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

# Install required packages including nginx and certbot for SSL and VS Code CLI
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tree jq yq build-essential \
       python3 \
       pkg-config \
       git gh \
       gosu \
       curl wget \
       ca-certificates \
       # nginx and SSL tools
       nginx \
       certbot \
       python3-certbot-nginx \
       # Process management
       supervisor \
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
RUN curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --output vscode_cli.tar.gz \
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
RUN mkdir -p /workspaces /tmp/dispatch \
    && chown -R dispatch:dispatch /workspaces /tmp/dispatch \
    && chown -R dispatch:dispatch /app

# Install global packages
RUN npm install -g @anthropic-ai/claude-code @qwen-code/qwen-code@latest @openai/codex

# Copy built application
WORKDIR /app
COPY --from=build /app /app

# Install Playwright browsers for headless testing
# This needs to be done after copying the app since it uses the installed playwright
RUN npx playwright install --with-deps chromium firefox webkit

# Copy configuration files
COPY docker/nginx-template.conf /etc/nginx/nginx-template.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create directories for SSL certificates and nginx
RUN mkdir -p /etc/letsencrypt /var/www/certbot /var/log/supervisor \
    && chown -R dispatch:dispatch /etc/letsencrypt /var/www/certbot

# Expose both HTTP and HTTPS ports
EXPOSE 80 443 3030

ENV NODE_ENV=production \
    PORT=3030 \
    TERMINAL_KEY=change-me-to-a-strong-password \
    ENABLE_TUNNEL=false \
    LT_SUBDOMAIN= \
    # SSL Configuration
    SSL_MODE=letsencrypt \
    DOMAIN=localhost \
    LETSENCRYPT_EMAIL= \
    LETSENCRYPT_STAGING=false \
    # Directory management configuration
    DISPATCH_CONFIG_DIR=/config \
    # User mapping configuration
    DEFAULT_UID=$USER_UID \
    DEFAULT_GID=$USER_GID

# Use the entrypoint script for SSL setup, user mapping and service management
ENTRYPOINT ["/entrypoint.sh"]
# Default command starts supervisor which manages nginx and the app
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]