# Testing Guide for Dispatch

This guide covers how to run tests, add new tests, and implement performance benchmarks in the Dispatch project.

## Testing Framework Overview

Dispatch uses a multi-layered testing approach:

- **Vitest**: Unit and integration tests for client/server code
- **Playwright**: End-to-end browser automation tests
- **Performance Benchmarks**: Constitutional compliance validation

## Test Organization

```
dispatch/
├── tests/
│   ├── client/           # Client-side unit tests
│   ├── server/           # Server-side unit tests
│   └── helpers/          # Test utilities and stubs
├── e2e/                  # Playwright E2E tests
│   ├── workspace-api.spec.js
│   ├── session-persistence.spec.js
│   ├── multi-device.spec.js
│   └── performance/
│       └── event-replay.bench.js
└── run-e2e-tests.js      # E2E test runner
```

## Running Tests

### All Tests

```bash
# Run all test suites
npm test

# Run with coverage
npm run test:coverage
```

### Unit Tests (Vitest)

```bash
# All unit tests
npm run test:unit

# Watch mode for development
npm run test:unit:watch

# Client-side tests only
vitest run tests/client/

# Server-side tests only
vitest run tests/server/

# Specific test file
vitest run tests/server/database.test.js
```

### End-to-End Tests (Playwright)

```bash
# All E2E tests
npm run test:e2e

# Run with browser UI (for debugging)
npm run test:e2e:headed

# Specific test suite
npm run test:e2e -- workspace-api

# Specific test file
npm run test:e2e -- e2e/session-persistence.spec.js

# Run tests matching pattern
npm run test:e2e -- --grep "multi-device"
```

### Performance Benchmarks

```bash
# Run performance benchmarks
npm run test:e2e -- e2e/performance/

# Specific benchmark
npm run test:e2e -- e2e/performance/event-replay.bench.js
```

## Writing Unit Tests

### Test Setup

Unit tests use Vitest with separate configurations for client and server code:

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'jsdom', // For client-side tests
		setupFiles: ['tests/setup.js'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			exclude: ['e2e/**', 'tests/**']
		}
	}
});
```

### Server-Side Unit Tests

Example: Testing workspace service logic

```javascript
// tests/server/workspace-service.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceService } from '$lib/server/shared/services/WorkspaceService.js';

describe('WorkspaceService', () => {
	let workspaceService;
	let mockDatabase;

	beforeEach(() => {
		mockDatabase = {
			get: vi.fn(),
			run: vi.fn(),
			all: vi.fn()
		};
		workspaceService = new WorkspaceService(mockDatabase);
	});

	it('should create workspace with valid path', async () => {
		const workspaceData = {
			path: '/workspace/test-project',
			name: 'Test Project'
		};

		mockDatabase.run.mockResolvedValue({ lastID: 1 });

		const result = await workspaceService.createWorkspace(workspaceData);

		expect(result.path).toBe(workspaceData.path);
		expect(result.name).toBe(workspaceData.name);
		expect(mockDatabase.run).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO workspaces'),
			expect.any(Array)
		);
	});

	it('should reject invalid workspace paths', async () => {
		const invalidPaths = [
			'../../../etc/passwd', // Path traversal
			'relative/path', // Not absolute
			'/system/critical/path' // Outside workspace root
		];

		for (const path of invalidPaths) {
			await expect(workspaceService.createWorkspace({ path, name: 'Test' })).rejects.toThrow();
		}
	});
});
```

### Client-Side Unit Tests

Example: Testing Svelte 5 ViewModels

```javascript
// tests/client/session-viewmodel.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionViewModel } from '$lib/client/shared/state/SessionViewModel.svelte.js';

