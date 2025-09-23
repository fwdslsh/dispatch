# Dispatch Docker Usage

This document explains how to run Dispatch using Docker with persistent storage.

## 🚀 Quick Start

### Using Docker Compose (recommended)

```bash
# Clone the repository and navigate to it
git clone https://github.com/fwdslsh/dispatch
cd dispatch

# Start with docker-compose
docker-compose up -d
```

### Basic Docker Run

```bash
# Create directories for persistent storage
mkdir -p dispatch-config dispatch-projects

# Run the container
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -v ./dispatch-config:/config \
  -v ./dispatch-projects:/projects \
  fwdslsh/dispatch:latest
```

Open your browser at `http://localhost:3030` and enter the password you set in `TERMINAL_KEY`.

## 📁 Volume Mounts

Dispatch uses a simple volume mounting strategy:

| Host Path              | Container Path | Purpose                       |
| ---------------------- | -------------- | ----------------------------- |
| `./dispatch-config`    | `/config`      | Configuration and settings    |
| `./dispatch-projects`  | `/projects`    | Project files and workspaces  |
| `./dispatch-workspace` | `/workspace`   | Temporary workspace directory |

The container runs as root internally, which allows it to write to mounted volumes without changing host permissions. Your host files remain owned by your user.

## Run with Public URL Sharing

```bash
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -e ENABLE_TUNNEL=true \
  -v ./dispatch-config:/config \
  -v ./dispatch-projects:/projects \
  fwdslsh/dispatch:latest
```

When `ENABLE_TUNNEL=true` the container will create a public URL. Always use a strong `TERMINAL_KEY` when enabling public access.

## Environment Variables

- `TERMINAL_KEY` (required) — Password for web UI authentication
- `PORT` (default: `3030`) — Server port inside the container
- `ENABLE_TUNNEL` (default: `false`) — Enable public URL sharing via LocalTunnel
- `LT_SUBDOMAIN` (optional) — Custom LocalTunnel subdomain

## Troubleshooting

### Port Conflicts

If port 3030 is already in use, map to a different host port:

```bash
# Use port 8080 on the host instead
docker run -p 8080:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -v ./dispatch-config:/config \
  -v ./dispatch-projects:/projects \
  fwdslsh/dispatch:latest
```

### Tunnel Not Working

- Verify `ENABLE_TUNNEL=true` is set
- Check network/firewall rules allow outbound connections
- LocalTunnel may be rate-limited; retry or set a custom `LT_SUBDOMAIN`

### Directory Permissions

The container runs as root internally to handle file permissions transparently. If you need to restrict access, mount volumes as read-only:

```bash
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -v ./dispatch-config:/config:ro \
  -v ./dispatch-projects:/projects \
  fwdslsh/dispatch:latest
```

## Security Notes

- Always use a strong `TERMINAL_KEY`, especially when enabling public URLs
- The container provides terminal access - use with appropriate caution
- Volume mounts restrict container access to specific host directories

## Building Locally

To build the image locally instead of using Docker Hub:

```bash
# Build the image
docker build -f docker/Dockerfile -t dispatch:local .

# Run your local build
docker run -p 3030:3030 \
  -e TERMINAL_KEY=your-secret-password \
  -v ./dispatch-config:/config \
  -v ./dispatch-projects:/projects \
  dispatch:local
```

## Further Reading

- See `docker/Dockerfile` for the image build process
- See `docker-compose.yml` for the complete Docker Compose configuration
- See `CONTRIBUTING.md` for development instructions
