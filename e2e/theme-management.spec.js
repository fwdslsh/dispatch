/**
 * E2E Test: Theme Management Workflow
 *
 * Tests the complete theme management functionality including:
 * - Viewing available themes (preset and custom)
 * - Uploading custom themes
 * - Activating themes and verifying CSS variable application
 * - Deleting custom themes
 * - Theme validation and error handling
 */

import { test, expect } from '@playwright/test';
import { navigateToRouteAuthenticated, waitForWorkspaceReady } from './core-helpers.js';

// Sample custom theme for upload testing
const customTheme = {
	name: 'Test Ocean',
	description: 'A cool ocean-themed terminal',
	background: '#001f3f',
	foreground: '#7fdbff',
	cursor: '#39cccc',
	cursorAccent: '#001f3f',
	selectionBackground: '#39cccc40',
	black: '#001f3f',
	red: '#ff4136',
	green: '#2ecc40',
	yellow: '#ffdc00',
	blue: '#0074d9',
	magenta: '#b10dc9',
	cyan: '#39cccc',
	white: '#aaaaaa',
	brightBlack: '#555555',
	brightRed: '#ff725c',
	brightGreen: '#85e89d',
	brightYellow: '#f1fa8c',
	brightBlue: '#3fbfff',
	brightMagenta: '#ff79c6',
	brightCyan: '#8be9fd',
	brightWhite: '#7fdbff'
};

