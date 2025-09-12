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

# Install required packages including gosu for user switching
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tree jq yq build-essential \
       python3 \
       pkg-config \
       git gh \
       gosu \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ARG USER_UID=1000
ARG USER_GID=1000

ENV NODE_ENV=production \
    PORT=3030 \
    TERMINAL_KEY=change-me \
    PTY_MODE=shell \
    ENABLE_TUNNEL=false \
    LT_SUBDOMAIN= \
    # Directory management configuration
    DISPATCH_CONFIG_DIR=/config \
    DISPATCH_PROJECTS_DIR=/projects \
    # Container environment flag
    CONTAINER_ENV=true \
    # Project sandboxing configuration
    PROJECT_SANDBOX_ENABLED=true \
    HOST_HOME_DIR=/home/dispatch \
    # User mapping configuration
    DEFAULT_UID=$USER_UID \
    DEFAULT_GID=$USER_GID

WORKDIR /app
COPY --from=build /app /app

# Create non-root user for security
# Note: node image already has 'node' user with UID 1000, so we'll modify it
RUN usermod -l dispatch -d /home/dispatch node \
    && groupmod -n dispatch node \
    && mkdir -p /home/dispatch \
    && chown dispatch:dispatch /home/dispatch

# Create mount point directories with proper ownership
# These will be overridden by volume mounts but need to exist
RUN mkdir -p /config /projects /workspace /tmp/dispatch-sessions \
    && chown -R dispatch:dispatch /config /projects /workspace /tmp/dispatch-sessions \
    && chown -R dispatch:dispatch /app

# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install global packages
RUN npm install -g @anthropic-ai/claude-code @qwen-code/qwen-code@latest @openai/codex

EXPOSE 3030

# Use the entrypoint script for user mapping and start the application
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/app.js"]