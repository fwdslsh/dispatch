# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dispatch** is a containerized web application providing interactive terminal sessions via browser. Built with SvelteKit, Socket.IO, and node-pty, it enables Claude Code sessions and shell access in isolated environments with web-based terminal access.

## Architecture - Unified Session Management

The codebase uses a modern unified session architecture with event sourcing:

### Core Architecture Components

**RunSessionManager** (`src/lib/server/runtime/RunSessionManager.js`):

- Single source of truth for all session types via adapter pattern
- Event-sourced history with monotonic sequence numbers for replay capability
- Real-time event emission to Socket.IO clients
- Supports session persistence and multi-client synchronization

**Adapter Pattern** (organized by feature):

- `src/lib/server/terminal/PtyAdapter.js` - Terminal sessions via node-pty
- `src/lib/server/claude/ClaudeAdapter.js` - Claude Code sessions via @anthropic-ai/claude-code
- `src/lib/server/file-editor/FileEditorAdapter.js` - File editing sessions
- Clean abstraction for adding new session types via adapter interface

**Socket.IO Events** (unified protocol):

- `client:hello` - Client identification with clientId
- `run:attach` - Attach to run session with event replay from sequence
- `run:input` - Send input to any session type
- `run:close` - Terminate session
- `run:event` - Server-sent events with (channel, type, payload)

## Development Commands

```bash
# Node.js 22+ required
nvm use

# Install dependencies
npm install

# Development modes
npm run dev               # Dev server with TERMINAL_KEY=testkey12345
npm run dev:local        # Use $HOME/code as workspace root
npm run dev:no-key       # No authentication required
npm run dev:tunnel       # With LocalTunnel enabled

# Testing
npm run test             # All unit tests
npm run test:unit        # Vitest unit tests
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:headed  # E2E with browser UI
npm run test:unit        # Vitest unit tests
npm run test:original    # Run tests with original session management
npm run test:simplified  # Run tests with simplified sessions

# Building & Production
npm run build            # Production build
npm run preview          # Preview build
npm start               # Build + start with LocalTunnel

# Code Quality
npm run check           # Type checking
npm run lint            # ESLint + Prettier check
npm run format          # Auto-format with Prettier

# Docker
npm run docker:dev      # Dev mode with build
npm run docker:start    # Start without rebuild
npm run docker:stop     # Stop containers
```

## Frontend MVVM Architecture (Svelte 5)

The frontend uses clean MVVM pattern with Svelte 5 runes and dependency injection:

### Directory Structure

```
src/lib/client/
├── shared/
│   ├── services/         # Business logic & external integrations
│   │   ├── ServiceContainer.svelte.js    # Dependency injection container
│   │   ├── SessionApiClient.js           # Session API operations
│   │   ├── RunSessionClient.js           # WebSocket session client
│   │   └── SocketService.svelte.js       # Socket.IO management
│   ├── state/            # ViewModels with $state runes
│   │   ├── SessionViewModel.svelte.js    # Session lifecycle management
│   │   ├── SessionState.svelte.js        # Session data state
│   │   ├── WorkspaceState.svelte.js      # Workspace management
│   │   ├── UIState.svelte.js             # UI state management
│   │   └── AppState.svelte.js            # Global app state
│   └── components/       # Shared UI components (Views)
├── terminal/             # Terminal session components
├── claude/               # Claude session components
└── file-editor/          # File editor components
```

### Key Architectural Patterns

**ServiceContainer** - Central dependency injection:

- Lazy-loaded service instantiation via `container.get('serviceName')`
- Test container support with `createTestContainer()`
- Shared instances across component tree

**ViewModel Pattern with Svelte 5 Runes**:

```javascript
// ViewModels use $state for reactivity
class ViewModel {
  data = $state([]);
  loading = $state(false);
  filtered = $derived.by(() => /* derivation */);
}
```

**Global Service Sharing**: `__API_SERVICES` provides shared instances across Socket.IO and API routes, ensuring consistent state management

## Testing Strategy

Vitest for unit tests with separate client/server configurations, Playwright for E2E:

```bash
# Run specific test suites
npm test                      # All unit tests
vitest run tests/client/      # Client-side tests
vitest run tests/server/      # Server-side tests
npm run test:e2e -- terminal  # Specific E2E test
npm run test:e2e:headed       # E2E with browser UI
```

