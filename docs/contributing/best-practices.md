# Development Best Practices

This guide provides best practices, patterns, and guidelines for developing the Dispatch codebase. Following these practices ensures code quality, maintainability, and consistency across the project.

## Table of Contents

1. [Architecture Patterns](#architecture-patterns)
2. [Code Organization](#code-organization)
3. [Testing Strategies](#testing-strategies)
4. [Error Handling](#error-handling)
5. [Security Practices](#security-practices)
6. [Performance Optimization](#performance-optimization)
7. [Git Workflow](#git-workflow)
8. [Code Review Guidelines](#code-review-guidelines)
9. [Common Pitfalls](#common-pitfalls)
10. [Tools and Automation](#tools-and-automation)

---

## Architecture Patterns

### MVVM Pattern (Svelte 5 Frontend)

Dispatch uses a clean MVVM (Model-View-ViewModel) pattern with Svelte 5 runes. See [MVVM Patterns Guide](../architecture/mvvm-patterns.md) for detailed guidance.

**Key Principles:**

```javascript
// ✅ GOOD: ViewModels with $state runes
class SessionViewModel {
    sessions = $state([]);
    loading = $state(false);

    filtered = $derived.by(() =>
        this.sessions.filter(s => s.status === 'running')
    );
}

// ❌ BAD: Mixing UI logic in services
class SessionService {
    // Don't put reactive state in services!
    sessions = $state([]); // Wrong!
}
```

**Best Practices:**

- **ViewModels** manage reactive state (`$state`, `$derived`)
- **Services** handle business logic and API calls (pure functions)
- **Components** bind to ViewModels, emit events only
- Use `ServiceContainer` for dependency injection

### Event Sourcing (Backend)

All session activity is event-sourced with monotonic sequence numbers.

```javascript
// ✅ GOOD: Append events, never mutate history
await eventStore.append(sessionId, {
    channel: 'stdout',
    type: 'data',
    payload: 'output text'
});

// ❌ BAD: Directly mutating session state
session.output += 'new output'; // Wrong! Not event-sourced
```

### Adapter Pattern (Session Types)

New session types use the adapter pattern. See [Adapter Registration Guide](../architecture/adapter-guide.md).

```javascript
// ✅ GOOD: Clean adapter interface
class MyAdapter extends BaseAdapter {
    async start(config) { /* ... */ }
    async write(data) { /* ... */ }
    async stop() { /* ... */ }
}

// Register via AdapterRegistry
adapterRegistry.register('my-type', new MyAdapter());
```

---

## Code Organization

### File Structure

```
src/
├── lib/
│   ├── client/              # Frontend code
│   │   ├── shared/
│   │   │   ├── services/    # Business logic (pure functions)
│   │   │   ├── state/       # ViewModels ($state runes)
│   │   │   └── components/  # Reusable UI components
│   │   ├── terminal/        # Terminal-specific components
│   │   ├── claude/          # Claude session components
│   │   └── file-editor/     # File editor components
│   └── server/              # Backend code
│       ├── shared/
│       │   ├── utils/       # Utility functions
│       │   └── services.js  # Service container
│       ├── database/        # Database repositories
│       ├── sessions/        # Session management
│       ├── terminal/        # Terminal adapter
│       ├── claude/          # Claude adapter
│       └── auth/            # Authentication services
├── routes/                  # SvelteKit routes
└── docs/                    # Documentation
```

### Naming Conventions

**Files:**
- Components: `PascalCase.svelte` (e.g., `SessionList.svelte`)
- ViewModels: `PascalCase.svelte.js` (e.g., `SessionState.svelte.js`)
- Services: `PascalCase.js` (e.g., `SessionApiClient.js`)
- Utils: `kebab-case.js` (e.g., `session-ids.js`)
- Tests: `*.test.js` or `*.spec.js`

**Variables and Functions:**
- Use `camelCase` for functions and variables
- Use `PascalCase` for classes and constructors
- Use `UPPER_SNAKE_CASE` for constants
- Prefix private fields with `#` (e.g., `#privateField`)

**Svelte Components:**
```javascript
// ✅ GOOD: Clear, descriptive names
<SessionListItem {session} on:select />

// ❌ BAD: Vague, generic names
<Item data={session} on:click />
```

### Import Organization

```javascript
// ✅ GOOD: Organized imports
// 1. External dependencies
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';

// 2. Internal shared utilities
import { logger } from '../utils/logger.js';
import { SessionId } from '../utils/session-ids.js';

// 3. Feature-specific imports
import { SessionViewModel } from './SessionViewModel.svelte.js';

// ❌ BAD: Mixed, unorganized imports
import { SessionViewModel } from './SessionViewModel.svelte.js';
import { writable } from 'svelte/store';
import { logger } from '../utils/logger.js';
```

### Avoid Circular Dependencies

```javascript
// ✅ GOOD: Clear dependency direction
// utils/session-ids.js (no dependencies)
export class SessionId { /* ... */ }

// services/SessionService.js (depends on utils)
import { SessionId } from '../utils/session-ids.js';

// ❌ BAD: Circular dependencies
// A.js imports B.js, B.js imports A.js
```

---

## Testing Strategies

### Unit Tests

**Location:** `tests/server/` and `tests/client/`

**Pattern:**
```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('SessionRepository', () => {
    let db;
    let repository;

    beforeEach(async () => {
        db = new DatabaseManager(':memory:');
        await db.init();
        repository = new SessionRepository(db);
    });

    it('creates session with unique ID', async () => {
        const session = await repository.create({
            kind: 'pty',
            ownerUserId: 'user-1'
        });

        expect(session.runId).toMatch(/^[a-z0-9]{10}$/);
        expect(session.kind).toBe('pty');
    });
});
```

**Best Practices:**
- **One assertion per test** (or closely related assertions)
- **Use descriptive test names** ("should X when Y")
- **Clean up resources** in `afterEach` hooks
- **Use test factories** for complex setup
- **Mock external dependencies** (network, file system)

### E2E Tests

**Location:** `e2e/`

**Pattern:**
```javascript
import { test, expect } from '@playwright/test';
import { resetToOnboarded } from './helpers/reset-database.js';

test.describe('Session Management', () => {
    test.beforeEach(async ({ page }) => {
        const { apiKey } = await resetToOnboarded();
        await page.goto('/login');
        await page.fill('[name="key"]', apiKey.key);
        await page.click('button[type="submit"]');
    });

    test('creates and displays terminal session', async ({ page }) => {
        await page.click('[data-testid="new-session"]');
        await page.selectOption('[name="type"]', 'pty');
        await page.click('button[type="submit"]');

        await expect(page.locator('.terminal')).toBeVisible();
    });
});
```

**Best Practices:**
- **Use test helpers** (`resetToOnboarded`, `completeOnboarding`)
- **Use data-testid** for stable selectors
- **Wait for conditions** (`expect().toBeVisible()`)
- **Test user journeys**, not implementation details
- See [Testing Quick Start Guide](../testing-quickstart.md)

### Test Database Setup

```javascript
// ✅ GOOD: Use helpers for consistent setup
import { resetToFreshInstall, resetToOnboarded } from './helpers/index.js';

test.beforeEach(async () => {
    await resetToOnboarded(); // Pre-seeded database
});

// ❌ BAD: Manual database setup in each test
test.beforeEach(async () => {
    await db.run('DELETE FROM sessions');
    await db.run('DELETE FROM users');
    // Lots of manual setup...
});
```

---

## Error Handling

### Async Error Handling

See [Error Handling Guide](./error-handling.md) for comprehensive patterns.

**Best Practices:**

```javascript
// ✅ GOOD: Try/catch with specific error handling
async function createSession(config) {
    try {
        const session = await sessionRepository.create(config);
        logger.info('SESSION', 'Created session', { id: session.runId });
        return session;
    } catch (error) {
        logger.error('SESSION', 'Failed to create session', { error, config });
        throw new Error(`Session creation failed: ${error.message}`);
    }
}

// ❌ BAD: Silent error swallowing
async function createSession(config) {
    try {
        return await sessionRepository.create(config);
    } catch (error) {
        return null; // Lost error context!
    }
}
```

### Form Validation

```javascript
// ✅ GOOD: Server-side validation with clear errors
export const actions = {
    async createWorkspace({ request }) {
        const data = await request.formData();
        const name = data.get('name');

        if (!name || name.length < 3) {
            return fail(400, {
                error: 'Workspace name must be at least 3 characters'
            });
        }

        try {
            const workspace = await workspaceService.create({ name });
            return { success: true, workspace };
        } catch (error) {
            logger.error('WORKSPACE', 'Creation failed', error);
            return fail(500, {
                error: 'Failed to create workspace. Please try again.'
            });
        }
    }
};

// ❌ BAD: Client-only validation
// Don't trust client validation - always validate on server!
```

### API Error Responses

```javascript
// ✅ GOOD: Consistent error structure
return json({
    error: 'Validation failed',
    details: {
        field: 'email',
        message: 'Invalid email format'
    }
}, { status: 400 });

// ❌ BAD: Inconsistent error responses
return json('Error!', { status: 500 }); // No structure!
```

---

## Security Practices

### Authentication

**Dual Authentication:** Dispatch supports both session cookies and API keys.

```javascript
// ✅ GOOD: Check authentication in hooks
export async function handle({ event, resolve }) {
    // Cookie validation
    const sessionCookie = event.cookies.get('session');
    if (sessionCookie) {
        const session = await cookieService.validateSessionCookie(sessionCookie);
        if (session) {
            event.locals.user = session.user;
            event.locals.sessionId = session.id;
        }
    }

    // API key fallback
    if (!event.locals.user) {
        const authHeader = event.request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const key = authHeader.substring(7);
            const user = await apiKeyManager.verifyApiKey(key);
            if (user) {
                event.locals.user = user;
            }
        }
    }

    return resolve(event);
}
```

### Input Validation

```javascript
// ✅ GOOD: Validate and sanitize inputs
function validateWorkspacePath(path) {
    // Prevent path traversal
    if (path.includes('..')) {
        throw new Error('Invalid path: contains ..');
    }

    // Ensure absolute path
    return resolve(path);
}

// ❌ BAD: Direct file system access with user input
async function readFile(userPath) {
    return fs.readFile(userPath); // Path traversal vulnerability!
}
```

### Secrets Management

```javascript
// ✅ GOOD: Use environment variables
const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY required in production');
}

// ❌ BAD: Hardcoded secrets
const apiKey = 'sk-1234567890'; // Never do this!

// ❌ BAD: Secrets in git
// .env file should be in .gitignore
```

### SQL Injection Prevention

```javascript
// ✅ GOOD: Parameterized queries
await db.get(
    'SELECT * FROM sessions WHERE run_id = ?',
    [sessionId]
);

// ❌ BAD: String concatenation
await db.get(
    `SELECT * FROM sessions WHERE run_id = '${sessionId}'`
);
```

### XSS Prevention

```javascript
// ✅ GOOD: Svelte auto-escapes by default
<div>{userInput}</div>

// ⚠️ CAUTION: Only use @html for trusted content
<div>{@html trustedMarkdown}</div>

// ❌ BAD: innerHTML with user input
element.innerHTML = userInput; // XSS vulnerability!
```

---

## Performance Optimization

### Lazy Loading

```javascript
// ✅ GOOD: Lazy load heavy components
const FileEditor = lazy(() => import('./FileEditor.svelte'));

// ✅ GOOD: Code splitting for routes
const routes = {
    '/admin': () => import('./routes/admin/+page.svelte')
};
```

### Caching

```javascript
// ✅ GOOD: Cache with TTL
class ThemeManager {
    cache = new Map();
    lastCacheUpdate = 0;
    cacheTimeout = 5 * 60 * 1000; // 5 minutes

    async listThemes() {
        if (Date.now() - this.lastCacheUpdate > this.cacheTimeout) {
            await this.loadThemes(); // Refresh cache
        }
        return Array.from(this.cache.values());
    }
}

// ❌ BAD: No cache invalidation
const themes = await loadAllThemes(); // Always loads from disk!
```

### Derived State

```javascript
// ✅ GOOD: Use $derived for computed values
class SessionViewModel {
    sessions = $state([]);

    runningSessions = $derived.by(() =>
        this.sessions.filter(s => s.status === 'running')
    );
}

// ❌ BAD: Manual recomputation
class SessionViewModel {
    sessions = $state([]);
    runningSessions = $state([]);

    updateRunningSessions() {
        this.runningSessions = this.sessions.filter(s => s.status === 'running');
    }
}
```

### Database Optimization

```javascript
// ✅ GOOD: Use indexes for frequent queries
CREATE INDEX idx_sessions_owner ON sessions(owner_user_id);
CREATE INDEX idx_sessions_status ON sessions(status);

// ✅ GOOD: Batch operations
await db.run('BEGIN TRANSACTION');
for (const item of items) {
    await db.run('INSERT INTO ...', [item]);
}
await db.run('COMMIT');

// ❌ BAD: N+1 queries
for (const session of sessions) {
    const events = await getEvents(session.id); // N queries!
}

// ✅ GOOD: Single query with JOIN
const sessionsWithEvents = await db.all(`
    SELECT s.*, GROUP_CONCAT(e.id) as event_ids
    FROM sessions s
    LEFT JOIN events e ON e.session_id = s.run_id
    GROUP BY s.run_id
`);
```

---

## Git Workflow

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# ✅ GOOD: Clear, descriptive commits
git commit -m "feat: Add session pause/resume functionality

- Implement pause() and resume() methods in SessionOrchestrator
- Add UI controls for pause/resume in SessionListItem
- Update tests for pause/resume behavior

Closes #123"

# ❌ BAD: Vague commit messages
git commit -m "fix stuff"
git commit -m "WIP"
git commit -m "update"
```

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, docs, style, refactor, test, chore

### Branch Naming

```bash
# ✅ GOOD: Descriptive branch names
feature/session-pause-resume
fix/auth-token-expiration
docs/update-api-reference
refactor/cleanup-event-store

# ❌ BAD: Generic branch names
fix
update
tmp
branch1
```

### Pull Requests

**Template:**
```markdown
## Summary
Brief description of changes

## Changes
- Added X feature
- Fixed Y bug
- Refactored Z component

## Testing
- [x] Unit tests pass
- [x] E2E tests pass
- [x] Manual testing completed

## Screenshots (if UI changes)
![Description](url)

## Related Issues
Closes #123
```

**Best Practices:**
- **Keep PRs focused** - one feature/fix per PR
- **Write descriptive titles and descriptions**
- **Include test coverage** for new features
- **Update documentation** as needed
- **Request reviews** from relevant team members
- **Respond to feedback** promptly

---

## Code Review Guidelines

### What to Look For

**Functionality:**
- Does the code work as intended?
- Are edge cases handled?
- Are errors handled gracefully?

**Testing:**
- Are there tests for new features?
- Do tests cover edge cases?
- Are tests clear and maintainable?

**Architecture:**
- Does the code follow project patterns?
- Is the code in the right location?
- Are dependencies reasonable?

**Performance:**
- Are there obvious performance issues?
- Is caching appropriate?
- Are database queries optimized?

**Security:**
- Is user input validated?
- Are secrets handled correctly?
- Are there SQL injection risks?

**Code Quality:**
- Is the code readable and maintainable?
- Are variables well-named?
- Is there unnecessary complexity?

### Giving Feedback

```markdown
# ✅ GOOD: Constructive, specific feedback
"This function could be simplified by using Array.filter() instead of the manual loop. Example:
```javascript
return items.filter(item => item.active);
```
This is more readable and handles edge cases better."

# ❌ BAD: Vague, unhelpful feedback
"This code is bad. Rewrite it."
```

**Tone:**
- Be **kind and respectful**
- **Assume good intent**
- **Ask questions** instead of demanding changes
- **Explain reasoning** for suggestions
- **Acknowledge good work**

---

## Common Pitfalls

### 1. $lib Imports in Server Code

```javascript
// ❌ BAD: $lib imports in server code cause issues
import { SessionId } from '$lib/shared/utils/session-ids.js';

// ✅ GOOD: Use relative imports in server code
import { SessionId } from '../shared/utils/session-ids.js';
```

**Why:** `$lib` alias is for client code. Server code should use relative paths to avoid Vite build issues.

### 2. Mixing State and Logic

```javascript
// ❌ BAD: Business logic in ViewModels
class SessionViewModel {
    async createSession(config) {
        // HTTP request in ViewModel!
        const response = await fetch('/api/sessions', {
            method: 'POST',
            body: JSON.stringify(config)
        });
        this.sessions = await response.json();
    }
}

// ✅ GOOD: Delegate to services
class SessionViewModel {
    constructor(sessionService) {
        this.sessionService = sessionService;
    }

    async createSession(config) {
        const session = await this.sessionService.create(config);
        this.sessions = [...this.sessions, session];
    }
}
```

### 3. Ignoring Error Cases

```javascript
// ❌ BAD: Assuming success
const data = await fetch('/api/data').then(r => r.json());

// ✅ GOOD: Handle errors
try {
    const response = await fetch('/api/data');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
} catch (error) {
    logger.error('API', 'Failed to fetch data', error);
    throw error;
}
```

### 4. Not Using Test Helpers

```javascript
// ❌ BAD: Manual database setup in every test
test('creates session', async () => {
    const db = new DatabaseManager(':memory:');
    await db.init();
    await db.run('CREATE TABLE sessions ...');
    // Lots of setup...
});

// ✅ GOOD: Use test helpers
import { resetToOnboarded } from './helpers/reset-database.js';

test('creates session', async () => {
    await resetToOnboarded();
    // Test logic...
});
```

### 5. Console.log in Production Code

```javascript
// ❌ BAD: console.log for debugging
console.log('User data:', userData);

// ✅ GOOD: Use logger utility
logger.debug('USER', 'User data', { userData });
```

### 6. Hardcoded Values

```javascript
// ❌ BAD: Magic numbers and strings
if (retryCount > 3) { /* ... */ }

// ✅ GOOD: Named constants
const MAX_RETRIES = 3;
if (retryCount > MAX_RETRIES) { /* ... */ }
```

---

## Tools and Automation

### Code Formatting

```bash
# Format all files
npm run format

# Check formatting without changes
npm run lint
```

**Pre-commit:** Always run `npm run format` before committing.

### Type Checking

```bash
# Check TypeScript/JSDoc types
npm run check

# Watch mode for continuous checking
npm run check:watch
```

### Testing

```bash
# Run all unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run specific test file
npm run test:unit -- path/to/test.js
```

### Build Performance

Build metrics are automatically tracked (see L8 implementation):
- Build duration logged to console
- Metrics saved to `.metrics/` directory
- Track build performance over time

### Environment Validation

Environment variables are validated on server startup (see L5 implementation):
- Production-required variables checked
- Security validation (key strength, HTTPS)
- Clear error vs warning distinction

### Deprecation Warnings

Use the deprecation utility to mark obsolete code (see L9 implementation):

```javascript
import { deprecationWarning } from '$lib/server/shared/utils/deprecation.js';

deprecationWarning({
    name: 'oldFunction()',
    alternative: 'newFunction()',
    version: '0.2.0',
    removalVersion: '0.3.0'
});
```

---

## Summary Checklist

Before submitting code, ensure:

- [ ] Code follows architecture patterns (MVVM, adapters, event sourcing)
- [ ] Tests written and passing
- [ ] Errors handled gracefully with logging
- [ ] Security best practices followed (validation, no secrets)
- [ ] Performance considerations addressed
- [ ] Git commit messages are descriptive
- [ ] Code formatted with Prettier
- [ ] Documentation updated (if needed)
- [ ] No console.log in production code
- [ ] Used relative imports in server code (not $lib)

## Additional Resources

- [MVVM Patterns Guide](../architecture/mvvm-patterns.md)
- [Error Handling Guide](./error-handling.md)
- [Testing Quick Start Guide](../testing-quickstart.md)
- [Adapter Registration Guide](../architecture/adapter-guide.md)
- [Deprecation Guide](./deprecation-guide.md)
- [Database Schema Reference](../reference/database-schema.md)
- [API Routes Reference](../reference/api-routes.md)

---

**Questions or suggestions?** Open a discussion on GitHub or reach out to the development team.
