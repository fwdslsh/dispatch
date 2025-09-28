/**
 * E2E Test: Retention Policy Configuration
 *
 * Tests the retention policy settings interface including:
 * - Accessing retention settings through settings page
 * - Configuring session and log retention periods
 * - Preview functionality showing impact of changes
 * - Saving and persistence of retention policies
 */

import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment, waitForWorkspace } from './test-helpers.js';

test.describe('Retention Policy Configuration', () => {
	const mockRetentionPolicy = {
		id: 'policy-1',
		userId: 'testuser',
		sessionRetentionDays: 30,
		logRetentionDays: 7,
		autoCleanupEnabled: true,
		lastCleanupRun: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
		previewSummary: null
	};

	const mockPreviewData = {
		sessionsToDelete: 5,
		logsToDelete: 12,
		totalSpaceSaved: '45.2 MB',
		summary: 'Will delete 5 sessions older than 14 days and 12 log files older than 3 days'
	};

	test.beforeEach(async ({ page }) => {
		// Setup fresh environment
		await setupFreshTestEnvironment(page, '/');

		// Mock onboarding complete state
		await page.route('/api/onboarding/status**', (route) => {
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

		// Mock retention policy API endpoints
		await page.route('/api/retention/policy**', (route) => {
			if (route.request().method() === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(mockRetentionPolicy)
				});
			} else if (route.request().method() === 'PUT') {
				const updatedPolicy = { ...mockRetentionPolicy, ...route.request().postDataJSON() };
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(updatedPolicy)
				});
			}
		});

		// Mock retention preview endpoint
		await page.route('/api/retention/preview**', (route) => {
			const requestData = route.request().postDataJSON();
			const customPreview = {
				...mockPreviewData,
				summary: `Will delete ${mockPreviewData.sessionsToDelete} sessions older than ${requestData.sessionRetentionDays} days and ${mockPreviewData.logsToDelete} log files older than ${requestData.logRetentionDays} days`
			};
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(customPreview)
			});
		});

		// Mock retention cleanup endpoint
		await page.route('/api/retention/cleanup**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					sessionsDeleted: mockPreviewData.sessionsToDelete,
					logsDeleted: mockPreviewData.logsToDelete,
					spaceSaved: mockPreviewData.totalSpaceSaved
				})
			});
		});

		// Mock empty sessions and workspaces
		await page.route('/api/sessions**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ sessions: [] })
			});
		});

		await page.route('/api/workspaces**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([])
			});
		});
	});

	test('should access retention settings through settings page', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		await test.step('Navigate to settings page', async () => {
			// Navigate directly to settings page
			await page.goto('/settings');

			// Wait for settings page to load
			await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });
		});

		await test.step('Find retention settings section', async () => {
			// Look for retention/data retention section
			const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
			if (await retentionSection.isVisible()) {
				await retentionSection.click();
			}

			// Should see retention settings interface
			await expect(page.locator('text=/retention|cleanup/i').first()).toBeVisible({ timeout: 5000 });
		});
	});

	test('should configure session and log retention periods', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Modify session retention period', async () => {
			// Find session retention input
			const sessionRetentionInput = page.locator('input[type="number"]').first();
			await expect(sessionRetentionInput).toBeVisible({ timeout: 5000 });

			// Check current value
			const currentValue = await sessionRetentionInput.inputValue();
			expect(parseInt(currentValue)).toBe(30);

			// Change to 14 days
			await sessionRetentionInput.clear();
			await sessionRetentionInput.fill('14');
		});

		await test.step('Modify log retention period', async () => {
			// Find log retention input (second number input or labeled input)
			const logRetentionInput = page.locator('input[type="number"]').nth(1);
			if (await logRetentionInput.isVisible()) {
				// Check current value
				const currentValue = await logRetentionInput.inputValue();
				expect(parseInt(currentValue)).toBe(7);

				// Change to 3 days
				await logRetentionInput.clear();
				await logRetentionInput.fill('3');
			}
		});

		await test.step('Verify form validation', async () => {
			// Test invalid values
			const sessionRetentionInput = page.locator('input[type="number"]').first();
			await sessionRetentionInput.clear();
			await sessionRetentionInput.fill('0');

			// Should show validation error or prevent saving
			const saveButton = page.locator('button', { hasText: /Save|Apply/i });
			if (await saveButton.isVisible()) {
				const isDisabled = await saveButton.isDisabled();
				if (!isDisabled) {
					await saveButton.click();
					// Should see error message
					await expect(page.locator('.error-message, [role="alert"]').first()).toBeVisible({ timeout: 3000 });
				}
			}

			// Restore valid value
			await sessionRetentionInput.clear();
			await sessionRetentionInput.fill('14');
		});
	});

	test('should show preview of retention policy changes', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Request preview of changes', async () => {
			// Modify retention periods
			const sessionRetentionInput = page.locator('input[type="number"]').first();
			await sessionRetentionInput.clear();
			await sessionRetentionInput.fill('14');

			const logRetentionInput = page.locator('input[type="number"]').nth(1);
			if (await logRetentionInput.isVisible()) {
				await logRetentionInput.clear();
				await logRetentionInput.fill('3');
			}

			// Look for preview button
			const previewButton = page.locator('button', { hasText: /Preview|Show Impact/i });
			if (await previewButton.isVisible()) {
				await previewButton.click();

				// Wait for preview to load
				await page.waitForTimeout(1000);

				// Should show preview summary
				await expect(page.locator('text=/Will delete.*sessions/i')).toBeVisible({ timeout: 5000 });
				await expect(page.locator('text=/5 sessions/i')).toBeVisible();
				await expect(page.locator('text=/14 days/i')).toBeVisible();
			}
		});

		await test.step('Verify preview content', async () => {
			// Preview should show simple, clear summary
			const previewText = page.locator('.preview-summary, .retention-preview, [data-testid="retention-preview"]');
			if (await previewText.first().isVisible()) {
				const text = await previewText.first().textContent();
				expect(text).toMatch(/sessions.*days/i);
				expect(text).toMatch(/logs?.*days/i);
			}
		});
	});

	test('should save retention policy changes', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Save retention policy changes', async () => {
			// Modify settings
			const sessionRetentionInput = page.locator('input[type="number"]').first();
			await sessionRetentionInput.clear();
			await sessionRetentionInput.fill('21');

			// Save changes
			const saveButton = page.locator('button', { hasText: /Save|Apply|Update/i });
			await expect(saveButton).toBeVisible({ timeout: 5000 });
			await saveButton.click();

			// Should see success message
			await expect(page.locator('.success-message, text=/saved successfully/i').first()).toBeVisible({ timeout: 5000 });
		});

		await test.step('Verify persistence', async () => {
			// Refresh page and verify settings are persisted
			await page.reload();
			await page.waitForTimeout(2000);

			// Navigate back to retention section
			const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
			if (await retentionSection.isVisible()) {
				await retentionSection.click();
			}

			// Verify saved value
			const sessionRetentionInput = page.locator('input[type="number"]').first();
			if (await sessionRetentionInput.isVisible()) {
				const value = await sessionRetentionInput.inputValue();
				expect(parseInt(value)).toBe(21);
			}
		});
	});

	test('should handle auto-cleanup toggle', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Toggle auto-cleanup setting', async () => {
			// Find auto-cleanup checkbox or toggle
			const autoCleanupToggle = page.locator('input[type="checkbox"]', { hasText: /auto|automatic/i });
			if (await autoCleanupToggle.isVisible()) {
				const isChecked = await autoCleanupToggle.isChecked();

				// Toggle the setting
				await autoCleanupToggle.click();

				// Verify state changed
				const newState = await autoCleanupToggle.isChecked();
				expect(newState).toBe(!isChecked);
			}
		});
	});

	test('should handle retention policy errors gracefully', async ({ page }) => {
		// Mock API error for policy save
		await page.route('/api/retention/policy**', (route) => {
			if (route.request().method() === 'PUT') {
				route.fulfill({
					status: 400,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Invalid retention period' })
				});
			} else {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(mockRetentionPolicy)
				});
			}
		});

		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Handle save error', async () => {
			// Modify settings
			const sessionRetentionInput = page.locator('input[type="number"]').first();
			await sessionRetentionInput.clear();
			await sessionRetentionInput.fill('999');

			// Try to save
			const saveButton = page.locator('button', { hasText: /Save|Apply/i });
			if (await saveButton.isVisible()) {
				await saveButton.click();

				// Should show error message
				await expect(page.locator('.error-message, [role="alert"]').first()).toBeVisible({ timeout: 5000 });
				await expect(page.locator('text=/Invalid retention period/i')).toBeVisible();
			}
		});
	});

	test('should support keyboard navigation', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Test keyboard navigation', async () => {
			// Tab through retention form elements
			await page.keyboard.press('Tab');

			const firstInput = page.locator('input[type="number"]').first();
			if (await firstInput.isVisible()) {
				await firstInput.focus();
				await expect(firstInput).toBeFocused();

				// Change value with keyboard
				await page.keyboard.press('Control+a');
				await page.keyboard.type('15');

				// Tab to next field
				await page.keyboard.press('Tab');

				const secondInput = page.locator('input[type="number"]').nth(1);
				if (await secondInput.isVisible()) {
					await expect(secondInput).toBeFocused();
				}
			}
		});
	});

	test('should be responsive on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Verify mobile responsive layout', async () => {
			// Form elements should be properly sized for mobile
			const numberInputs = page.locator('input[type="number"]');
			if (await numberInputs.first().isVisible()) {
				const inputBox = await numberInputs.first().boundingBox();
				expect(inputBox.width).toBeGreaterThan(50); // Should be reasonable width
				expect(inputBox.width).toBeLessThan(350); // Should fit in mobile viewport
			}

			// Buttons should be touch-friendly
			const saveButton = page.locator('button', { hasText: /Save|Apply/i });
			if (await saveButton.isVisible()) {
				const buttonBox = await saveButton.boundingBox();
				expect(buttonBox.height).toBeGreaterThan(40); // Touch-friendly height
			}
		});
	});

	test('should show last cleanup run information', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });

		// Navigate to retention section
		const retentionSection = page.locator('button', { hasText: /Data Retention|Retention/i });
		if (await retentionSection.isVisible()) {
			await retentionSection.click();
		}

		await test.step('Verify cleanup history display', async () => {
			// Should show when cleanup was last run
			const lastRunInfo = page.locator('text=/last.*cleanup|cleanup.*ago/i');
			if (await lastRunInfo.first().isVisible()) {
				const text = await lastRunInfo.first().textContent();
				expect(text).toMatch(/\d+.*day.*ago|\d+.*hour.*ago|yesterday|today/i);
			}
		});
	});
});