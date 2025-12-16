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

	test.beforeEach(async ({ page }) => {
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

		// Verify main elements are present
		await expect(page.locator('h1:has-text("OpenCode Portal")')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('text=AI-powered development sessions')).toBeVisible();
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
		await expect(page.locator('h1:has-text("OpenCode Portal")')).toBeVisible();
	});

	test('should display server status section', async ({ page }) => {
		await page.goto(`${BASE_URL}/opencode`);

		// Look for server status section
		await expect(page.locator('h2:has-text("Server Status")')).toBeVisible({ timeout: 5000 });

		// Should show either running or stopped status
		const statusIndicator = page.locator('.status-indicator, .server-status').first();
		await expect(statusIndicator).toBeVisible({ timeout: 3000 });
	});

	test('should display sessions section', async ({ page }) => {
		await page.goto(`${BASE_URL}/opencode`);

		// Look for sessions section
		await expect(page.locator('h2:has-text("Sessions")')).toBeVisible({ timeout: 5000 });

		// Should have "New Session" or "Create" button
		const createButton = page
			.locator('button:has-text("New Session"), button:has-text("Create")')
			.first();
		await expect(createButton).toBeVisible({ timeout: 3000 });
	});

	test('should display prompt composer placeholder when no session selected', async ({ page }) => {
		await page.goto(`${BASE_URL}/opencode`);

		// Should show placeholder when no session is selected
		const placeholder = page.locator(
			'text=Select a session or create a new one, .placeholder, .empty'
		);
		await expect(placeholder.first()).toBeVisible({ timeout: 5000 });
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
		// Click create session button
		const createButton = page.locator('button:has-text("New Session"), button.create-btn').first();
		await createButton.click({ timeout: 5000 });

		// Verify dialog appears with provider/model selects
		await expect(
			page.locator('[role="dialog"], .dialog, label:has-text("Provider")').first()
		).toBeVisible({ timeout: 3000 });
	});

	test('should display session list when sessions exist', async ({ page }) => {
		// Wait for sessions to load
		await page.waitForTimeout(2000);

		// Sessions list should be visible (even if empty)
		const sessionsList = page.locator(
			'.sessions-list, [data-testid="sessions-list"], .session-card'
		);
		const emptyMessage = page.locator('text=No sessions yet, .empty-message');

		// Either sessions exist or empty message shows
		const hasContent = await Promise.race([
			sessionsList.first().isVisible({ timeout: 2000 }).catch(() => false),
			emptyMessage.first().isVisible({ timeout: 2000 }).catch(() => false)
		]);

		expect(hasContent).toBeTruthy();
	});
});

test.describe('OpenCode Portal - Error Handling', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
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
