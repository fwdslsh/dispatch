# Multi-stage build
FROM node:20-bullseye AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Runtime stage
FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    python3 \
    python3-pip \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code (example - adjust based on actual installation method)
RUN npm install -g @anthropic-ai/claude-cli

# Non-root user
RUN useradd -m -u 10001 appuser
USER appuser

WORKDIR /app
COPY --from=build /app /app

# Create dirs for mounts (sessions, workspace, home)
RUN mkdir -p /home/appuser/sessions /workspace /home/appuser/home

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    TERMINAL_KEY=change-me \
    PTY_ROOT=/home/appuser/sessions \
    PTY_MODE=claude \
    ENABLE_TUNNEL=false \
    LT_SUBDOMAIN= \
    HOME=/home/appuser/home

COPY --chown=appuser:appuser start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["/app/start.sh"]