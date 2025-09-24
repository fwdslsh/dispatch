# Dispatch Docker Usage

This document explains how to run the [Dispatch Docker image](https://hub.docker.com/r/fwdslsh/dispatch). It includes examples for running the container, mounting local directories for persistent storage, handling permissions, SSL configuration, and more.

## SSL/HTTPS Support

Dispatch provides flexible SSL configuration optimized for different deployment scenarios:

### 🐳 **Docker/Production (Recommended)**

- **SSL disabled by default** - designed for reverse proxy SSL termination
- **No trust warnings** - perfect for remote hosting with free SSL (Cloudflare, nginx, Caddy)
- **Production ready** - follows best practices for containerized deployments

### 🔧 **Development (Vite Dev Server)**

- **Self-signed SSL enabled by default** - for local HTTPS development
- **Trust warnings expected** - one-time browser acceptance required
- **Local development optimized** - automatic certificate generation

### ⚙️ **Manual SSL Override**

- Set `SSL_ENABLED=true` to force self-signed certificates in any environment
- Set `SSL_ENABLED=false` to explicitly disable SSL

## Run

```bash
# Default: HTTP mode (ready for reverse proxy SSL)
docker run -p 3030:3030 -e TERMINAL_KEY=your-secret-password fwdslsh/dispatch:latest
```

Access via `http://localhost:3030` - perfect for putting behind:

- **Cloudflare** (automatic SSL)
- **nginx** with Let's Encrypt
- **Caddy** (automatic HTTPS)
- **Traefik** with SSL termination

### With Self-Signed SSL (Not Recommended for Remote)

```bash
# Force self-signed SSL (will show trust warnings)
docker run -p 3030:3030 -e TERMINAL_KEY=your-secret-password -e SSL_ENABLED=true fwdslsh/dispatch:latest
```

Access via `https://localhost:3030` (browser warnings expected)

## Persistent storage (volume mounts)

To keep user data, dotfiles, and project files across container restarts, mount host directories into the container.

```bash
# Create directories (no sudo needed!)
mkdir -p ~/dispatch-home ~/dispatch-projects

# Option 1: Use your current user ID (recommended)
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  --user $(id -u):$(id -g) \
  -v ~/dispatch-home:/home/dispatch \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
```

Recommended mount points:

- `/home/dispatch` — user home directory inside the container (shell history, dotfiles)
- `/workspace` — where you can keep project folders and code

**Security isolation**: The container can only access the specific directories you mount. No sudo required when using `--user $(id -u):$(id -g)` or building with your user ID.

## Environment variables

- `TERMINAL_KEY` (required) — password used to authenticate to the web UI
- `PORT` (default `3030`) — port inside the container
- `ENABLE_TUNNEL` (`true`|`false`) — enable public URL sharing
- `LT_SUBDOMAIN` — optional LocalTunnel subdomain
- `SSL_ENABLED` (`true`|`false`) — force SSL mode (default: auto-detected based on environment)
