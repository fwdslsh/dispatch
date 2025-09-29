# E2E Testing Framework for Dispatch

## Overview

Clean, maintainable end-to-end testing framework using Playwright, focused on core functionality and reliable CI execution.

## Quick Start

```bash
# Install dependencies
npm install
npm run playwright:install

# Run all tests
npm run test:e2e

# Run specific test file
npx playwright test comprehensive-ui.spec.js

# Run with UI mode
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

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

Single `playwright.config.js` with:
- **Base URL**: `http://localhost:5173` (consistent across all tests)
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Retries**: 2 on CI, 0 locally
- **Timeouts**: 10s action, 30s navigation
- **Screenshots**: On failure only
- **Video**: Retained on failure

## Best Practices

### Test Organization
- Use consistent `beforeEach` patterns with `navigateToWorkspace()`
- Take screenshots with `takeTestScreenshot()` for debugging
- Handle failures gracefully with try/catch blocks
- Use `safeInteract()` for reliable element interactions

### Authentication
```javascript
import { navigateToWorkspace } from './core-helpers.js';

test.beforeEach(async ({ page }) => {
    await navigateToWorkspace(page); // Handles auth automatically
});
```

### API Mocking
```javascript
import { setupApiMocks } from './core-helpers.js';

await setupApiMocks(page, {
    sessions: [{ id: 'test', name: 'Test Session' }]
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

**Connection refused errors**: Check dev server is running on port 5173
**Timeout errors**: Increase timeouts in playwright.config.js
**Flaky tests**: Use `safeInteract()` and proper wait conditions
**Screenshot mismatches**: Update baselines or check for font differences
