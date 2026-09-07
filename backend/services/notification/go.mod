module github.com/tagent-ai/tagent/backend/services/notification

go 1.24

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/prometheus/client_golang v1.19.0
	github.com/tagent-ai/tagent/backend/shared/pkg/events v0.0.0
	k8s.io/api v0.29.0
	k8s.io/apimachinery v0.29.0
	k8s.io/client-go v0.29.0
)

replace github.com/tagent-ai/tagent/backend/shared/pkg/events => ../../shared/pkg/events
