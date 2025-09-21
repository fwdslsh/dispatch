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

**Adapter Pattern** (`src/lib/server/adapters/`):
- `PtyAdapter.js` - Terminal sessions via node-pty
- `ClaudeAdapter.js` - Claude Code sessions via @anthropic-ai/claude-code
- `FileEditorAdapter.js` - File editing sessions
- Clean abstraction for adding new session types

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
npm run test:managers    # Test core manager classes
npm run test:database    # SQLite database tests

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
src/lib/client/shared/
├── services/         # Business logic & external integrations
│   ├── ServiceContainer.svelte.js    # Dependency injection container
│   ├── SessionApiClient.js           # Session API operations
│   └── WorkspaceApiClient.js         # Workspace operations
├── state/            # ViewModels with $state runes
│   ├── SessionViewModel.svelte.js    # Session lifecycle management
│   └── AppState.svelte.js            # Global app state
└── components/       # UI components (Views)
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

Required:

- `TERMINAL_KEY` - Authentication key (default: `change-me`)

Optional:

- `PORT` - Server port (default: 3030)
- `WORKSPACES_ROOT` - Default workspace directory
- `ENABLE_TUNNEL` - Enable LocalTunnel for public URLs
- `HOST_UID`/`HOST_GID` - Container user mapping

## Key Dependencies

- **Runtime**: Node.js >=22 (see .nvmrc)
- **Framework**: SvelteKit 2.x with Svelte 5
- **Real-time**: Socket.IO 4.8.x for WebSocket communication
- **Terminal**: @battlefieldduck/xterm-svelte + node-pty
- **Claude**: @anthropic-ai/claude-code 1.0.98
- **Database**: SQLite3 5.1.7

## Key Implementation Patterns

### Session Management
- **Event Sourcing**: All session activity logged as events with sequence numbers for replay
- **Session Persistence**: Sessions tracked in database, can resume after server restart
- **Multi-Client Support**: Multiple tabs can attach to same session with synchronized events
- **Client State Recovery**: UI can rebuild from (runId, seq) cursor after disconnect

### Adding New Session Type
1. Create adapter in `src/lib/server/adapters/` extending base adapter
2. Register adapter in `RunSessionManager.registerAdapter()`
3. Add UI component in `src/lib/client/[type]/`
4. Session events automatically handled via unified protocol

### Debugging
- Admin console at `/console?key=your-terminal-key` for live session monitoring
- Enable debug logging: `DEBUG=* npm run dev`
- Session events persisted in database for replay debugging
- Check browser DevTools Network tab for WebSocket frames

## Docker & CLI

Docker runs with non-root user (uid 10001) and runtime user mapping via HOST_UID/HOST_GID.

CLI at `bin/cli.js`:
```bash
dispatch init         # Initialize environment
dispatch start        # Start containers
dispatch stop         # Stop containers
```
