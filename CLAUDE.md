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

## Workspace Management

Dispatch supports workspace management for organizing development projects. Workspaces provide isolated environments for sessions and file operations.

### Core Concepts

**Workspace**: A directory-based project container with associated metadata
- **Path**: Absolute file system path (e.g., `/workspace/my-project`)
- **Name**: Human-readable display name
- **Status**: Lifecycle state (`new`, `active`, `archived`)
- **Sessions**: Associated terminal, Claude, and file editor sessions

### Workspace API

The Workspace API (`/api/workspaces`) provides REST endpoints for workspace lifecycle management:

```bash
# List all workspaces
GET /api/workspaces?authKey=YOUR_KEY

# Create new workspace
POST /api/workspaces
{
  "path": "/workspace/new-project",
  "name": "New Project",
  "authKey": "YOUR_KEY"
}

# Get workspace details with session counts
GET /api/workspaces/{workspaceId}

# Update workspace metadata
PUT /api/workspaces/{workspaceId}
{
  "name": "Updated Name",
  "status": "active",
  "authKey": "YOUR_KEY"
}

# Delete workspace (must have no active sessions)
DELETE /api/workspaces/{workspaceId}?authKey=YOUR_KEY
```

### Workspace-Session Integration

Sessions are automatically associated with workspaces:

```javascript
// Create session in specific workspace
await fetch('/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'pty',
    workspacePath: '/workspace/my-project',
    authKey: 'YOUR_KEY'
  })
});
```

**Session Lifecycle with Workspaces**:
1. Sessions created with `workspacePath` parameter
2. Workspace `lastActive` timestamp updated on session activity
3. Workspace session counts updated in real-time
4. Workspace deletion blocked if active sessions exist

### Database Schema

Workspaces integrate with existing session infrastructure:

```sql
-- Existing tables enhanced for workspace support
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,           -- Workspace path
  name TEXT NOT NULL,            -- Display name
  status TEXT DEFAULT 'new',     -- new, active, archived
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  lastActive TEXT
);

CREATE TABLE sessions (
  -- ... existing session fields
  workspacePath TEXT,            -- FK to workspaces.id
  FOREIGN KEY (workspacePath) REFERENCES workspaces(id)
);
```

### Frontend Integration

Workspace state management follows MVVM pattern:

```javascript
// WorkspaceState.svelte.js - Reactive workspace data
export class WorkspaceState {
  workspaces = $state([]);
  currentWorkspace = $state(null);
  loading = $state(false);

  // Derived state
  activeWorkspaces = $derived.by(() =>
    this.workspaces.filter(w => w.status === 'active')
  );
}

// WorkspaceService - API integration
export class WorkspaceService {
  async createWorkspace(path, name) {
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ path, name, authKey: this.authKey })
    });
    return response.json();
  }
}
```

### Best Practices

**Workspace Organization**:
- Use descriptive workspace names for easy identification
- Organize by project type: `/workspace/web-apps/`, `/workspace/data-science/`
- Archive unused workspaces to keep active list manageable

**Session Management**:
- Always specify `workspacePath` when creating sessions
- Monitor workspace session counts to avoid resource exhaustion
- Clean up stopped sessions periodically

**Security Considerations**:
- Workspace paths validated to prevent directory traversal
- All operations require authentication via `TERMINAL_KEY`
- Container isolation ensures workspaces cannot access system directories

### Debugging Workspace Issues

**Common Issues**:
1. **Workspace creation fails**: Check path permissions and workspace root configuration
2. **Session not associated**: Verify `workspacePath` parameter in session creation
3. **Deletion blocked**: Stop all active sessions before workspace deletion

**Debug Commands**:
```bash
# Check workspace API status
curl "http://localhost:3030/api/workspaces?authKey=testkey12345"

# Verify session-workspace association
curl "http://localhost:3030/api/sessions?include=all&authKey=testkey12345"

# Monitor workspace session counts
curl "http://localhost:3030/api/workspaces/[workspace-id]"
```
