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

# Install required packages including gosu for user switching and SSH daemon
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tree jq yq build-essential \
       python3 \
       pkg-config \
       git gh \
       gosu \
       openssh-server \
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

# Setup SSH daemon
RUN mkdir -p /var/run/sshd /etc/ssh/keys \
    && chmod 700 /etc/ssh/keys \
    && ssh-keygen -A \
    && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config \
    && sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
    && sed -i 's/#AuthorizedKeysFile/AuthorizedKeysFile/' /etc/ssh/sshd_config \
    && echo 'AuthorizedKeysFile /etc/ssh/keys/%u_authorized_keys' >> /etc/ssh/sshd_config \
    && echo 'Port 2222' >> /etc/ssh/sshd_config

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

EXPOSE 3030 2222

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
    SSH_PORT=2222 \
    SSH_ENABLED=true \
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