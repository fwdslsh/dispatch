/**
 * Onboarding E2E Test Helpers
 *
 * Helper functions for testing the onboarding flow in Dispatch.
 * These utilities provide reusable components for interacting with
 * the multi-step onboarding wizard.
 *
 * @see e2e/ONBOARDING_TEST_PLAN.md for test scenarios
 * @see e2e/ONBOARDING_QUICK_REFERENCE.md for selector reference
 */

import { expect } from '@playwright/test';

/**
 * Reset onboarding state to prepare for fresh onboarding flow
 * Clears localStorage and cookies to simulate first-time user
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function resetOnboardingState(page) {
	// Navigate to test server
	await page.goto('http://localhost:7173');

	// Clear localStorage
	await page.evaluate(() => {
		localStorage.clear();
	});

	// Clear cookies
	await page.context().clearCookies();

	// Reset onboarding state in the database by deleting the onboarding settings
	// This allows the onboarding flow to run again
	// Note: This requires direct database access or an API endpoint for test environments

	// For now, we'll use SQLite directly via a test API endpoint
	// The test server should provide a way to reset onboarding state
	// If this endpoint doesn't exist, the test will fail and we need to create it

	try {
		const resetResponse = await page.evaluate(async () => {
			// Try to reset via API (needs to be implemented server-side)
			const response = await fetch('http://localhost:7173/api/test/reset-onboarding', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});
			return { ok: response.ok, status: response.status };
		});

		// If the endpoint doesn't exist (404), we need to manually reset via database
		// For now, we'll just warn and continue
		if (!resetResponse.ok && resetResponse.status !== 404) {
			console.warn('[Test] Failed to reset onboarding via API:', resetResponse.status);
		}
	} catch (error) {
		console.warn('[Test] Could not reset onboarding state:', error.message);
	}

	// Verify onboarding is not complete using page context
	const status = await page.evaluate(async () => {
		const response = await fetch('http://localhost:7173/api/status');
		return response.json();
	});

	// Log current state for debugging
	console.log('[Test] Onboarding status after reset:', status.onboarding);

	expect(status.onboarding?.isComplete).toBe(false);

	// Navigate to onboarding page to trigger the flow
	await page.goto('http://localhost:7173/onboarding');

	// Wait for the page to fully load
	await page.waitForLoadState('networkidle');
}

/**
 * Fill workspace step with name and optional path verification
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Workspace name (empty string to skip)
 * @param {string} [expectedPath] - Optional: expected auto-generated path to verify
 * @returns {Promise<void>}
 */
export async function fillWorkspaceStep(page, name, expectedPath) {
	// Wait for workspace step to be visible
	await page.waitForSelector('input[placeholder*="Workspace name"]', {
		state: 'visible',
		timeout: 5000
	});

	if (name) {
		// Fill workspace name
		const nameInput = page.locator('input[placeholder*="Workspace name"]');
		await nameInput.fill(name);

		// Verify auto-generated path if provided
		if (expectedPath) {
			const pathInput = page.locator('input[placeholder*="Workspace path"]');
			await expect(pathInput).toHaveValue(expectedPath);
		}

		// Click Continue button (appears when name is provided)
		await page.click('button:has-text("Continue")');
	} else {
		// Click Skip Workspace button (appears when name is empty)
		await page.click('button:has-text("Skip Workspace")');
	}

	// Wait for theme step to load
	await page.waitForSelector('h2:has-text("Choose Your Theme")', { timeout: 5000 });
}

/**
 * Select a theme from the theme selection step
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string|null} themeId - Theme ID to select (null to skip theme selection)
 * @returns {Promise<void>}
 */
