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

# Install required packages including gosu for user switching and VS Code CLI
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tree jq yq build-essential \
       python3 \
       pkg-config \
       git gh \
       gosu \
       curl \
       # Dependencies for Playwright browsers
       libnss3 \
       libnspr4 \
       libatk1.0-0 \
       libatk-bridge2.0-0 \
       libcups2 \
       libdrm2 \
       libdbus-1-3 \
       libatspi2.0-0 \
       libx11-6 \
       libxcomposite1 \
       libxdamage1 \
       libxext6 \
       libxfixes3 \
       libxrandr2 \
       libgbm1 \
       libxcb1 \
       libxkbcommon0 \
       libpango-1.0-0 \
       libcairo2 \
       libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install VS Code CLI for Remote Tunnel functionality
RUN curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-linux-x64' --output vscode_cli.tar.gz \
    && tar -xf vscode_cli.tar.gz \
    && mv code /usr/local/bin/ \
    && rm vscode_cli.tar.gz \
    && chmod +x /usr/local/bin/code

# Set environment variables
ARG USER_UID=1000
ARG USER_GID=1000


RUN mkdir -p /home/dispatch
RUN mkdir /app
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

# Install global packages
RUN npm install -g @anthropic-ai/claude-code @qwen-code/qwen-code@latest @openai/codex

EXPOSE 3030

WORKDIR /app
COPY --from=build /app /app

# Install Playwright browsers for headless testing
# This needs to be done after copying the app since it uses the installed playwright
RUN npx playwright install --with-deps chromium firefox webkit

# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production \
    PORT=3030 \
    TERMINAL_KEY=change-me \
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

# Use the entrypoint script for user mapping and start the application
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/app.js"]