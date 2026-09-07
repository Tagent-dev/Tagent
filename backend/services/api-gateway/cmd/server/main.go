package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tagent-ai/tagent/backend/services/api-gateway/internal/cache"
	"github.com/tagent-ai/tagent/backend/services/api-gateway/internal/handlers"
	"github.com/tagent-ai/tagent/backend/services/api-gateway/internal/metrics"
	"github.com/tagent-ai/tagent/backend/services/api-gateway/internal/middleware"
	"github.com/tagent-ai/tagent/backend/services/api-gateway/internal/multicluster"
	"github.com/tagent-ai/tagent/backend/services/api-gateway/internal/ws"
)

var (
	discoveryURL   string
	monitoringURL  string
	aiEngineURL    string
	remediationURL string
	wsHub          *ws.Hub
)

func init() {
	discoveryURL = envOr("DISCOVERY_URL", "http://localhost:8081")
	monitoringURL = envOr("MONITORING_URL", "http://localhost:8082")
	aiEngineURL = envOr("AI_ENGINE_URL", "http://localhost:8083")
	remediationURL = envOr("REMEDIATION_URL", "http://localhost:8084")
}

func main() {
	port := envOr("PORT", "8080")

	router := gin.Default()

	// CORS
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "service": "tagent-api-gateway", "version": "0.2.0", "ws_clients": wsHub.ClientCount(), "redis": cache.IsConnected()})
	})
	router.GET("/ready", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ready"})
	})

	// ===== Prometheus Metrics =====
	router.Use(metrics.Middleware())
	router.GET("/metrics", metrics.Handler())

	// ===== Redis Init =====
	redisOk := cache.Init()
	if redisOk {
		log.Printf("  Redis:       connected")
	} else {
		log.Printf("  Redis:       disabled (caching + rate limiting off)")
	}

	// ===== Rate Limiting (Redis-backed) =====
	router.Use(middleware.RateLimit(middleware.DefaultRateLimitConfig()))

	// ===== Response Caching (Redis-backed, 15s TTL for GET requests) =====
	router.Use(middleware.ResponseCache(middleware.DefaultCacheConfig()))

	// ===== Redis Stats Endpoint =====
	router.GET("/api/v1/cache/stats", func(c *gin.Context) {
		c.JSON(200, cache.Stats(c.Request.Context()))
	})

	// ===== Session Endpoints =====
	router.POST("/api/v1/sessions", func(c *gin.Context) {
		var req struct {
			UserID   string `json:"user_id" binding:"required"`
			UserName string `json:"user_name" binding:"required"`
			Email    string `json:"email"`
			Role     string `json:"role"`
			IsAdmin  bool   `json:"is_admin"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		session := cache.Session{
			UserID:    req.UserID,
			UserName:  req.UserName,
			Email:     req.Email,
			Role:      req.Role,
			IsAdmin:   req.IsAdmin,
			IPAddress: c.ClientIP(),
		}
		sessionID, err := cache.CreateSession(c.Request.Context(), session)
		if err != nil {
			c.JSON(500, gin.H{"error": "failed to create session", "detail": err.Error()})
			return
		}
		c.JSON(201, gin.H{"session_id": sessionID, "expires_in": "24h"})
	})

	router.GET("/api/v1/sessions/:id", func(c *gin.Context) {
		session, err := cache.GetSession(c.Request.Context(), c.Param("id"))
		if err != nil {
			c.JSON(404, gin.H{"error": "session not found or expired"})
			return
		}
		c.JSON(200, session)
	})

	router.DELETE("/api/v1/sessions/:id", func(c *gin.Context) {
		cache.DeleteSession(c.Request.Context(), c.Param("id"))
		c.JSON(200, gin.H{"status": "deleted"})
	})

	// ===== Database & User Management =====
	databaseURL := envOr("DATABASE_URL", "")
	if databaseURL != "" {
		if err := handlers.InitDB(databaseURL); err != nil {
			log.Printf("WARNING: Database init failed (user management disabled): %v", err)
		} else {
			log.Printf("  Database:    connected")
		}
	} else {
		log.Printf("  Database:    disabled (DATABASE_URL not set)")
	}
	handlers.RegisterUserRoutes(router)

	// ===== Multi-Cluster Management =====
	clusterMgr := multicluster.New(handlers.GetDB())

	router.GET("/api/v1/fleet/clusters", func(c *gin.Context) {
		clusters := clusterMgr.GetClusters(c.Request.Context())
		c.JSON(200, gin.H{"clusters": clusters, "total": len(clusters)})
	})

	router.GET("/api/v1/fleet/summary", func(c *gin.Context) {
		summary := clusterMgr.GetFleetSummary(c.Request.Context())
		c.JSON(200, summary)
	})

	router.POST("/api/v1/fleet/clusters", func(c *gin.Context) {
		var req multicluster.ClusterInfo
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		if err := clusterMgr.RegisterCluster(req); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(201, gin.H{"status": "registered", "id": req.ID})
	})

	router.DELETE("/api/v1/fleet/clusters/:id", func(c *gin.Context) {
		if !clusterMgr.RemoveCluster(c.Param("id")) {
			c.JSON(404, gin.H{"error": "cluster not found or cannot be removed"})
			return
		}
		c.JSON(200, gin.H{"status": "removed"})
	})

	// WebSocket endpoint for live updates
	wsHub = ws.NewHub()
	router.GET("/ws", func(c *gin.Context) {
		wsHub.HandleConnection(c.Writer, c.Request)
	})

	// Start background poller to broadcast new incidents
	poller := ws.NewPoller(wsHub, monitoringURL, 5*time.Second)
	go poller.Run()

	// ===== Discovery Service =====
	router.GET("/api/v1/clusters", proxyGet(discoveryURL, "/summary"))
	router.GET("/api/v1/cluster-info", proxyGet(discoveryURL, "/cluster-info"))
	router.GET("/api/v1/resources", proxyGet(discoveryURL, "/resources"))
	router.GET("/api/v1/nodes", proxyGet(discoveryURL, "/nodes"))
	router.GET("/api/v1/nodes/:name", func(c *gin.Context) {
		resp, err := http.Get(discoveryURL + "/nodes/" + c.Param("name"))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.GET("/api/v1/nodes/:name/cloud", func(c *gin.Context) {
		resp, err := http.Get(discoveryURL + "/nodes/" + c.Param("name") + "/cloud")
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.GET("/api/v1/pods", proxyGetWithQuery(discoveryURL, "/pods"))
	router.GET("/api/v1/deployments", proxyGet(discoveryURL, "/deployments"))
	router.GET("/api/v1/services", proxyGet(discoveryURL, "/services"))
	router.POST("/api/v1/scan", proxyPost(discoveryURL, "/scan"))

	// ===== AI Engine =====
	router.POST("/api/v1/ai/chat", proxyPost(aiEngineURL, "/api/v1/ai/chat"))
	router.POST("/api/v1/ai/analyze", proxyPost(aiEngineURL, "/api/v1/ai/analyze"))
	router.POST("/api/v1/ai/rca", proxyPost(aiEngineURL, "/api/v1/ai/rca"))

	// ===== Morning Briefing (served by AI Engine) =====
	router.GET("/api/v1/briefing/latest", proxyGet(aiEngineURL, "/api/v1/briefing/latest"))
	router.POST("/api/v1/briefing/generate", proxyPost(aiEngineURL, "/api/v1/briefing/generate"))
	router.GET("/api/v1/briefing/history", proxyGet(aiEngineURL, "/api/v1/briefing/history"))

	// ===== Knowledge Base (served by AI Engine) =====
	router.GET("/api/v1/knowledge/entries", proxyGetWithQuery(aiEngineURL, "/api/v1/knowledge/entries"))
	router.GET("/api/v1/knowledge/stats", proxyGet(aiEngineURL, "/api/v1/knowledge/stats"))
	router.POST("/api/v1/knowledge/search", proxyPost(aiEngineURL, "/api/v1/knowledge/search"))
	router.POST("/api/v1/knowledge/ingest", proxyPost(aiEngineURL, "/api/v1/knowledge/ingest"))
	router.POST("/api/v1/knowledge/auto-ingest", proxyPost(aiEngineURL, "/api/v1/knowledge/auto-ingest"))
	router.POST("/api/v1/knowledge/recommend", proxyPost(aiEngineURL, "/api/v1/knowledge/recommend"))
	router.PUT("/api/v1/knowledge/feedback", proxyPut(aiEngineURL, "/api/v1/knowledge/feedback"))

	// ===== Risk Scoring (served by AI Engine) =====
	router.GET("/api/v1/risks/scores", proxyGet(aiEngineURL, "/api/v1/risks/scores"))
	router.GET("/api/v1/risks/summary", proxyGet(aiEngineURL, "/api/v1/risks/summary"))
	router.GET("/api/v1/risks/predictions", proxyGet(aiEngineURL, "/api/v1/risks/predictions"))
	router.POST("/api/v1/risks/analyze", proxyPost(aiEngineURL, "/api/v1/risks/analyze"))

	// ===== Predictive Detection (served by AI Engine) =====
	router.GET("/api/v1/predictive/predictions", proxyGet(aiEngineURL, "/api/v1/predictive/predictions"))
	router.GET("/api/v1/predictive/stats", proxyGet(aiEngineURL, "/api/v1/predictive/stats"))
	router.POST("/api/v1/predictive/explain", proxyPost(aiEngineURL, "/api/v1/predictive/explain"))
	router.POST("/api/v1/predictive/collect", proxyPost(aiEngineURL, "/api/v1/predictive/collect"))

	// ===== Plugin SDK (served by AI Engine) =====
	router.GET("/api/v1/plugins", proxyGet(aiEngineURL, "/api/v1/plugins"))
	router.GET("/api/v1/plugins/detections", proxyGet(aiEngineURL, "/api/v1/plugins/detections"))
	router.POST("/api/v1/plugins/run-detectors", proxyPost(aiEngineURL, "/api/v1/plugins/run-detectors"))
	router.POST("/api/v1/plugins/install", proxyPost(aiEngineURL, "/api/v1/plugins/install"))
	router.POST("/api/v1/plugins/enable/:name", func(c *gin.Context) {
		reqBody, _ := io.ReadAll(c.Request.Body)
		resp, err := http.Post(aiEngineURL+"/api/v1/plugins/enable/"+c.Param("name"), "application/json", strings.NewReader(string(reqBody)))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.POST("/api/v1/plugins/disable/:name", func(c *gin.Context) {
		reqBody, _ := io.ReadAll(c.Request.Body)
		resp, err := http.Post(aiEngineURL+"/api/v1/plugins/disable/"+c.Param("name"), "application/json", strings.NewReader(string(reqBody)))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.DELETE("/api/v1/plugins/:name", func(c *gin.Context) {
		req, _ := http.NewRequest(http.MethodDelete, aiEngineURL+"/api/v1/plugins/"+c.Param("name"), nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.POST("/api/v1/plugins/analyze", proxyPost(aiEngineURL, "/api/v1/plugins/analyze"))
	router.POST("/api/v1/plugins/action", proxyPost(aiEngineURL, "/api/v1/plugins/action"))

	// ===== AI Model Management (served by AI Engine) =====
	router.GET("/api/v1/models/catalog", proxyGet(aiEngineURL, "/api/v1/models/catalog"))
	router.GET("/api/v1/models/installed", proxyGet(aiEngineURL, "/api/v1/models/installed"))
	router.GET("/api/v1/models/active", proxyGet(aiEngineURL, "/api/v1/models/active"))
	router.POST("/api/v1/models/pull", proxyPost(aiEngineURL, "/api/v1/models/pull"))
	router.GET("/api/v1/models/pull/status/*modelPath", func(c *gin.Context) {
		modelPath := strings.TrimPrefix(c.Param("modelPath"), "/")
		resp, err := http.Get(aiEngineURL + "/api/v1/models/pull/status/" + modelPath)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.POST("/api/v1/models/switch", proxyPost(aiEngineURL, "/api/v1/models/switch"))
	router.POST("/api/v1/models/delete", proxyPost(aiEngineURL, "/api/v1/models/delete"))

	// ===== Cloud LLM API Keys (optional BYOK, served by AI Engine) =====
	router.POST("/api/v1/models/cloud/key", proxyPost(aiEngineURL, "/api/v1/models/cloud/key"))
	router.GET("/api/v1/models/cloud/keys", proxyGet(aiEngineURL, "/api/v1/models/cloud/keys"))
	router.DELETE("/api/v1/models/cloud/key/:provider", func(c *gin.Context) {
		req, _ := http.NewRequest(http.MethodDelete, aiEngineURL+"/api/v1/models/cloud/key/"+c.Param("provider"), nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})

	// ===== Monitoring =====
	router.GET("/api/v1/metrics/summary", proxyGet(monitoringURL, "/summary"))
	router.GET("/api/v1/metrics/cpu", proxyGet(monitoringURL, "/metrics/cpu"))
	router.GET("/api/v1/metrics/memory", proxyGet(monitoringURL, "/metrics/memory"))
	router.GET("/api/v1/metrics/network", proxyGet(monitoringURL, "/metrics/network"))
	router.GET("/api/v1/metrics/traffic", proxyGet(monitoringURL, "/metrics/traffic"))
	router.GET("/api/v1/metrics/node/:name", func(c *gin.Context) {
		url := monitoringURL + "/metrics/node/" + c.Param("name")
		if c.Request.URL.RawQuery != "" {
			url += "?" + c.Request.URL.RawQuery
		}
		resp, err := http.Get(url)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.POST("/api/v1/logs/search", proxyPost(monitoringURL, "/logs/search"))
	router.GET("/api/v1/traces", proxyGetWithQuery(monitoringURL, "/traces"))
	router.GET("/api/v1/traces/services", proxyGet(monitoringURL, "/traces/services"))
	router.GET("/api/v1/traces/:id", func(c *gin.Context) {
		resp, err := http.Get(monitoringURL + "/traces/" + c.Param("id"))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})

	// ===== Notification =====
	notificationURL := envOr("NOTIFICATION_URL", "http://localhost:8085")
	router.POST("/api/v1/notify", proxyPost(notificationURL, "/notify"))
	router.POST("/api/v1/notify/test/slack", proxyPost(notificationURL, "/test/slack"))
	router.POST("/api/v1/notify/test/email", proxyPost(notificationURL, "/test/email"))

	// ===== Escalation Chain =====
	router.GET("/api/v1/escalation/config", proxyGet(notificationURL, "/escalation/config"))
	router.PUT("/api/v1/escalation/config", proxyPut(notificationURL, "/escalation/config"))
	router.POST("/api/v1/escalation/trigger", proxyPost(notificationURL, "/escalation/trigger"))
	router.POST("/api/v1/escalation/acknowledge", proxyPost(notificationURL, "/escalation/acknowledge"))
	router.GET("/api/v1/escalation/active", proxyGet(notificationURL, "/escalation/active"))
	router.GET("/api/v1/escalation/history", proxyGet(notificationURL, "/escalation/history"))

	// ===== Integrations (served by Notification Service) =====
	router.GET("/api/v1/integrations", proxyGet(notificationURL, "/integrations"))
	router.GET("/api/v1/integrations/health", proxyGet(notificationURL, "/integrations/health"))
	router.GET("/api/v1/integrations/:id", func(c *gin.Context) {
		resp, err := http.Get(notificationURL + "/integrations/" + c.Param("id"))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.POST("/api/v1/integrations/:id/test", func(c *gin.Context) {
		resp, err := http.Post(notificationURL+"/integrations/"+c.Param("id")+"/test", "application/json", nil)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})

	// Integration Config (K8s Secrets management)
	router.GET("/api/v1/integrations/config", proxyGet(notificationURL, "/integrations/config"))
	router.GET("/api/v1/integrations/config/:id", func(c *gin.Context) {
		resp, err := http.Get(notificationURL + "/integrations/config/" + c.Param("id"))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.POST("/api/v1/integrations/config/:id", func(c *gin.Context) {
		reqBody, _ := io.ReadAll(c.Request.Body)
		resp, err := http.Post(notificationURL+"/integrations/config/"+c.Param("id"), "application/json", strings.NewReader(string(reqBody)))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})
	router.DELETE("/api/v1/integrations/config/:id", func(c *gin.Context) {
		req, _ := http.NewRequest(http.MethodDelete, notificationURL+"/integrations/config/"+c.Param("id"), nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	})

	// ===== Remediation =====
	router.POST("/api/v1/remediation/execute", proxyPost(remediationURL, "/execute"))
	router.GET("/api/v1/remediation/history", proxyGet(remediationURL, "/history"))
	router.GET("/api/v1/remediation/audit", proxyGet(remediationURL, "/audit"))
	router.POST("/api/v1/guardian/enable", proxyPost(remediationURL, "/guardian/enable"))
	router.POST("/api/v1/guardian/disable", proxyPost(remediationURL, "/guardian/disable"))
	router.GET("/api/v1/guardian/status", proxyGet(remediationURL, "/guardian/status"))
	router.GET("/api/v1/night-guardian/status", proxyGet(remediationURL, "/night-guardian/status"))
	router.PUT("/api/v1/night-guardian/config", proxyPut(remediationURL, "/night-guardian/config"))
	router.POST("/api/v1/night-guardian/run", proxyPost(remediationURL, "/night-guardian/run"))
	router.GET("/api/v1/night-guardian/reports", proxyGet(remediationURL, "/night-guardian/reports"))

	// ===== Incidents (from Monitoring Service detector) =====
	router.GET("/api/v1/incidents/stored", proxyGet(remediationURL, "/incidents"))
	router.GET("/api/v1/incidents", proxyGet(monitoringURL, "/incidents"))
	router.GET("/api/v1/incidents/:id", func(c *gin.Context) {
		id := c.Param("id")

		// Try monitoring service first (live incidents)
		resp, err := http.Get(monitoringURL + "/incidents")
		if err == nil {
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			var result struct {
				Incidents []map[string]interface{} `json:"incidents"`
			}
			if err := json.Unmarshal(body, &result); err == nil {
				for _, inc := range result.Incidents {
					if incID, ok := inc["id"].(string); ok && incID == id {
						c.JSON(200, inc)
						return
					}
				}
			}
		}

		// Try remediation service (stored incidents in PostgreSQL)
		resp2, err := http.Get(remediationURL + "/incidents")
		if err == nil {
			defer resp2.Body.Close()
			body, _ := io.ReadAll(resp2.Body)
			var result struct {
				Incidents []map[string]interface{} `json:"incidents"`
			}
			if err := json.Unmarshal(body, &result); err == nil {
				for _, inc := range result.Incidents {
					if incID, ok := inc["id"].(string); ok && incID == id {
						c.JSON(200, inc)
						return
					}
				}
			}
		}

		c.JSON(404, gin.H{"error": "incident not found", "id": id})
	})

	// ===== Reports (from PostgreSQL-backed remediation service) =====
	router.GET("/api/v1/reports", proxyGet(aiEngineURL, "/api/v1/reports"))
	router.GET("/api/v1/reports/:id", func(c *gin.Context) {
		// Try AI engine reports first (auto-generated)
		resp, err := http.Get(aiEngineURL + "/api/v1/reports/" + c.Param("id"))
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 {
				body, _ := io.ReadAll(resp.Body)
				c.Data(200, "application/json", body)
				return
			}
		}
		c.JSON(404, gin.H{"error": "report not found", "id": c.Param("id")})
	})
	router.GET("/api/v1/reports/:id/pdf", func(c *gin.Context) {
		resp, err := http.Get(aiEngineURL + "/api/v1/reports/" + c.Param("id") + "/pdf")
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable"})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "text/html", body)
	})
	router.POST("/api/v1/reports/generate", proxyPost(aiEngineURL, "/api/v1/reports/generate"))
	router.POST("/api/v1/reports/generate-all", proxyPost(aiEngineURL, "/api/v1/reports/generate-all"))

	// ===== Autoscaling (from Discovery Service) =====
	router.GET("/api/v1/autoscaling", proxyGet(discoveryURL, "/autoscaling"))

	// ===== Cost (placeholder) =====
	router.GET("/api/v1/cost/summary", proxyGet(discoveryURL, "/cost/summary"))

	// Chaos Testing feature removed.

	// ===== Audit (reads from remediation history) =====
	router.GET("/api/v1/audit", proxyGet(remediationURL, "/audit"))

	// ===== Events Stream (from Notification Service Kafka consumer) =====
	router.GET("/api/v1/events/recent", proxyGet(notificationURL, "/events/recent"))

	// ===== Logs (from Discovery Service — reads pod logs via K8s API) =====
	router.GET("/api/v1/logs", proxyGetWithQuery(discoveryURL, "/logs"))

	log.Printf("Tagent API Gateway starting on port %s", port)
	log.Printf("  Discovery:   %s", discoveryURL)
	log.Printf("  Monitoring:  %s", monitoringURL)
	log.Printf("  AI Engine:   %s", aiEngineURL)
	log.Printf("  Remediation: %s", remediationURL)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start: %v", err)
	}
}

func proxyGet(upstream, path string) gin.HandlerFunc {
	return func(c *gin.Context) {
		resp, err := http.Get(upstream + path)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable", "service": upstream})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	}
}

func proxyGetWithQuery(upstream, path string) gin.HandlerFunc {
	return func(c *gin.Context) {
		url := upstream + path
		if c.Request.URL.RawQuery != "" {
			url += "?" + c.Request.URL.RawQuery
		}
		resp, err := http.Get(url)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable", "service": upstream})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	}
}

func proxyPost(upstream, path string) gin.HandlerFunc {
	return func(c *gin.Context) {
		reqBody, _ := io.ReadAll(c.Request.Body)
		resp, err := http.Post(upstream+path, "application/json", strings.NewReader(string(reqBody)))
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable", "service": upstream})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	}
}

func proxyPut(upstream, path string) gin.HandlerFunc {
	return func(c *gin.Context) {
		reqBody, _ := io.ReadAll(c.Request.Body)
		req, err := http.NewRequest(http.MethodPut, upstream+path, strings.NewReader(string(reqBody)))
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			c.JSON(502, gin.H{"error": "upstream unreachable", "service": upstream})
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", body)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
