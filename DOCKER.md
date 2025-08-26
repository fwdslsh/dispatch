# Dispatch - Docker Usage Guide

A containerized web application that provides interactive PTY sessions accessible via browser. Run terminal sessions with Claude Code or shell environments in an isolated Docker container.

> **Quick Start**: `docker run -p 3000:3000 -e TERMINAL_KEY=your-secret-key dispatch`

## Features

✅ **Zero-config run**: `docker run` → browser → login with key → start sessions  
✅ **Authentication**: Shared secret key protection for all access  
✅ **Multi-session support**: Multiple PTY sessions per user, each isolated  
✅ **Claude Code integration**: Default mode for AI-assisted development  
✅ **Shell fallback**: Standard shell access when Claude isn't available  
✅ **LocalTunnel support**: Public URL sharing via environment flag  
✅ **Session isolation**: Each session runs in unique directory  
✅ **Non-root container**: Secure execution as non-privileged user

## Quick Start

### Basic Usage

```bash
# Run with custom authentication key
docker run -p 3000:3000 -e TERMINAL_KEY=your-secret-key dispatch

# Run in background with restart policy
docker run -d --restart unless-stopped \
  -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  --name dispatch \
  dispatch
```

Open http://localhost:3000, enter your key, and start a terminal session.

### With Public Access (LocalTunnel)

```bash
# Enable public tunnel for remote access
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -e ENABLE_TUNNEL=true \
  dispatch

# With custom subdomain
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -e ENABLE_TUNNEL=true \
  -e LT_SUBDOMAIN=my-dispatch \
  dispatch
```

The public tunnel URL will be logged to console and available at the `/public-url` endpoint.

### With Claude Code Support

For AI-assisted development, install the Claude CLI in a custom image:

```dockerfile
FROM dispatch:latest

# Switch to root to install packages
USER root

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-cli

# Switch back to non-root user
USER appuser

# Set Claude as default mode
ENV PTY_MODE=claude
```

```bash
# Build and run custom image
docker build -t dispatch-claude .
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -e PTY_MODE=claude \
  dispatch-claude
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `TERMINAL_KEY` | `change-me` | Authentication key ⚠️ **Always change this!** |
| `PTY_ROOT` | `/tmp/dispatch-sessions` | Session directory root |
| `PTY_MODE` | `shell` | Default session mode (`claude` or `shell`) |
| `ENABLE_TUNNEL` | `false` | Enable LocalTunnel for public access |
| `LT_SUBDOMAIN` | `""` | Optional LocalTunnel subdomain |

### Required Variables

- **`TERMINAL_KEY`**: Must be set to a secure value, especially when using public tunnels

### Security Notes

- Always use a strong `TERMINAL_KEY` in production
- When `ENABLE_TUNNEL=true`, the container will fail to start if `TERMINAL_KEY=change-me`
- Consider using Docker secrets for sensitive environment variables

## Port Configuration

The container exposes port `3000` by default. Map it to your desired host port:

```bash
# Standard mapping
docker run -p 3000:3000 dispatch

# Custom host port
docker run -p 8080:3000 dispatch

# Bind to specific interface
docker run -p 127.0.0.1:3000:3000 dispatch
```

## Session Management

### Session Isolation

Each terminal session:
- Runs in unique directory: `/tmp/dispatch-sessions/{uuid}`
- Has independent environment variables
- Supports either Claude Code or shell mode
- Maintains state until explicitly ended

### Session Persistence

By default, sessions are ephemeral and stored in `/tmp/dispatch-sessions`. For persistent sessions:

```bash
# Mount host directory (not recommended for security)
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -v ./sessions:/tmp/dispatch-sessions \
  dispatch

# Use named volume
docker volume create dispatch-sessions
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -v dispatch-sessions:/tmp/dispatch-sessions \
  dispatch
```

## Docker Compose

Use the included `docker-compose.yml` for easy deployment:

```yaml
version: '3.8'

