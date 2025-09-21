# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dispatch** is a containerized web application providing interactive terminal sessions via browser. Built with SvelteKit, Socket.IO, and node-pty, it enables Claude Code sessions and shell access in isolated environments with web-based terminal access.

## Architecture - Unified Session Refactor (In Progress)

The codebase is undergoing a major architectural refactor from complex multi-manager pattern to a unified session architecture:

### Current Refactor Status

- Implementing event-sourced session management with single `runId` identifier
- Moving from `SessionRegistry` + type-specific managers to unified `RunSessionManager`
- Replacing scattered Socket.IO events with 4 core events: `client:hello`, `run:attach`, `run:input`, `run:close`
- Adapter pattern for session types: `PtyAdapter` (terminals), `ClaudeAdapter` (Claude Code)

### Key Refactor Components

**RunSessionManager** (`src/lib/server/runtime/RunSessionManager.js`):

- Single class managing all session types via adapter pattern
- Event-sourced history with monotonic sequence numbers
- Real-time event emission to Socket.IO clients

**Adapters** (`src/lib/server/adapters/`):

- `PtyAdapter.js` - Terminal sessions via node-pty
- `ClaudeAdapter.js` - Claude Code sessions via @anthropic-ai/claude-code

**Database Schema** (simplified):

- `sessions` - Run sessions with runId, kind, status, metadata
- `session_events` - Event log with sequence numbers for replay
- `workspace_layout` - Client-specific UI layouts

See `UNIFIED_SESSION_REFACTOR_TASKS.md` for detailed implementation progress.

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
src/lib/client/
├── claude/           # Claude-specific components
├── terminal/         # Terminal-specific components
└── shared/
    ├── components/   # Views (UI components)
    ├── viewmodels/   # Business logic with $state runes
    ├── services/     # API clients and data layer
    └── state/        # Global reactive stores
```

### Key ViewModels

**SessionViewModel** - Session lifecycle and display management:

- Manages creation, resume, termination of sessions
- Display slot management for tiling window manager
- Mobile/desktop responsive behavior

**ServiceContainer** - Dependency injection:

- Lazy-loaded service instantiation
- Context-based dependency injection
- Test container support with `createTestContainer()`

### Component Patterns

```javascript
// ViewModels use Svelte 5 runes
class MyViewModel {
  constructor(apiClient) {
    this.data = $state([]);
    this.loading = $state(false);
    this.filtered = $derived.by(() => /* derivation */);
  }

  async loadData() {
    this.loading = true;
    this.data = await this.apiClient.fetch();
    this.loading = false;
  }
}

// Components access via ServiceContainer
const container = useServiceContainer();
const viewModel = await container.get('myViewModel');
```

## Socket.IO Architecture

### Current Events (being replaced)

- Authentication: `auth(key, callback)`
- Terminal: `terminal.start`, `terminal.write`, `terminal.resize`
- Claude: `claude.send`, `claude.auth.start`, `claude.commands.refresh`
- Session: `session.status`, `session.catchup`

### New Unified Events (in progress)

- `client:hello` - Client identification with clientId
- `run:attach` - Attach to run session with event replay
- `run:input` - Send input to any session type
- `run:close` - Terminate session
- `run:event` - Server-sent events with (channel, type, payload)

## Testing Strategy

### Test Types

- **Unit Tests**: Vitest with separate client/server configurations
- **E2E Tests**: Playwright for full integration testing
- **Manager Tests**: Direct testing of core service classes
- **Database Tests**: SQLite operations and migrations

### Test Execution

```bash
# Run specific test suites
vitest run tests/viewmodels/  # ViewModel tests
vitest run tests/server/      # Server logic tests
npm run test:e2e -- terminal  # Specific E2E test
```

## Database Schema

Using SQLite with these key tables:

- `workspaces` - Workspace metadata and paths
- `workspace_sessions` - Session-workspace associations with pinned state
- `session_history` - Audit trail of session events
- Migration to unified schema in progress (see refactor tasks)

## Environment Variables

Required:

- `TERMINAL_KEY` - Authentication key (default: `change-me`)

Optional:

- `PORT` - Server port (default: 3030)
- `WORKSPACES_ROOT` - Default workspace directory
- `ENABLE_TUNNEL` - Enable LocalTunnel for public URLs
- `HOST_UID`/`HOST_GID` - Container user mapping

## Docker Integration

### Security

- Non-root execution as `appuser` (uid 10001)
- Runtime user mapping via HOST_UID/HOST_GID
- Path sanitization for workspace access

### Volume Mounts

- `~/dispatch/projects:/workspace` - Project storage
- `~/dispatch/home:/home/dispatch` - Persistent home directory
- Database and config in container's home directory

## Key Dependencies

- **Runtime**: Node.js >=22 (see .nvmrc)
- **Framework**: SvelteKit 2.x with Svelte 5
- **Real-time**: Socket.IO 4.8.x for WebSocket communication
- **Terminal**: @battlefieldduck/xterm-svelte + node-pty
- **Claude**: @anthropic-ai/claude-code 1.0.98
- **Database**: SQLite3 5.1.7
- **UI**: Augmented UI for futuristic styling

## Common Development Tasks

### Adding New Session Type

1. Create adapter in `src/lib/server/adapters/`
2. Register adapter in `RunSessionManager`
3. Add UI component in `src/lib/client/`
4. Update Socket.IO event handling if needed

### Debugging Socket.IO Events

- Admin console at `/console?key=your-terminal-key`
- Enable debug logging: `DEBUG=* npm run dev`
- Check browser DevTools Network tab for WebSocket frames

### Testing Session Resume

1. Create session and note the runId
2. Disconnect (close tab or stop server)
3. Reconnect and verify events replay from last sequence

## Important Implementation Notes

- **Global Service Sharing**: `__API_SERVICES` provides shared instances across Socket.IO and API routes
- **Workspace Flexibility**: Workspaces can be any accessible directory, not restricted to WORKSPACES_ROOT
- **Session Persistence**: Sessions tracked in database, can resume after server restart
- **Event Sourcing**: All session activity logged as events for replay and debugging
- **Client State Recovery**: UI can rebuild from (runId, seq) cursor after disconnect
- **Multi-Client Support**: Multiple tabs can attach to same session with synchronized events

## Current Known Issues

- Refactor in progress - some features may be temporarily broken
- Complex session routing being replaced with unified pattern
- Multiple session identifier confusion (appSessionId vs typeSpecificId)
- Test coverage gaps in new unified architecture

## CLI Tool

Dispatch includes a CLI at `bin/cli.js`:

```bash
dispatch init         # Initialize environment
dispatch start        # Start containers
dispatch stop         # Stop containers
dispatch config       # Generate config
```
