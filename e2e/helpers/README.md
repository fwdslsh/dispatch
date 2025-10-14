# E2E Test Helpers

This directory contains helper functions for Playwright E2E tests.

## Database Reset Helpers

### `resetDatabase(options)`

Main function to reset the test database to a clean state.

**Options:**

- `deleteFile` (boolean): Delete entire database file and recreate (default: `false`)
- `seedData` (boolean): Create default user and API key (default: `false`)
- `onboarded` (boolean): Mark onboarding as complete (default: `false`)

**Returns:** Promise with reset result and state information

**Example:**

```javascript
import { resetDatabase } from './helpers/reset-database.js';

test.beforeEach(async () => {
	// Reset to fresh install
	await resetDatabase();
});

test('with seeded data', async () => {
	// Reset with user and API key
	const result = await resetDatabase({ seedData: true, onboarded: true });
	console.log('API Key:', result.apiKey.key);
});
```

### `resetToFreshInstall()`

Quick helper: Reset to fresh install state (onboarding not complete, no data).

**Example:**

```javascript
import { resetToFreshInstall } from './helpers/index.js';

test.beforeEach(async () => {
	await resetToFreshInstall();
});
```

### `resetToOnboarded()`

Quick helper: Reset with onboarding complete and a test API key created.

**Returns:** Promise with API key information

**Example:**

```javascript
import { resetToOnboarded } from './helpers/index.js';

test('authenticated test', async ({ page }) => {
	const { apiKey } = await resetToOnboarded();

	// Use the API key to authenticate
	await page.goto('/login');
	await page.fill('[name="key"]', apiKey.key);
	await page.click('button[type="submit"]');
});
```

### `deleteDatabase()`

Nuclear option: Delete the entire database file. The server will recreate it on next access.

**Example:**

```javascript
import { deleteDatabase } from './helpers/index.js';

test('schema migration test', async () => {
	await deleteDatabase();
	// Database will be recreated with latest schema
});
```

## Usage Patterns

### Pattern 1: Fresh Install Tests (Onboarding Flow)

```javascript
import { resetToFreshInstall } from './helpers/index.js';
import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
	test.beforeEach(async () => {
		await resetToFreshInstall();
	});

	test('should complete onboarding', async ({ page }) => {
		await page.goto('/');
		// Test onboarding flow...
	});
});
```

### Pattern 2: Authenticated Tests

```javascript
import { resetToOnboarded } from './helpers/index.js';
import { test, expect } from '@playwright/test';

test.describe('Workspace Features', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Auto-login
		await page.goto('/login');
		await page.fill('[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL('/workspace');
	});

	test('should create a session', async ({ page }) => {
		// Test workspace features...
	});
});
```

### Pattern 3: Custom Database State

```javascript
import { resetDatabase } from './helpers/index.js';
import { test, expect } from '@playwright/test';

test('custom state test', async () => {
	// Reset with specific state
	const result = await resetDatabase({
		onboarded: true,
		seedData: true
	});

	// Additional custom setup...
	// (e.g., create specific sessions, workspaces, etc.)
});
```

## Important Notes

1. **Test Isolation**: Always reset the database in `test.beforeEach()` to ensure tests don't interfere with each other.

2. **Database Path**: The helper automatically finds the test database at `.test-home/.dispatch/data/workspace.db`

3. **Performance**:
   - `resetDatabase()` (data clear) is faster than `deleteDatabase()` (file delete)
   - Use data clear for most tests, file delete only when needed

4. **Parallel Execution**: These helpers work with serial test execution (Playwright config: `workers: 1`). For parallel execution, implement per-test database isolation.

5. **API Keys**: When using `seedData: true`, the helper generates a random API key and returns it. Save this for authentication in your tests.

## Future Enhancements

- [ ] Support for creating custom users and API keys
- [ ] Helpers for creating sessions, workspaces, and events
- [ ] Snapshot/restore functionality for complex test states
- [ ] Parallel test support with isolated databases
