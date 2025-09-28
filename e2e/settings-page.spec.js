/**
 * E2E Test: Settings Page Navigation and Error Handling
 *
 * Validates the unified settings interface including:
 * - Left-side tab navigation and section availability
 * - Error handling for preferences loading failures
 * - Graceful handling of component load failures
 * - Fallback behavior when navigating to deprecated sections
 */

import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment, waitForWorkspace } from './test-helpers.js';

const expectedTabs = [
	'Global',
	'Environment',
	'Home Directory',
	'Tunnel',
	'VS Code Tunnel',
	'Claude Auth',
	'Claude Defaults',
	'Storage',
	'User Preferences',
	'Data Retention'
];

const mockSettingsResponse = {
	global: {
		telemetry: false,
		terminalFontSize: 14
	},
	'workspace-env': {
		variables: []
	},
	preferences: {
		theme: 'dark',
		lineNumbers: true
	},
	retention: {
		sessionRetentionDays: 30,
		logRetentionDays: 7
	}
};

test.describe('Settings Page Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await setupFreshTestEnvironment(page, '/');

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

		await page.route('**/api/settings**', (route) => {
			const url = route.request().url();
			if (route.request().method() === 'GET') {
				if (url.includes('category=')) {
					const category = new URL(url).searchParams.get('category');
					const data = mockSettingsResponse[category] ?? {};
					route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify(data)
					});
					return;
				}

				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(mockSettingsResponse)
				});
				return;
			}

			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});

		await page.route('**/api/retention/policy**', (route) => {
			if (route.request().method() === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessionRetentionDays: 30,
						logRetentionDays: 7,
						autoCleanupEnabled: true
					})
				});
				return;
			}

			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});
	});

	test('renders left navigation with all expected sections', async ({ page }) => {
		await page.goto('/settings');
		await waitForWorkspace(page);

		const tabList = page.locator('[role="tablist"]');
		await expect(tabList).toBeVisible();

		for (const tabLabel of expectedTabs) {
			await expect(page.getByRole('tab', { name: tabLabel })).toBeVisible();
		}

		const activeTab = page.getByRole('tab', { name: 'Global' });
		await expect(activeTab).toHaveAttribute('aria-selected', 'true');
	});

	test('shows actionable error when preferences fail to load', async ({ page }) => {
		await page.unroute('**/api/settings**');

		await page.route('**/api/settings**', (route) => {
			const url = route.request().url();
			if (route.request().method() === 'GET' && url.includes('category=preferences')) {
				route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Failed to load preferences' })
				});
				return;
			}

			if (route.request().method() === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(mockSettingsResponse)
				});
				return;
			}

			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});

		await page.goto('/settings');
		await waitForWorkspace(page);

		await page.getByRole('tab', { name: 'User Preferences' }).click();

		await expect(page.getByRole('alert')).toContainText('Unable to load user preferences');
		await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
	});

	test('displays recovery banner when component load fails', async ({ page }) => {
		await page.goto('/settings');
		await waitForWorkspace(page);

		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('dispatch:settings-component-error', {
					detail: { sectionId: 'claude-auth', reason: 'import-error' }
				})
			);
		});

		const banner = page.getByRole('alert').filter({ hasText: 'Claude Auth' });
		await expect(banner).toBeVisible();
		await expect(banner).toContainText('reload');
	});

	test('redirects deprecated sections to a safe fallback', async ({ page }) => {
		await page.goto('/settings?section=deprecated');
		await waitForWorkspace(page);

		await expect(page.getByRole('tab', { name: 'Global' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('alert')).toContainText('deprecated section is not available');
	});
});
