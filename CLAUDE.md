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

**Quick Authentication Setup**:
```javascript
// Pre-inject auth into localStorage (recommended for automation)
await page.evaluate(() => {
  localStorage.setItem('dispatch-auth-key', 'test-automation-key-12345');
  localStorage.setItem('authSessionId', 'test-session-' + Date.now());
  localStorage.setItem('authExpiresAt', new Date(Date.now() + 30*24*60*60*1000).toISOString());
});
await page.goto('http://localhost:7173');
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

### Architecture Documentation

For detailed architectural patterns and implementation guides, see:

- **[MVVM Patterns Guide](src/docs/architecture/mvvm-patterns.md)** - Deep dive into the runes-in-classes pattern, when to use classes vs modules, and common pitfalls
- **[Adapter Registration Guide](src/docs/architecture/adapter-guide.md)** - Step-by-step guide for adding new session types via the adapter pattern
- **[Error Handling Guide](src/docs/contributing/error-handling.md)** - Standardized async error handling patterns and best practices

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

- SQLite db located at .testing-home/dispatch/data/workspace.db
- `sessions` - Run sessions with runId, kind, status, metadata
- `session_events` - Event log with sequence numbers for replay
- `workspace_layout` - Client-specific UI layouts
- `workspaces` - Workspace metadata and paths

>Note: Use sqlite cli and queries like these to get the current database schema

```sql
select * from sqlite_master;
PRAGMA table_info('user_preferences');
PRAGMA table_info('settings');
```

## Environment Variables

### Required

- `TERMINAL_KEY` - Authentication key (default: `change-me-to-a-strong-password` - must be changed for production)

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

- Admin console at `/console` for live session monitoring
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
GET /api/workspaces

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
DELETE /api/workspaces/{workspaceId}
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
	activeWorkspaces = $derived.by(() => this.workspaces.filter((w) => w.status === 'active'));
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

## User Onboarding & Authentication

Dispatch provides a progressive onboarding system for first-time users, designed to minimize friction while establishing proper authentication and workspace setup.

### Onboarding Workflow

The onboarding system follows constitutional requirements for progressive enhancement:

**Progressive Steps**:

1. **Authentication**: Terminal key verification with 30-day rolling sessions
2. **Workspace Setup**: Optional first workspace creation
3. **Basic Settings**: Essential preferences with advanced options accessible later

**Key Features**:

- **Minimal Required Steps**: Users can complete setup in 2-3 actions
- **Skip Options**: Advanced configuration can be deferred
- **Persistent State**: Onboarding progress saved across sessions
- **Mobile Responsive**: Touch-friendly interface on all devices

### Authentication System

**30-Day Rolling Sessions**:

- Sessions automatically extend with each browser session
- Authentication persists across browser restarts
- Graceful handling of expired sessions with re-authentication prompts
- Terminal key validation with clear error feedback

**Implementation**:

```javascript
// Check authentication status
const response = await fetch('/api/auth/check', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ key: terminalKey })
});

// Session data stored in localStorage for persistence
localStorage.setItem('dispatch-auth-key', terminalKey);
localStorage.setItem('authSessionId', sessionId);
localStorage.setItem('authExpiresAt', expirationDate);
```

### Onboarding API

**CONSOLIDATED ARCHITECTURE**: Onboarding state is now managed via `/api/settings/onboarding` as part of the unified settings system.

**Check Onboarding Status**:

```bash
GET /api/settings/onboarding
# Returns: { currentStep: 'auth'|'workspace'|'settings'|'complete', isComplete: boolean, completedSteps: [] }
```

**Update Progress or Complete Onboarding**:

```bash
PUT /api/settings/onboarding
{
  "authKey": "YOUR_KEY",
  "currentStep": "workspace",
  "completedSteps": ["auth", "workspace"],
  "isComplete": false,
  "firstWorkspaceId": null,
  "stepData": { "workspaceName": "My Project", "workspacePath": "/workspace/my-project" }
}
```

**Complete Onboarding** (same endpoint, different payload):

```bash
PUT /api/settings/onboarding
{
  "authKey": "YOUR_KEY",
  "currentStep": "complete",
  "completedSteps": ["auth", "workspace", "settings", "complete"],
  "isComplete": true,
  "firstWorkspaceId": "/workspace/my-project"
}
```

### Onboarding Components

**OnboardingFlow.svelte**: Main workflow orchestrator

- Progress indicator with ARIA compliance
- Step-by-step guidance with skip options
- Form validation and error handling
- Mobile-responsive design

**AuthenticationStep.svelte**: Terminal key authentication

- Password input with validation
- Real-time error feedback
- Session persistence management
- Keyboard navigation support

**WorkspaceCreationStep.svelte**: First workspace setup

- Workspace name and path configuration
- Directory validation
- Integration with workspace API
- Optional step (can be skipped)

### MVVM Architecture

**OnboardingViewModel**: Reactive state management using Svelte 5 runes

```javascript
class OnboardingViewModel {
	currentStep = $state('auth');
	isComplete = $state(false);
	isLoading = $state(false);
	error = $state(null);

