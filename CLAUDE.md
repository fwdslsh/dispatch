# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dispatch** is a containerized web application that provides interactive terminal sessions accessible via browser. It's built with SvelteKit and uses Socket.IO for real-time communication. The primary use case is providing Claude Code sessions and shell access in isolated environments with web-based terminal access.

## Development Commands

```bash
# Use correct Node.js version (22+)
nvm use

# Install dependencies
npm install

# Development server with hot reload (sets TERMINAL_KEY=testkey12345, runs on --host)
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

# Linting and formatting
npm run lint          # Check code formatting and style
npm run format        # Auto-format code with Prettier

# Testing
npm run test          # Run all unit tests
npm run test:unit     # Run unit tests with Vitest
npm run test:e2e      # Run E2E tests with Playwright
npm run test:e2e:headed    # Run E2E tests with browser UI
npm run test:e2e:debug     # Debug E2E tests
npm run test:e2e:ui        # Playwright test UI
npm run test:e2e:report    # Show E2E test reports
npm run playwright:install # Install Playwright browsers

# Testing specific features
npm run test:core     # Test core managers
npm run test:managers # Test manager classes specifically
npm run test:ui       # Run UI-specific tests
npm run test:ui:headed # Run UI tests with browser visible

# Start production server (includes build + LocalTunnel enabled)
npm start

# Alternative production start
node src/app.js

# CLI tool access
./bin/dispatch-cli.js

# Docker development commands
npm run docker:dev    # Start in dev mode with build
npm run docker:start  # Start without rebuild
npm run docker:stop   # Stop Docker containers
```

## Architecture

### Core Components

- **Frontend**: SvelteKit application with xterm.js terminal emulator
- **Backend**: Express server with Socket.IO for WebSocket communication
- **Terminal Management**: node-pty integration for spawning terminal sessions
- **Workspace Management**: WorkspaceManager class handles workspace/project organization
- **Session Management**: Unified SessionManager coordinates all session types via SessionRouter
- **Claude Integration**: ClaudeSessionManager provides Claude Code session management
- **Authentication**: ClaudeAuthManager handles OAuth flow via PTY
- **Containerization**: Multi-stage Docker build with non-root execution

### High-Level Architecture

The application follows a clean separation between frontend UI, Socket.IO communication layer, and backend services:

**SvelteKit Frontend**:

- Main interface at `/` for terminal sessions
- Project management interface at `/projects`
- Uses xterm.js for terminal emulation with Socket.IO for real-time communication
- Svelte 5 with modern reactive patterns

**Socket.IO Layer** (`src/lib/server/socket-setup.js`):

- Handles real-time bidirectional communication
- Uses shared service managers from global `__API_SERVICES`
- Manages authentication and session lifecycle
- Routes messages between frontend and backend services

**Backend Services** (initialized in `src/hooks.server.js`):

- `SessionManager`: Unified abstraction over all session types with routing
- `SessionRouter`: In-memory session mapping and routing
- `WorkspaceManager`: Directory-based workspace management with database persistence
- `TerminalManager`: PTY session management with dynamic Socket.IO reference handling
- `ClaudeSessionManager`: Claude Code integration using `@anthropic-ai/claude-code` package
- `ClaudeAuthManager`: OAuth authentication flow management via PTY

### Session Architecture

**Unified Session Model**: All sessions (terminal/Claude) are managed through a common interface:

- `SessionManager` provides unified API for creating, managing, and routing to specific session types
- `SessionRouter` maps unified session IDs to session descriptors containing type and routing info
- Individual managers (`TerminalManager`, `ClaudeSessionManager`) handle type-specific operations
- Socket.IO references are dynamically updated across all managers for real-time communication

**Session Types**:
- `pty`: Terminal sessions via node-pty
- `claude`: Claude Code sessions via `@anthropic-ai/claude-code`

### Workspace and Session Model

**Workspaces**: Directory-based workspaces with persistent metadata

- Stored in `WORKSPACES_ROOT` (default: `~/.dispatch-home/workspaces`)
- SQLite database tracks workspace metadata and session history
- Each workspace is an isolated directory environment

**Sessions**: Ephemeral session instances within workspaces

- Sessions inherit workspace directory as working directory
- Session routing via `SessionRouter` maps unified IDs to session descriptors
- Sessions persist until explicitly terminated or disconnected

### Authentication & Security

- **Shared secret authentication**: All access requires `TERMINAL_KEY`
- **Non-root container execution**: Runs as `appuser` (uid 10001) in production
- **Session isolation**: Each session contained in separate workspace directory
- **WebSocket authentication**: Auth required before terminal operations
- **Claude OAuth**: Secure authentication via interactive PTY-based flow

## Environment Configuration

### Required Variables

