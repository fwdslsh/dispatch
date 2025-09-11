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
RUN npm install --no-save

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
       git gh \
       gosu \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV NODE_ENV=production \
    PORT=3030 \
    TERMINAL_KEY=change-me \
    PTY_MODE=shell \
    ENABLE_TUNNEL=false \
    LT_SUBDOMAIN= \
    # Directory management configuration
    DISPATCH_CONFIG_DIR=/home/dispatch/.config/dispatch \
    DISPATCH_PROJECTS_DIR=/var/lib/dispatch/projects \
    # Container environment flag
    CONTAINER_ENV=true \
    # Project sandboxing configuration
    PROJECT_SANDBOX_ENABLED=true \
    HOST_HOME_DIR=/home/dispatch
    
# Create non-root user with default UID/GID (optimized for common development values)
# Runtime user mapping will adjust these values if needed when using Docker Hub images
ARG USER_UID=1000
ARG USER_GID=1000
RUN groupadd -g ${USER_GID} dispatch 2>/dev/null || true \
    && useradd -m -u ${USER_UID} -g ${USER_GID} -s /bin/bash dispatch 2>/dev/null || true

WORKDIR /app
COPY --from=build /app /app

# Create directories and set proper ownership
RUN mkdir -p /home/dispatch/.config/dispatch /var/lib/dispatch/projects /workspace \
    && chown -R dispatch:dispatch /home/dispatch /var/lib/dispatch/projects /app /workspace \
    # Create initial project registry file
    && printf '%s' '{}' > /home/dispatch/.config/dispatch/projects.json \
    && chown dispatch:dispatch /home/dispatch/.config/dispatch/projects.json \
    && chmod 0644 /home/dispatch/.config/dispatch/projects.json

# Install global packages as root before switching user
RUN npm install -g @anthropic-ai/claude-code @qwen-code/qwen-code@latest @openai/codex

# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to the dispatch user (entrypoint will handle runtime user mapping)
USER dispatch

EXPOSE 3030

# Use entrypoint for runtime user mapping compatibility with Docker Hub
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/app.js"]