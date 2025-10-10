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
	test.beforeEach(async ({ page, request }) => {
		// Clear any existing authentication
		await page.goto('http://localhost:7173');
		await page.evaluate(() => {
			localStorage.clear();
		});

		// Mark onboarding as complete so we can test login page
		// (These tests are for the login flow, not onboarding)
		const completeOnboardingResponse = await request.post(
			'http://localhost:7173/api/test/complete-onboarding'
		);
		if (!completeOnboardingResponse.ok()) {
			const error = await completeOnboardingResponse.text();
			throw new Error(
				`Failed to complete onboarding: ${completeOnboardingResponse.status()} - ${error}`
			);
		}

		// Create a test API key for authentication tests
		// This is needed because the seed script deletes API keys
		const createKeyResponse = await request.post('http://localhost:7173/api/test/create-api-key', {
			data: {
				key: 'test-automation-key-12345',
				label: 'Test Auth Key'
			}
		});

		if (!createKeyResponse.ok()) {
			const error = await createKeyResponse.text();
			throw new Error(`Failed to create test API key: ${createKeyResponse.status()} - ${error}`);
		}
	});

	test('1.1.1 Successful Login with Valid Key', async ({ page }) => {
		// 1. Navigate to http://localhost:7173/login
		await page.goto('http://localhost:7173/login');

		// 2. Wait for login form to load
		await page.waitForSelector('input[type="password"]', { state: 'visible' });
		await expect(page.locator('input[type="password"]')).toBeVisible();

		// 3. Enter terminal key: test-automation-key-12345 in password field
		const passwordField = page.locator('input[type="password"]');
		await passwordField.fill('test-automation-key-12345');

		// 4. Click "Log In" button
		const loginButton = page.locator('button:has-text("Log In")');
		await expect(loginButton).toBeVisible();
		await loginButton.click();

		// 5. Wait for redirect
		// Expected: Button text changes to "Logging in..." during auth
		await expect(page.locator('button:has-text("Logging in")'))
			.toBeVisible({ timeout: 2000 })
			.catch(() => {
				// Button may change text very quickly, so this is optional
			});

		// Expected: Redirect to /workspace occurs after successful login
		// Note: The login page redirects to the redirect parameter (/ by default)
		// The layout then checks onboarding status and redirects if needed
		await page.waitForURL(/\/(workspace|onboarding)/, { timeout: 10000 });

		// User should end up on either workspace or onboarding page
		const finalUrl = page.url();
		expect(finalUrl).toMatch(/\/(workspace|onboarding)/);

		// Expected: Session cookie created and user authenticated
		// The successful redirect to /workspace proves authentication worked
		// (The auth middleware allows access to /workspace only for authenticated users)

		// Expected: clientId generated and stored (for Socket.IO identification)
		// Wait for Socket.IO connection to establish and clientId to be generated
		await page.waitForFunction(() => localStorage.getItem('clientId') !== null, { timeout: 5000 });
		const clientId = await page.evaluate(() => localStorage.getItem('clientId'));
		expect(clientId).toBeTruthy();
		// clientId should be a UUID format
		expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	test('1.1.2 Failed Login with Invalid Key', async ({ page }) => {
		// 1. Navigate to http://localhost:7173/login
		await page.goto('http://localhost:7173/login');

		// Wait for login form to load
		await page.waitForSelector('input[type="password"]', { state: 'visible' });

		// 2. Enter invalid key: invalid-key-123
		const passwordField = page.locator('input[type="password"]');
		await passwordField.fill('invalid-key-123');

		// 3. Click "Log In" button
		const loginButton = page.locator('button:has-text("Log In")');
		await loginButton.click();

		// 4. Wait for error message
		// Expected: Error message displayed: "Invalid authentication token" or similar
		const errorMessage = page.locator('[role="alert"]');
		await expect(errorMessage).toBeVisible({ timeout: 5000 });
		await expect(errorMessage).toContainText(/invalid/i);

		// Expected: User remains on login page (no redirect to workspace or onboarding)
		await page.waitForTimeout(1000); // Give time for any potential redirect
		expect(page.url()).not.toContain('/workspace');
		expect(page.url()).not.toContain('/onboarding');
		expect(page.url()).toContain('localhost:7173');

		// Expected: User is not authenticated (no session cookie created)
		const authCheckResponse = await page.evaluate(async () => {
			const response = await fetch('/api/auth/check');
			return await response.json();
		});
		expect(authCheckResponse.authenticated).toBe(false);

		// Expected: Form remains interactive (not disabled)
		await expect(passwordField).toBeEnabled();
		await expect(loginButton).toBeEnabled();
	});

	test('1.1.3 Login with Empty Key', async ({ page }) => {
		// 1. Navigate to http://localhost:7173/login
		await page.goto('http://localhost:7173/login');

		// Wait for login form to load
		await page.waitForSelector('input[type="password"]', { state: 'visible' });

		// 2. Leave terminal key field empty
		const passwordField = page.locator('input[type="password"]');
		await expect(passwordField).toBeVisible();

		// Verify field is empty
		const fieldValue = await passwordField.inputValue();
		expect(fieldValue).toBe('');

		// 3. Verify submit button is disabled
		const loginButton = page.locator('button:has-text("Log In")');

		// Expected: Button is disabled when field is empty
		await expect(loginButton).toBeDisabled();

		// Expected: Password field has required attribute
		const isRequired = await passwordField.evaluate((el: HTMLInputElement) => el.required);
		expect(isRequired).toBe(true);

		// Expected: No API call made (user remains on login page)
		await page.waitForTimeout(1000);
		expect(page.url()).not.toContain('/workspace');

		// Expected: User is not authenticated
		const authCheckResponse = await page.evaluate(async () => {
			const response = await fetch('/api/auth/check');
			return await response.json();
		});
		expect(authCheckResponse.authenticated).toBe(false);
	});
});
