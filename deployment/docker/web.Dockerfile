# ===== Stage 1: Install dependencies =====
FROM node:26-alpine AS deps
WORKDIR /app
COPY frontend/web/package.json ./
RUN npm install --legacy-peer-deps

# ===== Stage 2: Build =====
FROM node:26-alpine AS builder
WORKDIR /app
COPY frontend/web/package.json ./
RUN npm install --legacy-peer-deps
COPY frontend/web/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ===== Stage 3: Production =====
FROM node:26-alpine AS runner

LABEL org.opencontainers.image.title="Tagent Web" \
    org.opencontainers.image.description="AI-Powered Kubernetes SRE Platform — Web Dashboard" \
    org.opencontainers.image.vendor="Tagent" \
    org.opencontainers.image.source="https://github.com/Tagent-dev/Tagent" \
    org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Security: drop to non-root
USER nextjs:nodejs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/healthz || exit 1

CMD ["node", "server.js"]