test.describe('Theme Management Workflow', () => {
	test.beforeEach(async ({ page }) => {
		// Mock theme API endpoints
		await page.route('/api/themes**', async (route) => {
			const url = route.request().url();
			const method = route.request().method();

			// List themes
			if (method === 'GET' && !url.includes('/active') && !url.includes('/can-delete')) {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						themes: [
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
						]
					})
				});
				return;
			}

			// Active theme
			if (url.includes('/active')) {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						theme: {
							id: 'phosphor-green',
							name: 'Phosphor Green',
							source: 'preset',
							cssVariables: {
								'--theme-background': '#0c1210',
								'--theme-foreground': '#d9ffe6',
								'--theme-cursor': '#2ee66b'
							}
						}
					})
				});
				return;
			}

			// Can delete check
			if (url.includes('/can-delete')) {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ canDelete: true })
				});
				return;
			}

			// Upload theme (POST to /api/themes)
			if (method === 'POST') {
				route.fulfill({
					status: 201,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						themeId: 'test-ocean',
						name: 'Test Ocean',
						errors: [],
						warnings: []
					})
				});
				return;
			}

			// Delete theme
			if (method === 'DELETE') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
				return;
			}

			route.continue();
		});

		// Mock preferences API
		await page.route('/api/preferences**', (route) => {
			if (route.request().method() === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						globalDefault: 'phosphor-green.json'
					})
				});
				return;
			}

			if (route.request().method() === 'PUT') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
				return;
			}

			route.continue();
		});

		// Mock onboarding as complete
		await page.route('/api/settings/onboarding**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					currentStep: 'complete',
					isComplete: true,
					completedSteps: ['auth', 'workspace', 'complete']
				})
			});
		});
	});

	test('displays available themes in settings', async ({ page }) => {
		await navigateToRouteAuthenticated(page, '/settings');
		await waitForWorkspaceReady(page);

		// Navigate to themes section
		const themesTab = page.getByRole('tab', { name: /themes/i });
		await themesTab.click();

		// Verify preset themes are displayed
		await expect(page.getByText('Phosphor Green')).toBeVisible();
		await expect(page.getByText('Dark')).toBeVisible();
		await expect(page.getByText('Light')).toBeVisible();

		// Verify theme descriptions
		await expect(page.getByText('Classic terminal phosphor green')).toBeVisible();
		await expect(page.getByText('Professional dark theme')).toBeVisible();
	});

	test('uploads custom theme successfully', async ({ page }) => {
		await navigateToRouteAuthenticated(page, '/settings');
		await waitForWorkspaceReady(page);

		// Navigate to themes section
		await page.getByRole('tab', { name: /themes/i }).click();

		// Find and click upload button
		const uploadButton = page.getByRole('button', { name: /upload theme/i });
		await expect(uploadButton).toBeVisible();
		await uploadButton.click();

		// Wait for file input to be available
		const fileInput = page.locator('input[type="file"]');
		await expect(fileInput).toBeAttached();

		// Create a blob with the custom theme JSON
		const themeBlob = new Blob([JSON.stringify(customTheme, null, 2)], {
			type: 'application/json'
		});
		const themeFile = new File([themeBlob], 'test-ocean.json', { type: 'application/json' });

		// Upload the file
		await fileInput.setInputFiles({
			name: 'test-ocean.json',
			mimeType: 'application/json',
			buffer: Buffer.from(JSON.stringify(customTheme, null, 2))
		});

		// Verify success message
		await expect(page.getByText(/theme uploaded successfully/i)).toBeVisible({ timeout: 5000 });
	});

	test('activates theme and applies CSS variables', async ({ page }) => {
		await navigateToRouteAuthenticated(page, '/settings');
		await waitForWorkspaceReady(page);

		// Navigate to themes section
		await page.getByRole('tab', { name: /themes/i }).click();

		// Find a theme card and click activate
		const darkThemeCard = page.locator('[data-theme-id="dark"]');
		const activateButton = darkThemeCard.getByRole('button', { name: /activate/i });
		await activateButton.click();

		// Verify success notification
		await expect(page.getByText(/theme activated/i)).toBeVisible({ timeout: 5000 });

		// Verify CSS variables are applied to document
		const bgColor = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--theme-background');
		});

		expect(bgColor.trim()).toBeTruthy();
	});

	test('deletes custom theme after confirmation', async ({ page }) => {
		// First mock the themes list to include a custom theme
		await page.unroute('/api/themes**');
		await page.route('/api/themes**', async (route) => {
			const url = route.request().url();
			const method = route.request().method();

			if (method === 'GET' && !url.includes('/active') && !url.includes('/can-delete')) {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						themes: [
							{
								id: 'phosphor-green',
								name: 'Phosphor Green',
								source: 'preset'
							},
							{
								id: 'test-ocean',
								name: 'Test Ocean',
								source: 'custom',
								cssVariables: { '--theme-background': '#001f3f' }
							}
						]
					})
				});
				return;
			}

			if (url.includes('/can-delete')) {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ canDelete: true })
				});
				return;
			}

			if (method === 'DELETE') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
				return;
			}

			route.continue();
		});

		await navigateToRouteAuthenticated(page, '/settings');
		await waitForWorkspaceReady(page);

		// Navigate to themes section
		await page.getByRole('tab', { name: /themes/i }).click();

		// Find custom theme card
		const customThemeCard = page.locator('[data-theme-id="test-ocean"]');
		await expect(customThemeCard).toBeVisible();

		// Click delete button
		const deleteButton = customThemeCard.getByRole('button', { name: /delete/i });
		await deleteButton.click();

		// Confirm deletion in dialog
		const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
		await confirmButton.click();

		// Verify success message
		await expect(page.getByText(/theme deleted/i)).toBeVisible({ timeout: 5000 });
	});

	test('prevents deletion of preset themes', async ({ page }) => {
		await navigateToRouteAuthenticated(page, '/settings');
		await waitForWorkspaceReady(page);

		// Navigate to themes section
		await page.getByRole('tab', { name: /themes/i }).click();

		// Find preset theme card
		const presetCard = page.locator('[data-theme-id="phosphor-green"]');
		await expect(presetCard).toBeVisible();

		// Verify delete button is disabled or not present
		const deleteButton = presetCard.getByRole('button', { name: /delete/i });
		const deleteCount = await deleteButton.count();

		if (deleteCount > 0) {
			// If delete button exists, it should be disabled
			await expect(deleteButton).toBeDisabled();
		}
		// Otherwise, delete button shouldn't exist for preset themes (which is also valid)
	});

	test('validates theme file format', async ({ page }) => {
		await page.unroute('/api/themes**');
		await page.route('/api/themes**', async (route) => {
			const method = route.request().method();

			if (method === 'POST') {
				// Simulate validation error
				route.fulfill({
					status: 400,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						errors: ['Missing required field: background', 'Invalid color format for foreground'],
						warnings: []
					})
				});
				return;
			}

			route.continue();
		});

		await navigateToRouteAuthenticated(page, '/settings');
		await waitForWorkspaceReady(page);

		// Navigate to themes section
		await page.getByRole('tab', { name: /themes/i }).click();

		// Click upload
		const uploadButton = page.getByRole('button', { name: /upload theme/i });
		await uploadButton.click();

		// Upload invalid theme file
		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles({
			name: 'invalid-theme.json',
			mimeType: 'application/json',
			buffer: Buffer.from('{"name": "Invalid"}')
		});

		// Verify error message is displayed
		await expect(page.getByText(/missing required field/i)).toBeVisible({ timeout: 5000 });
		await expect(page.getByText(/invalid color format/i)).toBeVisible();
	});

	test('shows preview of theme colors', async ({ page }) => {
		await navigateToRouteAuthenticated(page, '/settings');
		await waitForWorkspaceReady(page);

		// Navigate to themes section
		await page.getByRole('tab', { name: /themes/i }).click();

		// Find a theme card
		const themeCard = page.locator('[data-theme-id="dark"]').first();
		await expect(themeCard).toBeVisible();

		// Verify preview elements exist (color swatches)
		const preview = themeCard.locator('.theme-preview, [data-theme-preview]');
		const previewCount = await preview.count();

		// Theme card should have some visual preview
		expect(previewCount).toBeGreaterThan(0);
	});
});
