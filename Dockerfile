#===============
# DOCKERFILE
# Minimal Alpine footprint for Nexio Nagare direct-stream anime addon.
#===============
FROM node:18-alpine

LABEL org.opencontainers.image.title="Nexio Nagare" \
      org.opencontainers.image.description="Stremio anime direct-streams addon (English-only) sourcing from public anime providers" \
      org.opencontainers.image.source="https://github.com/johnneerdael/nexio-nagare"

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 7002

CMD ["npm", "start"]
