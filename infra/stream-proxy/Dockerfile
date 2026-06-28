# ── Build stage ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production stage ─────────────────────────────────────────────
FROM node:22-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S visionex && adduser -u 1001 -S proxy -G visionex

WORKDIR /app

# Only copy production runtime files
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER proxy

EXPOSE 8080

ENV NODE_ENV=production \
    PORT=8080

# Liveness probe entrypoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('node:http').get('http://localhost:8080/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
