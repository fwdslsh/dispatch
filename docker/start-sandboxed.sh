#!/bin/bash
set -e

# Dispatch Docker Start Script with Project Sandboxing
# This script demonstrates the improved mounting strategy for project isolation

echo "Starting Dispatch with Project Sandboxing..."

# Configuration
DISPATCH_IMAGE="fwdslsh/dispatch:latest"
CONTAINER_NAME="dispatch"
TERMINAL_KEY="${TERMINAL_KEY:-$(cat .key 2>/dev/null || echo 'change-me')}"

# Directory setup - create if they don't exist
DISPATCH_ROOT="${DISPATCH_ROOT:-$HOME/dispatch}"
PROJECTS_DIR="${PROJECTS_DIR:-$DISPATCH_ROOT/projects}"
HOST_HOME_DIR="${HOST_HOME_DIR:-$DISPATCH_ROOT/home}"
SSH_DIR="${SSH_DIR:-$HOME/.ssh}"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"

echo "Directory Configuration:"
echo "  DISPATCH_ROOT: $DISPATCH_ROOT"
echo "  PROJECTS_DIR: $PROJECTS_DIR (for project storage)"
echo "  HOST_HOME_DIR: $HOST_HOME_DIR (system home with shared configs)"
echo "  SSH_DIR: $SSH_DIR (SSH keys, read-only)"
echo "  CLAUDE_DIR: $CLAUDE_DIR (Claude CLI config)"

# Create necessary directories
mkdir -p "$PROJECTS_DIR" "$HOST_HOME_DIR"

# Build Docker arguments
DOCKER_ARGS=(
  # Basic container setup
  -d --rm --name "$CONTAINER_NAME"
  -p 3030:3030
  
  # Environment variables
  -e "TERMINAL_KEY=$TERMINAL_KEY"
  -e "ENABLE_TUNNEL=${ENABLE_TUNNEL:-false}"
  -e "PTY_ROOT=/tmp/dispatch-sessions"
  -e "PROJECT_SANDBOX_ENABLED=true"
  -e "HOST_HOME_DIR=/home/appuser"
  
  # User permissions (run as host user for seamless file access)
  --user "$(id -u):$(id -g)"
  
  # Volume mounts with clear purposes:
  
  # 1. System home directory (shared configs, dotfiles, SSH keys, etc.)
  #    This is where system-wide configuration is stored and copied from
  -v "$HOST_HOME_DIR:/home/appuser"
  
  # 2. Legacy workspace mount for backward compatibility
  #    Projects can still be accessed here, but new projects use sandboxed directories
  -v "$PROJECTS_DIR:/workspace"
)

# Optional mounts (only if directories exist)
if [ -d "$SSH_DIR" ]; then
  echo "  Mounting SSH directory (read-only): $SSH_DIR"
  DOCKER_ARGS+=(-v "$SSH_DIR:/home/appuser/.ssh:ro")
fi

if [ -d "$CLAUDE_DIR" ]; then
  echo "  Mounting Claude directory: $CLAUDE_DIR"
  DOCKER_ARGS+=(-v "$CLAUDE_DIR:/home/appuser/.claude")
fi

echo ""
echo "Starting container with the following mounts:"
echo "  Host System Home -> Container /home/appuser (system configs, dotfiles)"
echo "  Host Projects Dir -> Container /workspace (legacy workspace access)"
if [ -d "$SSH_DIR" ]; then
  echo "  Host SSH Dir -> Container /home/appuser/.ssh:ro (SSH keys, read-only)"
fi
if [ -d "$CLAUDE_DIR" ]; then
  echo "  Host Claude Dir -> Container /home/appuser/.claude (Claude CLI config)"
fi

echo ""
echo "Project Sandboxing:"
echo "  Each project creates an isolated directory under /tmp/dispatch-sessions/"
echo "  Projects get their own HOME directory initialized with copied configs"
echo "  Terminal sessions are sandboxed to their project directory"

# Start the container
docker run "${DOCKER_ARGS[@]}" "$DISPATCH_IMAGE"

# Wait for container to start and show access information
sleep 2
if docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
  echo ""
  echo "✅ Dispatch started successfully!"
  echo "   Access at: http://localhost:3030"
  echo "   Auth key: $TERMINAL_KEY"
  echo ""
  echo "Container logs:"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -10
else
  echo "❌ Failed to start container"
  exit 1
fi