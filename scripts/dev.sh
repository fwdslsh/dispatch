#!/bin/bash
# Dispatch local dev: build and run with self-signed SSL (latest Docker config)

# Create local directories for config, projects, and workspace if needed
mkdir -p ~/dispatch/{config,projects,workspace}

# Read TERMINAL_KEY from .key if present
key="$(cat .key 2>/dev/null)"

# Build the image (if not already built)
docker build -f docker/Dockerfile -t fwdslsh/dispatch:latest .

# Run with self-signed SSL (default for local dev)
docker run -d --rm --name dispatch \
  -p 80:80 \
  -p 443:443 \
  -e DOMAIN=localhost \
  -e SSL_MODE=self-signed \
  -e DISPATCH_CONFIG_DIR="/config" \
  -e DISPATCH_WORKSPACE_DIR="/workspace" \
  -e TRUST_PROXY=true \
  --user $(id -u):$(id -g) \
  -v ~/dispatch/config:/config \
  -v ~/dispatch/projects:/projects \
  -v ~/dispatch/workspace:/workspace \
  fwdslsh/dispatch:latest
