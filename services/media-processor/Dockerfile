# The local processing service: what Visionex can do to a file without sending
# it anywhere.
#
# ── Why a container and not just apt on the host ────────────────────────────
#
# Everything installed below parses hostile input for a living. Tesseract reads
# whatever bytes it is handed; ffmpeg has a demuxer for almost every container
# format ever shipped; zbar decodes arbitrary images. That is a large parsing
# surface, and it is being pointed at files that arrived from the internet.
#
# The host runs the live website. Isolating this from it is the whole reason the
# audit called sandboxing a requirement rather than a nicety: a bug in a decoder
# should cost a container, not visionex.app.
#
# ── Debian rather than Alpine ───────────────────────────────────────────────
#
# Alpine would be smaller, but Tesseract's language data packaging is better on
# Debian and the Arabic model is what this channel actually needs. A hundred
# megabytes is not worth a worse `ara.traineddata`.

FROM node:22-bookworm-slim

# ── The tools ────────────────────────────────────────────────────────────────
#
# tesseract-ocr-ara is the one that matters here. Arabic is the language most of
# this channel's traffic arrives in, and the default English-only install would
# have made local OCR useless for exactly the people it is for.
#
# `--no-install-recommends` keeps the image to what is named: without it,
# ffmpeg alone pulls in most of a desktop.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr \
      tesseract-ocr-ara \
      tesseract-ocr-eng \
      ffmpeg \
      zbar-tools \
 && rm -rf /var/lib/apt/lists/*

# ── Who it runs as ───────────────────────────────────────────────────────────
#
# Never root. The `node` user ships with the base image; it owns nothing on the
# host and can write only to the tmpfs the container is given at runtime.
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/

USER node

# No dependencies to install: the service is plain Node with no packages. That
# is deliberate for something that will eventually be reachable from the
# internet — there is no lockfile to audit and no transitive code in the path.

ENV NODE_ENV=production \
    PORT=8081 \
    HOST=0.0.0.0

EXPOSE 8081

# The health endpoint is the readiness signal the deploy workflow waits on, so
# it is also the container's own check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8081/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