- `TERMINAL_KEY`: Authentication key (default: `change-me`)

### Optional Variables

- `PORT`: Server port (default: `3030`)
- `HOME`: User home directory for workspace initialization
- `WORKSPACES_ROOT`: Root directory for workspaces (default: `$HOME/.dispatch-home/workspaces`)
- `DISPATCH_CONFIG_DIR`: Configuration directory (default: `$HOME/.config/dispatch`)
- `DISPATCH_PROJECTS_DIR`: Projects root directory (default: `/workspace` in container)
- `ENABLE_TUNNEL`: Enable LocalTunnel (default: `false`)
- `LT_SUBDOMAIN`: Optional LocalTunnel subdomain
- `CONTAINER_ENV`: Container environment flag (default: `true` in Docker)

## Socket.IO API

The application uses Socket.IO for all real-time communication:

### Client Events

- `auth(key, callback)` - Authenticate without starting session
- `terminal.start(data, callback)` - Start terminal session with `{key, workspacePath, shell, env}`
- `terminal.write(data)` - Send input to terminal with `{key, id, data}`
- `terminal.resize(data)` - Resize terminal with `{key, id, cols, rows}`
- `claude.send(data)` - Send message to Claude with `{key, id, input}`
- `claude.auth.start(data)` - Initiate Claude OAuth flow
- `claude.auth.code(data)` - Submit OAuth authorization code
- `claude.commands.refresh(data, callback)` - Refresh available Claude commands
- `session.status(data, callback)` - Get session status and activity state
- `get-public-url(callback)` - Retrieve public tunnel URL

### Server Events

- `terminal.output({sessionId, data})` - Terminal output data
- `terminal.exit({sessionId, exitCode})` - Terminal session ended
- `claude.message.delta(events)` - Claude response events array
- `claude.auth.url({url})` - OAuth authorization URL
- `claude.auth.complete({success})` - OAuth completion status
- `claude.auth.error({error})` - OAuth error
- `admin.event.logged(event)` - Admin console event tracking
- `error(data)` - Error messages

## Core Service Classes

### SessionManager (`src/lib/server/core/SessionManager.js`)

Unified session management across all session types:

```javascript
// Key methods
async createSession({type, workspacePath, options}) // Create session of any type
async sendToSession(sessionId, data)               // Send data to session
async sessionOperation(sessionId, operation, params) // Perform operations like resize
getSession(sessionId)                              // Get session descriptor
setSocketIO(socket)                                // Update Socket.IO for real-time communication
```

### WorkspaceManager (`src/lib/server/core/WorkspaceManager.js`)

Manages workspace lifecycle with SQLite persistence:

```javascript
// Key methods
async init()                    // Initialize workspace database
async list()                    // List all workspace directories
async open(dir)                 // Open/create workspace
async clone(fromPath, toPath)   // Clone workspace
async rememberSession(dir, sessionDescriptor) // Persist session info
```

### SessionRouter (`src/lib/server/core/SessionRouter.js`)

Maps unified session IDs to session descriptors:

```javascript
// Key methods
bind(sessionId, descriptor)     // Register session with routing info
get(sessionId)                 // Get session descriptor
all()                          // Get all sessions
byWorkspace(workspacePath)     // Filter sessions by workspace
setProcessing(sessionId)       // Mark session as processing
setIdle(sessionId)             // Mark session as idle
```

### ClaudeSessionManager (`src/lib/server/claude/ClaudeSessionManager.js`)

Manages Claude Code sessions using `@anthropic-ai/claude-code`:

```javascript
// Key methods
async create({workspacePath, options}) // Create Claude session
list(workspacePath)                    // List Claude sessions
async send(id, userInput)              // Send message to Claude
setSocketIO(socket)                    // Update Socket.IO reference for output
async refreshCommands(sessionId)       // Refresh available Claude commands
```

### TerminalManager (`src/lib/server/terminals/TerminalManager.js`)

Manages PTY terminal sessions with dynamic Socket.IO handling:

```javascript
// Key methods
start({ workspacePath, shell, env }) // Create terminal session
write(id, data)                      // Send input to terminal
resize(id, cols, rows)               // Resize terminal
stop(id)                             // Kill terminal session
setSocketIO(socket)                  // Update Socket.IO reference for all terminals
```

### ClaudeAuthManager (`src/lib/server/claude/ClaudeAuthManager.js`)

Handles Claude OAuth authentication via PTY:

```javascript
// Key methods
start(socket)                        // Start OAuth flow
submitCode(socket, code)             // Submit authorization code
// Emits: claude.auth.url, claude.auth.complete, claude.auth.error
```

## Docker Integration

### Multi-stage Build

- **Build stage**: Install dependencies and build SvelteKit application
- **Runtime stage**: Minimal Node.js slim image with built application

### Security Features

