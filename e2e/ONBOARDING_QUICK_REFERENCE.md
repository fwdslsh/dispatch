# Onboarding E2E Tests - Quick Reference

**Purpose**: Fast lookup guide for implementing Playwright tests
**Full Details**: See `ONBOARDING_TEST_PLAN.md`

---

## Test Server Setup

```bash
# Start test server
npm run dev:test

# Verify ready
curl http://localhost:7173/api/status
```

**URL**: http://localhost:7173
**Test Key**: test-automation-key-12345

---

## Onboarding Flow Overview

```
┌─────────────────┐
│  /onboarding    │ → Check if already complete → Redirect to /
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 1: Workspace│ → Optional: Enter name or skip
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 2: Theme   │ → Optional: Select theme or skip
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Step 3: Settings│ → Required: Configure + Submit
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API Key Display │ → Copy key + Confirm → Continue
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   /workspace    │ → Authenticated user lands here
└─────────────────┘
```

---

## Selectors Quick Reference

### Step 1: Workspace

```javascript
// Input field
page.locator('input[placeholder*="Workspace name"]');

// Auto-generated path (read-only)
page.locator('input[placeholder*="Workspace path"]');

// Continue/Skip button (text changes based on input)
page.locator('button:has-text("Continue")');
page.locator('button:has-text("Skip Workspace")');
```

### Step 2: Theme

```javascript
// Theme cards (grid layout)
page.locator('[data-theme-id]');
page.locator('[data-theme-id="phosphor-green"]');
page.locator('[data-theme-id="cyber-blue"]');

// Buttons
page.locator('button:has-text("Continue with Selected Theme")');
page.locator('button:has-text("Skip")');

// Selected theme (has outline)
page.locator('.theme-option.selected');
```

### Step 3: Settings

```javascript
// Checkboxes
page.locator('input[type="checkbox"]').first(); // Auto cleanup
page.locator('input[type="checkbox"]').nth(1); // Remember workspace

// Navigation
page.locator('button:has-text("Back")');
page.locator('button:has-text("Complete Setup")');

// Loading state
page.locator('button:has-text("Completing Setup...")');
```

### API Key Display

```javascript
// Key display
page.locator('.api-key-text');

// Warning box
page.locator('.warning-box');

// Copy button
page.locator('button:has-text("Copy API Key")');
page.locator('button:has-text("✓ Copied to Clipboard!")');

// Confirmation checkbox
page.locator('input[type="checkbox"]'); // "I have saved my API key"

// Continue button
page.locator('button:has-text("Continue to Dispatch")');
```

### Progress Bar

```javascript
page.locator('.progress');
page.locator('text=/33% Complete/');
page.locator('text=/66% Complete/');
page.locator('text=/100% Complete/');
```

---

## Helper Functions (Copy to Test File)