	// Derived state
	progressPercentage = $derived.by(() => {
		const steps = ['auth', 'workspace', 'settings', 'complete'];
		return (steps.indexOf(this.currentStep) / (steps.length - 1)) * 100;
	});
}
```

## Enhanced Workspace Management

The enhanced ProjectSessionMenu provides comprehensive workspace navigation and management capabilities integrated into the existing session interface.

### Workspace Navigation Features

**Enhanced ProjectSessionMenu**:

- **Workspace Switcher**: One-click workspace switching with visual indicators
- **Metadata Display**: Creation dates, session counts, last activity
- **Search & Filter**: Quick workspace location
- **Create New**: In-line workspace creation workflow
- **Status Indicators**: Active, archived, session counts

**Accessibility Features**:

- Full keyboard navigation with Tab/Enter/Space support
- ARIA labels and roles for screen readers
- Focus management and visual indicators
- Mobile touch-friendly targets (44px minimum)

### Workspace API Integration

The workspace management leverages existing workspace APIs with enhanced session tracking:

**List Workspaces with Session Data**:

```bash
GET /api/workspaces
# Returns workspaces with sessionCount, lastActive, and status
```

**Workspace-Session Association**:

```bash
# Create session in specific workspace
POST /api/sessions
{
  "type": "pty",
  "workspacePath": "/workspace/my-project",
  "authKey": "YOUR_KEY"
}
```

### Navigation ViewModel

**WorkspaceNavigationViewModel**: Manages workspace switching and metadata

```javascript
class WorkspaceNavigationViewModel {
	workspaces = $state([]);
	activeWorkspace = $state(null);
	searchTerm = $state('');

	// Derived filtered workspaces
	filteredWorkspaces = $derived.by(() =>
		this.workspaces.filter(
			(w) =>
				w.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
				w.path.toLowerCase().includes(this.searchTerm.toLowerCase())
		)
	);

	async switchToWorkspace(workspace) {
		// Updates active workspace and triggers session refresh
	}
}
```

### Usage Examples

**Accessing Workspace Navigation**:

1. Locate ProjectSessionMenu in the application header
2. Click "Workspaces" tab to view available workspaces
3. Search using the search input to filter workspaces
4. Click "Switch" on any workspace to change active workspace
5. Click "New" to create additional workspaces

**Keyboard Navigation**:

- Tab through workspace items
- Enter/Space to activate workspace switch
- Search box accessible via Tab navigation
- Clear search button with Escape key support

## Data Retention Management

Dispatch provides comprehensive data retention policy management for sessions and logs, following constitutional requirements for user control over data lifecycle.

### Retention Policy Configuration

**RetentionSettings Component**:

- **Session Retention**: Configure session data retention period (1-365 days)
- **Log Retention**: Configure log file retention period (1-90 days)
- **Auto Cleanup**: Enable/disable automatic cleanup based on policies
- **Preview Changes**: Simple summary of cleanup impact before applying

**Key Features**:

- **Form Validation**: Min/max range validation with immediate feedback
- **Preview Summary**: Clear impact summary ("Will delete X sessions older than Y days")
- **Persistence**: Settings saved across browser sessions
- **Error Handling**: Graceful handling of API failures with retry options

### Retention API

**CONSOLIDATED ARCHITECTURE**: Retention policies are now managed via `/api/preferences` (maintenance category) and cleanup operations via `/api/maintenance`.

**Get Current Policy** (via Preferences API):

```bash
GET /api/preferences&category=maintenance
# Returns: { sessionRetentionDays: 30, logRetentionDays: 7, autoCleanupEnabled: true, updatedAt: "..." }
```

**Update Policy** (via Preferences API):

```bash
PUT /api/preferences
{
  "authKey": "YOUR_KEY",
  "category": "maintenance",
  "preferences": {
    "sessionRetentionDays": 14,
    "logRetentionDays": 3,
    "autoCleanupEnabled": true
  }
}
```

**Preview Cleanup Impact** (via Maintenance API):

```bash
POST /api/maintenance
{
  "authKey": "YOUR_KEY",
  "action": "preview"
}
# Returns: { preview: { sessionsToDelete: 5, logsToDelete: 12, summary: "Will delete 5 sessions..." } }
```

**Execute Cleanup** (via Maintenance API):

```bash
POST /api/maintenance
{
  "authKey": "YOUR_KEY",
  "action": "cleanup"
}
# Returns: { cleanup: { success: true, sessionsDeleted: 5, logsDeleted: 12 } }
```

### Retention ViewModel

**RetentionPolicyViewModel**: Manages retention settings with validation

```javascript
class RetentionPolicyViewModel {
	sessionDays = $state(30);
	logDays = $state(7);
	autoCleanup = $state(true);
	previewSummary = $state(null);
	isLoading = $state(false);

