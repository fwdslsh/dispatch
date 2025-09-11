# Docker Permissions Setup for Dispatch

This document explains how Dispatch handles Docker permissions for mounted folders to ensure seamless file access between the host and container.

## Problem

When using Docker with mounted volumes, file ownership can become problematic:

- Files created in the container may be owned by the container user
- Files created on the host may not be accessible in the container
- Permission changes on the host machine should not be required

## Solution

Dispatch uses **runtime user mapping** that works with both locally built images and pre-built images from Docker Hub. The container automatically adjusts its internal user to match your host user's UID/GID when it starts.

### 1. CLI Usage (Recommended)

The `dispatch` CLI is the easiest way to get started and works with Docker Hub images:

```bash
# Initialize your environment
node bin/cli.js init

# Start with Docker Hub image (recommended)
node bin/cli.js start

# Or build locally if needed
node bin/cli.js start --build
```

The CLI will:

- **Pull the latest image from Docker Hub** (default behavior)
- Automatically detect your UID/GID and pass them to the container
- Create directories if they don't exist
- Start the container with proper user mapping

### 2. Docker Compose Usage

For Docker Compose, you need to set environment variables:

```bash
# Set up environment variables
./setup-env.sh

# Or manually create .env file:
echo "USER_UID=$(id -u)" > .env
echo "USER_GID=$(id -g)" >> .env

# Start with compose (pulls from Docker Hub)
docker-compose up -d
```

### 3. Manual Docker Usage

**Using Docker Hub image (recommended):**

```bash
# Pull and run with runtime user mapping
docker pull fwdslsh/dispatch:latest
docker run -d \
  --name dispatch \
  -p 3030:3030 \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -e TERMINAL_KEY=your-key \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/home:/home/dispatch \
  fwdslsh/dispatch:latest
```

**Building locally (advanced users):**

```bash
# Build with your user's UID/GID
docker build -f docker/Dockerfile \
  --build-arg USER_UID=$(id -u) \
  --build-arg USER_GID=$(id -g) \
  -t dispatch-local .

# Run the locally built image
docker run -d \
  --name dispatch \
  -p 3030:3030 \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -e TERMINAL_KEY=your-key \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/home:/home/dispatch \
  dispatch-local
```

## How Runtime User Mapping Works

1. **Container starts** with a default user (`dispatch` with UID/GID 1000:1000)
2. **Entrypoint script** checks the `HOST_UID` and `HOST_GID` environment variables
3. **If different**, the script modifies the container user to match your host user
4. **Directory ownership** is updated to ensure proper file access
5. **Application starts** with the correctly mapped user

This approach works with:
- ✅ **Docker Hub images** (no building required)
- ✅ **Locally built images** (for customization)
- ✅ **Any host user UID/GID** (not limited to 1000:1000)
- ✅ **Docker Compose and CLI** usage

## Directory Structure

The setup creates two main directories:

- **Projects Directory** (`~/dispatch/projects` by default): For your code repositories and projects
- **Home Directory** (`~/dispatch/home` by default): For user configuration, dotfiles, shell history, etc.

## Key Features

✅ **Works with Docker Hub**: No need to build locally - just pull and run  
✅ **No host permission changes required**: Container adapts to your user  
✅ **Files owned by you**: All files created in mounted directories are owned by your user  
✅ **Seamless access**: Edit files from host or container without permission issues  
✅ **Easy setup**: CLI handles everything automatically  
✅ **Configurable**: Override default directories and settings as needed

## Troubleshooting

### Permission Denied Errors

If you see permission errors:

1. **Check environment variables**: Ensure `HOST_UID` and `HOST_GID` are set correctly
2. **Verify directories exist**: Make sure your mount directories are accessible
3. **Check container logs**: `docker logs dispatch` to see user mapping output
4. **Verify user mapping**: Check that container user matches your host user:

```bash
# Check your UID/GID
id

# Check container user (in running container)
docker exec dispatch id

# Should show matching UID/GID values
```

### Docker Hub vs Local Build

**Docker Hub (Recommended):**
- ✅ Faster setup (no build time)
- ✅ Always up-to-date
- ✅ Works with runtime user mapping
- ✅ No Docker build requirements

**Local Build:**
- ⚙️ Customization options
- ⚙️ Development/testing
- ⏱️ Longer setup time
- 🔧 Requires Docker build tools

### Container Won't Start

If the container fails to start:

1. **Check Docker logs**: `docker logs dispatch`
2. **Verify image**: `docker pull fwdslsh/dispatch:latest`
3. **Check port conflicts**: Ensure port 3030 is available
4. **User mapping issues**: Verify UID/GID values are valid numbers

```bash
# Debug container startup
docker run --rm -it \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  fwdslsh/dispatch:latest \
  /bin/bash
```
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
