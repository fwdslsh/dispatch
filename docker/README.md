# Dispatch Docker Usage

This document explains how to run the [Dispatch Docker image](https://hub.docker.com/r/fwdslsh/dispatch). It includes examples for running the container, mounting local directories for persistent storage, handling permissions, SSL configuration, and more.

## SSL/HTTPS Support

Dispatch now includes automatic SSL certificate generation for secure connections:

- **HTTPS enabled by default** - containers generate self-signed certificates automatically
- **No manual setup required** - certificates are created on first startup
- **Browser security warnings are normal** - click "Advanced" then "Proceed to localhost"
- **To disable SSL**: set `SSL_ENABLED=false` environment variable

## Run

```bash
# Run Dispatch with HTTPS (default)
docker run -p 3030:3030 -e TERMINAL_KEY=your-secret-password fwdslsh/dispatch:latest
```

Open your browser at `https://localhost:3030` and enter the password you set in `TERMINAL_KEY`.

To disable SSL and use HTTP:

```bash
# Run Dispatch with HTTP only
docker run -p 3030:3030 -e TERMINAL_KEY=your-secret-password -e SSL_ENABLED=false fwdslsh/dispatch:latest
```

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
- `SSL_ENABLED` (`true`|`false`) — enable HTTPS with auto-generated certificates (default: `true`)
