// spec: e2e/test-plans/settings-page-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';
import { completeOnboarding } from '../helpers/onboarding-helpers.js';
import { resetToFreshInstall } from '../helpers/reset-database.js';

test.describe('Settings Theme Functionality', () => {
	// Reset database before each test to ensure isolation
	test.beforeEach(async () => {
		await resetToFreshInstall();
	});

	test('Test 2.1: View Preset Themes', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// 1. Navigate to Settings page
		await page.goto('http://127.0.0.1:7173/settings');

		// 2. Wait for Theme tab to be active (it's the default)
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Theme' })).toBeVisible();

		// 3. Verify three preset theme cards are displayed
		const darkTheme = page.getByRole('article', { name: 'Dark theme preview' });
		const lightTheme = page.getByRole('article', { name: 'Light theme preview' });
		const phosphorTheme = page.getByRole('article', { name: 'Phosphor Green theme preview' });

		await expect(darkTheme).toBeVisible();
		await expect(lightTheme).toBeVisible();
		await expect(phosphorTheme).toBeVisible();

		// 4. Verify Dark theme card components
		await expect(darkTheme.locator('.title', { hasText: 'Dark' })).toBeVisible();
		await expect(
			darkTheme.locator('.description', {
				hasText: 'Professional dark theme with balanced contrast'
			})
		).toBeVisible();
		await expect(darkTheme.getByRole('img', { name: 'ANSI color palette' })).toBeVisible();
		await expect(darkTheme.getByRole('button', { name: 'Activate Dark theme' })).toBeVisible();

		// 5. Verify Light theme card components
		await expect(lightTheme.locator('.title', { hasText: 'Light' })).toBeVisible();
		await expect(
			lightTheme.locator('.description', {
				hasText: 'Clean light theme with high contrast for daytime coding'
			})
		).toBeVisible();
		await expect(lightTheme.getByRole('img', { name: 'ANSI color palette' })).toBeVisible();
		await expect(lightTheme.getByRole('button', { name: 'Activate Light theme' })).toBeVisible();

		// 6. Verify Phosphor Green theme card components
		await expect(phosphorTheme.locator('.title', { hasText: 'Phosphor Green' })).toBeVisible();
		await expect(
			phosphorTheme.locator('.description', {
				hasText: 'Classic terminal phosphor green - the default Dispatch theme'
			})
		).toBeVisible();
		await expect(phosphorTheme.getByRole('img', { name: 'ANSI color palette' })).toBeVisible();
		// Phosphor Green is the default theme, so it should show as active
		// Button should be either "Active" or "Currently active theme" (disabled)
		const phosphorButton = phosphorTheme.getByRole('button').first();
		await expect(phosphorButton).toBeVisible();
		// Verify it's marked as active (either by text or disabled state)
		const isActive = await phosphorButton.isDisabled();
		if (isActive) {
			await expect(phosphorButton).toHaveAttribute('aria-label', 'Currently active theme');
		}

		// 7. Verify each theme has terminal preview with command
		await expect(darkTheme.getByText('dispatch --theme Dark', { exact: false })).toBeVisible();
		await expect(lightTheme.getByText('dispatch --theme Light', { exact: false })).toBeVisible();
		await expect(
			phosphorTheme.getByText('dispatch --theme Phosphor Green', { exact: false })
		).toBeVisible();
	});

	test('Test 2.2: Activate Different Theme', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// 1. Navigate to Settings > Theme tab
		await page.goto('http://127.0.0.1:7173/settings');
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');

		// 2. Find the Dark theme card
		const darkTheme = page.getByRole('article', { name: 'Dark theme preview' });
		const darkActivateButton = darkTheme.getByRole('button', { name: 'Activate Dark theme' });

		// 3. Set up API request listener to verify the activation request succeeds
		const apiPromise = page.waitForResponse(
			(response) =>
				response.url().includes('/api/settings/themes') && response.request().method() === 'PUT'
		);

		// 4. Click "Activate" button on Dark theme card
		await darkActivateButton.click();

		// 5. Verify API request was successful
		const apiResponse = await apiPromise;
		expect(apiResponse.status()).toBe(200);

		// 6. Page reloads automatically after successful activation
		// Wait for the reload to complete
		await page.waitForURL('**/settings*', { timeout: 10000 });
		await page.waitForLoadState('networkidle');

		// 7. Verify Dark theme now shows as active (page already reloaded)
		const reloadedDarkTheme = page.getByRole('article', { name: 'Dark theme preview' });
		await expect(reloadedDarkTheme.getByRole('status')).toHaveText('Active');
		await expect(
			reloadedDarkTheme.getByRole('button', { name: 'Currently active theme' })
		).toBeDisabled();
	});

	test('Test 2.3: Verify Theme Persistence', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// 1. Navigate to Settings > Theme tab
		await page.goto('http://127.0.0.1:7173/settings');
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');

		// 2. Set up API request listener
		const apiPromise = page.waitForResponse(
			(response) =>
				response.url().includes('/api/settings/themes') && response.request().method() === 'PUT'
		);

		// 3. Activate Light theme
		const lightTheme = page.getByRole('article', { name: 'Light theme preview' });
		const lightActivateButton = lightTheme.getByRole('button', { name: 'Activate Light theme' });
		await lightActivateButton.click();

		// 4. Verify API request was successful
		const apiResponse = await apiPromise;
		expect(apiResponse.status()).toBe(200);

		// 5. Wait for automatic page reload after activation
		await page.waitForLoadState('load');

		// 6. Navigate back to Settings > Theme (after reload)
		await page.goto('http://127.0.0.1:7173/settings');
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');

		// 7. Verify Light theme persists as active after reload
		const reloadedLightTheme = page.getByRole('article', { name: 'Light theme preview' });
		await expect(reloadedLightTheme.getByRole('status')).toHaveText('Active');
		await expect(
			reloadedLightTheme.getByRole('button', { name: 'Currently active theme' })
		).toBeDisabled();
	});

	test('Test 2.4: Switch Between All Themes', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// 1. Navigate to Settings > Theme tab
		await page.goto('http://127.0.0.1:7173/settings');
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');

		// 2. Activate Dark theme
		let apiPromise = page.waitForResponse(
			(response) =>
				response.url().includes('/api/settings/themes') && response.request().method() === 'PUT'
		);
		const darkTheme = page.getByRole('article', { name: 'Dark theme preview' });
		await darkTheme.getByRole('button', { name: 'Activate Dark theme' }).click();
		let apiResponse = await apiPromise;
		expect(apiResponse.status()).toBe(200);
		// Wait for automatic reload to complete
		await page.waitForURL('**/settings*', { timeout: 10000 });
		await page.waitForLoadState('networkidle');

		// 3. Activate Light theme (page already reloaded from previous activation)
		apiPromise = page.waitForResponse(
			(response) =>
				response.url().includes('/api/settings/themes') && response.request().method() === 'PUT'
		);
		const lightTheme = page.getByRole('article', { name: 'Light theme preview' });
		await lightTheme.getByRole('button', { name: 'Activate Light theme' }).click();
		apiResponse = await apiPromise;
		expect(apiResponse.status()).toBe(200);
		await page.waitForURL('**/settings*', { timeout: 10000 });
		await page.waitForLoadState('networkidle');

		// 4. Activate Phosphor Green theme (page already reloaded from previous activation)
		apiPromise = page.waitForResponse(
			(response) =>
				response.url().includes('/api/settings/themes') && response.request().method() === 'PUT'
		);
		const phosphorTheme = page.getByRole('article', { name: 'Phosphor Green theme preview' });
		await phosphorTheme.getByRole('button', { name: 'Activate Phosphor Green theme' }).click();
		apiResponse = await apiPromise;
		expect(apiResponse.status()).toBe(200);
		await page.waitForURL('**/settings*', { timeout: 10000 });
		await page.waitForLoadState('networkidle');

		// 5. Verify only Phosphor Green shows as active (last activated theme)
		// Page has already reloaded from the last activation
		const finalPhosphorTheme = page.getByRole('article', { name: 'Phosphor Green theme preview' });
		await expect(finalPhosphorTheme.getByRole('status')).toHaveText('Active');

		// Other themes should NOT show active status
		const finalDarkTheme = page.getByRole('article', { name: 'Dark theme preview' });
		const finalLightTheme = page.getByRole('article', { name: 'Light theme preview' });
		await expect(finalDarkTheme.getByRole('status')).not.toBeVisible();
		await expect(finalLightTheme.getByRole('status')).not.toBeVisible();
	});

	test('Test 2.5: Theme Card Components Verification', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Theme tab
		await page.goto('http://127.0.0.1:7173/settings');
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');

		// Verify Dark theme has all 16 ANSI colors (8 normal + 8 bright)
		const darkTheme = page.getByRole('article', { name: 'Dark theme preview' });
		const darkPalette = darkTheme.getByRole('img', { name: 'ANSI color palette' });

		// Verify normal colors (0-7) - use .first() to avoid strict mode violation
		for (let i = 0; i < 8; i++) {
			await expect(darkPalette.getByLabel(`Color ${i}`, { exact: true }).first()).toBeVisible();
		}

		// Verify bright colors (0-7) - use exact match to distinguish from normal colors
		for (let i = 0; i < 8; i++) {
			await expect(darkPalette.getByLabel(`Bright color ${i}`, { exact: true })).toBeVisible();
		}

		// Verify terminal preview elements
		await expect(darkTheme.getByText('$', { exact: true })).toBeVisible(); // Prompt
		await expect(darkTheme.getByText('dispatch', { exact: true })).toBeVisible(); // Command
		await expect(darkTheme.getByText('--theme', { exact: true })).toBeVisible(); // Argument
		await expect(darkTheme.getByText('# Terminal theme preview')).toBeVisible(); // Comment
	});

	test('Test 2.6: Custom Themes Section Visibility', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Theme tab
		await page.goto('http://127.0.0.1:7173/settings');
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');

		// 1. Verify Custom Themes section exists
		await expect(page.getByRole('heading', { name: 'Custom Themes', level: 4 })).toBeVisible();

		// 2. Verify upload area is visible
		const uploadArea = page.getByRole('region', { name: 'Theme upload area' });
		await expect(uploadArea).toBeVisible();

		// 3. Verify upload instructions
		await expect(page.getByText('Drag and drop a theme file here, or browse files')).toBeVisible();
		await expect(page.getByText('Supported format: JSON (max 5MB)')).toBeVisible();

		// 4. Verify empty state for custom themes
		await expect(page.getByText('No custom themes uploaded yet')).toBeVisible();
	});
});
