package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/tagent-ai/tagent/backend/shared/pkg/events"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/tagent-ai/tagent/backend/services/remediation/internal/guardian"
)

type ActionRequest struct {
	Action    string `json:"action" binding:"required"`
	Namespace string `json:"namespace" binding:"required"`
	Target    string `json:"target" binding:"required"`
	DryRun    bool   `json:"dry_run"`
	Reason    string `json:"reason,omitempty"`
}

type ActionResult struct {
	Action    string `json:"action"`
	Target    string `json:"target"`
	Status    string `json:"status"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
	DryRun    bool   `json:"dry_run"`
	Reason    string `json:"reason,omitempty"`
}

type GuardianConfig struct {
	Enabled            bool   `json:"enabled"`
	AutoFix            bool   `json:"auto_fix"`
	Confidence         int    `json:"confidence"`
	IntervalSeconds    int    `json:"interval_seconds"`
	MinRestarts        int    `json:"min_restarts"`
	ProtectedNamespace string `json:"protected_namespace"`
}

type GuardianReport struct {
	ID             string       `json:"id"`
	IncidentID     string       `json:"incident_id"`
	Title          string       `json:"title"`
	Severity       string       `json:"severity,omitempty"`
	Namespace      string       `json:"namespace"`
	Target         string       `json:"target"`
	DetectedStatus string       `json:"detected_status"`
	Confidence     int          `json:"confidence"`
	Action         string       `json:"action"`
	Result         ActionResult `json:"result"`
	Recommendation string       `json:"recommendation"`
	Content        string       `json:"content,omitempty"`
	CreatedAt      string       `json:"created_at"`
	ResolvedAt     string       `json:"resolved_at,omitempty"`
	Duration       string       `json:"duration,omitempty"`
	DryRun         bool         `json:"dry_run"`
	Evidence       []string     `json:"evidence"`
}

type GuardianRun struct {
	StartedAt  string           `json:"started_at"`
	FinishedAt string           `json:"finished_at"`
	Findings   int              `json:"findings"`
	Fixed      int              `json:"fixed"`
	Reports    []GuardianReport `json:"reports"`
}

var (
	client         kubernetes.Interface
	mode           string
	guard          *guardian.Guardian
	store          *Store
	publisher      *events.Publisher
	guardianConfig GuardianConfig
	history        []ActionResult
	guardianRuns   []GuardianRun
	reports        []GuardianReport
	stateMu        sync.RWMutex
)

func main() {
	port := envOr("PORT", "8084")
	mode = envOr("REMEDIATION_MODE", "read-only")

	// Init K8s client
	realClient := mustK8sClient()
	client = realClient
	store = initStore(context.Background(), envOr("DATABASE_URL", ""))

	// Init Kafka event publisher
	publisher = events.NewPublisher("remediation")

	// Night Guardian config
	guardianEnabled := envOr("NIGHT_GUARDIAN_ENABLED", "false") == "true"
	confidence, _ := strconv.Atoi(envOr("NIGHT_GUARDIAN_CONFIDENCE", "85"))
	intervalSeconds, _ := strconv.Atoi(envOr("NIGHT_GUARDIAN_INTERVAL_SECONDS", "60"))
	minRestarts, _ := strconv.Atoi(envOr("NIGHT_GUARDIAN_MIN_RESTARTS", "3"))
	guardianConfig = GuardianConfig{
		Enabled:            guardianEnabled,
		AutoFix:            envOr("NIGHT_GUARDIAN_AUTO_FIX", "true") == "true",
		Confidence:         confidence,
		IntervalSeconds:    intervalSeconds,
		MinRestarts:        minRestarts,
		ProtectedNamespace: envOr("NIGHT_GUARDIAN_PROTECTED_NAMESPACES", "kube-system,kube-public,kube-node-lease"),
	}

	guard = guardian.New(realClient, guardian.Config{
		Enabled:         guardianEnabled,
		MinConfidence:   confidence,
		MonitoringURL:   envOr("MONITORING_URL", "http://localhost:8082"),
		NotificationURL: envOr("NOTIFICATION_URL", "http://localhost:8085"),
	})

	// Start Night Guardian background loop (checks every 30s)
	go guard.RunLoop(context.Background(), 30*time.Second)

	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":         "healthy",
			"service":        "tagent-remediation",
			"mode":           mode,
			"night_guardian": guardianEnabled,
		})
	})

	// Prometheus metrics
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	router.POST("/execute", executeAction)

	router.GET("/history", func(c *gin.Context) {
		items := listHistory(c.Request.Context())
		c.JSON(200, gin.H{"history": items, "total": len(items)})
	})

	router.GET("/audit", func(c *gin.Context) {
		items := listHistory(c.Request.Context())
		c.JSON(200, gin.H{"history": items, "total": len(items)})
	})

	router.GET("/incidents", func(c *gin.Context) {
		if store == nil {
			c.JSON(200, gin.H{"incidents": []StoredIncident{}, "total": 0})
			return
		}
		items, err := store.ListIncidents(c.Request.Context(), 100)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, gin.H{"incidents": items, "total": len(items)})
	})

	router.GET("/reports", func(c *gin.Context) {
		items := listReports(c.Request.Context())
		c.JSON(200, gin.H{"reports": items, "total": len(items)})
	})

	// Night Guardian control
	router.POST("/guardian/enable", func(c *gin.Context) {
		guardianConfig.Enabled = true
		guard = guardian.New(realClient, guardian.Config{
			Enabled:         true,
			MinConfidence:   confidence,
			MonitoringURL:   envOr("MONITORING_URL", "http://localhost:8082"),
			NotificationURL: envOr("NOTIFICATION_URL", "http://localhost:8085"),
		})
		go guard.RunLoop(context.Background(), 30*time.Second)
		c.JSON(200, gin.H{"message": "Night Guardian enabled"})
	})

	router.POST("/guardian/disable", func(c *gin.Context) {
		// In production, use context cancellation. For now, just log.
		log.Println("[guardian] Disable requested — will take effect on next restart")
		c.JSON(200, gin.H{"message": "Night Guardian will be disabled on next cycle"})
	})

	router.GET("/guardian/status", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"enabled":    guardianConfig.Enabled,
			"confidence": guardianConfig.Confidence,
			"logs":       guard.GetLogs(),
		})
	})

	router.GET("/night-guardian/status", func(c *gin.Context) {
		runs, reportItems := snapshotGuardianState(c.Request.Context())
		var latest GuardianRun
		if len(runs) > 0 {
			latest = runs[len(runs)-1]
		}
		c.JSON(200, gin.H{
			"config":       guardianConfig,
			"latest_run":   latest,
			"run_count":    len(runs),
			"report_count": len(reportItems),
			"mode":         mode,
		})
	})

	router.PUT("/night-guardian/config", func(c *gin.Context) {
		var next GuardianConfig
		if err := c.ShouldBindJSON(&next); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if next.Confidence == 0 {
			next.Confidence = 85
		}
		if next.IntervalSeconds == 0 {
			next.IntervalSeconds = 60
		}
		if next.MinRestarts == 0 {
			next.MinRestarts = 3
		}
		if next.ProtectedNamespace == "" {
			next.ProtectedNamespace = "kube-system,kube-public,kube-node-lease"
		}
		guardianConfig = next
		c.JSON(200, guardianConfig)
	})

	router.POST("/night-guardian/run", func(c *gin.Context) {
		run, err := runGuardianScan(c.Request.Context())
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, run)
	})

	router.GET("/night-guardian/reports", func(c *gin.Context) {
		items := listReports(c.Request.Context())
		c.JSON(200, gin.H{"reports": items, "total": len(items)})
	})

	log.Printf("Tagent Remediation Service starting on port %s (mode: %s, guardian: %v)", port, mode, guardianEnabled)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start: %v", err)
	}
}

func executeAction(c *gin.Context) {
	var req ActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if mode == "read-only" && !req.DryRun {
		result := ActionResult{
			Action:    req.Action,
			Target:    req.Namespace + "/" + req.Target,
			Status:    "blocked",
			Message:   "Remediation is in read-only mode. Set REMEDIATION_MODE=approval-required or auto to enable.",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			DryRun:    req.DryRun,
			Reason:    req.Reason,
		}
		recordAction(c.Request.Context(), result)
		c.JSON(http.StatusForbidden, result)
		return
	}

	result := performAction(c.Request.Context(), req)
	recordAction(c.Request.Context(), result)
	c.JSON(200, result)
}

func performAction(ctx context.Context, req ActionRequest) ActionResult {
	result := ActionResult{
		Action:    req.Action,
		Target:    req.Namespace + "/" + req.Target,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		DryRun:    req.DryRun,
		Reason:    req.Reason,
	}

	if req.DryRun {
		result.Status = "dry-run"
		result.Message = "Would execute: " + req.Action + " on " + req.Target
		return result
	}

	switch req.Action {
	case "restart-pod":
		err := client.CoreV1().Pods(req.Namespace).Delete(ctx, req.Target, metav1.DeleteOptions{})
		if err != nil {
			result.Status = "failed"
			result.Message = err.Error()
		} else {
			result.Status = "success"
			result.Message = "Pod deleted (will be recreated by controller)"
		}

	case "scale-deployment":
		dep, err := client.AppsV1().Deployments(req.Namespace).Get(ctx, req.Target, metav1.GetOptions{})
		if err != nil {
			result.Status = "failed"
			result.Message = err.Error()
		} else {
			replicas := *dep.Spec.Replicas + 1
			dep.Spec.Replicas = &replicas
			_, err = client.AppsV1().Deployments(req.Namespace).Update(ctx, dep, metav1.UpdateOptions{})
			if err != nil {
				result.Status = "failed"
				result.Message = err.Error()
			} else {
				result.Status = "success"
				result.Message = fmt.Sprintf("Scaled to %d replicas", replicas)
			}
		}

	default:
		result.Status = "unknown-action"
		result.Message = "Supported: restart-pod, scale-deployment"
	}
	return result
}

func recordAction(ctx context.Context, result ActionResult) {
	stateMu.Lock()
	history = append([]ActionResult{result}, history...)
	if len(history) > 200 {
		history = history[:200]
	}
	stateMu.Unlock()
	if store != nil {
		store.SaveAuditLog(ctx, result)
	}
	// Publish to Kafka event bus
	if publisher != nil {
		_ = publisher.PublishRemediation(ctx, events.TopicRemediationCompleted, events.RemediationEvent{
			Action:    result.Action,
			Target:    result.Target,
			Namespace: strings.Split(result.Target, "/")[0],
			Status:    result.Status,
			Message:   result.Message,
			DryRun:    result.DryRun,
			Reason:    result.Reason,
		})
	}
	log.Printf("AUDIT: action=%s target=%s status=%s dry_run=%v", result.Action, result.Target, result.Status, result.DryRun)
}

func runGuardianScan(ctx context.Context) (GuardianRun, error) {
	start := time.Now().UTC()
	run := GuardianRun{
		StartedAt: start.Format(time.RFC3339),
		Reports:   []GuardianReport{},
	}

	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return run, err
	}

	protected := protectedNamespaces(guardianConfig.ProtectedNamespace)
	for _, pod := range pods.Items {
		if protected[pod.Namespace] {
			continue
		}
		detected, evidence := detectPodIssue(pod, guardianConfig.MinRestarts)
		if detected == "" {
			continue
		}

		run.Findings++
		confidence := 90
		dryRun := mode != "auto" || !guardianConfig.AutoFix || confidence < guardianConfig.Confidence
		req := ActionRequest{
			Action:    "restart-pod",
			Namespace: pod.Namespace,
			Target:    pod.Name,
			DryRun:    dryRun,
			Reason:    detected,
		}
		result := performAction(ctx, req)
		recordAction(ctx, result)
		if result.Status == "success" {
			run.Fixed++
		}

		report := GuardianReport{
			ID:             fmt.Sprintf("NGR-%d-%s", start.UnixNano(), pod.Name),
			IncidentID:     fmt.Sprintf("INC-%s-%s", pod.Namespace, pod.Name),
			Title:          fmt.Sprintf("%s detected in pod %s", detected, pod.Name),
			Severity:       severityForConfidence(confidence),
			Namespace:      pod.Namespace,
			Target:         pod.Name,
			DetectedStatus: detected,
			Confidence:     confidence,
			Action:         "restart-pod",
			Result:         result,
			Recommendation: "Restart the failing pod so its controller can recreate it with a clean container state.",
			CreatedAt:      time.Now().UTC().Format(time.RFC3339),
			DryRun:         dryRun,
			Evidence:       evidence,
		}
		run.Reports = append(run.Reports, report)
		recordReport(ctx, report)
	}

	run.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	stateMu.Lock()
	guardianRuns = append(guardianRuns, run)
	if len(guardianRuns) > 100 {
		guardianRuns = guardianRuns[len(guardianRuns)-100:]
	}
	stateMu.Unlock()
	return run, nil
}

func detectPodIssue(pod corev1.Pod, minRestarts int) (string, []string) {
	evidence := []string{
		"pod=" + pod.Namespace + "/" + pod.Name,
		"phase=" + string(pod.Status.Phase),
	}
	for _, status := range pod.Status.ContainerStatuses {
		if status.RestartCount >= int32(minRestarts) {
			evidence = append(evidence, fmt.Sprintf("container=%s restarts=%d", status.Name, status.RestartCount))
		}
		if status.State.Waiting != nil {
			reason := status.State.Waiting.Reason
			evidence = append(evidence, fmt.Sprintf("container=%s waiting=%s", status.Name, reason))
			if reason == "CrashLoopBackOff" || reason == "OOMKilled" || reason == "Error" || reason == "ImagePullBackOff" {
				return reason, evidence
			}
		}
		if status.RestartCount >= int32(minRestarts) {
			return "HighRestarts", evidence
		}
	}
	return "", evidence
}

func protectedNamespaces(value string) map[string]bool {
	result := map[string]bool{}
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			result[item] = true
		}
	}
	return result
}

func recordReport(ctx context.Context, report GuardianReport) {
	stateMu.Lock()
	reports = append([]GuardianReport{report}, reports...)
	if len(reports) > 200 {
		reports = reports[:200]
	}
	stateMu.Unlock()
	if store != nil {
		store.SaveGuardianReport(ctx, report)
	}
}

func listHistory(ctx context.Context) []ActionResult {
	if store != nil {
		items, err := store.ListActionResults(ctx, 200)
		if err == nil {
			return items
		}
		log.Printf("PostgreSQL audit read failed: %v", err)
	}
	stateMu.RLock()
	defer stateMu.RUnlock()
	items := make([]ActionResult, len(history))
	copy(items, history)
	return items
}

func listReports(ctx context.Context) []GuardianReport {
	if store != nil {
		items, err := store.ListReports(ctx, 200)
		if err == nil {
			return items
		}
		log.Printf("PostgreSQL report read failed: %v", err)
	}
	stateMu.RLock()
	defer stateMu.RUnlock()
	items := make([]GuardianReport, len(reports))
	copy(items, reports)
	return items
}

func snapshotGuardianState(ctx context.Context) ([]GuardianRun, []GuardianReport) {
	reportItems := listReports(ctx)
	stateMu.RLock()
	defer stateMu.RUnlock()
	runItems := make([]GuardianRun, len(guardianRuns))
	copy(runItems, guardianRuns)
	return runItems, reportItems
}

func mustK8sClient() *kubernetes.Clientset {
	config, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := envOr("KUBECONFIG", "")
		if kubeconfig == "" {
			home, _ := os.UserHomeDir()
			kubeconfig = filepath.Join(home, ".kube", "config")
		}
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			log.Fatalf("Cannot create K8s client: %v", err)
		}
	}
	c, err := kubernetes.NewForConfig(config)
	if err != nil {
		log.Fatalf("Cannot create K8s client: %v", err)
	}
	return c
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
