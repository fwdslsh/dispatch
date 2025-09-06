# Dispatch Docker Usage

This document explains how to build and run Dispatch with **project sandboxing** enabled. Dispatch isolates terminal sessions within project directories for enhanced security and organization.

## 🔒 Project Sandboxing Overview

**How it works:**

- Each project creates an isolated directory under `/tmp/dispatch-sessions/{project-id}/`
- Terminal sessions use the project directory as their `$HOME`
- Configuration files are copied from the host system home to each project home
- Sessions are sandboxed and cannot easily escape their project directory

## 📁 Volume Mounting Strategy

Dispatch uses a clear mounting strategy with distinct purposes:

| Host Path             | Container Path          | Purpose              | Notes                              |
| --------------------- | ----------------------- | -------------------- | ---------------------------------- |
| `~/dispatch/home`     | `/home/appuser`         | **System Home**      | Shared configs, dotfiles, SSH keys |
| `~/dispatch/projects` | `/workspace`            | **Legacy Workspace** | Backward compatibility access      |
| `~/.ssh`              | `/home/appuser/.ssh:ro` | **SSH Keys**         | Read-only SSH access               |
| `~/.claude`           | `/home/appuser/.claude` | **Claude Config**    | Claude CLI configuration           |

## 🚀 Quick Start

### Using the enhanced start script (recommended)

```bash
# Use the enhanced start script with project sandboxing
chmod +x docker/start-sandboxed.sh
./docker/start-sandboxed.sh
```

### Basic run with sandboxing

```bash
# Create directories for the new structure
mkdir -p ~/dispatch/{home,projects}

# Run with project sandboxing enabled
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e PROJECT_SANDBOX_ENABLED=true \
  --user $(id -u):$(id -g) \
  -v ~/dispatch/home:/home/appuser \
  -v ~/dispatch/projects:/workspace \
  fwdslsh/dispatch:latest
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
