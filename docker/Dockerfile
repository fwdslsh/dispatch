# Multi-stage build
FROM node:22-bookworm AS build

WORKDIR /app
COPY package*.json ./
# Install build tools so native modules (node-pty) can be compiled against this image's libc
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       python3 \
       pkg-config \
       git \
    && rm -rf /var/lib/apt/lists/*

# Force native modules to build from source where applicable (node-pty will compile)
ENV npm_config_build_from_source=true

# Install all deps (including devDeps like node-gyp) so native modules can compile
RUN npm ci

COPY . .

# Run the build (this will compile native addons during install/build)
RUN npm run build

# Runtime stage
FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tree jq yq build-essential \
       python3 \
       pkg-config \
       git gh

# Set environment variables
ENV NODE_ENV=production \
    PORT=3030 \
    TERMINAL_KEY=change-me \
    PTY_ROOT=/tmp/dispatch-sessions \
    PTY_MODE=shell \
    ENABLE_TUNNEL=false \
    LT_SUBDOMAIN=
    
# Create non-root user with configurable UID/GID
ARG USER_UID=10001
ARG USER_GID=10001
RUN (groupadd -g ${USER_GID} appuser || true) \
    && useradd -m -u ${USER_UID} -g ${USER_GID} appuser

WORKDIR /app
COPY --from=build /app /app

# Create dirs for sessions
RUN mkdir -p /tmp/dispatch-sessions /workspace \
    && chown -R appuser:appuser /tmp/dispatch-sessions /app /workspace /home/appuser \
    # Create an initial sessions.json so the runtime has a writable file at PTY_ROOT
    && printf '%s' '{"sessions": [], "active": null}' > /tmp/dispatch-sessions/sessions.json \
    && chown appuser:appuser /tmp/dispatch-sessions/sessions.json \
    && chmod 0644 /tmp/dispatch-sessions/sessions.json

RUN npm install -g @anthropic-ai/claude-code @qwen-code/qwen-code@latest @qwen-code/qwen-code@latest
USER appuser


EXPOSE 3030

CMD ["node", "src/app.js"]