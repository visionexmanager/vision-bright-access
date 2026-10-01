# Build context: services/isp-management
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx tsc -p tsconfig.build.json
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci
COPY web ./web
RUN npm --prefix web run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
COPY migrations ./migrations
COPY package.json ./
# Unprivileged, and nothing writable: the root filesystem is mounted read-only by compose.
USER node
EXPOSE 8443
CMD ["node", "dist/main.js"]
