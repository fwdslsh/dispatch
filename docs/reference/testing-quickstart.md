# Dispatch Testing Quick Start

Quick reference for initializing Dispatch instances for testing, development, and automation. This guide shows you how to set up temporary Dispatch environments with optional automated onboarding.

## Quick Start Options

### Option 1: Use the Testing Setup Script (Recommended)

The fastest way to get a clean testing instance:

```bash
# Create a fresh instance with automated onboarding
./scripts/setup-test-instance.sh --auto-onboard

# Create a fresh instance without onboarding (manual setup)
./scripts/setup-test-instance.sh

# Create instance with custom auth key
./scripts/setup-test-instance.sh --auto-onboard --key "my-custom-key-12345"

# Create instance with specific workspace
./scripts/setup-test-instance.sh --auto-onboard --workspace "/workspace/my-project"
```

The script will:

- Create temporary directories for HOME and WORKSPACES_ROOT
- Initialize a fresh SQLite database
- Optionally complete onboarding automatically
- Output environment variables for use
- Start the dev server if requested

### Option 2: Manual Temporary Instance

For more control over the setup:

```bash
# Create temporary directories
export TEST_HOME=$(mktemp -d /tmp/dispatch-test-home.XXXXXX)
export TEST_WORKSPACES=$(mktemp -d /tmp/dispatch-test-workspaces.XXXXXX)
export TERMINAL_KEY="test-automation-key-12345"

# Run dev server with temporary instance
HOME="$TEST_HOME" \
WORKSPACES_ROOT="$TEST_WORKSPACES" \
TERMINAL_KEY="$TERMINAL_KEY" \
SSL_ENABLED=false \
npm run dev -- --port 7173
```

### Option 3: Use Existing npm Scripts

Dispatch provides pre-configured npm scripts for testing:

```bash
# Standard test server (port 7173, no SSL, temporary storage)
npm run dev:test

# Development server with persistent storage
npm run dev

# Development server without SSL
npm run dev:http
```

## Database Seeding for Automated Testing

### Method 1: API-Based Seeding (Recommended)

Use the onboarding API endpoint to seed a fresh database:

```bash
# After starting the server, complete onboarding via API
curl -X POST http://localhost:7173/api/settings/onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "terminalKey": "test-automation-key-12345",
    "workspaceName": "Test Workspace",
    "workspacePath": "/workspace/test-workspace",
    "preferences": {
      "theme": {
        "current": "default",
        "colorScheme": "dark"
      }
    }
  }'
```

### Method 2: Direct Database Manipulation

For advanced use cases, you can directly manipulate the SQLite database:

```javascript
// Node.js script example
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('/tmp/dispatch-test-home.XXXXX/.dispatch/data/workspace.db');
const run = promisify(db.run.bind(db));

// Complete onboarding
await run(`
  INSERT INTO settings (category, settings_json, description, created_at, updated_at)
  VALUES (
    'onboarding',
    '{"isComplete": true, "completedAt": "${new Date().toISOString()}", "firstWorkspaceId": "/workspace/test"}',
    'Automated test onboarding',
    ${Date.now()},
    ${Date.now()}
  )
`);

// Add authentication key
await run(`
  INSERT INTO settings (category, settings_json, description, created_at, updated_at)
  VALUES (
    'authentication',
    '{"terminal_key": "test-automation-key-12345"}',
    'Test authentication',
    ${Date.now()},
    ${Date.now()}
  )
`);

// Create workspace
await run(`
  INSERT INTO workspaces (path, name, last_active, created_at, updated_at)
  VALUES (
    '/workspace/test-workspace',
    'Test Workspace',
    ${Date.now()},
    ${Date.now()},
    ${Date.now()}
  )
`);

db.close();
```

### Method 3: Using Playwright Test Helpers

For E2E tests, use the built-in test helpers:

```javascript
import { navigateToWorkspaceWithOnboardingComplete } from './e2e/core-helpers.js';

test('my test', async ({ page }) => {
	// Automatically mocks onboarding as complete and navigates to workspace
	await navigateToWorkspaceWithOnboardingComplete(page);

	// Your test code here
});
```

## Environment Variables Reference

| Variable          | Default                         | Description                                   |
| ----------------- | ------------------------------- | --------------------------------------------- |
| `HOME`            | `~`                             | Home directory (contains `.dispatch/` config) |
| `WORKSPACES_ROOT` | `~/.dispatch-home/workspaces`   | Root directory for workspaces                 |
| `TERMINAL_KEY`    | (required)                      | Authentication key for access                 |
| `SSL_ENABLED`     | `true`                          | Enable/disable SSL                            |
| `PORT`            | `3030` (dev: `5173`)            | Server port                                   |
| `DB_PATH`         | `~/.dispatch/data/workspace.db` | SQLite database path                          |

