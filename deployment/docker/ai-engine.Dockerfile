# ===== Stage 1: Build dependencies =====
FROM python:3.15-slim AS builder

WORKDIR /build

# Install deps in a virtual env (isolates from system)
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/services/ai-engine/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ===== Stage 2: Production =====
FROM python:3.15-slim

LABEL org.opencontainers.image.title="Tagent AI Engine" \
    org.opencontainers.image.description="AI-Powered Kubernetes SRE Platform — AI Engine (Local LLM)" \
    org.opencontainers.image.vendor="Tagent" \
    org.opencontainers.image.source="https://github.com/Tagent-dev/Tagent" \
    org.opencontainers.image.licenses="Apache-2.0"

# Security: create non-root user
RUN groupadd --gid 1001 tagent && \
    useradd --uid 1001 --gid 1001 --shell /bin/false --create-home tagent

# Copy virtual env from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
WORKDIR /app
COPY backend/services/ai-engine/ .

# Create plugin directory (writable by app)
RUN mkdir -p /data/plugins && chown tagent:tagent /data/plugins

# Security: drop to non-root user
USER tagent:tagent

EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8083/health')" || exit 1

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8083", "--workers", "2"]
