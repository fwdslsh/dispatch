# Dispatch Quick Start Guide

Get up and running with Dispatch in minutes! This guide walks you through installation, initialization, starting your first container, and attaching for development.

## Prerequisites

- **Docker**: Make sure Docker is installed and running
- **Bash**: Compatible with bash shell (Linux, macOS, WSL)

## Step 1: Install Dispatch

```bash
# Install the dispatch CLI
curl -fsSL https://raw.githubusercontent.com/fwdslsh/dispatch/main/install.sh | bash

# Or install manually
wget https://raw.githubusercontent.com/fwdslsh/dispatch/main/bin/dispatch
chmod +x dispatch
sudo mv dispatch /usr/local/bin/
```

## Step 2: Initialize Your Environment

```bash
# Create configuration directories and generate authentication keys
dispatch init
```

This creates:

- `~/.dispatch/` - Configuration directory
- `~/.dispatch/.env` - Environment variables including your secure `TERMINAL_KEY`
- `~/workspace/` - Default workspace for your projects

## Step 3: Start Dispatch

```bash
# Start the container with default settings
dispatch start

# Or customize the port
dispatch start --port 8080
```

Your Dispatch instance is now running! The command will show:

- Web interface URL (typically http://localhost:3030)
- Your authentication key for browser access
- Public tunnel URL (if enabled)

## Step 4: Access Your Environment

### Option A: Web Interface

1. Open http://localhost:3030 in your browser
2. Enter your `TERMINAL_KEY` when prompted
3. Start coding in the secure, isolated environment

### Option B: Attach Directly

```bash
# Attach an interactive shell to the running container
dispatch attach
```

This gives you direct terminal access to your Dispatch environment. Use `exit` or Ctrl+D to detach.

## Step 5: Connect to Remote Instances

If you have Dispatch running on a remote server:

```bash
# Connect to a remote dispatch instance via SSH
dispatch connect myserver.com

# Specify custom port and SSH key
dispatch connect myserver.com --port 2223 --key ~/.ssh/my_key

# The default SSH port is 2222 and user is 'dispatch'
```

## Common Commands

```bash
dispatch status    # Check if container is running
dispatch stop      # Stop the container
dispatch update    # Update to latest version
dispatch help      # Show all available commands
```

## Updating Dispatch

Keep your Dispatch installation up to date:

```bash
dispatch update
```

This will:

1. Stop the running container (if any)
2. Pull the latest Docker image
3. Restart with the new version (if it was running)

## Workspace Management

Your `~/workspace/` directory is automatically mounted in the container as `/workspace`. Any files you create or modify will persist between container restarts.

## Security Notes

- Keep your `TERMINAL_KEY` secure - it's stored in `~/.dispatch/.env`
- The container runs with your user permissions for file access
- All operations are sandboxed within the Docker container

## Troubleshooting

**Container won't start?**

```bash
dispatch status    # Check current state
docker logs dispatch    # View container logs
```

**Can't attach?**

```bash
dispatch status    # Ensure container is running
dispatch start     # Start if not running
```

**SSH connection issues?**

```bash
# Check SSH key permissions
ls -la ~/.ssh/
chmod 600 ~/.ssh/id_rsa    # Fix permissions if needed
```

## Next Steps

- Explore the web interface for advanced features
- Set up Claude AI integration for code assistance
- Configure custom adapters for your workflow
- Share your setup with teammates using the same commands

Happy coding! 🚀