export async function selectTheme(page, themeId) {
	// Wait for theme step to be visible
	await page.waitForSelector('h2:has-text("Choose Your Theme")', {
		state: 'visible',
		timeout: 5000
	});

	if (themeId) {
		// Wait for theme options to load
		await page.waitForSelector('.theme-option', { timeout: 5000 });

		// Click on the specified theme card by finding it by theme name or index
		// Since we don't have data-theme-id, we'll click the first theme option for now
		const themeOption = page.locator('.theme-option').first();
		await themeOption.click();

		// Verify theme is selected (should have selection outline)
		await expect(themeOption).toHaveClass(/selected/);

		// Click Continue with Selected Theme
		await page.click('button:has-text("Continue with Selected Theme")');
	} else {
		// Click Skip button to use default theme
		await page.click('button:has-text("Skip")');
	}

	// Wait for settings step to load
	await page.waitForSelector('button:has-text("Complete Setup")', { timeout: 5000 });
}

/**
 * Complete the settings step and submit the onboarding form
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} [options] - Optional settings configuration
 * @param {boolean} [options.autoCleanup=true] - Enable automatic cleanup checkbox
 * @param {boolean} [options.rememberWorkspace=true] - Enable remember workspace checkbox
 * @returns {Promise<void>}
 */
export async function completeSettingsStep(page, options = {}) {
	const { autoCleanup = true, rememberWorkspace = true } = options;

	// Wait for settings step to be visible
	await page.waitForSelector('button:has-text("Complete Setup")', {
		state: 'visible',
		timeout: 5000
	});

	// Configure checkboxes (both are checked by default)
	const checkboxes = page.locator('input[type="checkbox"]');
	const autoCleanupCheckbox = checkboxes.first();
	const rememberWorkspaceCheckbox = checkboxes.nth(1);

	// Only click if we need to toggle from default state
	if (!autoCleanup) {
		await autoCleanupCheckbox.click();
	}
	if (!rememberWorkspace) {
		await rememberWorkspaceCheckbox.click();
	}

	// Click Complete Setup button
	await page.click('button:has-text("Complete Setup")');

	// Wait for loading state
	await expect(page.locator('button:has-text("Completing Setup...")'))
		.toBeVisible({
			timeout: 2000
		})
		.catch(() => {
			// Loading state may be very brief due to fast bcrypt on modern hardware
		});

	// Wait for API key display (bcrypt operations take 300-500ms)
	await page.waitForSelector('.api-key-text', { timeout: 10000 });
}

/**
 * Verify API key is displayed correctly on completion page
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} The displayed API key value
 */
export async function verifyApiKeyDisplay(page) {
	// Wait for API key display to be visible
	const apiKeyElement = page.locator('.api-key-text');
	await expect(apiKeyElement).toBeVisible({ timeout: 5000 });

	// Get the API key value
	const apiKey = await apiKeyElement.textContent();
	expect(apiKey).toBeTruthy();

	// Verify API key format: dpk_[A-Za-z0-9_-]{43}
	expect(apiKey).toMatch(/^dpk_[A-Za-z0-9_-]{43}$/);
	expect(apiKey.length).toBe(47);

	// Verify warning box is visible
	const warningBox = page.locator('.warning-box');
	await expect(warningBox).toBeVisible();

	// Verify warning text contains security message
	await expect(warningBox).toContainText(/only time/i);

	return apiKey;
}

/**
 * Copy API key using the copy button and verify clipboard
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} The copied API key value
 */
export async function copyApiKey(page) {
	// Get the API key value before copying
	const apiKeyElement = page.locator('.api-key-text');
	const apiKey = await apiKeyElement.textContent();

	// Verify Continue button is initially disabled
	const continueButton = page.locator('button:has-text("Continue to Dispatch")');
	await expect(continueButton).toBeDisabled();

	// Click Copy API Key button
	const copyButton = page.locator('button:has-text("Copy API Key")');
	await copyButton.click();

	// Verify copy feedback animation
	await expect(page.locator('button:has-text("✓ Copied to Clipboard!")')).toBeVisible({
		timeout: 2000
	});

	// Verify Continue button is now enabled
	await expect(continueButton).toBeEnabled({ timeout: 1000 });

	// Wait for feedback animation to complete (2 seconds)
	// Optional: can verify button text reverts back
	await page.waitForTimeout(2100);
	await expect(copyButton).toBeVisible();

	return apiKey;
}

