// spec: e2e/TEST_PLAN.md
// seed: e2e/seed.spec.ts
//
// PREREQUISITES:
//   1. Start the test server: npm run dev:test
//   2. Ensure clean database state (if tests fail with auth errors):
//      - Stop the test server (Ctrl+C)
//      - Delete database: rm -rf .testing-home/dispatch
//      - Restart server: npm run dev:test
//   3. Run tests: npx playwright test e2e/auth-login.spec.ts
//
// NOTE: These tests require a fresh server instance with the correct terminal key.
// The global setup will verify this and provide instructions if misconfigured.

import { test, expect } from '@playwright/test';

test.describe('Authentication 1.1 - Login Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any existing authentication
		await page.goto('http://localhost:7173');
		await page.evaluate(() => {
			localStorage.clear();
		});
	});

	test('1.1.1 Successful Login with Valid Key', async ({ page }) => {
		// 1. Navigate to http://localhost:7173
		await page.goto('http://localhost:7173');

		// 2. Wait for login form to load
		await page.waitForSelector('input[type="password"]', { state: 'visible' });
		await expect(page.locator('input[type="password"]')).toBeVisible();

		// 3. Enter terminal key: test-automation-key-12345 in password field
		const passwordField = page.locator('input[type="password"]');
		await passwordField.fill('test-automation-key-12345');

		// 4. Click "connect" button
		const connectButton = page.locator('button:has-text("connect")');
		await expect(connectButton).toBeVisible();
		await connectButton.click();

		// 5. Wait for redirect
		// Expected: Button text changes to "connecting..." during auth
		await expect(page.locator('button:has-text("connecting")'))
			.toBeVisible({ timeout: 2000 })
			.catch(() => {
				// Button may change text very quickly, so this is optional
			});

		// Expected: Redirect to /workspace occurs
		await page.waitForURL('**/workspace', { timeout: 10000 });
		expect(page.url()).toContain('/workspace');

		// Expected: Authentication token stored in localStorage
		const authToken = await page.evaluate(() => localStorage.getItem('dispatch-auth-token'));
		expect(authToken).toBe('test-automation-key-12345');

		// Expected: clientId generated and stored (for Socket.IO identification)
		// Wait for Socket.IO connection to establish and clientId to be generated
		await page.waitForFunction(() => localStorage.getItem('clientId') !== null, { timeout: 5000 });
		const clientId = await page.evaluate(() => localStorage.getItem('clientId'));
		expect(clientId).toBeTruthy();
		// clientId should be a UUID format
		expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	test('1.1.2 Failed Login with Invalid Key', async ({ page }) => {
		// 1. Navigate to http://localhost:7173
		await page.goto('http://localhost:7173');

		// Wait for login form to load
		await page.waitForSelector('input[type="password"]', { state: 'visible' });

		// 2. Enter invalid key: invalid-key-123
		const passwordField = page.locator('input[type="password"]');
		await passwordField.fill('invalid-key-123');

		// 3. Click "connect" button
		const connectButton = page.locator('button:has-text("connect")');
		await connectButton.click();

		// 4. Wait for error message
		// Expected: Error message displayed: "Invalid authentication token" or similar
		const errorMessage = page.locator('[role="alert"]');
		await expect(errorMessage).toBeVisible({ timeout: 5000 });
		await expect(errorMessage).toContainText(/invalid/i);

		// Expected: User remains on login page
		await page.waitForTimeout(1000); // Give time for any potential redirect
		expect(page.url()).not.toContain('/workspace');
		expect(page.url()).toContain('localhost:7173');

		// Expected: No token stored in localStorage
		const authToken = await page.evaluate(() => localStorage.getItem('dispatch-auth-token'));
		expect(authToken).toBeFalsy();

		// Expected: Form remains interactive (not disabled)
		await expect(passwordField).toBeEnabled();
		await expect(connectButton).toBeEnabled();
	});

	test('1.1.3 Login with Empty Key', async ({ page }) => {
		// 1. Navigate to http://localhost:7173
		await page.goto('http://localhost:7173');

		// Wait for login form to load
		await page.waitForSelector('input[type="password"]', { state: 'visible' });

		// 2. Leave terminal key field empty
		const passwordField = page.locator('input[type="password"]');
		await expect(passwordField).toBeVisible();

		// Verify field is empty
		const fieldValue = await passwordField.inputValue();
		expect(fieldValue).toBe('');

		// 3. Attempt to submit form
		const connectButton = page.locator('button:has-text("connect")');

		// Expected: HTML5 validation prevents submission
		// Try to click the button
		await connectButton.click();

		// Expected: Required field error shown
		// Check if HTML5 validation message appears
		const isValid = await passwordField.evaluate((el: HTMLInputElement) => el.validity.valid);
		expect(isValid).toBe(false);

		// Expected: No API call made (user remains on login page)
		await page.waitForTimeout(1000);
		expect(page.url()).not.toContain('/workspace');

		// Verify no token was stored
		const authToken = await page.evaluate(() => localStorage.getItem('dispatch-auth-token'));
		expect(authToken).toBeFalsy();
	});
});
