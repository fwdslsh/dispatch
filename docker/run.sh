#!/bin/bash
mkdir -p ~/dispatch/{home,projects}

key="$(cat .key 2>/dev/null)"
docker build -f docker/Dockerfile -t fwdslsh/dispatch:latest .
docker run -d --rm --name dispatch \
  -p 3030:3030 \
  -e TERMINAL_KEY="${key:-}" \
  -e ENABLE_TUNNEL=true \
  -e DISPATCH_CONFIG_DIR="/home/appuser/.config/dispatch" \
  -e DISPATCH_PROJECTS_DIR="/workspace" \
  --user $(id -u):$(id -g) \
  -v ~/dispatch/home:/home/appuser \
  -v ~/dispatch/projects:/workspace \
  fwdslsh/dispatch:latest
