# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dispatch** is a containerized web application that provides interactive PTY (pseudoterminal) sessions accessible via browser. It's built with SvelteKit and uses Socket.IO for real-time terminal communication. The primary use case is providing Claude Code sessions in isolated Docker environments with web-based terminal access.

## Development Commands

```bash
# Use correct Node.js version (22+)
nvm use

# Install dependencies
npm install

# Development server with hot reload (sets TERMINAL_KEY=test, runs on --host)
npm run dev

# Build for production  
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Watch mode type checking
npm run check:watch

# Start production server (includes build + LocalTunnel enabled)
npm start

# Alternative production start
node src/app.js
# OR use the wrapper script
./start.sh
```

## Architecture

### Core Components

- **Frontend**: SvelteKit application with xterm.js terminal emulator
- **Backend**: Express server with Socket.IO for WebSocket communication
- **Terminal Management**: node-pty for spawning and managing PTY sessions
- **Session Storage**: Simple JSON-based session persistence  
- **Containerization**: Multi-stage Docker build with non-root execution
- **UI Framework**: Uses augmented-ui for futuristic styling (see https://augmented-ui.com/docs/)

### Key Files Structure

```
src/
├── app.js                     # Production server entry point
├── app.css                    # Global styles with augmented-ui
├── lib/
│   ├── components/
│   │   ├── Terminal.svelte    # Main terminal component with xterm.js
│   │   ├── Chat.svelte        # Chat/auxiliary UI component
│   │   ├── HeaderToolbar.svelte # Navigation toolbar
│   │   └── Icons/             # SVG icon components
│   └── server/
│       ├── socket-handler.js  # Socket.IO connection management
│       ├── terminal.js        # TerminalManager class for PTY sessions
│       ├── session-store.js   # Session metadata persistence (stores file at PTY_ROOT/sessions.json)
│       └── sessions.json      # Session storage file created at runtime in PTY_ROOT (default /tmp/dispatch-sessions/sessions.json)
└── routes/
    ├── +page.svelte          # Main application interface
    ├── sessions/+page.svelte # Session management interface
    ├── sessions/[id]/+page.svelte # Individual session view
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
- `PORT`: Server port (default: `3030`)
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
- Mobile-first responsive design with keyboard handling

### UI Styling Guidelines
- Uses augmented-ui library for futuristic interface elements
- Reference https://augmented-ui.com/docs/ when working with augmented-ui styles
- Consistent theme with CSS custom properties (--bg-darker, --primary, --surface, etc.)
- Mobile keyboard detection and viewport management

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

### Development Access
- Development server runs on all interfaces (`--host` flag)
- Default auth key in development: `test`
- Access at `http://localhost:3030` with key `test`

## Key Dependencies & Versions

- **Node.js**: >=22 (see `.nvmrc` and `package.json` engines)
- **xterm.js**: Terminal emulator with addon support
- **Socket.IO**: Real-time bidirectional communication
- **node-pty**: Pseudoterminal management
- **augmented-ui**: Futuristic UI components
- **SvelteKit**: Full-stack web framework
- **Playwright**: Testing framework (available but not configured)

## Runtime Requirements & Constraints

- Container runs as non-root user (`appuser`, uid 10001)
- Session directories are ephemeral and isolated
- Claude CLI must be installed separately for Claude mode
- LocalTunnel requires network access for public URLs
- File system permissions must allow session directory creation