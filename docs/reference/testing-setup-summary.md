# Testing Setup - Summary

## What Was Created

### 1. Testing Quick Start Guide (`docs/testing-quickstart.md`)

A comprehensive guide that covers:

- **Quick Start Options**: Three different methods to initialize test instances
  - Automated script (recommended)
  - Manual temporary instance setup
  - Pre-configured npm scripts

- **Database Seeding Methods**:
  - API-based seeding (recommended) - uses the onboarding endpoint
  - Direct database manipulation - for advanced use cases
  - Playwright test helpers - for E2E tests

- **Environment Variables Reference**: Complete documentation of all relevant environment variables

- **Database Schema Overview**: Key tables and SQL queries for testing

- **Common Testing Scenarios**: Step-by-step examples for:
  - Testing fresh installation
  - Testing workspace features
  - Testing authentication
  - Testing session persistence

- **UI Test Automation Setup**: Instructions for Selenium, Cypress, and other tools

- **Playwright E2E Tests**: How to use the existing test helpers

- **Troubleshooting**: Common issues and solutions

### 2. Setup Script (`scripts/setup-test-instance.sh`)

A bash script that automates test instance creation with the following features:

**Capabilities**:

- Creates temporary directories for HOME and WORKSPACES_ROOT
- Initializes fresh SQLite database with proper schema
- Optionally completes onboarding automatically
- Optionally creates and seeds workspace
- Can start the dev server immediately
- Outputs environment variables for manual use

**Options**:

```bash
--auto-onboard          # Complete onboarding automatically
--key KEY               # Set custom TERMINAL_KEY
--workspace PATH        # Create workspace at PATH
--workspace-name NAME   # Set workspace name
--port PORT             # Server port (default: 7173)
--start                 # Start dev server after setup
--print-home            # Print HOME directory and exit
--help                  # Show help message
```

**Usage Examples**:

```bash
# Basic auto-onboarded instance
./scripts/setup-test-instance.sh --auto-onboard

# Custom key and workspace
./scripts/setup-test-instance.sh --auto-onboard --key "my-key" --workspace "/workspace/myapp"

# Create and start immediately
./scripts/setup-test-instance.sh --auto-onboard --start
```

**Database Initialization**:
The script uses a Node.js inline script to properly initialize the SQLite database with:

- All required tables (sessions, session_events, workspace_layout, workspaces, settings, user_preferences)
- WAL mode enabled
- Foreign keys enabled
- Authentication settings (when auto-onboarding)
- Onboarding completion record
- Workspace creation (when specified)

### 3. Documentation Updates

Added references to the new testing quick start guide in:

- **Main README.md**: Added to "Documentation & Support" section
- **docs/README.md**: Added to "Getting Started" section
- **e2e/README.md**: Added cross-reference in overview section

## How to Use

### For Developers

1. **Quick test instance**:

   ```bash
   ./scripts/setup-test-instance.sh --auto-onboard --start
   ```

2. **Custom testing scenario**:

   ```bash
   ./scripts/setup-test-instance.sh --auto-onboard \
     --key "custom-test-key" \
     --workspace "/workspace/test-project" \
     --workspace-name "My Test Project"
   ```

3. **CI/Automated testing**:

   ```bash
   # Get instance home directory
   export TEST_HOME=$(./scripts/setup-test-instance.sh --auto-onboard --print-home)

   # Start server
   HOME="$TEST_HOME" npm run dev:test &

   # Run tests
   npm run test:e2e
   ```

### For E2E Tests

Use the existing Playwright helpers in `e2e/core-helpers.js`:

```javascript
import { navigateToWorkspaceWithOnboardingComplete } from './e2e/core-helpers.js';

test('my test', async ({ page }) => {
	// Automatically sets up mocks and bypasses onboarding
	await navigateToWorkspaceWithOnboardingComplete(page);

	// Test your features
});
```

### For UI Automation Tools

1. Start test server: `npm run dev:test`
2. Connect to: `http://localhost:7173`
3. Pre-inject auth into localStorage:
   ```javascript
   localStorage.setItem('dispatch-auth-key', 'test-automation-key-12345');
   localStorage.setItem('authSessionId', 'test-' + Date.now());
   localStorage.setItem(
   	'authExpiresAt',
   	new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
   );
   localStorage.setItem('onboarding-complete', 'true');
   ```

## Key Features

1. **Isolation**: Each instance uses temporary directories that can be easily cleaned up
2. **Repeatability**: Fresh database initialization ensures consistent test state
3. **Flexibility**: Multiple options for different testing scenarios
4. **Automation**: Can be fully automated for CI/CD pipelines
5. **Documentation**: Comprehensive guide covers all use cases

## Database Seeding Details

The script automatically creates and seeds the following:

### Settings Table

- **authentication** category: Contains terminal_key
- **onboarding** category: Marks onboarding as complete with timestamp

### Workspaces Table

- Creates workspace entry when --workspace is provided
- Includes path, name, and timestamps

### Database Schema

All tables from the production schema:

- sessions
- session_events
- workspace_layout
- workspaces
- settings
- user_preferences

## Cleanup

Temporary directories can be cleaned up with:

```bash
# Manual cleanup of specific instance
rm -rf /tmp/dispatch-test-home.XXXXXX /tmp/dispatch-test-workspaces.XXXXXX

# Automatic cleanup of old test directories
find /tmp -name "dispatch-test-*" -type d -mtime +1 -exec rm -rf {} +
```

## Testing the Setup

To verify the script works:

```bash
# Test help output
./scripts/setup-test-instance.sh --help

# Test instance creation (dry run)
./scripts/setup-test-instance.sh --auto-onboard

# Test full workflow
./scripts/setup-test-instance.sh --auto-onboard --start
```

## Next Steps

- Try the script with different options
- Review the testing quick start guide
- Integrate into CI/CD pipelines
- Customize for specific testing needs

## Files Created

1. `/docs/testing-quickstart.md` - Comprehensive testing guide
2. `/scripts/setup-test-instance.sh` - Automated setup script

## Files Modified

1. `/README.md` - Added testing quick start reference
2. `/docs/README.md` - Added to getting started section
3. `/e2e/README.md` - Added cross-reference
