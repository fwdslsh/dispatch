#!/bin/bash
set -e

# Default user details (can be overridden by build args)
DEFAULT_UID=${DEFAULT_UID:-1000}
DEFAULT_GID=${DEFAULT_GID:-1000}
USER_NAME="dispatch"

# Get host UID/GID from environment variables (set by CLI or docker run)
HOST_UID=${HOST_UID:-$DEFAULT_UID}
HOST_GID=${HOST_GID:-$DEFAULT_GID}

echo "🔧 Dispatch Container Startup"
echo "   Default container user: ${USER_NAME} (${DEFAULT_UID}:${DEFAULT_GID})"
echo "   Requested host mapping: ${HOST_UID}:${HOST_GID}"

# Check if we need to adjust the user mapping
if [ "$HOST_UID" != "$DEFAULT_UID" ] || [ "$HOST_GID" != "$DEFAULT_GID" ]; then
    echo "🔄 Adjusting user mapping to match host user..."
    
    # Create group if it doesn't exist or update existing one
    if ! getent group "$HOST_GID" > /dev/null 2>&1; then
        groupadd -g "$HOST_GID" "$USER_NAME" || {
            # If group name conflicts, modify existing group
            groupmod -g "$HOST_GID" "$USER_NAME" 2>/dev/null || {
                # If that fails, delete and recreate
                groupdel "$USER_NAME" 2>/dev/null || true
                groupadd -g "$HOST_GID" "$USER_NAME"
            }
        }
    else
        # Group with this GID exists, modify our user's group
        groupmod -g "$HOST_GID" "$USER_NAME" 2>/dev/null || {
            # If that fails, try alternative approach
            existing_group=$(getent group "$HOST_GID" | cut -d: -f1)
            usermod -g "$existing_group" "$USER_NAME" 2>/dev/null || true
        }
    fi
    
    # Update user UID
    usermod -u "$HOST_UID" "$USER_NAME" 2>/dev/null || {
        echo "⚠️  Warning: Could not change UID to $HOST_UID, using existing UID"
    }
    
    echo "✅ User mapping updated"
else
    echo "✅ Using default user mapping (no changes needed)"
fi

# Get the actual UID/GID of our user (may be different if usermod failed)
ACTUAL_UID=$(id -u "$USER_NAME")
ACTUAL_GID=$(id -g "$USER_NAME")
echo "   Actual container user: ${USER_NAME} (${ACTUAL_UID}:${ACTUAL_GID})"

# Ensure critical directories exist and have proper ownership
echo "📁 Setting up directories..."

# Standard directories that should be writable by the app user
DIRS_TO_SETUP=(
    "/home/$USER_NAME"
    "/workspace"
    "/tmp/dispatch-sessions"
)

for dir in "${DIRS_TO_SETUP[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "   ✓ Created: $dir"
    fi
      
done

echo "📁 Directory setup complete"

# Switch to the application user and start the app
echo "🚀 Starting application as user: $USER_NAME"
echo "   Environment:"
echo "     PORT: ${PORT:-3030}"
echo "     ENABLE_TUNNEL: ${ENABLE_TUNNEL:-false}"

# Execute the application as the mapped user
exec gosu "$USER_NAME" "$@"