- Non-root user execution (`appuser`, uid 10001)
- Minimal runtime dependencies
- Isolated workspace directories with proper permissions

### LocalTunnel Integration

- Optional public URL sharing via LocalTunnel
- Automatic URL detection and persistence to config directory
- Graceful cleanup on server shutdown

## Development Patterns

### Server Architecture

**Main Application** (`src/app.js`):

- Production server entry point
- Initializes directories and starts HTTP server
- Integrates SvelteKit handler with Socket.IO via `setupSocketIO()`
- Manages LocalTunnel lifecycle
- Sets up global `__DISPATCH_SOCKET_IO` for API endpoint access

**Shared Service Architecture** (`src/hooks.server.js`):

- Initializes global `__API_SERVICES` with shared manager instances
- Provides service access to both API endpoints and Socket.IO handlers
- All managers (WorkspaceManager, SessionRouter, TerminalManager, ClaudeSessionManager, SessionManager) are shared
- Database initialization and error handling

**Socket.IO Integration** (`src/lib/server/socket-setup.js`):

- Centralizes Socket.IO initialization with `setupSocketIO()` function
- Uses shared service managers from `hooks.server.js` via `__API_SERVICES`
- Handles authentication and session management
- Coordinates between frontend and backend services
- Admin event tracking and history management

**Vite Development** (`vite.config.js`):

- Custom Socket.IO plugin for development server
- Separate test configurations for client and server
- Browser testing with Playwright integration

### Frontend Components

**Terminal Integration**: Uses `@battlefieldduck/xterm-svelte` for terminal UI
**UI Framework**: Augmented UI for futuristic styling components
**State Management**: Modern Svelte 5 reactive patterns

## Testing & Debugging

### Test Configuration

The project uses Vitest with separate client/server test projects:

- **Client tests**: Browser environment with Playwright (`tests/**/*.svelte.{test,spec}.{js,ts}`)
- **Server tests**: Node environment for backend logic (`tests/**/*.{test,spec}.{js,ts}`)
- **E2E tests**: Full Playwright integration testing
- **Core tests**: Manager-specific tests for core functionality
- **UI tests**: Browser-based UI component tests
- **Debugging Tools**: Various test scripts for specific features

### Development Mode

- Vite dev server with hot reload and Socket.IO integration
- Development-specific authentication bypass options
- Console debugging for Socket.IO events and session lifecycle
- Admin console for real-time monitoring at `/console?key=your-terminal-key`

### Production Deployment

For production:

1. Set strong `TERMINAL_KEY` (especially with `ENABLE_TUNNEL=true`)
2. Mount persistent volumes for workspace data
3. Configure proper directory permissions for container user
4. Claude Code integration requires Claude CLI in container

## Key Dependencies & Versions

- **Node.js**: >=22 (see `.nvmrc` and `package.json` engines)
- **@anthropic-ai/claude-code**: Claude Code CLI integration
- **xterm.js**: Terminal emulator with Svelte wrapper (`@battlefieldduck/xterm-svelte`)
- **Socket.IO**: Real-time bidirectional communication (v4.8.1)
- **node-pty**: Pseudoterminal management (via Claude Code package)
- **augmented-ui**: Futuristic UI components
- **SvelteKit**: Full-stack web framework with adapter-node
- **Vitest**: Testing framework with Playwright integration
- **SQLite**: Database for workspace and session persistence
- **Commander**: CLI argument parsing

## Runtime Requirements & Constraints

- Container runs as non-root user (`appuser`, uid 10001)
- Workspace directories require proper permissions for container user
- Workspaces persist when using persistent volume mounts
- Sessions are ephemeral and tied to workspace lifecycle
- Claude integration requires network access for API calls
- LocalTunnel requires network access for public URLs
- File system permissions must allow directory creation in configured paths

## Key Architectural Patterns

### Global Service Sharing

- `__API_SERVICES` global provides shared service instances
- Services are initialized once in `hooks.server.js` and reused across Socket.IO and API endpoints
- Socket.IO references are dynamically updated across managers for real-time communication

### Unified Session Management

- `SessionManager` provides consistent API for all session types
- `SessionRouter` handles unified ID mapping and session state tracking
- Type-specific managers handle implementation details
- Activity state tracking (`processing`, `streaming`, `idle`) for UI feedback

### Database Integration

- SQLite database for persistent storage
- Workspace metadata and session history
- Database initialization and error handling
- Migration support for schema changes

### Authentication Flow

- Shared key authentication for general access
- Claude-specific OAuth flow handled via PTY interaction
- Session-level authentication tracking
- Admin console with same authentication system

## Admin Console

Access at `/console?key=your-terminal-key` for:

- Real-time socket monitoring
- Event history and tracking
- Server logs and debugging
- Connection management