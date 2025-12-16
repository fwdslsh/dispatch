/**
 * Onboarding & Login Regression Tests
 *
 * These tests ensure critical onboarding and login issues don't regress.
 * Each test corresponds to a specific issue found during manual testing.
 */

import { test, expect } from '@playwright/test';
import { resetToFreshInstall, resetToOnboarded } from './helpers/index.js';

const BASE_URL = 'http://localhost:7173';

test.describe('Regression Tests - Onboarding Flow', () => {
	/**
	 * Issue #1: Login page must be accessible during onboarding
	 *
	 * Problem: Login page was redirecting to onboarding, preventing users
	 * from entering API keys during the onboarding process.
	 *
	 * Fix: Exempted /login from onboarding redirects in both server-side
	 * middleware and client-side redirect logic.
	 */
	test('Issue #1: Login page should be accessible when onboarding is incomplete', async ({
		page
	}) => {
		// Reset to fresh install (onboarding not complete)
		await resetToFreshInstall();

		// Navigate to login page
		await page.goto(`${BASE_URL}/login`);

		// Should stay on login page (not redirect to onboarding)
		await expect(page).toHaveURL(/\/login$/);

		// Login form should be visible
		const keyInput = page.locator('input[name="key"]');
		await expect(keyInput).toBeVisible();

		// Page title should indicate this is the login page
		await expect(page).toHaveTitle(/Login/i);
	});

	/**
	 * Issue #2: Protected routes should redirect to onboarding when incomplete
	 *
	 * Problem: Need to ensure users complete onboarding before accessing
	 * protected routes like workspace.
	 *
	 * Fix: Maintained redirect for non-exempt routes, only exempting
	 * /login, /settings, and /api-docs.
	 */
	test('Issue #2: Root path should redirect to onboarding when incomplete', async ({ page }) => {
		// Reset to fresh install (onboarding not complete)
		await resetToFreshInstall();

		// Navigate to root path
		await page.goto(`${BASE_URL}/`);

		// Should redirect to onboarding
		await page.waitForURL(/\/onboarding/);
		await expect(page).toHaveURL(/\/onboarding/);
	});

	test('Issue #2: Workspace route should redirect to onboarding when incomplete', async ({
		page
	}) => {
		await resetToFreshInstall();

		// Try to access workspace without completing onboarding
		await page.goto(`${BASE_URL}/workspace`);

		// Should redirect to login (which may redirect to onboarding)
		await page.waitForURL(/\/(login|onboarding)/);
		const currentUrl = page.url();
		expect(currentUrl).toMatch(/\/(login|onboarding)/);
	});

	/**
	 * Issue #4: Test automation key must work for E2E tests
	 *
	 * Problem: Need predictable authentication for automated testing.
	 *
	 * Fix: Use consistent test-automation-key-12345 in database seeding
	 * via resetToOnboarded() helper.
	 */
	test('Issue #4: Test automation key should authenticate successfully', async ({ page }) => {
		// Reset with test automation key
		const { apiKey } = await resetToOnboarded();

		// Verify we got the expected test key
		expect(apiKey.key).toBe('test-automation-key-12345');

		// Navigate to login
		await page.goto(`${BASE_URL}/login`);

		// Login with test key
		await page.fill('input[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');

		// Should successfully authenticate and redirect to workspace
		await page.waitForURL(`${BASE_URL}/workspace`);
		await expect(page).toHaveURL(/\/workspace$/);
	});
});

test.describe('Regression Tests - Login Error Handling', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	/**
	 * Issue #3: Login error messages should clear when user types
	 *
	 * Problem: After entering an invalid API key and seeing an error,
	 * the error message persisted even after the user started typing
	 * to correct their mistake.
	 *
	 * Fix: Added reactive $effect in login page that tracks when the
	 * apiKey changes from its initial value when the error was shown,
	 * immediately clearing the showError state.
	 */
	test('Issue #3: Error message should clear when user starts typing', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		// Submit invalid API key
		await page.fill('input[name="key"]', 'invalid-key-12345');
		await page.click('button[type="submit"]');

		// Wait for error to appear
		const errorMessage = page.locator('[role="alert"], .error-message');
		await expect(errorMessage).toBeVisible({ timeout: 5000 });

		// Verify error text is shown
		const errorText = await errorMessage.textContent();
		expect(errorText).toMatch(/Invalid.*key|Authentication.*failed/i);

		// Start typing to correct the mistake
		const keyInput = page.locator('input[name="key"]');
		await keyInput.fill('invalid-key-12345x'); // Add one character

		// Error should disappear immediately (no delay)
		await expect(errorMessage).not.toBeVisible({ timeout: 1000 });
	});

	test('Issue #3: Error should reappear on new submission with bad key', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		// First attempt with invalid key
		await page.fill('input[name="key"]', 'bad-key-1');
		await page.click('button[type="submit"]');

		// Error appears
		const errorMessage = page.locator('[role="alert"], .error-message');
		await expect(errorMessage).toBeVisible({ timeout: 5000 });

		// Start typing (error clears)
		await page.fill('input[name="key"]', 'bad-key-2');
		await expect(errorMessage).not.toBeVisible();

		// Submit again with different bad key
		await page.click('button[type="submit"]');

		// Error should appear again for the new submission
		await expect(errorMessage).toBeVisible({ timeout: 5000 });
	});

	test('Issue #3: Error should clear and stay cleared when typing valid key', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		// Submit invalid key
		await page.fill('input[name="key"]', 'wrong-key');
		await page.click('button[type="submit"]');

		// Error appears
		const errorMessage = page.locator('[role="alert"], .error-message');
		await expect(errorMessage).toBeVisible({ timeout: 5000 });

		// Type the correct key
		await page.fill('input[name="key"]', apiKey);

		// Error should clear
		await expect(errorMessage).not.toBeVisible({ timeout: 1000 });

		// Error should stay cleared (no flashing)
		await page.waitForTimeout(500);
		await expect(errorMessage).not.toBeVisible();
	});
});

test.describe('Regression Tests - Onboarding Exemptions', () => {
	test('Settings page should be accessible during onboarding', async ({ page }) => {
		await resetToFreshInstall();

		// Navigate directly to settings
		await page.goto(`${BASE_URL}/settings`);

		// Should stay on settings (not redirect to onboarding)
		// Note: May redirect to login first if not authenticated
		await page.waitForURL(/\/(settings|login)/);

		const currentUrl = page.url();
		// Should be either on settings or login (but not onboarding)
		expect(currentUrl).not.toMatch(/\/onboarding/);
	});

	test('API docs should be accessible during onboarding', async ({ page }) => {
		await resetToFreshInstall();

		// Navigate to API docs
		await page.goto(`${BASE_URL}/api-docs`);

		// Should stay on api-docs (not redirect to onboarding)
		await expect(page).toHaveURL(/\/api-docs/);
	});
});