```javascript
/**
 * Complete workspace step
 * @param {Page} page - Playwright page
 * @param {string} name - Workspace name (empty to skip)
 */
async function completeWorkspaceStep(page, name = '') {
	await page.waitForSelector('input[placeholder*="Workspace name"]');

	if (name) {
		await page.fill('input[placeholder*="Workspace name"]', name);
		await page.click('button:has-text("Continue")');
	} else {
		await page.click('button:has-text("Skip Workspace")');
	}

	// Wait for theme step to load
	await page.waitForSelector('[data-theme-id]', { timeout: 5000 });
}

/**
 * Complete theme step
 * @param {Page} page - Playwright page
 * @param {string|null} themeId - Theme ID to select (null to skip)
 */
async function completeThemeStep(page, themeId = null) {
	if (themeId) {
		await page.click(`[data-theme-id="${themeId}"]`);
		await page.click('button:has-text("Continue with Selected Theme")');
	} else {
		await page.click('button:has-text("Skip")');
	}

	// Wait for settings step to load
	await page.waitForSelector('button:has-text("Complete Setup")');
}

/**
 * Complete settings step
 * @param {Page} page - Playwright page
 */
async function completeSettingsStep(page) {
	await page.click('button:has-text("Complete Setup")');

	// Wait for API key display (bcrypt takes time)
	await page.waitForSelector('.api-key-text', { timeout: 10000 });
}

/**
 * Copy API key and continue
 * @param {Page} page - Playwright page
 * @returns {Promise<string>} - The API key value
 */
async function copyApiKeyAndContinue(page) {
	// Get the API key value
	const apiKey = await page.locator('.api-key-text').textContent();

	// Copy to clipboard
	await page.click('button:has-text("Copy API Key")');

	// Wait for feedback animation
	await page.waitForSelector('button:has-text("✓ Copied to Clipboard!")');

	// Click continue (should be enabled now)
	await page.click('button:has-text("Continue to Dispatch")');

	// Wait for redirect
	await page.waitForURL('**/workspace', { timeout: 10000 });

	return apiKey;
}

/**
 * Complete full onboarding flow
 * @param {Page} page - Playwright page
 * @param {Object} options - Configuration
 * @param {string} options.workspace - Workspace name (empty to skip)
 * @param {string} options.theme - Theme ID (null to skip)
 * @returns {Promise<string>} - Generated API key
 */
async function completeOnboarding(page, options = {}) {
	await page.goto('http://localhost:7173/onboarding');

	await completeWorkspaceStep(page, options.workspace || '');
	await completeThemeStep(page, options.theme || null);
	await completeSettingsStep(page);

	const apiKey = await copyApiKeyAndContinue(page);

	return apiKey;
}

/**
 * Verify API key format
 * @param {string} key - API key to validate
 */
function verifyApiKeyFormat(key) {
	expect(key).toMatch(/^dpk_[A-Za-z0-9_-]{43}$/);
	expect(key.length).toBe(47);
}

/**
 * Check onboarding status via API
 * @returns {Promise<boolean>} - True if onboarding complete
 */
async function isOnboardingComplete() {
	const response = await fetch('http://localhost:7173/api/status');
	const status = await response.json();
	return status.onboarding?.isComplete === true;
}

/**
 * Wait for loading state to clear
 * @param {Page} page - Playwright page
 */
async function waitForLoadingComplete(page) {
	await page.waitForSelector('button:has-text("Completing Setup...")', {
		state: 'hidden',
		timeout: 10000
	});
}
```

---

## Common Test Patterns

### Basic Complete Flow

```javascript
test('complete onboarding', async ({ page }) => {
	const apiKey = await completeOnboarding(page, {
		workspace: 'My Project',
		theme: 'cyber-blue'
	});

	verifyApiKeyFormat(apiKey);
	expect(page.url()).toContain('/workspace');
});
```

### Skip All Optional Steps

```javascript
test('minimal onboarding', async ({ page }) => {
	await page.goto('http://localhost:7173/onboarding');
	await completeWorkspaceStep(page); // Empty = skip
	await completeThemeStep(page); // Null = skip
	await completeSettingsStep(page);
	await copyApiKeyAndContinue(page);

	expect(page.url()).toContain('/workspace');
});
```

### Test Error Handling

```javascript
test('handles submission error', async ({ page }) => {
	// Mock API to return error
	await page.route('**/onboarding?/submit', (route) => {
		route.fulfill({
			status: 200,
			body: JSON.stringify({
				type: 'failure',
				data: { error: 'Database error' }
			})
		});
	});

	await page.goto('http://localhost:7173/onboarding');
	await completeWorkspaceStep(page);
	await completeThemeStep(page);
	await page.click('button:has-text("Complete Setup")');

	// Verify error displayed
	await expect(page.locator('[role="alert"]')).toContainText('Database error');

	// Verify form still interactive
	await expect(page.locator('button:has-text("Complete Setup")')).toBeEnabled();
});
```

### Verify Database State

