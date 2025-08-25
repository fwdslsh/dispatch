# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dispatch** is a containerized web application that provides interactive PTY (pseudoterminal) sessions accessible via browser. It's built with SvelteKit and uses Socket.IO for real-time terminal communication. The primary use case is providing Claude Code sessions in isolated Docker environments with web-based terminal access.

## Development Commands

```bash
# Install dependencies
npm install

# Development server with hot reload
npm run dev

# Build for production  
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Watch mode type checking
npm run check:watch

# Start production server
npm start
```

## Architecture

### Core Components

- **Frontend**: SvelteKit application with xterm.js terminal emulator
- **Backend**: Express server with Socket.IO for WebSocket communication
- **Terminal Management**: node-pty for spawning and managing PTY sessions
- **Session Storage**: Simple JSON-based session persistence
- **Containerization**: Multi-stage Docker build with non-root execution

### Key Files Structure

```
src/
├── app.js                     # Production server entry point
├── lib/
│   ├── components/
│   │   └── Terminal.svelte    # Main terminal component with xterm.js
│   └── server/
│       ├── socket-handler.js  # Socket.IO connection management
│       ├── terminal.js        # TerminalManager class for PTY sessions
│       ├── session-store.js   # Session metadata persistence
│       └── sessions.json      # Session storage file
└── routes/
    ├── +page.svelte          # Main application interface
    ├── session/[id]/+page.svelte  # Individual session view
    ├── sessions/+page.svelte # Session management interface
    └── public-url/+server.js # LocalTunnel URL endpoint
```

### Session Architecture

Each terminal session runs in isolation:
- **Unique directory**: `/tmp/dispatch-sessions/{uuid}`
- **Independent environment**: Separate HOME and working directory
- **Process isolation**: Each session spawns its own PTY process
- **Mode selection**: Supports both Claude Code (`claude`) and shell (`bash`) modes

### Authentication & Security

- **Shared secret authentication**: All access requires `TERMINAL_KEY`
- **Non-root container execution**: Runs as `appuser` (uid 10001)
- **Session isolation**: Each session contained in separate directory
- **WebSocket authentication**: Auth required before terminal operations

## Environment Configuration

### Required Variables
- `TERMINAL_KEY`: Authentication key (default: `change-me`)

### Optional Variables
- `PORT`: Server port (default: `3000`)
- `PTY_ROOT`: Session directory root (default: `/tmp/dispatch-sessions`)
- `PTY_MODE`: Default session mode (default: `shell`, can be `claude`)
- `ENABLE_TUNNEL`: Enable LocalTunnel (default: `false`)
- `LT_SUBDOMAIN`: Optional LocalTunnel subdomain

## Socket.IO API

The application uses Socket.IO for all terminal communication:

### Client Events
- `auth(key, callback)` - Authenticate with terminal key
- `create(opts, callback)` - Create new PTY session with `{mode, cols, rows, meta}`
- `attach(opts, callback)` - Attach to existing session with `{sessionId, cols, rows}`
- `list(callback)` - Get all sessions (no auth required)
- `input(data)` - Send input to attached session
- `resize(dims)` - Resize terminal with `{cols, rows}`
- `end(sessionId?)` - End session (current if no ID provided)
- `detach()` - Detach from session without ending it

### Server Events
- `output(data)` - Terminal output data
- `ended({exitCode, signal})` - Session terminated
- `sessions-updated(sessions)` - Broadcast when session list changes

## Terminal Management

The `TerminalManager` class handles PTY lifecycle:

### Session Creation
1. Generate unique session ID (UUID)
2. Create isolated directory in `PTY_ROOT`
3. Spawn PTY process with specified mode (`claude` or shell)
4. Set up environment variables (`HOME`, `TERM`, etc.)
5. Register cleanup handlers for process exit

### Mode Switching
- **Claude Mode**: Spawns `claude` command for AI-assisted development
- **Shell Mode**: Spawns user's default shell (`$SHELL` or `/bin/bash`)

## Docker Integration

### Multi-stage Build
- **Build stage**: Install dependencies and build application
- **Runtime stage**: Minimal Node.js slim image with built application

### Security Features
- Non-root user execution (`appuser`)
- Minimal runtime dependencies
- Isolated session directories with proper permissions

### LocalTunnel Integration
- Optional public URL sharing via LocalTunnel
- Automatic URL detection and persistence to `/tmp/tunnel-url.txt`
- Graceful cleanup on server shutdown

## Development Patterns

### Component Architecture
- `Terminal.svelte`: Main terminal interface with xterm.js integration
- Socket.IO client management with authentication flow
- Responsive terminal sizing with ResizeObserver and window events
- Session persistence using localStorage

### Error Handling
- Graceful PTY process failures
- Socket disconnection recovery
- Authentication error feedback
- Session cleanup on unexpected termination

### State Management
- Session metadata stored in JSON file
- Socket-to-session mapping for connection tracking
- Broadcast updates when session list changes

## Testing & Debugging

### Development Mode
- Vite dev server with hot reload
- Socket.IO integrated via Vite plugin
- Development-specific error handling

### Production Deployment
For production with Claude Code:
1. Install Claude CLI in container: `npm install -g @anthropic-ai/claude-cli`
2. Set `PTY_MODE=claude`
3. Configure authentication key
4. Use volume mounts for session persistence if needed

### Common Debug Points
- Socket authentication flow in `socket-handler.js:17-26`
- PTY session creation in `terminal.js:36-86`
- Terminal component initialization in `Terminal.svelte:28-62`
- LocalTunnel URL extraction in `app.js:38-76`