## Database Schema Overview

### Key Tables for Testing

**settings** - Application settings by category

```sql
-- Onboarding status
SELECT * FROM settings WHERE category = 'onboarding';

-- Authentication configuration
SELECT * FROM settings WHERE category = 'authentication';
```

**workspaces** - Workspace registry

```sql
SELECT * FROM workspaces;
```

**sessions** - Run sessions (PTY, Claude, File Editor)

```sql
SELECT run_id, kind, status, created_at FROM sessions;
```

**session_events** - Event log for all session activity

```sql
SELECT run_id, seq, channel, type, ts FROM session_events;
```

## Common Testing Scenarios

### Scenario 1: Test Fresh Installation

```bash
# Start fresh instance without onboarding
./scripts/setup-test-instance.sh

# Navigate to http://localhost:7173
# Should see onboarding flow
```

### Scenario 2: Test Workspace Features

```bash
# Start instance with auto-onboarding
./scripts/setup-test-instance.sh --auto-onboard --workspace "/workspace/my-project"

# Navigate to http://localhost:7173/workspace
# Should see workspace with project loaded
```

### Scenario 3: Test Authentication

```bash
# Start instance with custom key
./scripts/setup-test-instance.sh --auto-onboard --key "custom-test-key"

# Try accessing without auth - should redirect to login
# Login with "custom-test-key" - should succeed
```

### Scenario 4: Test Session Persistence

```bash
# Start instance with auto-onboarding
export INSTANCE_HOME=$(./scripts/setup-test-instance.sh --auto-onboard --print-home)

# Create some sessions, then stop server (Ctrl+C)

# Restart with same HOME
HOME="$INSTANCE_HOME" npm run dev:test

# Sessions should be restored
```

## UI Test Automation Setup

For Selenium, Cypress, or other UI automation tools:

1. **Start the test server** (avoids SSL certificate issues):

   ```bash
   npm run dev:test
   ```

2. **Connect to**: `http://localhost:7173`

3. **Authenticate** by injecting into localStorage before navigation:

   ```javascript
   localStorage.setItem('dispatch-auth-key', 'test-automation-key-12345');
   localStorage.setItem('authSessionId', 'test-' + Date.now());
   localStorage.setItem(
   	'authExpiresAt',
   	new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
   );
   localStorage.setItem('onboarding-complete', 'true');
   ```

4. **Navigate** to your target route (e.g., `/workspace`)

## Playwright E2E Tests

The project includes comprehensive E2E tests using Playwright:

```bash
# Install browsers (one-time)
npm run playwright:install

# Run all tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/onboarding.spec.js

# Run with UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Key Test Helpers

Located in `e2e/core-helpers.js`:

- `navigateToWorkspaceWithOnboardingComplete(page)` - Skip onboarding, go to workspace
- `setupFreshTestEnvironment(page)` - Clear storage and setup auth
- `preAuthenticateUser(page)` - Set auth in localStorage
- `setupWorkspaceTestMocks(page)` - Mock API endpoints
- `waitForWorkspaceReady(page)` - Wait for workspace to load

## Cleanup

Temporary directories created by the test server are automatically cleaned up on process exit. For manual cleanup:

```bash
# Find and remove temporary test directories
find /tmp -name "dispatch-test-*" -type d -mtime +1 -exec rm -rf {} +

# Clean up .testing-home directory (used by npm run dev)
rm -rf .testing-home/
```

## Troubleshooting

### Database Locked Errors

If you see "database is locked" errors:

```bash
# Ensure no other processes are using the database
lsof | grep workspace.db

# Kill any stale processes
pkill -f "dispatch|vite"
```

### SSL Certificate Warnings in Tests

Use the test server (no SSL):

```bash
npm run dev:test
```

Or disable SSL verification in your test client (not recommended for production tests).

### Onboarding Won't Complete

Check the database:

```bash
sqlite3 ~/.dispatch/data/workspace.db "SELECT * FROM settings WHERE category = 'onboarding';"
```

Clear onboarding state:

```bash
sqlite3 ~/.dispatch/data/workspace.db "DELETE FROM settings WHERE category = 'onboarding';"
```

## Next Steps

- [Full Quick Start Guide](quickstart.md) - Production installation
- [E2E Test README](../e2e/README.md) - Comprehensive testing guide
- [Architecture Documentation](architecture/) - System design and patterns
- [Contributing Guide](../CONTRIBUTING.md) - Development workflow

## Reference

- Test key: `test-automation-key-12345`
- Test server port: `7173`
- Test server URL: `http://localhost:7173`
- Database location: `$HOME/.dispatch/data/workspace.db`
- Config directory: `$HOME/.dispatch/`
