# ===== Stage 1: Build =====
FROM golang:1.27-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build
COPY backend/services/monitoring/ ./services/monitoring/
COPY backend/shared/ ./shared/

WORKDIR /build/services/monitoring
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /tagent-monitoring ./cmd/server

# ===== Stage 2: Production (distroless) =====
FROM gcr.io/distroless/static-debian12:nonroot

LABEL org.opencontainers.image.title="Tagent Monitoring" \
    org.opencontainers.image.description="AI-Powered Kubernetes SRE Platform — Monitoring Service" \
    org.opencontainers.image.vendor="Tagent" \
    org.opencontainers.image.source="https://github.com/Tagent-dev/Tagent" \
    org.opencontainers.image.licenses="Apache-2.0"

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /tagent-monitoring /tagent-monitoring

USER nonroot:nonroot

EXPOSE 8082

ENTRYPOINT ["/tagent-monitoring"]
