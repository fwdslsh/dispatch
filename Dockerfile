# Multi-stage build
FROM node:20-bullseye AS build

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN NODE_ENV=production npm run build

# Runtime stage
FROM node:20-slim

# Install runtime dependencies for node-pty
RUN apt-get update && apt-get install -y python3 && rm -rf /var/lib/apt/lists/*

# Note: Claude CLI and other tools would be installed here in a real deployment
# For this MVP, we're keeping it minimal

# Create non-root user
RUN useradd -m -u 10001 appuser

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./
COPY --from=build /app/src ./src

# Create dirs for sessions
RUN mkdir -p /tmp/dispatch-sessions && chown -R appuser:appuser /tmp/dispatch-sessions /app

USER appuser

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    TERMINAL_KEY=change-me \
    PTY_ROOT=/tmp/dispatch-sessions \
    PTY_MODE=shell \
    ENABLE_TUNNEL=false \
    LT_SUBDOMAIN=

EXPOSE 3000

CMD ["node", "src/app.js"]