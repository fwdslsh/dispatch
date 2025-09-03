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

# Development server only (no client)
npm run dev:server

# Development without authentication (TERMINAL_KEY not required)
npm run dev:no-key

# Development with LocalTunnel enabled
npm run dev:tunnel

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

# CLI tool access
./bin/dispatch-cli.js
```

## Architecture

### Core Components

- **Frontend**: SvelteKit application with xterm.js terminal emulator
- **Backend**: Express server with Socket.IO for WebSocket communication
- **Terminal Management**: node-pty for spawning and managing PTY sessions
- **Project Management**: Hierarchical project/session organization with DirectoryManager
- **Session Storage**: JSON-based project registry and session persistence  
- **Containerization**: Multi-stage Docker build with non-root execution
- **UI Framework**: Uses augmented-ui for futuristic styling (see https://augmented-ui.com/docs/)

### Simple Architecture Patterns

This codebase emphasizes maintainability through **simple, focused patterns**:

- **Handler-based Architecture**: Each domain (sessions, projects, terminal I/O) has dedicated handlers with single responsibilities
- **Service Layer**: Clean separation with services that encapsulate business logic (`TerminalConfigurationService`, `ClaudeCodeService`)
- **Dependency Injection**: Services are injected into handlers for easy testing and swapping
- **Constants Centralization**: All magic numbers, strings, and configuration in `/src/lib/config/constants.js`
- **Unified Storage**: `StorageManager` abstraction eliminates scattered file operations
- **Consistent Error Handling**: Standardized error response patterns throughout
- **ESM Modules**: Clean ES module structure with explicit imports/exports

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
│   ├── config/
│   │   └── constants.js       # Centralized configuration constants
│   ├── services/              # Business logic services
│   │   ├── TerminalConfigurationService.js
│   │   ├── ClaudeCodeService.js
│   │   └── TerminalHistoryService.js
│   ├── utils/                 # Shared utilities
│   ├── contexts/              # Svelte 5 contexts for state management
│   └── server/
│       ├── handlers/          # Specialized event handlers
│       │   ├── SessionHandler.js
│       │   ├── ProjectHandler.js
│       │   └── TerminalIOHandler.js
│       ├── middleware/        # Cross-cutting concerns (auth, validation)
│       ├── config/            # Server configuration
│       ├── socket-handler.js  # Main Socket.IO coordinator
│       ├── terminal.js        # TerminalManager class for PTY sessions
│       ├── session-store.js   # Session metadata persistence 
│       └── directory-manager.js # Project and session directory management
├── bin/
│   └── dispatch-cli.js        # CLI tool entry point
└── routes/
    ├── +page.svelte          # Main application interface
    ├── sessions/+page.svelte # Session management interface
    ├── sessions/[id]/+page.svelte # Individual session view
    └── public-url/+server.js # LocalTunnel URL endpoint
```

### Project and Session Architecture

The application organizes work into projects with isolated sessions:

**Project Structure:**
- **Project registry**: Stored in `DISPATCH_CONFIG_DIR/projects.json` (default: `/home/appuser/.config/dispatch/projects.json`)
- **Project directories**: Each project gets its own directory in `DISPATCH_PROJECTS_DIR` (default: `/var/lib/dispatch/projects`)
- **Unique project IDs**: Generated using timestamps and random values for uniqueness

**Session Architecture:**
Each terminal session runs within a project context:
- **Session directory**: `{project_path}/sessions/{session_uuid}`
- **Independent environment**: Separate HOME and working directory per session
- **Process isolation**: Each session spawns its own PTY process
- **Project inheritance**: Sessions inherit the project's working directory and context
- **Mode selection**: Supports both Claude Code (`claude`) and shell (`bash`) modes

### Authentication & Security

- **Shared secret authentication**: All access requires `TERMINAL_KEY`
- **Non-root container execution**: Runs as `appuser` (uid 10001)
- **Session isolation**: Each session contained in separate directory
- **WebSocket authentication**: Auth required before terminal operations
- **Claude AI Authentication**: Interactive web-based OAuth flow for Claude access (see [Claude Authentication Guide](docs/claude-authentication.md))

## Environment Configuration

### Required Variables
- `TERMINAL_KEY`: Authentication key (default: `change-me`)

### Optional Variables
- `PORT`: Server port (default: `3030`)
- `DISPATCH_CONFIG_DIR`: Configuration directory (default: `/home/appuser/.config/dispatch`)
- `DISPATCH_PROJECTS_DIR`: Projects root directory (default: `/var/lib/dispatch/projects`)
- `PTY_MODE`: Default session mode (default: `shell`, can be `claude`)
- `ENABLE_TUNNEL`: Enable LocalTunnel (default: `false`)
- `LT_SUBDOMAIN`: Optional LocalTunnel subdomain
- `CONTAINER_ENV`: Container environment flag (default: `true` in Docker)

