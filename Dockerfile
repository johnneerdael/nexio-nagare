#===============
# DOCKERFILE
# Multi-arch image for Nexio Nagare. Uses node:20-bookworm-slim (glibc) rather
# than -alpine because the alpine ARM64 binary triggers
# "qemu: uncaught target signal 4 (Illegal instruction)" during `npm ci` under
# the GitHub Actions QEMU emulator. The bookworm-slim base is ~30MB larger but
# builds reliably across linux/amd64 + linux/arm64.
#===============
FROM node:20-bookworm-slim

LABEL org.opencontainers.image.title="Nexio Nagare" \
      org.opencontainers.image.description="Stremio anime direct-streams addon (English-only) sourcing from public anime providers" \
      org.opencontainers.image.source="https://github.com/johnneerdael/nexio-nagare"

WORKDIR /app

# python3 + g++ + make are needed to compile better-sqlite3 from source on
# architectures that don't have a prebuilt binary published.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 7002

CMD ["npm", "start"]
