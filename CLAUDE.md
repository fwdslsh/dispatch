# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository. Parallel execution should be used whenever possible while working in this repository.

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
npm run dev               # Dev server with TERMINAL_KEY=testkey12345 (SSL enabled, port 5173)
npm run dev:local        # Use $HOME/code as workspace root
npm run dev:no-key       # No authentication required
npm run dev:tunnel       # With LocalTunnel enabled
npm run dev:test         # Automated testing server (port 7173, no SSL, known key)

# Testing
npm run test             # All unit tests
npm run test:unit        # Vitest unit tests
npm run test:e2e         # Playwright E2E tests
npm run test:unit        # Vitest unit tests

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

**IMPORTANT** ALWAYS commit pending changes before running `npm run format` and then make a commit once it is done with a message of "code formatting" to make reviewing diffs easier

### Automated UI Testing

When testing the UI with automated tools (DevTools MCP, Playwright, etc.), use the dedicated test server to avoid SSL certificate issues:

```bash
npm run dev:test
```

This starts the server on `http://localhost:7173` with:

- **No SSL**: Avoids certificate warnings in automated browsers
- **Known Terminal Key**: `test-automation-key-12345` for predictable authentication
- **Dedicated Port**: 7173 to avoid conflicts with regular dev server
- **Isolated Storage**: Uses temporary directories in `/tmp` (fresh state, no interference with dev)

**Quick Authentication Setup** (using cookie-based sessions):

```javascript
// Option 1: Complete onboarding flow (generates API key + sets cookie)
import { completeOnboarding } from './e2e/helpers/onboarding-helpers.js';

const apiKey = await completeOnboarding(page, {
	workspaceName: 'test-workspace',
	clickContinue: true // Auto-login after onboarding
});
// Page is now authenticated with session cookie

// Option 2: Use pre-seeded database with API key
import { resetToOnboarded } from './e2e/helpers/index.js';

const { apiKey } = await resetToOnboarded();
await page.goto('http://localhost:7173/login');
await page.fill('[name="key"]', apiKey.key);
await page.click('button[type="submit"]');
await page.waitForURL('**/workspace');
// Page is now authenticated with session cookie
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
│   │   ├── AuthViewModel.svelte.js       # Authentication state & operations
│   │   ├── ApiKeyState.svelte.js         # API key management
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

### Architecture Documentation

For detailed architectural patterns and implementation guides, see:

- **[MVVM Patterns Guide](src/docs/architecture/mvvm-patterns.md)** - Deep dive into the runes-in-classes pattern, when to use classes vs modules, and common pitfalls
- **[Adapter Registration Guide](src/docs/architecture/adapter-guide.md)** - Step-by-step guide for adding new session types via the adapter pattern
- **[Error Handling Guide](src/docs/contributing/error-handling.md)** - Standardized async error handling patterns and best practices

## Testing

📖 **See [Testing Quick Start Guide](docs/testing-quickstart.md)** for comprehensive testing setup, database seeding, and E2E test helpers.

**Important Note**
Production code should NEVER know about tests. Tests should adapt to production, not vice versa. Test-specific
endpoints, environment variables, and conditional code paths are anti-patterns that:

- Create security vulnerabilities
- Increase maintenance burden
- Make production behave differently than tests
- Violate separation of concerns

**Quick Commands:**

```bash
npm test                      # All unit tests (Vitest)
npm run test:e2e              # E2E tests (Playwright)
npm run test:e2e:headed       # E2E with browser UI
npm run dev:test              # Test server on port 7173 (no SSL, known key)
```

**Key Resources:**

- E2E Helpers Documentation: `e2e/helpers/README.md`
- Onboarding Test Helpers: `e2e/helpers/onboarding-helpers.js`
- Database Reset Helpers: `e2e/helpers/reset-database.js`
- Onboarding Test Plans: `e2e/ONBOARDING_TEST_PLAN.md`, `e2e/ONBOARDING_QUICK_REFERENCE.md`

**E2E Testing Patterns:**

```javascript
// Pattern 1: Fresh Install Tests (Onboarding Flow)
import { resetToFreshInstall } from './e2e/helpers/index.js';

test.beforeEach(async () => {
	await resetToFreshInstall();
});

// Pattern 2: Authenticated Tests
import { resetToOnboarded } from './e2e/helpers/index.js';

test.beforeEach(async ({ page }) => {
	const { apiKey } = await resetToOnboarded();
	// Auto-login with API key
	await page.goto('/login');
	await page.fill('[name="key"]', apiKey.key);
	await page.click('button[type="submit"]');
});

// Pattern 3: Complete Onboarding Flow
import { completeOnboarding } from './e2e/helpers/onboarding-helpers.js';