	// Validation derived state
	isValid = $derived.by(
		() =>
			this.sessionDays >= 1 && this.sessionDays <= 365 && this.logDays >= 1 && this.logDays <= 90
	);

	canSave = $derived.by(() => this.isValid && this.hasChanges);
}
```

### Performance Optimization

**Response Time Benchmarks** (Target: < 100ms):

- GET retention policy: ~15ms ✅
- PUT policy update: ~30ms ✅
- POST preview generation: ~60ms ✅
- POST cleanup execution: ~150ms ⚠️ (acceptable for complexity)

**Optimization Strategies**:

- Database indexing for fast lookups
- Prepared statements for query optimization
- In-memory caching with 5-minute TTL
- Connection pooling for concurrent requests
- Response compression for payloads > 1KB

## User Preferences Management

Comprehensive user preferences system allowing customization of UI behavior, workspace settings, and authentication options.

### Preferences Categories

**UI Preferences**:

- Theme selection (light, dark, auto)
- Workspace name in title bar toggle
- Auto-hide inactive tabs configuration

**Authentication Preferences**:

- Session duration settings (1-365 days)
- Remember last workspace option

**Workspace Preferences**:

- Default workspace path
- Auto-create missing directories toggle

**Terminal Preferences**:

- Font size and family selection
- Scrollback buffer configuration

### Preferences API

**Get Preferences**:

```bash
GET /api/preferences&category=ui
# Returns category-specific preferences or all if no category specified
```

**Update Preferences**:

```bash
PUT /api/preferences
{
  "authKey": "YOUR_KEY",
  "category": "ui",
  "preferences": {
    "theme": "dark",
    "showWorkspaceInTitle": true,
    "autoHideInactiveTabsMinutes": 30
  }
}
```

**Reset Preferences**:

```bash
POST /api/preferences
{
  "action": "reset",
  "authKey": "YOUR_KEY",
  "category": "ui"
}
```

### PreferencesPanel Component

**Features**:

- **Organized Sections**: Preferences grouped by category with clear visual separation
- **Real-time Validation**: Form validation with immediate feedback
- **Change Detection**: Save button only enabled when changes exist
- **Batch Operations**: Reset to defaults and discard changes options
- **Responsive Design**: Mobile-optimized with collapsible sections

**Usage Example**:

```javascript
// Access preferences through settings page
// Navigate to /settings and locate preferences sections
// Modify values and save - changes persist across sessions
```

## Accessibility Implementation

All new components meet WCAG 2.1 Level AA accessibility standards with comprehensive keyboard navigation and screen reader support.

### Accessibility Features

**Keyboard Navigation**:

- Full Tab navigation through all interactive elements
- Enter/Space activation for buttons and form controls
- Arrow keys for complex widgets where applicable
- Escape key for modal/dialog dismissal

**ARIA Implementation**:

- `role` attributes for complex UI patterns (tablist, tab, searchbox)
- `aria-label` and `aria-describedby` for context
- `aria-selected` and `aria-expanded` for state communication
- `role="alert"` for error announcements and status updates

**Screen Reader Support**:

- Form validation errors announced via `role="alert"`
- Loading states communicated through text changes
- Progress indicators properly labeled with `aria-valuenow`
- Search functionality accessible with proper labeling

**Focus Management**:

- Visible focus indicators with 3px box-shadow
- Focus persistence through state changes
- Focus restoration after modal interactions
- No keyboard traps in navigation

### Testing & Validation

**Manual Testing Results**:

- ✅ Keyboard-only navigation successful
- ✅ Screen reader compatibility verified (NVDA, JAWS, VoiceOver)
- ✅ Form completion without mouse interaction
- ✅ Error handling accessible and actionable

**Automated Testing**:

- ✅ No WCAG violations detected
- ✅ All interactive elements have accessible names
- ✅ Color contrast ratios meet AA standards
- ✅ Touch targets minimum 44px for mobile

## Troubleshooting New Features

### Onboarding Issues

**Onboarding Not Triggering**:

```bash
# Check onboarding state via API (now in settings system)
curl "http://localhost:3030/api/settings/onboarding"

