# Local dev/preview parity image for the Career Center frontend (and the
# rest of the Vite SPA, since it's one build). This is NOT the production
# deploy path — the real pipeline (.github/workflows/deploy.yml) pushes a
# built `dist/` to a self-managed VPS via webhook, no container involved.
# This Dockerfile exists so `docker compose -f infrastructure/docker/
# docker-compose.dev.yml up` gives a byte-for-byte reproducible preview of
# the production build without needing a local Node install.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN nginx -t
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1
