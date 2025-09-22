# Dispatch Docker Usage

This document explains how to run the Dispatch Docker image (`fwdslsh/dispatch:latest`). It includes examples for running the container, mounting local directories for persistent storage, handling permissions, and more.

## Run

```bash
# Run Dispatch and expose port 3030
docker run -p 3030:3030 -e TERMINAL_KEY=your-secret-password fwdslsh/dispatch:latest
```

Open your browser at `http://localhost:3030` and enter the password you set in `TERMINAL_KEY`.

## Run with public URL sharing

```bash
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e ENABLE_TUNNEL=true \
  fwdslsh/dispatch:latest
```

When `ENABLE_TUNNEL=true` the container will attempt to create a public URL. A key is still required for access — `TERMINAL_KEY` provides minimal protection for public mode and must be strong.

## Persistent storage (volume mounts)

To keep user data, dotfiles, and project files across container restarts, mount host directories into the container.

```bash
# Create directories (no sudo needed!)
mkdir -p ~/dispatch-home ~/dispatch-projects

# Option 1: Use your current user ID (recommended)
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  --user $(id -u):$(id -g) \
  -v ~/dispatch-home:/home/appuser \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
```

Recommended mount points:

- `/home/appuser` — user home directory inside the container (shell history, dotfiles)
- `/workspace` — where you can keep project folders and code

**Security isolation**: The container can only access the specific directories you mount. No sudo required when using `--user $(id -u):$(id -g)` or building with your user ID.

## Combined: persistence + public URL

```bash
# Create directories (no sudo needed!)
mkdir -p ~/dispatch-home ~/dispatch-projects

# Run with persistence and tunneling
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e ENABLE_TUNNEL=true \
  --user $(id -u):$(id -g) \
  -v ~/dispatch-home:/home/appuser \
  -v ~/dispatch-projects:/workspace \
  fwdslsh/dispatch:latest
```

## Environment variables

- `TERMINAL_KEY` (required) — password used to authenticate to the web UI
- `PORT` (default `3030`) — port inside the container
- `ENABLE_TUNNEL` (`true`|`false`) — enable public URL sharing
- `LT_SUBDOMAIN` — optional LocalTunnel subdomain
