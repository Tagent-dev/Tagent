"""Plugin SDK router — manage and run community plugins.

Endpoints:
- GET    /plugins                → list all loaded plugins
- GET    /plugins/detections     → recent detections from plugins
- POST   /plugins/run-detectors  → manually trigger all detectors
- POST   /plugins/install        → install a plugin from source code
- POST   /plugins/enable/:name   → enable a plugin
- POST   /plugins/disable/:name  → disable a plugin
- DELETE /plugins/:name          → unload a plugin
- POST   /plugins/analyze        → run an analyzer plugin
- POST   /plugins/action         → run an action plugin
"""

import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.plugins.manager import plugin_manager

router = APIRouter()

DISCOVERY_URL = os.getenv("DISCOVERY_URL", "http://localhost:8081")


class InstallRequest(BaseModel):
    code: str  # Python source code
    filename: str  # e.g. "my_detector.py"


class AnalyzeRequest(BaseModel):
    plugin_name: str
    incident: dict


class ActionRequest(BaseModel):
    plugin_name: str
    params: dict
    dry_run: bool = False


async def get_cluster_data() -> dict:
    """Fetch current cluster state for plugins."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{DISCOVERY_URL}/resources")
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return {"pods": [], "nodes": [], "deployments": [], "services": [], "summary": {}}


@router.get("")
async def list_plugins():
    """List all loaded plugins."""
    plugins = plugin_manager.get_all_plugins()
    return {
        "plugins": plugins,
        "total": len(plugins),
        "detectors": len(plugin_manager.detectors),
        "analyzers": len(plugin_manager.analyzers),
        "actions": len(plugin_manager.actions),
    }


@router.get("/detections")
async def get_detections():
    """Get recent detections from all detector plugins."""
    detections = plugin_manager.get_recent_detections()
    return {"detections": detections, "total": len(detections)}


@router.post("/run-detectors")
async def run_detectors():
    """Manually trigger all detector plugins."""
    cluster_data = await get_cluster_data()
    detections = plugin_manager.run_detectors(cluster_data)
    return {
        "status": "complete",
        "detections": detections,
        "total": len(detections),
    }


@router.post("/install")
async def install_plugin(request: InstallRequest):
    """Install a plugin from Python source code.

    The code must contain at least one class that subclasses
    DetectorPlugin, AnalyzerPlugin, or ActionPlugin.
    """
    if not request.filename.endswith(".py"):
        raise HTTPException(status_code=400, detail="Filename must end with .py")

    # Basic safety checks
    dangerous_imports = ["subprocess", "shutil", "ctypes", "__import__"]
    for d in dangerous_imports:
        if d in request.code:
            raise HTTPException(status_code=400, detail=f"Plugin contains forbidden import/call: {d}")

    result = plugin_manager.install_from_code(request.code, request.filename)
    return result


@router.post("/enable/{name}")
async def enable_plugin(name: str):
    """Enable a disabled plugin."""
    if plugin_manager.enable_plugin(name):
        return {"status": "enabled", "name": name}
    raise HTTPException(status_code=404, detail="Plugin not found")


@router.post("/disable/{name}")
async def disable_plugin(name: str):
    """Disable a plugin (stops it from running)."""
    if plugin_manager.disable_plugin(name):
        return {"status": "disabled", "name": name}
    raise HTTPException(status_code=404, detail="Plugin not found")


@router.delete("/{name}")
async def unload_plugin(name: str):
    """Unload and remove a plugin."""
    if plugin_manager.unload_plugin(name):
        return {"status": "unloaded", "name": name}
    raise HTTPException(status_code=404, detail="Plugin not found")


@router.post("/analyze")
async def run_analyzer(request: AnalyzeRequest):
    """Run a specific analyzer plugin on an incident."""
    cluster_data = await get_cluster_data()
    result = plugin_manager.run_analyzer(request.plugin_name, request.incident, cluster_data)
    if result is None:
        raise HTTPException(status_code=404, detail="Analyzer not found or disabled")
    return result


@router.post("/action")
async def run_action(request: ActionRequest):
    """Run a specific action plugin."""
    result = plugin_manager.run_action(request.plugin_name, request.params, request.dry_run)
    if result is None:
        raise HTTPException(status_code=404, detail="Action not found or disabled")
    return result