```javascript
test('creates database records', async ({ page }) => {
	await completeOnboarding(page, { workspace: 'Test' });

	// Check status API
	const status = await fetch('http://localhost:7173/api/status').then((r) => r.json());
	expect(status.onboarding.isComplete).toBe(true);

	// Verify session cookie
	const cookies = await page.context().cookies();
	const sessionCookie = cookies.find((c) => c.name === 'dispatch_session');
	expect(sessionCookie).toBeTruthy();
	expect(sessionCookie.httpOnly).toBe(true);
});
```

### Test Keyboard Navigation

```javascript
test('keyboard navigation works', async ({ page }) => {
	await page.goto('http://localhost:7173/onboarding');

	// Tab to workspace name field
	await page.keyboard.press('Tab');
	await page.keyboard.type('Keyboard Test');

	// Tab to continue button
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');

	// On theme step, tab to theme card
	await page.keyboard.press('Tab');
	await page.keyboard.press('Space'); // Select theme

	// Continue through flow...
});
```

---

## API Key Verification

### Format

```javascript
// Pattern: dpk_[A-Za-z0-9_-]{43}
const keyRegex = /^dpk_[A-Za-z0-9_-]{43}$/;

// Examples (all valid):
('dpk_abc123XYZ-_0000000000000000000000000000000');
('dpk_ABCDEFGHIJKLMNOPQRSTUVWXYZ-_0123456789xyz');

// Examples (invalid):
('dpk_short'); // Too short
('dpk_has+special/chars='); // Invalid chars (+, /, =)
('notdpk_abc123...'); // Wrong prefix
```

### Database Storage

```javascript
// Plaintext shown ONCE on completion page
// Database stores bcrypt hash (cost factor 12)

// Query to verify (pseudo-code)
const apiKey = db.get('SELECT * FROM api_keys WHERE label = ?', ['First API Key']);
expect(apiKey.key_hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt format
expect(apiKey.key_hash).not.toBe(plaintext); // Never stores plaintext
```

---

## Progress Bar Percentages

```javascript
// Step 1: Workspace
expect(page.locator('text=/33% Complete/')).toBeVisible();

// Step 2: Theme
expect(page.locator('text=/66% Complete/')).toBeVisible();

// Step 3: Settings
expect(page.locator('text=/100% Complete/')).toBeVisible();

// Calculation: (currentStepIndex / totalSteps) * 100
// Steps: ['workspace', 'theme', 'settings', 'complete']
// Workspace = 0/3 = 0% → Display: 33% (index 0 = step 1)
// Theme = 1/3 = 33% → Display: 66% (index 1 = step 2)
// Settings = 2/3 = 66% → Display: 100% (index 2 = step 3)
```

---

## Timing Considerations

### Bcrypt Operations

- API key hashing: ~100-150ms
- Session ID hashing: ~100-150ms
- Total submission: ~300-500ms

### Recommended Timeouts

```javascript
// API key display (after bcrypt)
{
	timeout: 10000;
}

// Navigation after continue
await page.waitForURL('**/workspace', { timeout: 10000 });

// Cookie propagation (known issue C-003)
await page.waitForFunction(() => document.cookie.includes('dispatch_session'), { timeout: 5000 });
```

### Loading States

```javascript
// Button changes during submission
'Complete Setup' → 'Completing Setup...' → (redirect)

// Copy button feedback
'Copy API Key' → '✓ Copied to Clipboard!' → (2 sec) → 'Copy API Key'
```

---

## Known Issues to Handle in Tests

### C-002: Theme API 401 Error

```javascript
// Expected: Theme cards load during onboarding
// Actual: /api/themes returns 401 (requires auth)
// Workaround: Test should expect error state or skip theme step

test('handles theme loading error', async ({ page }) => {
	await page.goto('http://localhost:7173/onboarding');
	await completeWorkspaceStep(page);

	// May see error state instead of themes
	const errorVisible = await page
		.locator('text=/Failed to load themes/')
		.isVisible({ timeout: 2000 })
		.catch(() => false);

	if (errorVisible) {
		await page.click('button:has-text("Continue with Default Theme")');
	} else {
		await completeThemeStep(page);
	}
});
```