services:
  dispatch:
    image: dispatch:latest
    ports:
      - "3000:3000"
    environment:
      - TERMINAL_KEY=your-secure-key-here
      - PTY_MODE=shell
      - ENABLE_TUNNEL=false
    restart: unless-stopped
    # Optional: Persistent sessions (not recommended for security)
    # volumes:
    #   - ./sessions:/tmp/dispatch-sessions
```

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Container Architecture

### Multi-stage Build

- **Build stage**: Installs dependencies and builds the SvelteKit application
- **Runtime stage**: Minimal Node.js slim image with only production dependencies

### Security Features

- **Non-root execution**: Container runs as `appuser` (uid 10001)
- **Minimal runtime**: Only necessary dependencies included
- **Isolated sessions**: Each session directory has proper permissions
- **Input validation**: All file operations validated against session boundaries

### Runtime Requirements

- **Node.js**: 22+ (included in container)
- **Memory**: Minimum 512MB recommended
- **Storage**: Ephemeral sessions require minimal space, persistent sessions vary

## Health Checks

Monitor container health with custom health checks:

```bash
# Check if application is responding
curl -f http://localhost:3000/ || exit 1

# Check public tunnel status (if enabled)
curl -s http://localhost:3000/public-url | jq -e '.url'
```

Add to Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1
```

## Troubleshooting

### Common Issues

**Container fails to start with tunnel enabled:**
```
ERROR: TERMINAL_KEY must be set when ENABLE_TUNNEL=true for security
```
Solution: Set a secure `TERMINAL_KEY` value.

**Permission denied errors:**
```
Error: EACCES: permission denied, mkdir '/tmp/dispatch-sessions'
```
Solution: Ensure proper volume permissions or run with `--user` flag if needed.

**Claude mode not working:**
```
command not found: claude
```
Solution: Install Claude CLI in a custom image (see Claude Code Support section).

### Logs and Debugging

```bash
# View container logs
docker logs dispatch

# Follow logs in real-time
docker logs -f dispatch

# Debug container
docker exec -it dispatch /bin/bash

# Check session directories
docker exec dispatch ls -la /tmp/dispatch-sessions/
```

## API Endpoints

The container exposes these HTTP endpoints:

- `GET /` - Main application interface
- `GET /public-url` - Returns LocalTunnel URL if enabled (JSON: `{"url": "..."}`)
- `WebSocket /socket.io/` - PTY session communication

### WebSocket API

Connect to `ws://localhost:3000/socket.io/` for real-time session management:

- `auth(key, callback)` - Authenticate with terminal key
- `list(callback)` - List active sessions
- `create({mode, cols, rows, meta}, callback)` - Create new session
- `attach({sessionId, cols, rows}, callback)` - Attach to existing session
- `input`, `resize`, `end`, `detach` - Session control events

## Production Deployment

### Security Considerations

1. **Use strong authentication keys**
2. **Enable HTTPS with reverse proxy** (nginx, Traefik, etc.)
3. **Restrict network access** to trusted sources
4. **Monitor session activity** and implement rate limiting
5. **Regular security updates** of base images

### Reverse Proxy Example (nginx)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    # SSL configuration here
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Scaling and Load Balancing

For multiple container instances:

```bash
# Run multiple containers with different ports
docker run -d -p 3001:3000 -e TERMINAL_KEY=key1 --name dispatch-1 dispatch
docker run -d -p 3002:3000 -e TERMINAL_KEY=key2 --name dispatch-2 dispatch
```

Note: Session state is not shared between containers. Use sticky sessions or external session storage for load balancing.

## Links

- **[Main Documentation](README.md)** - Complete development and usage guide
- **[Source Code](https://github.com/fwdslsh/dispatch)** - GitHub repository
- **[Issues](https://github.com/fwdslsh/dispatch/issues)** - Bug reports and feature requests
- **[Claude.ai](https://claude.ai)** - For Claude Code integration

---

**License**: Creative Commons Attribution 4.0 International License  
**Support**: For issues and questions, please use the [GitHub issue tracker](https://github.com/fwdslsh/dispatch/issues)