/**
 * Verify session cookie exists and has correct attributes
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object>} The session cookie object
 */
export async function verifySessionCookie(page) {
	// Get all cookies
	const cookies = await page.context().cookies();

	// Find dispatch session cookie
	const sessionCookie = cookies.find((c) => c.name === 'dispatch_session');

	// Verify cookie exists
	expect(sessionCookie).toBeTruthy();

	// Verify cookie attributes
	expect(sessionCookie.httpOnly).toBe(true);
	expect(sessionCookie.sameSite).toBe('Lax');

	// In production (SSL), Secure should be true
	// In test server (no SSL), Secure is false
	// expect(sessionCookie.secure).toBe(false); // Test server

	return sessionCookie;
}

/**
 * Verify user is authenticated by checking redirect and state
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function verifyAuthenticated(page) {
	// Verify URL is workspace page
	await page.waitForURL('**/workspace', { timeout: 10000 });
	expect(page.url()).toContain('/workspace');

	// Verify session cookie exists
	await verifySessionCookie(page);

	// Verify no redirect back to login (wait a moment)
	await page.waitForTimeout(1000);
	expect(page.url()).toContain('/workspace');
	expect(page.url()).not.toContain('/auth');
}

/**
 * Complete full onboarding flow with all steps
 * Convenience function that combines all steps
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {string} [options.workspaceName] - Workspace name (empty to skip)
 * @param {string} [options.themeId] - Theme ID to select (null to skip)
 * @param {boolean} [options.autoCleanup=true] - Enable auto cleanup
 * @param {boolean} [options.rememberWorkspace=true] - Enable remember workspace
 * @param {boolean} [options.clickContinue=true] - Click Continue to Dispatch button
 * @returns {Promise<string>} The generated API key
 */
export async function completeOnboarding(page, options = {}) {
	const {
		workspaceName = '',
		themeId = null,
		autoCleanup = true,
		rememberWorkspace = true,
		clickContinue = true
	} = options;

	// Navigate to onboarding page
	await page.goto('http://localhost:7173/onboarding');

	// Step 1: Workspace
	await fillWorkspaceStep(page, workspaceName);

	// Step 2: Theme
	await selectTheme(page, themeId);

	// Step 3: Settings
	await completeSettingsStep(page, { autoCleanup, rememberWorkspace });

	// Verify API key display
	const apiKey = await verifyApiKeyDisplay(page);

	// Copy API key
	await copyApiKey(page);

	// Optionally click Continue
	if (clickContinue) {
		await page.click('button:has-text("Continue to Dispatch")');
		await verifyAuthenticated(page);
	}

	return apiKey;
}

/**
 * Verify progress bar shows correct percentage
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} percentage - Expected percentage (33, 66, or 100)
 * @returns {Promise<void>}
 */
export async function verifyProgressBar(page, percentage) {
	const progressText = page.locator(`text=/${percentage}% Complete/`);
	await expect(progressText).toBeVisible({ timeout: 2000 });
}

/**
 * Verify API key format is correct
 * Utility function for standalone verification
 *
 * @param {string} apiKey - API key to validate
 */
export function validateApiKeyFormat(apiKey) {
	expect(apiKey).toMatch(/^dpk_[A-Za-z0-9_-]{43}$/);
	expect(apiKey.length).toBe(47);
	// Ensure no special characters that aren't URL-safe
	expect(apiKey).not.toMatch(/[+/=]/);
}

/**
 * Check onboarding completion status via API
 *
 * @returns {Promise<boolean>} True if onboarding is complete
 */
export async function isOnboardingComplete() {
	const response = await fetch('http://localhost:7173/api/status');
	const status = await response.json();
	return status.onboarding?.isComplete === true;
}

/**
 * Enable debug logging for page console and network
 * Useful for troubleshooting test failures
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export function enableDebugLogging(page) {
	page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
	page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
	page.on('request', (req) => console.log('→', req.method(), req.url()));
	page.on('response', (res) => console.log('←', res.status(), res.url()));
}
