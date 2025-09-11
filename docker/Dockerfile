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
    PTY_MODE=shell \
    ENABLE_TUNNEL=false \
    LT_SUBDOMAIN= \
    # Directory management configuration
    DISPATCH_CONFIG_DIR=/home/appuser/.config/dispatch \
    DISPATCH_PROJECTS_DIR=/var/lib/dispatch/projects \
    # Container environment flag
    CONTAINER_ENV=true \
    # Project sandboxing configuration
    PROJECT_SANDBOX_ENABLED=true \
    HOST_HOME_DIR=/home/appuser
    
# Create non-root user with configurable UID/GID
ARG USER_UID=10001
ARG USER_GID=10001
RUN (groupadd -g ${USER_GID} appuser || true) \
    && useradd -m -u ${USER_UID} -g ${USER_GID} appuser

WORKDIR /app
COPY --from=build /app /app

# Create directories for the new directory management structure
# /home/appuser/.config/dispatch: Application configuration and project registry
# /var/lib/dispatch/projects: Project storage root (each project gets a subdirectory)
# /workspace: Legacy workspace directory for backward compatibility
RUN mkdir -p /home/appuser/.config/dispatch /var/lib/dispatch/projects /workspace \
    && chown -R appuser:appuser /home/appuser/.config/dispatch /var/lib/dispatch/projects /app /workspace /home/appuser \
    # Create initial project registry file
    && printf '%s' '{}' > /home/appuser/.config/dispatch/projects.json \
    && chown appuser:appuser /home/appuser/.config/dispatch/projects.json \
    && chmod 0644 /home/appuser/.config/dispatch/projects.json

RUN npm install -g @anthropic-ai/claude-code @qwen-code/qwen-code@latest @openai/codex
USER appuser


EXPOSE 3030

CMD ["node", "src/app.js"]