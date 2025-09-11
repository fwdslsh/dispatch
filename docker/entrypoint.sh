#!/bin/bash
set -e

# Runtime user mapping for Docker Hub compatibility
# This script ensures the container user matches the host user for proper file permissions

# Default values
DEFAULT_UID=1000
DEFAULT_GID=1000
DISPATCH_USER="dispatch"

# Get the target UID/GID from environment or use defaults
TARGET_UID=${HOST_UID:-$DEFAULT_UID}
TARGET_GID=${HOST_GID:-$DEFAULT_GID}

# Get current dispatch user info
CURRENT_UID=$(id -u $DISPATCH_USER 2>/dev/null || echo $DEFAULT_UID)
CURRENT_GID=$(id -g $DISPATCH_USER 2>/dev/null || echo $DEFAULT_GID)

echo "🔧 Dispatch entrypoint: Configuring user permissions..."
echo "   Target UID/GID: $TARGET_UID:$TARGET_GID"
echo "   Current UID/GID: $CURRENT_UID:$CURRENT_GID"

# Only modify user if UID/GID don't match
if [ "$CURRENT_UID" != "$TARGET_UID" ] || [ "$CURRENT_GID" != "$TARGET_GID" ]; then
    echo "   Adjusting user mapping..."
    
    # Modify the group GID if needed
    if [ "$CURRENT_GID" != "$TARGET_GID" ]; then
        groupmod -g $TARGET_GID $DISPATCH_USER 2>/dev/null || {
            echo "   Creating new group with GID $TARGET_GID"
            groupadd -g $TARGET_GID ${DISPATCH_USER}_new 2>/dev/null || true
            usermod -g $TARGET_GID $DISPATCH_USER 2>/dev/null || true
        }
    fi
    
    # Modify the user UID if needed  
    if [ "$CURRENT_UID" != "$TARGET_UID" ]; then
        usermod -u $TARGET_UID $DISPATCH_USER 2>/dev/null || {
            echo "   Warning: Could not change UID, but continuing..."
        }
    fi
    
    # Fix ownership of key directories
    echo "   Fixing directory ownership..."
    chown -R $TARGET_UID:$TARGET_GID /home/dispatch 2>/dev/null || true
    chown -R $TARGET_UID:$TARGET_GID /var/lib/dispatch 2>/dev/null || true
    chown -R $TARGET_UID:$TARGET_GID /workspace 2>/dev/null || true
    
    echo "   ✅ User mapping updated successfully"
else
    echo "   ✅ User mapping already correct"
fi

# Switch to the dispatch user and execute the main command
echo "🚀 Starting Dispatch as user $DISPATCH_USER ($(id -u $DISPATCH_USER 2>/dev/null || echo $TARGET_UID):$(id -g $DISPATCH_USER 2>/dev/null || echo $TARGET_GID))..."

# If no command specified, run the default
if [ $# -eq 0 ]; then
    # Check if gosu is available, otherwise try su-exec or exec directly
    if command -v gosu >/dev/null 2>&1; then
        exec gosu $DISPATCH_USER node src/app.js
    elif command -v su-exec >/dev/null 2>&1; then
        exec su-exec $DISPATCH_USER node src/app.js
    else
        # Fallback: try to switch user with su
        exec su -s /bin/sh $DISPATCH_USER -c "cd /app && exec node src/app.js"
    fi
else
    # Execute provided command with user switching
    if command -v gosu >/dev/null 2>&1; then
        exec gosu $DISPATCH_USER "$@"
    elif command -v su-exec >/dev/null 2>&1; then
        exec su-exec $DISPATCH_USER "$@"
    else
        # Fallback: try to switch user with su
        exec su -s /bin/sh $DISPATCH_USER -c "cd /app && exec $*"
    fi
fi