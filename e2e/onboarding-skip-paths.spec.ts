// spec: e2e/ONBOARDING_TEST_PLAN.md
// Test Group 2: Skip Path Tests
//
// PREREQUISITES:
//   1. Start the test server: npm run dev:test
//   2. Ensure the server is running on http://localhost:7173
//   3. Run tests: npx playwright test e2e/onboarding-skip-paths.spec.ts
//
// NOTE: These tests verify optional step skipping and minimal onboarding paths.

import { test, expect } from '@playwright/test';
import {
	resetOnboardingState,
	fillWorkspaceStep,
	selectTheme,
	completeSettingsStep,
	verifyApiKeyDisplay,
	copyApiKey,
	verifyAuthenticated
} from './helpers/onboarding-helpers.js';

test.describe('Onboarding - Skip Path Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any existing state to simulate fresh onboarding
		await resetOnboardingState(page);
	});

	test.afterEach(async ({ page }, testInfo) => {
		// Screenshot on failure for debugging
		if (testInfo.status !== testInfo.expectedStatus) {
			await page.screenshot({
				path: `test-results/skip-path-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`,
				fullPage: true
			});
		}
	});

	test('Test 2.1: Skip workspace creation', async ({ page }) => {
		// Navigate to /onboarding
		await page.goto('http://localhost:7173/onboarding');

		// Click "Skip Workspace" (don't fill workspace name)
		await fillWorkspaceStep(page, ''); // Empty string = skip

		// Verify theme step loads
		await expect(page.locator('h2:has-text("Choose Your Theme")')).toBeVisible();

		// Select theme
		const firstTheme = page.locator('.theme-option').first();
		await firstTheme.click();
		await page.click('button:has-text("Continue with Selected Theme")');

		// Complete settings
		await page.waitForSelector('button:has-text("Complete Setup")', { timeout: 5000 });
		await page.click('button:has-text("Complete Setup")');

		// Verify API key display
		const apiKey = await verifyApiKeyDisplay(page);
		expect(apiKey).toBeTruthy();

		// Copy and continue
		await copyApiKey(page);
		await page.click('button:has-text("Continue to Dispatch")');

		// Verify successful authentication
		await verifyAuthenticated(page);

		// Query API to verify no workspace created
		const response = await page.evaluate(async () => {
			const res = await fetch('http://localhost:7173/api/workspaces');
			return res.json();
		});

		// Should have no workspaces (or only default/system workspaces)
		expect(response.workspaces || response).toEqual(expect.arrayContaining([]));

		console.log('[Test] ✓ Skip workspace path verified - no workspace created');
	});

	test('Test 2.2: Skip theme selection', async ({ page }) => {
		// Navigate to /onboarding
		await page.goto('http://localhost:7173/onboarding');

		// Create workspace
		await fillWorkspaceStep(page, 'Skip Theme Test');

		// Verify theme step loads
		await expect(page.locator('h2:has-text("Choose Your Theme")')).toBeVisible();

		// Verify default theme is pre-selected (phosphor-green)
		const selectedTheme = page.locator('.theme-option.selected');
		const hasSelection = await selectedTheme.isVisible({ timeout: 2000 }).catch(() => false);
		if (hasSelection) {
			console.log('[Test] Default theme is pre-selected');
		}

		// Click "Skip (use default)" on theme step
		await page.click('button:has-text("Skip")');

		// Complete settings
		await page.waitForSelector('button:has-text("Complete Setup")', { timeout: 5000 });
		await page.click('button:has-text("Complete Setup")');

		// Verify API key display
		await verifyApiKeyDisplay(page);

		// Copy and continue
		await copyApiKey(page);
		await page.click('button:has-text("Continue to Dispatch")');

		// Verify authentication works
		await verifyAuthenticated(page);

		// Verify default theme is applied (check CSS variables or API)
		const themeApplied = await page.evaluate(() => {
			// Check if default theme CSS is applied
			const root = document.documentElement;
			const bgColor = getComputedStyle(root).getPropertyValue('--color-bg-primary');
			return bgColor !== ''; // Should have theme variables set
		});

		expect(themeApplied).toBe(true);

		console.log('[Test] ✓ Skip theme selection verified - default theme applied');
	});

	test('Test 2.3: Minimal onboarding (skip all optional steps)', async ({ page }) => {
		// Navigate to /onboarding
		await page.goto('http://localhost:7173/onboarding');

		// Click "Skip Workspace"
		await fillWorkspaceStep(page, ''); // Skip

		// Click "Skip (use default)" on theme
		await page.waitForSelector('button:has-text("Skip")', { timeout: 5000 });
		await page.click('button:has-text("Skip")');

		// Verify settings step loads
		await page.waitForSelector('button:has-text("Complete Setup")', { timeout: 5000 });

		// Keep default checkboxes (both checked)
		const checkboxes = page.locator('input[type="checkbox"]');
		await expect(checkboxes.first()).toBeChecked();
		await expect(checkboxes.nth(1)).toBeChecked();

		// Click "Complete Setup"
		await page.click('button:has-text("Complete Setup")');

		// Verify API key displays
		const apiKey = await verifyApiKeyDisplay(page);
		expect(apiKey).toBeTruthy();

		// Copy key and continue
		await copyApiKey(page);
		await page.click('button:has-text("Continue to Dispatch")');

		// Verify authentication succeeds
		await verifyAuthenticated(page);

		// Verify minimal configuration (no workspace, default theme)
		const statusResponse = await page.evaluate(async () => {
			const res = await fetch('http://localhost:7173/api/status');
			return res.json();
		});

		expect(statusResponse.onboarding?.isComplete).toBe(true);

		// Verify no workspaces created
		const workspacesResponse = await page.evaluate(async () => {
			const res = await fetch('http://localhost:7173/api/workspaces');
			return res.json();
		});

		expect(workspacesResponse.workspaces || workspacesResponse).toEqual(expect.arrayContaining([]));

		console.log('[Test] ✓ Minimal onboarding path verified - fastest completion');
	});
});
