# Dispatch Docker Usage

This document explains how to build and run the Dispatch Docker image (`fwdslsh/dispatch:latest`). It includes examples for running the container, mounting local directories for persistent storage, handling permissions, and troubleshooting common Docker-related issues.

## Run (basic)

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
- `PTY_MODE` (`shell`|`claude`) — default session mode
- `ENABLE_TUNNEL` (`true`|`false`) — enable public URL sharing
- `LT_SUBDOMAIN` — optional LocalTunnel subdomain

## Troubleshooting

### Container fails to write to mounted folders

Symptom: You can access the UI but cannot create files or save in mounted folders.

Fix:
1. Ensure the host directories exist: `mkdir -p ~/dispatch-home ~/dispatch-projects`
2. Use the recommended permission approach:

```bash
docker run --user $(id -u):$(id -g) [other options...]
```

3. For read-only access, add `:ro` suffix: `-v ~/dispatch-home:/home/appuser:ro`

### Port conflicts

If port 3030 on the host is already in use, either stop the conflicting service or map to a different host port:

```bash
# Map host port 3030 to container 3030
docker run -p 3030:3030 -e TERMINAL_KEY=your-secret-password fwdslsh/dispatch:latest
```

### Tunnel not working

- Confirm `ENABLE_TUNNEL=true` is set
- Check network/firewall rules
- LocalTunnel may be rate-limited; retry or set `LT_SUBDOMAIN`

## Security notes

- `TERMINAL_KEY` is required for all access; use a strong password when enabling public URLs
- The container runs as a non-root user to reduce risk, but terminal access still allows running commands in that environment — use with care

## Examples (summary)

Run locally (no persistence):

```bash
docker run -p 3030:3030 -e TERMINAL_KEY=secret fwdslsh/dispatch:latest
```

Run with persistence and custom host port:

```bash
mkdir -p ~/dispatch-home ~/dispatch-projects
docker run -p 3030:3030 -e TERMINAL_KEY=secret --user $(id -u):$(id -g) -v ~/dispatch-home:/home/appuser -v ~/dispatch-projects:/workspace fwdslsh/dispatch:latest
```

## Further reading

- See `docker/Dockerfile` for how the image is built and the flexible runtime user configuration
- See `CONTRIBUTING.md` for development and build instructions

---

If you'd like, I can also add a short script in `docker/` to help create and chown the directories automatically (example: `docker/setup-mounts.sh`). Would you like that?