describe('SessionViewModel', () => {
	let viewModel;
	let mockSessionService;

	beforeEach(() => {
		mockSessionService = {
			create: vi.fn(),
			list: vi.fn(),
			delete: vi.fn()
		};

		viewModel = new SessionViewModel(mockSessionService);
	});

	it('should create session and update state', async () => {
		const sessionData = { id: 'sess_123', type: 'pty', status: 'running' };
		mockSessionService.create.mockResolvedValue(sessionData);

		await viewModel.createSession('pty', { workspacePath: '/workspace/test' });

		expect(viewModel.sessions).toContain(sessionData);
		expect(viewModel.currentSession).toBe(sessionData);
		expect(viewModel.loading).toBe(false);
	});

	it('should handle errors gracefully', async () => {
		mockSessionService.create.mockRejectedValue(new Error('Network error'));

		await viewModel.createSession('pty', {});

		expect(viewModel.error).toBe('Network error');
		expect(viewModel.loading).toBe(false);
	});

	it('should filter active sessions correctly', () => {
		viewModel.sessions = [
			{ id: '1', status: 'running' },
			{ id: '2', status: 'stopped' },
			{ id: '3', status: 'running' }
		];

		expect(viewModel.activeSessions).toHaveLength(2);
		expect(viewModel.activeSessions.every((s) => s.status === 'running')).toBe(true);
	});
});
```

### Mocking Socket.IO

```javascript
// tests/helpers/socket-mock.js
import { vi } from 'vitest';

export function createMockSocket() {
	const eventHandlers = new Map();

	return {
		emit: vi.fn(),
		on: vi.fn((event, handler) => {
			eventHandlers.set(event, handler);
		}),
		off: vi.fn(),
		connect: vi.fn(),
		disconnect: vi.fn(),

		// Test helpers
		_emit: (event, data) => {
			const handler = eventHandlers.get(event);
			if (handler) handler(data);
		},
		_getHandlers: () => eventHandlers
	};
}
```

## Writing E2E Tests

### Test Structure

E2E tests use Playwright with the test workspace isolation pattern:

```javascript
// e2e/example.spec.js
import { test, expect } from '@playwright/test';

const TEST_KEY = process.env.TERMINAL_KEY || 'testkey12345';
const BASE_URL = 'http://localhost:5173';

test.describe('Feature Name', () => {
	const testWorkspacePath = '/tmp/test-workspace-unique';

	test.beforeEach(async ({ page }) => {
		// Set up test environment
		await page.goto(BASE_URL);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Create test workspace
		await page.request
			.post(`${BASE_URL}/api/workspaces`, {
				data: {
					path: testWorkspacePath,
					name: 'Test Workspace',
					authKey: TEST_KEY
				}
			})
			.catch(() => {
				// Workspace might already exist
			});
	});

	test.afterEach(async ({ page }) => {
		// Clean up test data
		try {
			await page.request.delete(
				`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}?authKey=${TEST_KEY}`
			);
		} catch {
			// Ignore cleanup errors
		}
	});

	test('should do something', async ({ page }) => {
		// Test implementation
	});
});
```

### Best Practices for E2E Tests

**1. Use Data Attributes for Selectors**

```javascript
// Good: Stable selectors
await page.click('[data-testid="create-session-button"]');
await page.waitForSelector('[data-testid="terminal-container"]');

// Avoid: Fragile selectors
await page.click('button:nth-child(2)'); // Breaks if UI changes
await page.click('button:has-text("Create")'); // Breaks if text changes
```

**2. Proper Waiting Strategies**

```javascript
// Wait for specific elements
await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

// Wait for network requests
await page.waitForResponse(
	(response) => response.url().includes('/api/sessions') && response.status() === 200
);

// Wait for navigation
await page.waitForURL('**/dashboard');