## Database Schema (SQLite)

Event-sourced architecture with key tables:

- `sessions` - Run sessions with runId, kind, status, metadata
- `session_events` - Event log with sequence numbers for replay
- `workspace_layout` - Client-specific UI layouts
- `workspaces` - Workspace metadata and paths

## Environment Variables

### Required

- `TERMINAL_KEY` - Authentication key (default: `change-me` - must be changed for production)

### Optional

- `PORT` - Server port (default: 3030)
- `WORKSPACES_ROOT` - Default workspace directory (default: `/workspace` in container, configurable for dev)
- `ENABLE_TUNNEL` - Enable LocalTunnel for public URLs (default: false)
- `LT_SUBDOMAIN` - Custom LocalTunnel subdomain (optional)
- `HOST_UID`/`HOST_GID` - Container user mapping for file permissions
- `HOME` - Home directory override (useful for dev mode)
- `DEBUG` - Enable debug logging (e.g., `DEBUG=*` for all modules)

## Key Dependencies

- **Runtime**: Node.js >=22 (see .nvmrc)
- **Framework**: SvelteKit 2.x with Svelte 5
- **Real-time**: Socket.IO 4.8.x for WebSocket communication
- **Terminal**: @battlefieldduck/xterm-svelte + node-pty
- **Claude**: @anthropic-ai/claude-code 1.0.98
- **Database**: SQLite3 5.1.7

## Important File Paths & Organization

### Development Files

- `.testing-home/` - Test home directory for dev mode
- `.testing-home/workspaces/` - Test workspace directory
- `.svelte-kit/` - SvelteKit build cache
- `build/` - Production build output

### Configuration Files

- `vite.config.js` - Vite bundler configuration
- `svelte.config.js` - SvelteKit configuration
- `playwright.config.js` - E2E test configuration
- `.nvmrc` - Node.js version specification (22+)
- `docker-compose.yml` - Docker compose configuration

### Test Organization

- `tests/client/` - Client-side unit tests
- `tests/server/` - Server-side unit tests
- `tests/helpers/` - Test utilities and stubs
- `tests/scripts/` - Test runner scripts
- `e2e/` - Playwright end-to-end tests

## Key Implementation Patterns

### Session Management

- **Event Sourcing**: All session activity logged as events with sequence numbers for replay
- **Session Persistence**: Sessions tracked in database, can resume after server restart
- **Multi-Client Support**: Multiple tabs can attach to same session with synchronized events
- **Client State Recovery**: UI can rebuild from (runId, seq) cursor after disconnect

### Adding New Session Type

1. Create adapter in appropriate directory under `src/lib/server/[feature]/`
2. Register adapter in `src/lib/server/shared/index.js` via `RunSessionManager.registerAdapter()`
3. Add session type constant to `src/lib/shared/session-types.js`
4. Create UI components in `src/lib/client/[feature]/`
5. Register session module in `src/lib/client/shared/session-modules/index.js`
6. Session events automatically handled via unified protocol

### Debugging

- Admin console at `/console?key=your-terminal-key` for live session monitoring
- Enable debug logging: `DEBUG=* npm run dev`
- Session events persisted in database for replay debugging
- Check browser DevTools Network tab for WebSocket frames

## Docker & CLI

### Docker Setup

Docker configuration in `docker/` directory:

- Multi-stage build for optimized image size
- Non-root user (uid 10001) with gosu for runtime user mapping
- Support for HOST_UID/HOST_GID environment variables
- Pre-installed development tools (git, gh, build-essential)

### CLI Tool

CLI at `bin/cli.js` for Docker management:

```bash
dispatch init         # Initialize environment and directories
dispatch start        # Start containers with options:
                     #   -k/--key: Set terminal key
                     #   --projects: Mount projects directory
                     #   --home: Mount home directory
                     #   --build: Force rebuild
                     #   --open: Open browser automatically
dispatch stop         # Stop and remove containers
```

### Session Modules System

Dynamic session component loading via `src/lib/client/shared/session-modules/`:

- Extensible module registration
- Type-based component resolution
- Header and pane component mapping
