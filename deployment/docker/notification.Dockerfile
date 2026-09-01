# ===== Stage 1: Build =====
FROM golang:1.27-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build
COPY backend/services/notification/ ./services/notification/
COPY backend/shared/ ./shared/

WORKDIR /build/services/notification
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /tagent-notification ./cmd/server

# ===== Stage 2: Production (distroless) =====
FROM gcr.io/distroless/static-debian12:nonroot

LABEL org.opencontainers.image.title="Tagent Notification" \
    org.opencontainers.image.description="AI-Powered Kubernetes SRE Platform — Notification Service" \
    org.opencontainers.image.vendor="Tagent" \
    org.opencontainers.image.source="https://github.com/Tagent-dev/Tagent" \
    org.opencontainers.image.licenses="Apache-2.0"

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /tagent-notification /tagent-notification

USER nonroot:nonroot

EXPOSE 8085

ENTRYPOINT ["/tagent-notification"]
