"""Plugin Manager — loads, runs, and manages Tagent plugins.

Plugins are discovered from:
1. Built-in plugins in app/plugins/builtin/
2. User plugins uploaded via API (stored in /data/plugins/)
3. Plugins registered at runtime

The manager runs all enabled detector plugins every 15 seconds
(same cycle as predictive data collection) and collects their detections.
"""

import importlib
import importlib.util
import os
import time
import traceback
from pathlib import Path

from app.plugins.sdk import (
    ActionPlugin,
    AnalyzerPlugin,
    DetectorPlugin,
    PluginInfo,
)

# Directories for plugin discovery
BUILTIN_DIR = Path(__file__).parent / "builtin"
USER_PLUGIN_DIR = Path(os.getenv("TAGENT_PLUGIN_DIR", "/data/plugins"))


class PluginManager:
    """Manages the lifecycle of all plugins."""

    def __init__(self):
        self.detectors: dict[str, DetectorPlugin] = {}
        self.analyzers: dict[str, AnalyzerPlugin] = {}
        self.actions: dict[str, ActionPlugin] = {}
        self.info: dict[str, PluginInfo] = {}
        self.detections: list[dict] = []  # Recent detections from all plugins
        self._load_builtin_plugins()
        self._load_user_plugins()

    def _load_builtin_plugins(self):
        """Load built-in plugins from builtin/ directory."""
        if not BUILTIN_DIR.exists():
            BUILTIN_DIR.mkdir(parents=True, exist_ok=True)
            return

        for file in BUILTIN_DIR.glob("*.py"):
            if file.name.startswith("_"):
                continue
            self._load_plugin_file(file, source="builtin")

    def _load_user_plugins(self):
        """Load user-uploaded plugins."""
        if not USER_PLUGIN_DIR.exists():
            return

        for file in USER_PLUGIN_DIR.glob("*.py"):
            if file.name.startswith("_"):
                continue
            self._load_plugin_file(file, source="user")

    def _load_plugin_file(self, path: Path, source: str = "unknown"):
        """Load a single plugin file and register any plugin classes found."""
        try:
            spec = importlib.util.spec_from_file_location(f"tagent_plugin_{path.stem}", path)
            if spec is None or spec.loader is None:
                return
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Find plugin classes in the module
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if not isinstance(attr, type):
                    continue
                if attr in (DetectorPlugin, AnalyzerPlugin, ActionPlugin):
                    continue

                if issubclass(attr, DetectorPlugin):
                    instance = attr()
                    instance.on_load()
                    self.register_detector(instance, source)
                elif issubclass(attr, AnalyzerPlugin):
                    instance = attr()
                    self.register_analyzer(instance, source)
                elif issubclass(attr, ActionPlugin):
                    instance = attr()
                    self.register_action(instance, source)

        except Exception as e:
            print(f"[plugins] Failed to load {path.name}: {e}")
            traceback.print_exc()

    def register_detector(self, plugin: DetectorPlugin, source: str = "api"):
        """Register a detector plugin."""
        self.detectors[plugin.name] = plugin
        self.info[plugin.name] = PluginInfo(
            name=plugin.name,
            version=plugin.version,
            type="detector",
            description=plugin.description,
            author=plugin.author,
            enabled=plugin.enabled,
        )
        print(f"[plugins] Loaded detector: {plugin.name} v{plugin.version} ({source})")

    def register_analyzer(self, plugin: AnalyzerPlugin, source: str = "api"):
        """Register an analyzer plugin."""
        self.analyzers[plugin.name] = plugin
        self.info[plugin.name] = PluginInfo(
            name=plugin.name,
            version=plugin.version,
            type="analyzer",
            description=plugin.description,
            author=plugin.author,
            enabled=plugin.enabled,
        )
        print(f"[plugins] Loaded analyzer: {plugin.name} v{plugin.version} ({source})")

    def register_action(self, plugin: ActionPlugin, source: str = "api"):
        """Register an action plugin."""
        self.actions[plugin.name] = plugin
        self.info[plugin.name] = PluginInfo(
            name=plugin.name,
            version=plugin.version,
            type="action",
            description=plugin.description,
            author=plugin.author,
            enabled=plugin.enabled,
        )
        print(f"[plugins] Loaded action: {plugin.name} v{plugin.version} ({source})")

    def unload_plugin(self, name: str) -> bool:
        """Unload a plugin by name."""
        if name in self.detectors:
            self.detectors[name].on_unload()
            del self.detectors[name]
        elif name in self.analyzers:
            del self.analyzers[name]
        elif name in self.actions:
            del self.actions[name]
        else:
            return False
        del self.info[name]
        return True

    def enable_plugin(self, name: str) -> bool:
        """Enable a plugin."""
        if name in self.info:
            self.info[name].enabled = True
            if name in self.detectors:
                self.detectors[name].enabled = True
            elif name in self.analyzers:
                self.analyzers[name].enabled = True
            elif name in self.actions:
                self.actions[name].enabled = True
            return True
        return False

    def disable_plugin(self, name: str) -> bool:
        """Disable a plugin."""
        if name in self.info:
            self.info[name].enabled = False
            if name in self.detectors:
                self.detectors[name].enabled = False
            elif name in self.analyzers:
                self.analyzers[name].enabled = False
            elif name in self.actions:
                self.actions[name].enabled = False
            return True
        return False

    def run_detectors(self, cluster_data: dict) -> list[dict]:
        """Run all enabled detector plugins and return detections."""
        all_detections = []

        for name, detector in self.detectors.items():
            if not detector.enabled:
                continue

            info = self.info.get(name)
            try:
                detections = detector.detect(cluster_data)
                if info:
                    info.last_run = time.time()
                    info.detection_count += len(detections)
                    info.error = None

                for d in detections:
                    all_detections.append({
                        "plugin": name,
                        "title": d.title,
                        "severity": d.severity,
                        "service": d.service,
                        "namespace": d.namespace,
                        "evidence": d.evidence,
                        "recommendation": d.recommendation,
                        "metadata": d.metadata,
                        "detected_at": time.time(),
                    })
            except Exception as e:
                if info:
                    info.error = str(e)
                print(f"[plugins] Detector {name} error: {e}")

        # Store recent detections (last 100)
        self.detections = (all_detections + self.detections)[:100]
        return all_detections

    def run_analyzer(self, name: str, incident: dict, cluster_data: dict) -> dict | None:
        """Run a specific analyzer plugin."""
        analyzer = self.analyzers.get(name)
        if not analyzer or not analyzer.enabled:
            return None

        try:
            result = analyzer.analyze(incident, cluster_data)
            return {
                "plugin": name,
                "summary": result.summary,
                "severity": result.severity,
                "confidence": result.confidence,
                "recommendations": result.recommendations,
                "metadata": result.metadata,
            }
        except Exception as e:
            return {"plugin": name, "error": str(e)}

    def run_action(self, name: str, params: dict, dry_run: bool = False) -> dict | None:
        """Run a specific action plugin."""
        action = self.actions.get(name)
        if not action or not action.enabled:
            return None

        # Validate first
        valid, error = action.validate(params)
        if not valid:
            return {"plugin": name, "status": "validation_failed", "message": error}

        try:
            result = action.execute(params, dry_run=dry_run)
            return {
                "plugin": name,
                "status": result.status,
                "message": result.message,
                "metadata": result.metadata,
                "dry_run": dry_run,
            }
        except Exception as e:
            return {"plugin": name, "status": "error", "message": str(e)}

    def get_all_plugins(self) -> list[dict]:
        """Return info about all loaded plugins."""
        return [
            {
                "name": info.name,
                "version": info.version,
                "type": info.type,
                "description": info.description,
                "author": info.author,
                "enabled": info.enabled,
                "detection_count": info.detection_count,
                "last_run": info.last_run,
                "error": info.error,
            }
            for info in self.info.values()
        ]

    def get_recent_detections(self) -> list[dict]:
        """Return recent detections from all plugins."""
        return self.detections

    def install_from_code(self, code: str, filename: str) -> dict:
        """Install a plugin from Python source code."""
        # Save to user plugin directory
        USER_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
        filepath = USER_PLUGIN_DIR / filename
        filepath.write_text(code)

        # Load it
        before = set(self.info.keys())
        self._load_plugin_file(filepath, source="user-upload")
        after = set(self.info.keys())

        new_plugins = after - before
        if new_plugins:
            return {"status": "installed", "plugins": list(new_plugins), "file": filename}
        return {"status": "no_plugins_found", "file": filename}


# Singleton instance
plugin_manager = PluginManager()
