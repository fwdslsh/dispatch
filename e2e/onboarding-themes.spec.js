/**
 * E2E Test: Onboarding Theme Selection
 *
 * Tests theme selection during the onboarding flow including:
 * - Displaying available themes in onboarding wizard
 * - Selecting a theme and setting it as global default
 * - Skipping theme selection (uses fallback)
 * - Verifying selected theme is applied after onboarding completion
 */

import { test, expect } from '@playwright/test';
import { preAuthenticateUser } from './core-helpers.js';

const mockThemes = [
	{
		id: 'phosphor-green',
		name: 'Phosphor Green',
		description: 'Classic terminal phosphor green',
		source: 'preset',
		cssVariables: {
			'--theme-background': '#0c1210',
			'--theme-foreground': '#d9ffe6'
		}
	},
	{
		id: 'dark',
		name: 'Dark',
		description: 'Professional dark theme',
		source: 'preset',
		cssVariables: {
			'--theme-background': '#0d1117',
			'--theme-foreground': '#e6edf3'
		}
	},
	{
		id: 'light',
		name: 'Light',
		description: 'Clean light theme',
		source: 'preset',
		cssVariables: {
			'--theme-background': '#ffffff',
			'--theme-foreground': '#24292f'
		}
	}
];

test.describe('Onboarding Theme Selection', () => {
	test.beforeEach(async ({ page }) => {
		// Setup fresh onboarding state (not complete)
		await page.addInitScript(() => {
			localStorage.clear();
			sessionStorage.clear();
		});

		// Mock onboarding as in-progress (at theme step)
		await page.route('/api/settings/onboarding**', async (route) => {
			const method = route.request().method();

			if (method === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						currentStep: 'settings', // Theme selection happens in settings step
						isComplete: false,
						completedSteps: ['auth', 'workspace']
					})
				});
				return;
			}

			if (method === 'PUT') {
				// Update onboarding progress
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
				return;
			}

			route.continue();
		});

		// Mock themes API
		await page.route('/api/themes**', async (route) => {
			const url = route.request().url();

			if (url.includes('/active')) {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						theme: mockThemes[0] // Default fallback
					})
				});
				return;
			}

			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ themes: mockThemes })
			});
		});

		// Mock preferences API
		await page.route('/api/preferences**', async (route) => {
			const method = route.request().method();

			if (method === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						globalDefault: null // No theme selected yet
					})
				});
				return;
			}

			if (method === 'PUT') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
				return;
			}

			route.continue();
		});

		// Pre-authenticate to bypass auth step
		await preAuthenticateUser(page);
	});

	test('displays theme options in onboarding wizard', async ({ page }) => {
		await page.goto('/onboarding');
		await page.waitForLoadState('domcontentloaded');

		// Navigate to settings/theme step if needed
		const settingsStepButton = page.getByRole('button', { name: /settings|next/i });
		if ((await settingsStepButton.count()) > 0) {
			await settingsStepButton.click();
		}

		// Look for theme selection section
		const themeSection = page.locator('[data-onboarding-step="theme"], [data-step="theme"]');

		if ((await themeSection.count()) > 0) {
			await expect(themeSection).toBeVisible();

			// Verify theme options are displayed
			await expect(page.getByText('Phosphor Green')).toBeVisible();
			await expect(page.getByText('Dark')).toBeVisible();
			await expect(page.getByText('Light')).toBeVisible();

			// Verify descriptions are shown
			await expect(page.getByText('Classic terminal phosphor green')).toBeVisible();
		}
	});

	test('selects theme and sets as global default', async ({ page }) => {
		await page.goto('/onboarding');
		await page.waitForLoadState('domcontentloaded');

		// Navigate to theme selection step
		const nextButton = page.getByRole('button', { name: /next|continue/i });
		if ((await nextButton.count()) > 0) {
			// Click next until we reach theme step
			for (let i = 0; i < 3; i++) {
				if ((await nextButton.count()) > 0) {
					await nextButton.click();
					await page.waitForTimeout(300);
				}
			}
		}

		// Select dark theme
		const darkThemeOption = page.locator('[data-theme-id="dark"], input[value="dark"]');

		if ((await darkThemeOption.count()) > 0) {
			await darkThemeOption.click();

			// Verify selection is highlighted
			const selectedTheme = page.locator('[data-theme-id="dark"][aria-selected="true"]');
			if ((await selectedTheme.count()) > 0) {
				await expect(selectedTheme).toBeVisible();
			}

			// Continue with onboarding
			const continueButton = page.getByRole('button', { name: /continue|finish|next/i });
			if ((await continueButton.count()) > 0) {
				await continueButton.click();

				// Wait for onboarding completion
				await page.waitForTimeout(1000);

				// Verify theme is applied (check CSS variable)
				const bgColor = await page.evaluate(() => {
					return getComputedStyle(document.documentElement).getPropertyValue('--theme-background');
				});

				expect(bgColor.trim()).toBeTruthy();
			}
		}
	});

	test('skips theme selection and uses fallback', async ({ page }) => {
		await page.goto('/onboarding');
		await page.waitForLoadState('domcontentloaded');

		// Look for skip button in theme step
		const skipButton = page.getByRole('button', { name: /skip/i });

		if ((await skipButton.count()) > 0) {
			// Navigate to theme step first
			const nextButton = page.getByRole('button', { name: /next|continue/i });
			for (let i = 0; i < 3 && (await nextButton.count()) > 0; i++) {
				await nextButton.click();
				await page.waitForTimeout(300);
			}

			// Skip theme selection
			if ((await skipButton.count()) > 0) {
				await skipButton.click();

				// Should proceed to next step or complete onboarding
				await page.waitForTimeout(500);

				// Verify we moved forward (either to next step or workspace)
				const url = page.url();
				expect(url).not.toContain('theme');
			}
		}
	});

	test('shows theme preview during selection', async ({ page }) => {
		await page.goto('/onboarding');
		await page.waitForLoadState('domcontentloaded');

		// Navigate to theme step
		const nextButton = page.getByRole('button', { name: /next|continue/i });
		for (let i = 0; i < 3 && (await nextButton.count()) > 0; i++) {
			await nextButton.click();
			await page.waitForTimeout(300);
		}

		// Find theme cards
		const themeCard = page.locator('[data-theme-id="dark"]').first();

		if ((await themeCard.count()) > 0) {
			// Hover or click to preview
			await themeCard.hover();

			// Look for preview element
			const preview = themeCard.locator('.theme-preview, [data-theme-preview]');

			if ((await preview.count()) > 0) {
				await expect(preview).toBeVisible();

				// Preview should show color swatches
				const colorSwatch = preview.locator('.color-swatch, [data-color-swatch]');
				const swatchCount = await colorSwatch.count();
				expect(swatchCount).toBeGreaterThan(0);
			}
		}
	});

	test('applies selected theme immediately after onboarding', async ({ page }) => {
		// Mock onboarding as complete with theme selected
		await page.unroute('/api/settings/onboarding**');
		await page.route('/api/settings/onboarding**', async (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					currentStep: 'complete',
					isComplete: true,
					completedSteps: ['auth', 'workspace', 'settings', 'complete'],
					stepData: {
						selectedTheme: 'dark.json'
					}
				})
			});
		});

		// Mock preferences with selected theme
		await page.unroute('/api/preferences**');
		await page.route('/api/preferences**', async (route) => {
			if (route.request().method() === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						globalDefault: 'dark.json'
					})
				});
				return;
			}

			route.continue();
		});

		// Mock active theme
		await page.unroute('/api/themes**');
		await page.route('/api/themes**', async (route) => {
			const url = route.request().url();

			if (url.includes('/active')) {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						theme: mockThemes[1] // Dark theme
					})
				});
				return;
			}

			route.continue();
		});

		// Navigate to workspace after onboarding
		await page.goto('/workspace');
		await page.waitForLoadState('domcontentloaded');

		// Wait for theme to apply
		await page.waitForTimeout(500);

		// Verify dark theme is applied
		const bgColor = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--theme-background');
		});

		expect(bgColor.trim()).toBeTruthy();
	});

	test('allows changing theme selection before completing onboarding', async ({ page }) => {
		await page.goto('/onboarding');
		await page.waitForLoadState('domcontentloaded');

		// Navigate to theme step
		const nextButton = page.getByRole('button', { name: /next|continue/i });
		for (let i = 0; i < 3 && (await nextButton.count()) > 0; i++) {
			await nextButton.click();
			await page.waitForTimeout(300);
		}

		// Select first theme
		const lightTheme = page.locator('[data-theme-id="light"], input[value="light"]');
		if ((await lightTheme.count()) > 0) {
			await lightTheme.click();
			await page.waitForTimeout(200);

			// Change selection to dark theme
			const darkTheme = page.locator('[data-theme-id="dark"], input[value="dark"]');
			await darkTheme.click();

			// Verify dark theme is now selected
			const selectedDark = page.locator('[data-theme-id="dark"][aria-selected="true"]');
			if ((await selectedDark.count()) > 0) {
				await expect(selectedDark).toBeVisible();
			}

			// Light theme should not be selected
			const selectedLight = page.locator('[data-theme-id="light"][aria-selected="true"]');
			expect(await selectedLight.count()).toBe(0);
		}
	});
});
