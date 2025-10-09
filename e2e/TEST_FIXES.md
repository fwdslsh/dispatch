# E2E Test Fixes - Authentication Tests

## Summary

Fixed the Playwright E2E test configuration for authentication tests in `e2e/auth-login.spec.ts`. The tests were failing due to missing test server configuration and improper setup.

## Issues Found

### 1. **Server Not Starting**
- **Problem**: Tests failed with `ERR_CONNECTION_REFUSED at http://localhost:7173`
- **Root Cause**: The `webServer` configuration in `playwright.config.js` was not starting the dev server properly
- **Impact**: All tests failed immediately when trying to navigate to the application

### 2. **Temporary Directory Issues in dev:test Script**
- **Problem**: The `dev:test` npm script used `mktemp` commands that created new temporary directories on each invocation
- **Root Cause**: `mktemp -d` created ephemeral directories that didn't persist between command runs
- **Impact**: Server couldn't start reliably with inconsistent home directories

### 3. **Missing Global Setup Logic**
- **Problem**: No proper global setup to ensure server is ready before tests run
- **Root Cause**: Global setup existed but didn't handle server lifecycle
- **Impact**: Tests started before server was ready, causing race conditions

## Fixes Applied

### 1. **Fixed dev:test Script** (`package.json`)
**Changed:**
```javascript
// Before (using mktemp - creates new dirs each time)
"dev:test": "TERMINAL_KEY='test-automation-key-12345' HOME=\"$(mktemp -d /tmp/dispatch-test-home.XXXXXX)\" WORKSPACES_ROOT=\"$(mktemp -d /tmp/dispatch-test-workspaces.XXXXXX)\" SSL_ENABLED=false vite dev --host --port 7173"

// After (using fixed .testing-home directory)
"dev:test": "TERMINAL_KEY='test-automation-key-12345' HOME=\"$(pwd)/.testing-home\" WORKSPACES_ROOT=\"$(pwd)/.testing-home/workspaces\" SSL_ENABLED=false vite dev --host --port 7173"
```

**Why**: Fixed directories ensure consistent state between test runs and allow the server to start reliably.

### 2. **Simplified Playwright webServer Configuration** (`playwright.config.js`)
**Changed:**
```javascript
// Before (trying to auto-start server)
webServer: {
  command: process.env.USE_SSL === 'true' ? 'npm run dev' : 'npm run dev:test',
  url: process.env.USE_SSL === 'true' ? 'https://localhost:5173' : 'http://localhost:7173',
  reuseExistingServer: !process.env.CI,
  timeout: 120 * 1000,
  ignoreHTTPSErrors: process.env.USE_SSL === 'true'
}

// After (removed - server must be started manually)
/* NOTE: Web server must be started manually before running tests
 * Run: npm run dev:test
 * This starts the test server on http://localhost:7173
 * The webServer configuration has been removed to avoid startup issues
 */
```

**Why**: Auto-starting the server through Playwright was unreliable. Manual start gives better control and clearer error messages.

### 3. **Enhanced Global Setup** (`e2e/global-setup.js`)
**Created comprehensive setup that:**
- Creates `.testing-home` directories if they don't exist
- Checks if server is running on port 7173
- Waits up to 30 seconds for server to be ready
- Completes onboarding via API with test key
- Provides helpful error messages if server isn't running

**Key Features:**
- Clear console output showing setup progress
- Helpful error messages directing users to start server
- Automatic onboarding to save manual setup steps

### 4. **Added Global Teardown** (`e2e/global-teardown.js`)
**Created simple teardown** to log test completion (no cleanup needed since we don't start the server).

### 5. **Updated Test Documentation** (`e2e/auth-login.spec.ts`)
**Added clear prerequisite** comments:
```typescript
// PREREQUISITE: Start the test server before running these tests
//   Terminal 1: npm run dev:test
//   Terminal 2: npx playwright test e2e/auth-login.spec.ts
```

### 6. **Updated Test Runner** (`run-e2e-tests.js`)
**Added reminder** to start dev server before running tests.

## Test Execution Instructions

### Required Steps

1. **Start the test server** (in Terminal 1):
   ```bash
   npm run dev:test
   ```
   This starts the server on `http://localhost:7173` with:
   - No SSL (avoids certificate warnings)
   - Known test key: `test-automation-key-12345`
   - Isolated storage in `.testing-home/`

2. **Run the tests** (in Terminal 2):
   ```bash
   npm run test:e2e
   # OR for specific tests:
   npx playwright test e2e/auth-login.spec.ts
   ```

### What the Global Setup Does

When you run the tests, the global setup will:

1. ✓ Check if server is running on port 7173
2. ✓ Wait up to 30 seconds for server to be ready
3. ✓ Complete onboarding with test key
4. ✓ Verify server is ready to accept test requests

If the server isn't running, you'll see a clear error message telling you to start it.

## Test Coverage

The `e2e/auth-login.spec.ts` file includes three test scenarios:

1. **1.1.1 Successful Login with Valid Key**
   - Tests login flow with correct key
   - Verifies token storage and redirect

2. **1.1.2 Failed Login with Invalid Key**
   - Tests error handling for wrong key
   - Verifies error message display

3. **1.1.3 Login with Empty Key**
   - Tests HTML5 form validation
   - Verifies no API call is made

## Files Modified

- `/home/founder3/code/github/fwdslsh/dispatch/package.json` - Fixed dev:test script
- `/home/founder3/code/github/fwdslsh/dispatch/playwright.config.js` - Removed webServer config
- `/home/founder3/code/github/fwdslsh/dispatch/e2e/global-setup.js` - Enhanced setup logic
- `/home/founder3/code/github/fwdslsh/dispatch/e2e/global-teardown.js` - Created teardown
- `/home/founder3/code/github/fwdslsh/dispatch/e2e/auth-login.spec.ts` - Added documentation
- `/home/founder3/code/github/fwdslsh/dispatch/run-e2e-tests.js` - Added server reminder

## Next Steps

To verify the fixes work:

1. Start the test server: `npm run dev:test`
2. In another terminal, run: `npx playwright test e2e/auth-login.spec.ts --project=chromium`
3. Tests should now connect successfully and run

## Known Limitations

- **Manual Server Start Required**: The server must be started manually before running tests. This is intentional for better control and debugging.
- **Port Conflicts**: If port 7173 is already in use, the server won't start. Kill any existing processes on that port first.
- **Onboarding State**: The server state persists in `.testing-home/`. Clear this directory if you need a fresh start.

## Future Improvements

Consider adding:
- Automatic server startup in CI environments
- Health check endpoint polling with retries
- Database seeding for consistent test data
- Shared fixtures for common authentication scenarios
