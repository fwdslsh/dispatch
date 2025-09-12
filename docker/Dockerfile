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
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
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
    HOST_HOME_DIR=/home/dispatch

WORKDIR /app
COPY --from=build /app /app

# Create mount point directories
# These will be overridden by volume mounts but need to exist
RUN mkdir -p /config /projects /workspace

# Install global packages
RUN npm install -g @anthropic-ai/claude-code @qwen-code/qwen-code@latest @openai/codex

EXPOSE 3030

# Run as root - container will handle permissions internally
# This allows writing to mounted volumes without changing host permissions
CMD ["node", "src/app.js"]