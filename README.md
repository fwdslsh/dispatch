# Dispatch - SvelteKit PTY + Claude Code in Docker

A containerized web application that provides interactive PTY sessions in Docker, accessible via browser. Each session starts in its own isolated folder with support for Claude Code or shell environments.

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

### Local Development

```bash
# Use the correct Node.js version (22+)
nvm use

# Install dependencies
npm install

# Build the application
npm run build

# Run with default settings
TERMINAL_KEY=your-secret-key node src/app.js
```

**Note**: This project includes a `.nvmrc` file that specifies Node.js version 22. Run `nvm use` to automatically switch to the correct version.

Open http://localhost:3000, enter your key, and start a terminal session.

### Docker Usage

```bash
# Build the container
docker build -t dispatch .

# Run with custom key
docker run -p 3000:3000 -e TERMINAL_KEY=your-secret-key dispatch

# Run with public tunnel
docker run -p 3000:3000 \
  -e TERMINAL_KEY=your-secret-key \
  -e ENABLE_TUNNEL=true \
  dispatch
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `TERMINAL_KEY` | `change-me` | Authentication key (⚠️ change this!) |
| `PTY_ROOT` | `/tmp/dispatch-sessions` | Session directory root |
| `PTY_MODE` | `shell` | Default session mode (`claude` or `shell`) |
| `ENABLE_TUNNEL` | `false` | Enable LocalTunnel for public access |
| `LT_SUBDOMAIN` | `""` | Optional LocalTunnel subdomain |

## Architecture

```
┌─────────────────┐    ├───────────────────┤    ┌──────────────┐
│   Browser       │◄──►│   SvelteKit       │◄──►│  PTY Session │
│   (xterm.js)    │    │   + Socket.IO     │    │  (isolated)  │
└─────────────────┘    └───────────────────┘    └──────────────┘
                               │
                               ▼
                       ┌───────────────────┐
                       │   LocalTunnel     │
                       │   (optional)      │
                       └───────────────────┘
```

### Components

- **Frontend**: SvelteKit + xterm.js for browser terminal
- **Backend**: Socket.IO server for real-time PTY communication  
- **Session Manager**: node-pty for isolated shell/Claude sessions
- **Tunneling**: LocalTunnel for public URL sharing
- **Container**: Docker with non-root user execution

## Session Isolation

Each terminal session:
- Runs in unique directory: `/sessions/{uuid}`
- Has independent environment
- Supports either Claude Code or shell mode
- Maintains state until explicitly ended

## Security

- All access requires authentication with `TERMINAL_KEY`
- Container runs as non-root user (`appuser`)
- Sessions isolated in separate directories
- No persistent storage beyond session lifetime

## API Endpoints

- `GET /` - Main application interface
- `GET /public-url` - Returns LocalTunnel URL if enabled
- `WebSocket /socket.io/` - PTY session communication

Note: The previous REST session management endpoint (`/sessions/api`) has been deprecated. Use the WebSocket API (`socket.io`) to list, create, attach, and end sessions. See the "WebSocket usage" section below.

### WebSocket usage

Clients should connect to the Socket.IO server and use these events:

- `list` (callback) — returns `{ ok: true, sessions: [...], active }`
- `create` (opts, callback) — create PTY; server expects `{ mode, cols, rows, meta }`; callback returns `{ ok: true, sessionId }`
- `attach` (opts, callback) — attach to existing session `{ sessionId, cols, rows }`
- `end` (sessionId?) — end a session; server broadcasts `sessions-updated`
- server broadcasts `sessions-updated` whenever session metadata changes

## Development

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check
```

## Production Deployment

For production deployment with Claude Code:

1. Install Claude CLI in the container
2. Set `PTY_MODE=claude` 
3. Configure appropriate authentication
4. Use volume mounts for persistent data if needed

```dockerfile
# Add to Dockerfile for Claude support
RUN npm install -g @anthropic-ai/claude-cli
ENV PTY_MODE=claude
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both shell and Claude modes
5. Submit a pull request

## License

MIT License - see LICENSE file for details.