test('onboarding test', async ({ page }) => {
	const apiKey = await completeOnboarding(page, {
		workspaceName: 'my-project',
		clickContinue: true
	});
	// Now authenticated and ready to test
});
```

## Database Schema (SQLite)

Event-sourced architecture with key tables:

- SQLite db located at `.testing-home/dispatch/data/workspace.db`
- `sessions` - Run sessions with runId, kind, status, metadata
- `session_events` - Event log with sequence numbers for replay
- `workspace_layout` - Client-specific UI layouts
- `workspaces` - Workspace metadata and paths
- `auth_sessions` - Browser session cookies with expiration and provider tracking
- `api_keys` - Hashed API keys with labels and last-used timestamps
- `users` - User accounts (default: single 'default' user)

**See [Database Schema Reference](docs/reference/database-schema.md)** for complete schema documentation, field details, indexes, and common query patterns.

**Quick schema inspection:**

```bash
sqlite3 .testing-home/dispatch/data/workspace.db "SELECT sql FROM sqlite_master WHERE type='table';"
sqlite3 .testing-home/dispatch/data/workspace.db "PRAGMA table_info('sessions');"
```

## Environment Variables

📖 **See [Configuration Reference](docs/configuration/configuration-reference.md)** for complete variable documentation.

**Essential Variables:**

- `TERMINAL_KEY` - Authentication key (required for production)
- `PORT` - Server port (default: 3030)
- `WORKSPACES_ROOT` - Workspace directory (default: `/workspace`)
- `ENABLE_TUNNEL` - Enable public URL via LocalTunnel
- `HOST_UID`/`HOST_GID` - Container user mapping
- `DEBUG` - Debug logging (e.g., `DEBUG=*`)

## Key Dependencies

- **Runtime**: Node.js >=22 (see .nvmrc)
- **Framework**: SvelteKit 2.x with Svelte 5
- **Real-time**: Socket.IO 4.8.x for WebSocket communication
- **Terminal**: @battlefieldduck/xterm-svelte + node-pty
- **Claude**: @anthropic-ai/claude-code 1.0.98
- **Database**: SQLite3 5.1.7
- **Window Manager**: sv-window-manager ([GitHub](https://github.com/itlackey/sv-window-manager/)) - Svelte 5 tiling window manager with `onpaneremoved` event support

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

### Authentication

Dispatch implements dual authentication supporting both session cookies and API keys:

**Authentication Flow**:

- **Browser Sessions**: httpOnly, Secure (production), SameSite=Lax cookies managed by SvelteKit
- **Programmatic Access**: API keys via Authorization: Bearer {key} header
- **Unified Support**: All routes accept EITHER cookies OR API keys (never both required)

**Cookie Session Management** (`src/lib/server/auth/`):

- `SessionManager.server.js` - Session CRUD with bcrypt-hashed IDs (cost 12)
- `CookieService.server.js` - Cookie generation, validation, and refresh
- `ApiKeyManager.server.js` - API key generation, validation, and management
- Sessions: 30-day expiration with 24-hour rolling refresh window
- Automatic session rotation on login/logout/sensitive changes

**Authentication Middleware** (`src/hooks.server.js`):

- Cookie validation via `CookieService.validateSessionCookie()`
- API key validation via `ApiKeyManager.verifyApiKey()`
- Dual auth: Checks cookies first, falls back to Authorization header
- Attaches `event.locals.user` and `event.locals.sessionId` on success

**Socket.IO Dual Auth** (`src/lib/server/shared/socket-setup.js`):

- Accepts cookies via `socket.request.headers.cookie`
- Accepts API keys via `socket.handshake.auth.apiKey`
- Validates both methods through same auth services
- Emits `session:expired` event when session becomes invalid

**SvelteKit Form Actions Pattern** (`src/routes/auth/+page.server.js`):

- Login: `?/login` action with API key validation
- Logout: `?/logout` action with session destruction
- CSRF protection via SvelteKit's built-in token validation
- Origin header validation for cookie-based requests

**Client-Side MVVM Integration**:

- `AuthViewModel.svelte.js` - Authentication state and operations
- `ApiKeyState.svelte.js` - API key management (list, create, disable, delete)
- `ServiceContainer` provides shared auth service instances
- Reactive state with Svelte 5 $state runes

**API Key Security**:

- Generated keys: 32-byte base64url (URL-safe, no special chars)
- Storage: bcrypt hashed with cost factor 12 (never plaintext)
- Display: Shown exactly once on creation with warning
- Validation: Constant-time comparison via bcrypt.compare()
- Metadata: Tracks creation date, last used timestamp, custom labels

**Session Lifecycle**:

- Creation: On successful login (API key or OAuth)
- Persistence: Stored in SQLite `auth_sessions` table
- Expiration: 30 days from creation
- Refresh: Automatic when within 24h of expiry
- Cleanup: Expired sessions removed by background job
- Multi-client: Same session shared across browser tabs

**OAuth Integration** (optional):

- **Provider Support**: GitHub and Google OAuth providers
- **Configuration UI**: `/settings/oauth` - Enable/disable providers, configure client credentials
- **Unified Session Creation**: OAuth login creates same session cookie as API key login
- **Provider Tracking**: Sessions track authentication provider (`api_key`, `oauth_github`, `oauth_google`)
- **Secure Credential Storage**: Client secrets encrypted at rest, never sent to browser
- **Fallback Support**: When OAuth provider unavailable, system offers API key login fallback
- **Provider Lifecycle**: Disabling provider prevents new logins but preserves existing sessions
- **Settings Routes**: `/api/settings/oauth` for CRUD operations
- **Components**: `OAuthSettings.svelte` - Provider configuration UI

**First-Run Onboarding** (`/routes/onboarding/+page.svelte`):

- **Multi-step wizard**: Workspace setup → Theme selection → Settings configuration
- **Auto-generates first API key** on fresh installation
- **Displays key once** with "copy now" warning (security best practice)
- **Immediately creates browser session cookie** for seamless login
- **Stores onboarding completion** in settings to prevent re-display
- **Route exemptions**: `/login`, `/settings`, and `/api-docs` accessible during onboarding (allows key entry and configuration)
- **Comprehensive E2E tests**: See `e2e/ONBOARDING_TEST_PLAN.md` for 30+ test scenarios
- **Route protection**: Server-side `+page.server.js` redirects if already onboarded

### Debugging

- Admin console at `/console` for live session monitoring
- Enable debug logging: `DEBUG=* npm run dev`
- Session events persisted in database for replay debugging
- Check browser DevTools Network tab for WebSocket frames

## Docker & CLI

📖 **See [CLI Guide](docs/cli-guide.md)** for installation, usage, and Docker configuration details.

**Quick Commands:**

```bash
dispatch init         # Initialize environment
dispatch start        # Start containers (supports --key, --uid, --gid, --tunnel)
dispatch stop         # Stop containers
```

**Docker Features:** Multi-stage build, non-root user, HOST_UID/GID mapping, pre-installed dev tools

### Session Modules System

Dynamic session component loading via `src/lib/client/shared/session-modules/`:

- Extensible module registration
- Type-based component resolution
- Header and pane component mapping

## API Documentation

### Interactive API Explorer

📖 **Visit `/api-docs`** for interactive API documentation with live request testing.

**Features:**

- Browse all API endpoints with request/response schemas
- Test endpoints with authentication (API keys or session cookies)
- Download OpenAPI 3.0 specification at `/openapi.json`
- Search endpoints and schemas
- Server selection (development, test, production)

**Access:**

```
http://localhost:5173/api-docs      # Development server
http://localhost:7173/api-docs      # Test server
http://localhost:3030/api-docs      # Production server
```

📖 **See [API Documentation Guide](docs/contributing/api-documentation-guide.md)** for maintaining the OpenAPI spec and API explorer.

### Workspace Management

📖 **See [Workspace API Reference](docs/reference/workspace-api.md)** for complete API documentation and examples.

**Core Concepts:**

- Workspaces organize projects with isolated sessions and file operations
- REST API at `/api/workspaces` for CRUD operations
- Sessions automatically associated via `workspacePath` parameter
- MVVM pattern integration with `WorkspaceState` and `WorkspaceService`

**Quick Example:**

```javascript
// Create session in workspace
await fetch('/api/sessions', {
	method: 'POST',
	body: JSON.stringify({
		type: 'pty',
		workspacePath: '/workspace/my-project',
		authKey: 'YOUR_KEY'
	})
});
```

### REST API Routes

📖 **See [API Routes Reference](docs/reference/api-routes.md)** for complete REST API documentation.

**Major API groups:**

- `/api/sessions` - Session lifecycle management (create, list, close, layout)
- `/api/workspaces` - Workspace CRUD operations
- `/api/settings` - Server configuration by category
- `/api/files` - File read/write operations
- `/api/browse` - Directory browsing and git cloning
- `/api/git` - Git operations (status, commit, push, pull, worktrees)
- `/api/claude` - Claude Code authentication and projects
- `/api/themes` - Theme management
- `/api/admin` - Admin monitoring endpoints
- `/api/auth` - Authentication status and API key management

**Authentication:** All protected routes accept EITHER session cookies OR API keys via Authorization: Bearer header. Browser clients automatically use cookies via SvelteKit. Programmatic clients (scripts, CLI) use API keys.

### Socket.IO Events

📖 **See [Socket.IO Events Reference](docs/reference/socket-events.md)** for complete event protocol documentation.

**Core events:**

- `client:hello` - Authentication and client identification
- `run:attach` - Attach to session with event replay
- `run:input` - Send input to session
- `run:event` - Real-time event streaming from server
- `run:close` - Terminate session

**Event sourcing:** All session activity is persisted with monotonic sequence numbers, enabling replay and multi-client synchronization.

## Additional Features

For detailed documentation on specific features and implementation details, see:

- **Visual Design**: [Visual Design System](docs/reference/visual-design-system.md)
- **Settings Management**: [Settings Migration](docs/reference/settings-migration.md)
- **Git Features**: [Git Worktrees](docs/features/git-worktrees.md)
- **Workspace Features**: [Workspace Environment](docs/features/workspace-env.md), [Home Directory Manager](docs/features/home-directory-manager.md)
- **Docker**: [Docker Permissions](docs/configuration/docker-permissions.md)
- **Quick Start**: [Quickstart Guide](docs/quickstart.md)

These documentation files contain user-facing feature descriptions, detailed UI workflows, and integration examples.
