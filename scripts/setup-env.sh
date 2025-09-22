#!/bin/bash

# Script to set up user environment variables for Docker Compose
# This ensures containers are built with the current user's UID/GID

echo "Setting up environment for Docker Compose..."

# Create .env file with current user's UID and GID
cat > .env << EOF
# User mapping for Docker containers
USER_UID=$(id -u)
USER_GID=$(id -g)

# Dispatch configuration
TERMINAL_KEY=change-me-in-production
ENABLE_TUNNEL=false
EOF

echo "Created .env file with:"
echo "  USER_UID=$(id -u)"
echo "  USER_GID=$(id -g)"
echo ""
echo "You can now run 'docker-compose up -d' to start Dispatch with proper permissions."