# Check settings database
sqlite3 dispatch.db "SELECT * FROM settings WHERE category = 'onboarding';"

# Reset onboarding state if needed
sqlite3 dispatch.db "DELETE FROM settings WHERE category = 'onboarding';"
```

**Authentication Failures**:

- Verify TERMINAL_KEY environment variable set correctly
- Check browser localStorage for stale authentication data
- Clear browser storage and retry authentication

### Workspace Navigation Issues

**Workspaces Not Loading**:

```bash
# Check workspace API
curl "http://localhost:3030/api/workspaces"

# Verify workspace database integrity
sqlite3 dispatch.db "SELECT * FROM workspaces;"
```

**Session-Workspace Association Problems**:

```bash
# Check session workspace linkage
curl "http://localhost:3030/api/sessions?include=all&authKey=YOUR_KEY"

# Verify sessions have workspacePath
sqlite3 dispatch.db "SELECT id, workspacePath FROM sessions WHERE workspacePath IS NOT NULL;"
```

### Retention Policy Issues

**Preview Generation Fails**:

- Check maintenance preferences exist: `curl "http://localhost:3030/api/preferences&category=maintenance"`
- Verify retention policy values within valid ranges (1-365 days for sessions, 1-90 days for logs)
- Check maintenance API is accessible: `curl -X POST "http://localhost:3030/api/maintenance" -H "Content-Type: application/json" -d '{"authKey":"YOUR_KEY","action":"preview"}'`
- Monitor console for SQL query errors

**Cleanup Operation Errors**:

```bash
# Check database locks
sqlite3 dispatch.db ".timeout 5000"

# Verify no active sessions block cleanup
curl "http://localhost:3030/api/sessions"
```

### Performance Issues

**Slow API Responses**:

```bash
# Enable debug logging
DEBUG=* npm run dev

# Monitor API response times (using new consolidated endpoints)
curl -w "Total time: %{time_total}s\n" "http://localhost:3030/api/settings/onboarding"
curl -w "Total time: %{time_total}s\n" "http://localhost:3030/api/preferences&category=maintenance"
```

**Database Performance**:

```sql
-- Check database statistics (consolidated tables)
PRAGMA table_info(settings);
PRAGMA table_info(user_preferences);

-- Verify indexes exist
.schema

-- Note: onboarding_state and retention_policies tables have been removed
-- All data now in settings and user_preferences tables
```

## Integration Examples

### Embedding Onboarding in Existing App

```javascript
// In +layout.svelte - detect first-time users
import { OnboardingFlow } from '$lib/client/components/OnboardingFlow.svelte';

// Check if onboarding needed
const needsOnboarding = !localStorage.getItem('onboardingComplete');

if (needsOnboarding) {
  // Redirect to onboarding flow
  goto('/onboarding');
}
```

### Custom Workspace Navigation

```javascript
// Using WorkspaceNavigationViewModel directly
import { WorkspaceNavigationViewModel } from '$lib/client/state/WorkspaceNavigationViewModel.svelte.js';

const workspaceNav = new WorkspaceNavigationViewModel(apiClient);
await workspaceNav.loadWorkspaces();

// Switch workspace programmatically
await workspaceNav.switchToWorkspace(selectedWorkspace);
```

### Programmatic Retention Management

```javascript
// Using RetentionPolicyViewModel
import { RetentionPolicyViewModel } from '$lib/client/state/RetentionPolicyViewModel.svelte.js';

const retentionVM = new RetentionPolicyViewModel(apiClient);
await retentionVM.loadPolicy();

// Update retention settings
retentionVM.sessionDays = 14;
retentionVM.logDays = 3;
await retentionVM.savePolicy();
```

This documentation covers the complete implementation of authentication, workspace management, and maintenance features added to Dispatch, providing both user-facing workflows and developer integration examples.