## Socket.IO API

The application uses Socket.IO for all terminal communication:

### Client Events
- `auth(key, callback)` - Authenticate with terminal key
- `create(opts, callback)` - Create new PTY session with `{mode, cols, rows, meta, project}` (project optional)
- `attach(opts, callback)` - Attach to existing session with `{sessionId, cols, rows}`
- `list(callback)` - Get all sessions (no auth required)
- `listProjects(callback)` - Get all projects 
- `input(data)` - Send input to attached session
- `resize(dims)` - Resize terminal with `{cols, rows}`
- `end(sessionId?)` - End session (current if no ID provided)
- `detach()` - Detach from session without ending it

### Server Events
- `output(data)` - Terminal output data
- `ended({exitCode, signal})` - Session terminated
- `sessions-updated(sessions)` - Broadcast when session list changes

## Terminal and Project Management

The `TerminalManager` class works with `DirectoryManager` to handle PTY lifecycle within projects:

### Project Creation
1. Generate unique project ID using timestamp and random values
2. Create project directory in `DISPATCH_PROJECTS_DIR`
3. Register project in project registry (`DISPATCH_CONFIG_DIR/projects.json`)
4. Set up project metadata and permissions

### Session Creation
1. Generate unique session ID (UUID)
2. Create session directory within project: `{project_path}/sessions/{session_uuid}`
3. Spawn PTY process with specified mode (`claude` or shell)
4. Set up environment variables (`HOME`, `TERM`, etc.) with project context
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

## Development Patterns for Maintainability

### Code Organization Principles
- **Single Responsibility**: Each module focuses on one concern (handlers, services, utilities)
- **Explicit Dependencies**: All imports/exports are clearly declared
- **Constants over Magic**: Use `/src/lib/config/constants.js` for all configuration values
- **Error First**: Consistent error handling patterns across all modules
- **Service Layer**: Business logic isolated in services, separate from I/O concerns

### Component Architecture (Svelte 5)
- **Modern Runes**: Components use `$state`, `$derived`, `$props` for reactive state
- **Context-based State**: Shared state via Svelte 5 contexts in `/src/lib/contexts/`
- **Clean Separation**: UI components don't contain business logic
- **Responsive Design**: Mobile-first with consistent breakpoints from constants

### Handler Pattern
Each Socket.IO event type has a dedicated handler:
- `SessionHandler` - Session lifecycle management
- `ProjectHandler` - Project operations
- `TerminalIOHandler` - Terminal input/output processing

Handlers receive injected services and use consistent error response patterns.

### Configuration Management
All configuration centralized in `/src/lib/config/constants.js`:
- Terminal settings and validation rules
- UI responsive breakpoints and dimensions
- Storage keys and file paths
- Error codes and messages
- Project sandboxing settings

### Error Handling Patterns
- **Consistent Responses**: Standard error format across all handlers
- **Graceful Degradation**: Fallbacks for PTY failures and socket disconnections
- **User Feedback**: Clear error messages without exposing implementation details
- **Cleanup**: Automatic resource cleanup on failures

### UI Styling Guidelines
- Uses augmented-ui library for futuristic interface elements
- Reference https://augmented-ui.com/docs/ when working with augmented-ui styles
- Consistent theme with CSS custom properties (--bg-darker, --primary, --surface, etc.)
- Mobile keyboard detection and viewport management

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
4. Mount persistent volumes for project data:
   - `~/dispatch-config:/home/appuser/.config/dispatch` (project registry)
   - `~/dispatch-projects:/var/lib/dispatch/projects` (project storage)

### Common Debug Points
- Handler initialization and dependency injection in `socket-handler.js`
- Project creation workflow in `directory-manager.js`
- PTY session lifecycle in `terminal.js` 
- Terminal component state management in `Terminal.svelte`
- Configuration loading from `/src/lib/config/constants.js`
- Service interactions in handlers (session, project, terminal I/O)

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
- Project and session directories require proper permissions
- Projects persist when using persistent volume mounts
- Sessions are ephemeral within their project context
- Claude CLI must be installed separately for Claude mode
- LocalTunnel requires network access for public URLs
- File system permissions must allow directory creation in `DISPATCH_CONFIG_DIR` and `DISPATCH_PROJECTS_DIR`