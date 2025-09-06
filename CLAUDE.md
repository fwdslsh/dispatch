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

### Architecture Patterns

This codebase follows modern modular patterns for maintainability:

- **Feature-based Organization**: Code organized by features (projects, sessions, session-types) with shared utilities
- **MVVM Architecture**: ViewModels separate UI logic from components using Svelte 5 runes (`$state`, `$derived`)
- **Session Type System**: Pluggable session types (Claude, Shell) with isolated namespaced handlers
- **Service Layer**: Business logic encapsulated in services with dependency injection
- **Centralized Configuration**: Feature-specific config files and shared constants
- **Svelte 5 Contexts**: Modern reactive state management with contexts and runes
- **ESM Modules**: Clean ES module structure with explicit imports/exports

### Feature-Based Architecture

The codebase is now organized around features with clear separation:

```
src/
├── app.js                     # Production server entry point
├── app.css                    # Global styles with augmented-ui
├── lib/
│   ├── projects/              # Project management feature
│   │   ├── components/        # Project UI components
│   │   ├── services/          # Project services
│   │   └── config.js          # Project configuration
│   ├── sessions/              # Session management feature
│   │   ├── components/        # Session UI components & ViewModels
│   │   ├── services/          # Session services
│   │   └── config.js          # Session configuration
│   ├── session-types/         # Pluggable session type system
│   │   ├── registry.js        # Session type registry
│   │   ├── index.js           # Main entry point & initialization
│   │   ├── shared/            # Base classes & utilities
│   │   ├── claude/            # Claude Code session type
│   │   │   ├── components/    # Claude-specific components
│   │   │   ├── server/        # Claude server handlers
│   │   │   └── utils/         # Claude utilities
│   │   └── shell/             # Shell session type
│   │       ├── components/    # Shell-specific components
│   │       ├── server/        # Shell server handlers
│   │       └── utils/         # Shell utilities
│   ├── shared/                # Shared components & utilities
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # Svelte 5 contexts
│   │   └── utils/             # Shared utilities & constants
│   ├── services/              # Core application services
│   └── server/                # Core server infrastructure
│       ├── handlers/          # Main Socket.IO handlers
│       ├── middleware/        # Auth & validation middleware
│       ├── socket-handler.js  # Socket.IO coordinator
│       └── namespaced-socket-handler.js # Session type handler routing
├── bin/
│   └── dispatch-cli.js        # CLI tool entry point
└── routes/
    ├── +page.svelte          # Main application interface
    ├── projects/+page.svelte # Project management interface
    └── projects/[id]/+page.svelte # Individual project view
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

### Session Type System

The application now uses a pluggable session type architecture:

**Session Type Registry**: Central registry managing available session types

- **Static Registration**: Session types are statically imported and registered for build optimization
- **Namespace Isolation**: Each session type operates in its own Socket.IO namespace
- **Extensible**: New session types can be added by implementing `BaseSessionType`

**Built-in Session Types**:

- **Claude (`claude`)**: AI-assisted development using Claude Code CLI
- **Shell (`shell`)**: Traditional shell sessions with customizable terminals

**Handler System**: Each session type provides its own Socket.IO handlers:

- `src/lib/session-types/claude/server/` - Claude-specific server handlers
- `src/lib/session-types/shell/server/` - Shell-specific server handlers

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

- **Feature-First**: Code organized by features (projects, sessions, session-types) rather than technical layers
- **MVVM Pattern**: ViewModels handle business logic, Components handle UI, Models handle data
- **Explicit Dependencies**: All imports/exports are clearly declared with ESM modules
- **Configuration per Feature**: Each feature has its own `config.js` alongside shared constants
- **Shared Foundation**: Common components, contexts, and utilities in `/src/lib/shared/`

### MVVM Architecture (Svelte 5)

**ViewModels**: Handle business logic using Svelte 5 runes

- Located alongside components (e.g., `DirectoryPickerViewModel.svelte.js`)
- Use `$state`, `$derived`, `$effect` for reactive business logic
- Clean separation from UI concerns

**Components**: Focus purely on presentation

- Use `$props` to receive data from ViewModels
- Minimal business logic, primarily UI event handling
- Responsive design with mobile-first approach

**Contexts**: Global state management

- Located in `/src/lib/shared/contexts/` for shared state
- Feature-specific contexts within feature directories
- Use Svelte 5 context API with runes for reactivity

### Server Architecture

**Main Socket.IO Handlers**: Core application handlers in `/src/lib/server/handlers/`

- `session-handler.js` - Session lifecycle management
- `project-handler.js` - Project operations
- `auth-handler.js` - Authentication handling

**Namespaced Session Type Handlers**: Isolated handlers per session type

- Routed through `namespaced-socket-handler.js`
- Each session type provides its own handlers via factory functions
- Complete isolation between session types for security and maintainability

**Middleware**: Cross-cutting concerns

- `auth-middleware.js` - Authentication validation
- `auth-decorators.js` - Handler authentication decoration

### Configuration Management

**Feature-specific Configuration**: Each feature has its own `config.js`

- `/src/lib/projects/config.js` - Project-related constants
- `/src/lib/sessions/config.js` - Session-related constants
- `/src/lib/session-types/*/config.js` - Session type specific configs

**Shared Configuration**: Common utilities in `/src/lib/shared/utils/constants.js`

- Core application constants
- UI breakpoints and dimensions
- Shared validation rules

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

- Session type registration and initialization in `src/lib/session-types/index.js`
- Namespaced handler routing in `src/lib/server/namespaced-socket-handler.js`
- Project creation workflow in `src/lib/server/directory-manager.js`
- MVVM patterns in ViewModels (e.g., `DirectoryPickerViewModel.svelte.js`)
- Socket.IO namespace isolation for session types
- Feature configuration loading from respective `config.js` files

### Development Access

- Development server runs on all interfaces (`--host` flag)
- Default auth key in development: `testkey12345`
- Access at `http://localhost:5173` during development
- Production access at `http://localhost:3030` with configured key

## Key Dependencies & Versions

- **Node.js**: >=22 (see `.nvmrc` and `package.json` engines)
- **xterm.js**: Terminal emulator with addon support
- **Socket.IO**: Real-time bidirectional communication
- **node-pty**: Pseudoterminal management
- **augmented-ui**: Futuristic UI components
- **SvelteKit**: Full-stack web framework
- **Playwright**: Testing framework (available but not configured)

**VERY IMPORTANT** Use the svelte-llm MCP tool to review documentation on modern Svelte syntax, SvelteKit best practices, and any other Svelte or SvelteKit related information.

## Runtime Requirements & Constraints

- Container runs as non-root user (`appuser`, uid 10001)
- Project and session directories require proper permissions
- Projects persist when using persistent volume mounts
- Sessions are ephemeral within their project context
- Claude CLI must be installed separately for Claude mode
- LocalTunnel requires network access for public URLs
- File system permissions must allow directory creation in `DISPATCH_CONFIG_DIR` and `DISPATCH_PROJECTS_DIR`
