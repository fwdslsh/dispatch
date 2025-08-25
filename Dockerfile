# Multi-stage build
FROM node:20-bullseye AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Runtime stage
FROM node:20-slim

# Note: Claude CLI and other tools would be installed here in a real deployment
# For this MVP, we're keeping it minimal

# Create non-root user
RUN useradd -m -u 10001 appuser

WORKDIR /app
COPY --from=build /app /app

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