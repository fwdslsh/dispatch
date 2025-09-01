#!/bin/bash
set -e

echo "Starting Dispatch application..."
echo "Environment:"
echo "  PORT: $PORT"
echo "  PTY_MODE: $PTY_MODE"
echo "  ENABLE_TUNNEL: $ENABLE_TUNNEL"
echo "  LT_SUBDOMAIN: $LT_SUBDOMAIN"
echo "  DISPATCH_CONFIG_DIR: $DISPATCH_CONFIG_DIR"
echo "  DISPATCH_PROJECTS_DIR: $DISPATCH_PROJECTS_DIR"
echo "  CONTAINER_ENV: $CONTAINER_ENV"

# Initialize directory management structure
echo "Initializing directory management structure..."

# Ensure config directory exists
if [ -n "$DISPATCH_CONFIG_DIR" ]; then
    mkdir -p "$DISPATCH_CONFIG_DIR"
    echo "  ✓ Config directory: $DISPATCH_CONFIG_DIR"
    
    # Initialize projects registry if it doesn't exist
    PROJECTS_REGISTRY="$DISPATCH_CONFIG_DIR/projects.json"
    if [ ! -f "$PROJECTS_REGISTRY" ]; then
        echo '{}' > "$PROJECTS_REGISTRY"
        echo "  ✓ Created projects registry: $PROJECTS_REGISTRY"
    fi
else
    echo "  ⚠️  DISPATCH_CONFIG_DIR not set, using defaults"
fi

# Ensure projects directory exists
if [ -n "$DISPATCH_PROJECTS_DIR" ]; then
    mkdir -p "$DISPATCH_PROJECTS_DIR"
    echo "  ✓ Projects directory: $DISPATCH_PROJECTS_DIR"
else
    echo "  ⚠️  DISPATCH_PROJECTS_DIR not set, using defaults"
fi

# Legacy PTY_ROOT support (deprecated)
if [ -n "$PTY_ROOT" ]; then
    echo "  ⚠️  PTY_ROOT is deprecated, please use DISPATCH_CONFIG_DIR and DISPATCH_PROJECTS_DIR"
    mkdir -p "$PTY_ROOT"
fi

# Verify directory permissions
echo "Verifying directory permissions..."
if [ -n "$DISPATCH_CONFIG_DIR" ] && [ -w "$DISPATCH_CONFIG_DIR" ]; then
    echo "  ✓ Config directory is writable"
else
    echo "  ❌ Config directory is not writable: $DISPATCH_CONFIG_DIR"
fi

if [ -n "$DISPATCH_PROJECTS_DIR" ] && [ -w "$DISPATCH_PROJECTS_DIR" ]; then
    echo "  ✓ Projects directory is writable"
else
    echo "  ❌ Projects directory is not writable: $DISPATCH_PROJECTS_DIR"
fi

echo "Directory initialization complete!"

# Start the Node.js application
echo "Starting Node.js application..."
exec node src/app.js