# E2E Testing Framework for Dispatch

## Overview

Clean, maintainable end-to-end testing framework using Playwright, focused on core functionality and reliable CI execution.

📖 **See also**: [Testing Quick Start Guide](../docs/testing-quickstart.md) - Comprehensive guide for setting up test instances and database seeding.

## Quick Start

```bash
# Install dependencies
npm install
npm run playwright:install

# Run all tests (uses test server by default)
npm run test:e2e

# Run specific test file
npx playwright test comprehensive-ui.spec.js

# Run SSL-specific tests
USE_SSL=true npm run test:e2e -- ssl-tests.spec.js

# Run with UI mode
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

## Test Servers

**Default Test Server** (recommended):
- URL: `http://localhost:7173`
- No SSL (avoids certificate warnings)
- Faster, more reliable
- Known auth key: `test-automation-key-12345`
- Isolated tmp storage

**SSL Development Server** (for SSL-specific tests):
- URL: `https://localhost:5173`
- SSL enabled with self-signed certificate
- Use `USE_SSL=true` environment variable
- For testing certificate validation, HTTPS features

## Test Structure

### Core Test Files

- `comprehensive-ui.spec.js` - Main UI functionality tests
- `consolidated-session-tests.spec.js` - Session management tests
- `workspace-api.spec.js` - API endpoint tests
- `auth-persistence.spec.js` - Authentication flow tests
- `working-directory.spec.js` - Directory management tests
- `window-manager.spec.js` - Window management tests

### Helper Files

- `core-helpers.js` - Consolidated test utilities
- `global-setup.js` - Global test configuration

## Configuration

Single `playwright.config.js` with automatic server selection:

- **Base URL**: `http://localhost:7173` (default) or `https://localhost:5173` (with `USE_SSL=true`)
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Retries**: 2 on CI, 0 locally
- **Timeouts**: 10s action, 30s navigation
- **Screenshots**: On failure only
- **Video**: Retained on failure
- **Server**: Auto-starts `npm run dev:test` (or `npm run dev` with `USE_SSL=true`)

**Environment Variables**:
- `USE_SSL=true` - Use SSL server instead of test server
- `TERMINAL_KEY=<key>` - Override default authentication key
- `CI=true` - Enable CI optimizations (retries, single worker)

## Best Practices

### Test Organization

- Use `navigateToWorkspaceWithOnboardingComplete()` for most tests to bypass onboarding
- Take screenshots with `takeTestScreenshot()` for debugging
- Handle failures gracefully with try/catch blocks
- Use `safeInteract()` for reliable element interactions

### Database Initialization

Most tests should **bypass the onboarding flow** to test workspace functionality directly. Use these helpers:

```javascript
import { navigateToWorkspaceWithOnboardingComplete } from './core-helpers.js';

test.beforeEach(async ({ page }) => {
	// Sets up mocks + auth + navigates to workspace with onboarding complete
	await navigateToWorkspaceWithOnboardingComplete(page);
});
```

**Available initialization helpers:**

- `navigateToWorkspaceWithOnboardingComplete(page)` - Complete setup (recommended for workspace tests)
- `navigateToRouteAuthenticated(page, route)` - Navigate to any route with auth (for /settings, /console)
- `preAuthenticateUser(page)` - Set localStorage auth without form interaction
- `quickAuth(page)` - Minimal auth setup for simple tests
- `setupWorkspaceTestMocks(page, options)` - Mock API endpoints with onboarding complete
- `completeOnboardingViaApi(page)` - Seed database with completed onboarding state

**When to test onboarding flow:**

Only `onboarding.spec.js` should test the actual onboarding flow. All other tests should assume onboarding is complete.

### Authentication

```javascript
// For workspace tests
import { navigateToWorkspaceWithOnboardingComplete } from './core-helpers.js';
test.beforeEach(async ({ page }) => {
	await navigateToWorkspaceWithOnboardingComplete(page);
});

// For settings/console tests
import { navigateToRouteAuthenticated } from './core-helpers.js';
test.beforeEach(async ({ page }) => {
	await navigateToRouteAuthenticated(page, '/settings');
});

// For custom navigation with pre-auth
import { preAuthenticateUser } from './core-helpers.js';
test.beforeEach(async ({ page }) => {
	await preAuthenticateUser(page); // Sets localStorage
	// Setup your custom mocks here
	await page.goto('/your-route');
});
```

**Key Benefits of Pre-Authentication:**
- Bypasses login form completely
- No need to find/fill terminal key input
- Immediate access to protected routes
- Consistent test environment

### API Mocking

```javascript
import { setupWorkspaceTestMocks } from './core-helpers.js';

// Mocks onboarding, sessions, workspaces, and auth
await setupWorkspaceTestMocks(page, {
	sessions: [{ id: 'test', name: 'Test Session' }],
	workspaces: [{ id: '/workspace/test', name: 'Test' }],
	onboardingComplete: true  // default
});
```

### Element Interaction

```javascript
import { safeInteract } from './core-helpers.js';

await safeInteract(page, 'button', 'click');
await safeInteract(page, 'input', 'fill', 'test value');
```

## Debugging

### Failed Tests

```bash
# View HTML report
npx playwright show-report

# Run with headed browser
npx playwright test --headed

# Run single test in debug mode
npx playwright test comprehensive-ui.spec.js --debug
```

### Screenshots and Videos

- Screenshots: `test-results/`
- Videos: `test-results/` (on failure only)
- HTML Report: `playwright-report/`

## Maintenance

### Adding New Tests

1. Add to existing spec files when possible
2. Use `core-helpers.js` utilities
3. Follow naming convention: `feature-name.spec.js`
4. Update this README if adding new categories

### Updating Selectors

- Use `data-testid` attributes when possible
- Prefer semantic selectors (`button`, `input`)
- Avoid brittle CSS selectors

### CI Reliability

- Tests run in single worker on CI
- No external API dependencies
- Service worker disabled globally
- Storage cleared between tests

## Troubleshooting

**Connection refused errors**:
- Default: Check test server is running on port 7173
- SSL mode: Check dev server is running on port 5173
- Verify `playwright.config.js` webServer configuration

**Timeout errors**: Increase timeouts in playwright.config.js

**Flaky tests**: Use `safeInteract()` and proper wait conditions

**Screenshot mismatches**: Update baselines or check for font differences

**SSL certificate errors** (when using SSL server):
- Ensure `ignoreHTTPSErrors: true` is set
- Verify self-signed certificate generation in dev server

**Authentication failures**:
- Check `TERMINAL_KEY` environment variable
- Default test server (`npm run dev:test`) uses: `test-automation-key-12345`
- Default dev server (`npm run dev`) uses: `testkey12345` (deprecated for tests)
