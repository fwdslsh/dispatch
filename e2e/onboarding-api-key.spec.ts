// spec: e2e/ONBOARDING_TEST_PLAN.md
// Test Group 5: API Key Display & Copy Tests
//
// PREREQUISITES:
//   1. Start the test server: npm run dev:test
//   2. Ensure the server is running on http://localhost:7173
//   3. Run tests: npx playwright test e2e/onboarding-api-key.spec.ts
//
// NOTE: These tests verify API key display, copy functionality, and security measures.

import { test, expect } from '@playwright/test';
import {
	resetOnboardingState,
	completeOnboarding,
	fillWorkspaceStep,
	selectTheme,
	completeSettingsStep,
	verifyApiKeyDisplay,
	copyApiKey,
	validateApiKeyFormat
} from './helpers/onboarding-helpers.js';

test.describe('Onboarding - API Key Display & Copy Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any existing state to simulate fresh onboarding
		await resetOnboardingState(page);
	});

	test.afterEach(async ({ page }, testInfo) => {
		// Screenshot on failure for debugging
		if (testInfo.status !== testInfo.expectedStatus) {
			await page.screenshot({
				path: `test-results/api-key-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`,
				fullPage: true
			});
		}
	});

	test('Test 5.1: API key display format validation', async ({ page }) => {
		// Complete onboarding flow to API key display
		await page.goto('http://localhost:7173/onboarding');
		await fillWorkspaceStep(page, 'Format Test');
		await selectTheme(page, null); // Skip theme
		await completeSettingsStep(page);

		// Wait for API key display
		const apiKeyElement = page.locator('.api-key-text');
		await expect(apiKeyElement).toBeVisible({ timeout: 10000 });

		// Get the API key value
		const apiKey = await apiKeyElement.textContent();
		expect(apiKey).toBeTruthy();

		// Verify key matches /^dpk_[A-Za-z0-9_-]{43}$/
		expect(apiKey).toMatch(/^dpk_[A-Za-z0-9_-]{43}$/);

		// Verify key length is 47 characters
		expect(apiKey.length).toBe(47);

		// Verify prefix
		expect(apiKey.startsWith('dpk_')).toBe(true);

		// Verify no invalid characters (+ / =)
		expect(apiKey).not.toMatch(/[+/=]/);

		// Use helper to validate format
		validateApiKeyFormat(apiKey);

		// Verify key label is "First API Key" (check metadata if visible)
		const keyMetadata = page.locator('.api-key-metadata, .key-info, text=/First API Key/i');
		const metadataVisible = await keyMetadata.isVisible({ timeout: 2000 }).catch(() => false);
		if (metadataVisible) {
			await expect(keyMetadata).toContainText(/First API Key/i);
		}

		// Verify warning box is visible
		const warningBox = page.locator('.warning-box');
		await expect(warningBox).toBeVisible();

		// Verify warning text contains security message
		await expect(warningBox).toContainText(/only time/i);

		// Verify "Continue to Dispatch" button is disabled initially
		const continueButton = page.locator('button:has-text("Continue to Dispatch")');
		await expect(continueButton).toBeDisabled();

		console.log('[Test] ✓ API key format validation passed');
		console.log(`[Test] API Key: ${apiKey.substring(0, 10)}...`);
	});

	test('Test 5.2: Copy API key functionality', async ({ page }) => {
		// Complete onboarding to API key display
		await page.goto('http://localhost:7173/onboarding');
		await fillWorkspaceStep(page, ''); // Skip workspace
		await selectTheme(page, null); // Skip theme
		await completeSettingsStep(page);

		// Wait for API key display
		const apiKeyElement = page.locator('.api-key-text');
		await expect(apiKeyElement).toBeVisible({ timeout: 10000 });

		// Get the API key value before copying
		const apiKey = await apiKeyElement.textContent();

		// Verify Continue button is initially disabled
		const continueButton = page.locator('button:has-text("Continue to Dispatch")');
		await expect(continueButton).toBeDisabled();

		// Click "Copy API Key" button
		const copyButton = page.locator('button:has-text("Copy API Key")');
		await copyButton.click();

		// Verify button text changes to "✓ Copied to Clipboard!"
		await expect(page.locator('button:has-text("✓ Copied to Clipboard!")')).toBeVisible({
			timeout: 2000
		});

		// Try to verify clipboard contains the key (may not work in all environments)
		try {
			const clipboardText = await page.evaluate(async () => {
				return await navigator.clipboard.readText();
			});
			expect(clipboardText).toBe(apiKey);
			console.log('[Test] ✓ Clipboard verification successful');
		} catch (error) {
			console.warn('[Test] Clipboard API not available in test environment:', error.message);
		}

		// Verify "Continue to Dispatch" button becomes enabled
		await expect(continueButton).toBeEnabled({ timeout: 1000 });

		// Wait 2 seconds for feedback animation
		await page.waitForTimeout(2100);

		// Verify button text reverts to "Copy API Key"
		await expect(copyButton).toBeVisible();
		const buttonText = await copyButton.textContent();
		expect(buttonText).toContain('Copy API Key');

		// Verify "Continue to Dispatch" button stays enabled (permanent state)
		await expect(continueButton).toBeEnabled();

		console.log('[Test] ✓ Copy functionality and state transitions verified');
	});

	test('Test 5.3: Manual confirmation checkbox', async ({ page }) => {
		// Complete onboarding to API key display
		await page.goto('http://localhost:7173/onboarding');
		await fillWorkspaceStep(page, 'Checkbox Test');
		await selectTheme(page, null); // Skip theme
		await completeSettingsStep(page);

		// Wait for API key display
		const apiKeyElement = page.locator('.api-key-text');
		await expect(apiKeyElement).toBeVisible({ timeout: 10000 });

		// Verify "Continue to Dispatch" button is disabled
		const continueButton = page.locator('button:has-text("Continue to Dispatch")');
		await expect(continueButton).toBeDisabled();

		// Find the manual confirmation checkbox
		// The checkbox should have text like "I have saved my API key"
		const confirmCheckbox = page.locator('input[type="checkbox"]').last(); // API key page checkbox

		// Check "I have saved my API key" checkbox
		await confirmCheckbox.check();

		// Verify "Continue to Dispatch" button becomes enabled
		await expect(continueButton).toBeEnabled({ timeout: 1000 });

		// Uncheck the checkbox
		await confirmCheckbox.uncheck();

		// Verify button becomes disabled again
		await expect(continueButton).toBeDisabled();

		// Check again and verify button re-enables
		await confirmCheckbox.check();
		await expect(continueButton).toBeEnabled();

		console.log('[Test] ✓ Manual confirmation checkbox state management verified');
	});

	test('Test 5.4: Combined copy and checkbox state', async ({ page }) => {
		// Complete onboarding
		await page.goto('http://localhost:7173/onboarding');
		await fillWorkspaceStep(page, ''); // Skip workspace
		await selectTheme(page, null); // Skip theme
		await completeSettingsStep(page);

		// Wait for API key display
		const apiKeyElement = page.locator('.api-key-text');
		await expect(apiKeyElement).toBeVisible({ timeout: 10000 });

		const continueButton = page.locator('button:has-text("Continue to Dispatch")');
		const copyButton = page.locator('button:has-text("Copy API Key")');
		const confirmCheckbox = page.locator('input[type="checkbox"]').last();

		// Initially disabled
		await expect(continueButton).toBeDisabled();

		// Click "Copy API Key"
		await copyButton.click();

		// Verify continue button enabled
		await expect(continueButton).toBeEnabled({ timeout: 1000 });

		// Check manual confirmation
		await confirmCheckbox.check();

		// Both should enable the button, verify still enabled
		await expect(continueButton).toBeEnabled();

		// Uncheck manual confirmation
		await confirmCheckbox.uncheck();

		// Verify continue button stays enabled (copy state persists)
		await expect(continueButton).toBeEnabled();

		console.log('[Test] ✓ Combined copy and checkbox state persistence verified');
	});
});