// Wait for function to return true
await page.waitForFunction(
	() => document.querySelector('[data-testid="session-list"]').children.length > 0
);
```

**3. Multi-Browser Testing**

```javascript
test('should sync across multiple browsers', async ({ browser }) => {
	const context1 = await browser.newContext();
	const context2 = await browser.newContext();

	const page1 = await context1.newPage();
	const page2 = await context2.newPage();

	try {
		// Test multi-device scenarios
		await page1.goto(BASE_URL);
		await page2.goto(BASE_URL);

		// ... test implementation
	} finally {
		await context1.close();
		await context2.close();
	}
});
```

### API Testing Pattern

```javascript
test('should handle API operations', async ({ page }) => {
	// Test API endpoint directly
	const response = await page.request.post(`${BASE_URL}/api/workspaces`, {
		data: {
			path: '/workspace/api-test',
			name: 'API Test Workspace',
			authKey: TEST_KEY
		}
	});

	expect(response.status()).toBe(201);

	const data = await response.json();
	expect(data).toMatchObject({
		id: '/workspace/api-test',
		name: 'API Test Workspace',
		status: 'new'
	});

	// Verify in UI
	await page.goto(`${BASE_URL}/dashboard`);
	await expect(page.locator('text=API Test Workspace')).toBeVisible();
});
```

## Performance Benchmarks

### Constitutional Requirements

Dispatch has specific performance requirements that must be validated:

- **Event Replay**: Must complete in <100ms regardless of history size
- **Session Creation**: Should complete in <5 seconds
- **Multi-Client Sync**: Events should propagate in <1 second

### Writing Performance Tests

```javascript
// e2e/performance/event-replay.bench.js
test('should replay events within constitutional limit', async ({ page }) => {
	// Create session with large event history
	await createSessionWithEvents(page, 10000); // 10K events

	const sessionId = await getSessionId(page);

	// Measure replay performance
	console.log('Measuring event replay performance...');
	const startTime = Date.now();

	const historyResponse = await page.request.get(`${BASE_URL}/api/sessions/${sessionId}/history`);
	expect(historyResponse.status()).toBe(200);

	const historyData = await historyResponse.json();
	const endTime = Date.now();

	const replayTime = endTime - startTime;
	console.log(`Event replay time for ${historyData.events.length} events: ${replayTime}ms`);

	// Constitutional requirement: <100ms
	expect(replayTime).toBeLessThan(100);
});
```

### Performance Monitoring

```javascript
// tests/performance/helpers.js
export function measureExecutionTime(fn) {
	return async (...args) => {
		const start = performance.now();
		const result = await fn(...args);
		const end = performance.now();

		return {
			result,
			duration: end - start
		};
	};
}

export function createPerformanceReporter() {
	const metrics = [];

	return {
		record(name, duration, metadata = {}) {
			metrics.push({
				name,
				duration,
				metadata,
				timestamp: Date.now()
			});
		},

		getReport() {
			return {
				totalTests: metrics.length,
				averageDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
				slowestTest: metrics.reduce((max, m) => (m.duration > max.duration ? m : max)),
				metrics
			};
		}
	};
}
```

## Test Configuration

### Playwright Configuration

```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,

	reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],

	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		}
	],

	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI
	}
});
```

### Environment Variables for Testing

```bash
# .env.test
TERMINAL_KEY=testkey12345
NODE_ENV=test
WORKSPACES_ROOT=/tmp/test-workspaces
ENABLE_TUNNEL=false
DEBUG=test:*
```

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Debugging Tests

### Playwright Debugging

```bash
# Run tests in debug mode
npx playwright test --debug

# Run specific test in debug mode
npx playwright test e2e/session-persistence.spec.js --debug

# Generate trace files
npx playwright test --trace on

# View trace files
npx playwright show-trace trace.zip
```

### Vitest Debugging

```bash
# Run tests in debug mode
vitest --inspect-brk

# Debug specific test
vitest run tests/server/database.test.js --inspect-brk

# Use VS Code debugger
vitest --inspect-brk --no-coverage
```

### Common Testing Issues

**1. Flaky E2E Tests**

- Add proper waits instead of fixed timeouts
- Use deterministic selectors
- Clean up test data properly

**2. Mock Issues**

- Ensure mocks are reset between tests
- Use factory functions for complex mocks
- Verify mock expectations

**3. Performance Test Variability**

- Run benchmarks multiple times
- Account for CI environment differences
- Use relative performance comparisons

## Adding New Tests

### Checklist for New Features

When adding a new feature, ensure you add:

- [ ] Unit tests for business logic
- [ ] Integration tests for API endpoints
- [ ] E2E tests for user workflows
- [ ] Performance tests if applicable
- [ ] Error handling tests
- [ ] Security/validation tests

### Test Coverage Goals

- **Unit Tests**: >90% code coverage
- **E2E Tests**: Cover all user workflows
- **Performance Tests**: Validate constitutional requirements
- **Integration Tests**: Test all API endpoints

### Test Naming Convention

```javascript
// Unit tests: describe what, test should
describe('WorkspaceService', () => {
	it('should create workspace with valid data', () => {});
	it('should reject invalid paths', () => {});
	it('should handle database errors gracefully', () => {});
});

// E2E tests: describe user scenario
test.describe('Workspace Management', () => {
	test('user can create and delete workspace', async ({ page }) => {});
	test('workspace persists across page reload', async ({ page }) => {});
});
```

This testing guide ensures comprehensive coverage of Dispatch's functionality while maintaining performance and reliability standards.
