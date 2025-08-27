#!/bin/bash
set -e

echo "Starting Dispatch application..."
echo "Environment:"
echo "  PORT: $PORT"
echo "  PTY_ROOT: $PTY_ROOT"
echo "  PTY_MODE: $PTY_MODE"
echo "  ENABLE_TUNNEL: $ENABLE_TUNNEL"
echo "  LT_SUBDOMAIN: $LT_SUBDOMAIN"

# Ensure sessions directory exists
mkdir -p "$PTY_ROOT"

# Start the Node.js application
exec node src/app.js