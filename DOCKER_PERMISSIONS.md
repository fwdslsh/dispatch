# Docker Permissions Setup for Dispatch

This document explains how Dispatch handles Docker permissions for mounted folders to ensure seamless file access between the host and container.

## Problem

When using Docker with mounted volumes, file ownership can become problematic:

- Files created in the container may be owned by the container user
- Files created on the host may not be accessible in the container
- Permission changes on the host machine should not be required

## Solution

Dispatch uses a user mapping approach that ensures the container runs with the same UID/GID as the host user:

### 1. CLI Usage (Recommended)

The `dispatch` CLI automatically handles user mapping:

```bash
# Initialize your environment
node bin/cli.js init

# Start with proper user mapping (builds container with your UID/GID)
node bin/cli.js start --build --projects ~/dispatch/projects --home ~/dispatch/home
```

The CLI will:

- Automatically detect your UID/GID
- Build the Docker image with matching user credentials
- Mount directories with proper permissions
- Create directories if they don't exist

### 2. Docker Compose Usage

For Docker Compose, you need to set environment variables:

```bash
# Set up environment variables
./setup-env.sh

# Or manually create .env file:
echo "USER_UID=$(id -u)" > .env
echo "USER_GID=$(id -g)" >> .env

# Start with compose
docker-compose up -d
```

### 3. Manual Docker Build

```bash
# Build with your user's UID/GID
docker build -f docker/Dockerfile \
  --build-arg USER_UID=$(id -u) \
  --build-arg USER_GID=$(id -g) \
  -t dispatch .

# Run with mounted directories
docker run -d \
  --name dispatch \
  -p 3030:3030 \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/home:/home/dispatch \
  -e TERMINAL_KEY=your-key \
  dispatch
```

## Directory Structure

The setup creates two main directories:

- **Projects Directory** (`~/dispatch/projects` by default): For your code repositories and projects
- **Home Directory** (`~/dispatch/home` by default): For user configuration, dotfiles, shell history, etc.

## Key Features

✅ **No host permission changes required**: The container user matches your host user  
✅ **Files owned by you**: All files created in mounted directories are owned by your user  
✅ **Seamless access**: Edit files from host or container without permission issues  
✅ **Easy setup**: CLI handles everything automatically  
✅ **Configurable**: Override default directories and settings as needed

## Troubleshooting

### Permission Denied Errors

If you see permission errors:

1. Make sure you built the image with `--build` flag or proper build args
2. Check that your directories exist and are accessible
3. Verify the container user matches your host user:

```bash
# Check your UID/GID
id

# Check container user (in running container)
docker exec dispatch id
```

### Files Have Wrong Owner

If files are created with wrong ownership:

1. Rebuild the image with correct UID/GID
2. Use the CLI's `--build` flag to ensure proper user mapping
3. Check that no `--user` flag conflicts are present

## Advanced Configuration

You can customize the setup by editing `~/.dispatch/config.json`:

```json
{
	"volumes": {
		"projects": "/path/to/your/projects",
		"home": "/path/to/container/home",
		"ssh": "~/.ssh",
		"claude": "~/.claude",
		"config": "~/.config"
	}
}
```

## Security Notes

- SSH keys are mounted read-only by default
- The container runs as a non-root user
- File permissions are preserved between host and container
- No privileged access required
