#!/bin/bash
key="$(cat .key 2>/dev/null)"
docker build -f docker/Dockerfile -t fwdslsh/dispatch:latest .
docker run -d --rm --name dispatch \
  -p 3030:3030 \
  -e TERMINAL_KEY="${key:-}" \
  -e ENABLE_TUNNEL=true \
  -e PTY_ROOT="/home/appuser" \
  --user $(id -u):$(id -g) \
  -v ~/dispatch-home:/home/appuser \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