### C-005/C-006: API Key Not Displayed

```javascript
// Expected: API key display after submission
// Actual: Event propagation bug prevents display
// Test should document this failure until fixed

test('displays API key after completion', async ({ page }) => {
	await page.goto('http://localhost:7173/onboarding');
	await completeWorkspaceStep(page);
	await completeThemeStep(page);
	await completeSettingsStep(page);

	// This SHOULD work but may fail due to C-005/C-006
	await expect(page.locator('.api-key-text')).toBeVisible({ timeout: 10000 });
});
```

---

## Accessibility Checklist

```javascript
test('accessibility requirements', async ({ page }) => {
	await page.goto('http://localhost:7173/onboarding');

	// Semantic HTML
	await expect(page.locator('[role="main"]')).toBeVisible();
	await expect(page.locator('[aria-label="Setup wizard"]')).toBeVisible();

	// Heading hierarchy
	const h2 = await page.locator('h2').count();
	expect(h2).toBeGreaterThan(0);

	// Form labels
	const nameInput = page.locator('input[placeholder*="Workspace name"]');
	const inputId = await nameInput.getAttribute('id');
	if (inputId) {
		await expect(page.locator(`label[for="${inputId}"]`)).toBeVisible();
	}

	// Keyboard navigation
	await page.keyboard.press('Tab');
	const focused = await page.evaluate(() => document.activeElement.tagName);
	expect(['INPUT', 'BUTTON']).toContain(focused);

	// Error alerts
	// (Test in error scenario)
	await expect(page.locator('[role="alert"]')).toHaveCount(0); // No errors yet
});
```

---

## Test Isolation Pattern

```javascript
test.describe('Onboarding Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage
		await page.goto('http://localhost:7173');
		await page.evaluate(() => localStorage.clear());

		// Clear cookies
		await page.context().clearCookies();

		// Verify clean state
		const status = await fetch('http://localhost:7173/api/status').then((r) => r.json());
		expect(status.onboarding.isComplete).toBe(false);
	});

	test.afterEach(async ({ page }, testInfo) => {
		// Screenshot on failure
		if (testInfo.status !== testInfo.expectedStatus) {
			await page.screenshot({
				path: `test-results/${testInfo.title.replace(/\s+/g, '-')}.png`,
				fullPage: true
			});
		}
	});

	test('scenario 1', async ({ page }) => {
		// Test implementation
	});
});
```

---

## Quick Debug Tips

```javascript
// Enable console logging
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

// Capture network requests
page.on('request', (req) => console.log('→', req.method(), req.url()));
page.on('response', (res) => console.log('←', res.status(), res.url()));

// Pause test execution
await page.pause();

// Wait for debugging
await page.waitForTimeout(999999);

// Dump page HTML
const html = await page.content();
console.log(html);

// Check localStorage
const storage = await page.evaluate(() => JSON.stringify(localStorage));
console.log('LocalStorage:', storage);

// Check cookies
const cookies = await page.context().cookies();
console.log('Cookies:', cookies);
```

---

## Running Tests

```bash
# Run all onboarding tests
npx playwright test e2e/onboarding

# Run specific scenario
npx playwright test e2e/onboarding -g "complete flow"

# Run with UI
npx playwright test e2e/onboarding --ui

# Debug mode
npx playwright test e2e/onboarding --debug

# Headed mode (see browser)
npx playwright test e2e/onboarding --headed

# Generate report
npx playwright show-report
```

---

## Success Checklist

✅ Test server running on port 7173
✅ Fresh database state verified
✅ Helper functions imported
✅ Selectors tested and working
✅ Timeouts appropriate for bcrypt
✅ Error handling implemented
✅ Accessibility checks included
✅ Test isolation configured
✅ Debug utilities ready
✅ Known issues documented

---

**Quick Reference Version**: 1.0
**Created**: 2025-10-09
**See Also**: ONBOARDING_TEST_PLAN.md (full details)
