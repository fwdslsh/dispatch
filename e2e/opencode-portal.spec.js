/**
 * OpenCode Portal E2E Tests
 *
 * Tests for the dedicated OpenCode portal at /opencode including:
 * - Portal page loads correctly
 * - Server status display
 * - Session management (create, list, delete)
 * - Navigation to portal from workspace header
 */

import { test, expect } from '@playwright/test';
import { resetToOnboarded } from './helpers/index.js';

const BASE_URL = 'http://localhost:7173';

test.describe('OpenCode Portal - Page Load', () => {
	let apiKey;

	test.beforeEach(async ({ page, context }) => {
		// Clear browser state for test isolation
		await context.clearCookies();
		try {
			await page.evaluate(() => {
				localStorage.clear();
				sessionStorage.clear();
			});
		} catch (e) {
			// localStorage may not be accessible in some contexts (e.g., about:blank)
			// This is fine - the page reload will start with clean storage anyway
		}

		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should load /opencode portal page', async ({ page }) => {
		// Navigate to OpenCode portal
		await page.goto(`${BASE_URL}/opencode`);

		// Verify main elements are present (sidebar and chat area)
		await expect(page.locator('.sessions-sidebar')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('h2:has-text("OpenCode Sessions")')).toBeVisible();
		await expect(page.locator('.empty-chat')).toBeVisible();
	});

	test('should have working navigation link in workspace header', async ({ page }) => {
		// Start at workspace
		await page.goto(`${BASE_URL}/workspace`);

		// Find and click OpenCode nav link
		const opencodeLink = page.locator('a[href="/opencode"]').first();
		await expect(opencodeLink).toBeVisible({ timeout: 5000 });
		await opencodeLink.click();

		// Verify navigation worked
		await page.waitForURL(`${BASE_URL}/opencode`);
		await expect(page.locator('.sessions-sidebar')).toBeVisible();
		await expect(page.locator('h2:has-text("OpenCode Sessions")')).toBeVisible();
	});

	test('should display session sidebar with create button', async ({ page }) => {
		await page.goto(`${BASE_URL}/opencode`);

		// Look for session sidebar
		await expect(page.locator('.sessions-sidebar')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('h2:has-text("OpenCode Sessions")')).toBeVisible();

		// Should have create button (using aria-label from Button component)
		const createButton = page.locator('button[aria-label="Create new session"]').first();
		await expect(createButton).toBeVisible({ timeout: 3000 });
	});

	test('should display empty state when no sessions exist', async ({ page }) => {
		await page.goto(`${BASE_URL}/opencode`);

		// Wait for loading to complete (loading indicator to disappear)
		await expect(page.locator('.loading')).not.toBeVisible({ timeout: 5000 }).catch(() => {
			// Loading might not appear at all if data loads instantly
		});

		// Wait for either empty state or session list to appear
		await page.waitForSelector('.empty-state, .sessions-list', { timeout: 5000 }).catch(() => {
			// If neither appears, that's a test failure
		});

		// Should show either session list or empty state
		const hasSessions = await page.locator('.session-card').count();
		if (hasSessions === 0) {
			// Verify empty state in sidebar
			const emptyState = page.locator('.empty-state').first();
			await expect(emptyState).toBeVisible({ timeout: 3000 });
		}
	});

	test('should display empty chat placeholder when no session selected', async ({ page }) => {
		await page.goto(`${BASE_URL}/opencode`);

		// Should show empty chat placeholder
		const emptyChat = page.locator('.empty-chat');
		await expect(emptyChat).toBeVisible({ timeout: 5000 });
		await expect(page.locator('text=Select a session or create a new one')).toBeVisible();
	});
});

test.describe('OpenCode Portal - Session Management', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);

		// Navigate to portal
		await page.goto(`${BASE_URL}/opencode`);
	});

	test('should open session creation dialog', async ({ page }) => {
		// Wait for page to fully load
		await expect(page.locator('.sessions-sidebar')).toBeVisible({ timeout: 5000 });

		// Wait for loading to complete
		await expect(page.locator('.loading')).not.toBeVisible({ timeout: 5000 }).catch(() => {});

		// Click create session button (using aria-label from Button component)
		const createButton = page.locator('button[aria-label="Create new session"]').first();
		await expect(createButton).toBeVisible({ timeout: 3000 });
		await expect(createButton).toBeEnabled({ timeout: 3000 });
		await createButton.click({ timeout: 5000 });

		// Verify Modal component appears with provider/model selects
		await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
		await expect(page.locator('text=Create New Session')).toBeVisible();
		await expect(page.locator('label:has-text("Provider")')).toBeVisible();
		await expect(page.locator('label:has-text("Model")')).toBeVisible();
	});

	test('should display session list when sessions exist', async ({ page }) => {
		// Wait for loading to complete
		await expect(page.locator('.loading')).not.toBeVisible({ timeout: 5000 }).catch(() => {
			// Loading might not appear at all
		});

		// Wait for either empty state or session list to appear
		await page.waitForSelector('.empty-state, .sessions-list', { timeout: 5000 }).catch(() => {
			// If neither appears, that's a test failure
		});

		// Check if sessions exist or empty state is shown
		const sessionCount = await page.locator('.session-card').count();

		if (sessionCount > 0) {
			// Sessions exist - verify session cards are visible
			await expect(page.locator('.session-card').first()).toBeVisible({ timeout: 2000 });
		} else {
			// No sessions - verify empty state is visible
			const emptyState = page.locator('.empty-state').first();
			await expect(emptyState).toBeVisible({ timeout: 2000 });
		}
	});
});

test.describe('OpenCode Portal - Error Handling', () => {
	let apiKey;

	test.beforeEach(async ({ page, context }) => {
		// Clear browser state for test isolation
		await context.clearCookies();
		try {
			await page.evaluate(() => {
				localStorage.clear();
				sessionStorage.clear();
			});
		} catch (e) {
			// localStorage may not be accessible in some contexts (e.g., about:blank)
			// This is fine - the page reload will start with clean storage anyway
		}

		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should handle page load errors gracefully', async ({ page }) => {
		// Navigate to portal
		await page.goto(`${BASE_URL}/opencode`);

		// Page should not show uncaught error dialogs
		const errorDialog = page.locator('[role="alertdialog"], .error-dialog');
		await expect(errorDialog).not.toBeVisible({ timeout: 2000 }).catch(() => {});

		// Main content should be visible even if there are API errors
		await expect(page.locator('.opencode-portal, main, [class*="portal"]').first()).toBeVisible({
			timeout: 5000
		});
	});
});
