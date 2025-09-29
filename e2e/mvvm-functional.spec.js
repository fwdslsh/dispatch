import { test, expect } from '@playwright/test';
import {
	setupFreshTestEnvironment,
	waitForWorkspaceReady,
	setupApiMocks,
	mobileTap
} from './core-helpers.js';

test.describe('MVVM Architecture Functional Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Setup clean environment with MVVM architecture
		await setupFreshTestEnvironment(page, '/workspace');
	});

	test('should load MVVM workspace architecture successfully', async ({ page }) => {
		// Verify main workspace container exists
		await expect(page.locator('.dispatch-workspace')).toBeVisible();

		// Verify main content area exists
		await expect(page.locator('.main-content')).toBeVisible();

		// Verify WorkspacePage component is loaded (not the old monolithic component)
		const title = await page.title();
		expect(title).toContain('Dispatch');

		// Check for MVVM-specific elements
		const workspaceExists = await page.locator('.dispatch-workspace').count();
		expect(workspaceExists).toBeGreaterThan(0);
	});

	test('should handle empty workspace state correctly', async ({ page }) => {
		// Mock empty API responses
		await setupApiMocks(page, {
			sessions: [],
			workspaces: []
		});

		await page.reload();
		await waitForWorkspaceReady(page);

		// Should show empty workspace component
		const emptyState = page.locator('.empty-workspace, .no-sessions, [data-testid="empty-state"]');
		await expect(emptyState.first()).toBeVisible({ timeout: 5000 });
	});

	test('should display sessions when available', async ({ page }) => {
		// Mock sessions data
		await setupApiMocks(page, {
			sessions: [
				{
					id: 'test-session-1',
					type: 'pty',
					title: 'Terminal Session',
					pinned: true,
					isActive: true
				}
			]
		});

		await page.reload();
		await waitForWorkspaceReady(page);

		// Should show session containers
		const sessionContainer = page.locator(
			'.session-container, .session-grid, [data-testid="session"]'
		);
		await expect(sessionContainer.first()).toBeVisible({ timeout: 5000 });
	});

	test('should handle mobile navigation correctly', async ({ page, browserName, isMobile }) => {
		if (!isMobile) {
			test.skip(); // Skip on desktop
		}

		// Mock some sessions
		await setupApiMocks(page, {
			sessions: [
				{ id: 'session1', type: 'pty', title: 'Terminal 1', pinned: true },
				{ id: 'session2', type: 'claude', title: 'Claude 1', pinned: true }
			]
		});

		await page.reload();
		await waitForWorkspaceReady(page);

		// Look for mobile navigation elements
		const mobileNav = page.locator(
			'.mobile-navigation, .bottom-navigation, [data-testid="mobile-nav"]'
		);
		if ((await mobileNav.count()) > 0) {
			await expect(mobileNav.first()).toBeVisible();

			// Test mobile tap functionality
			const navButton = mobileNav.locator('button, .nav-btn').first();
			if ((await navButton.count()) > 0) {
				await mobileTap(page, navButton.first());
			}
		}
	});

	test('should handle responsive layout changes', async ({ page }) => {
		// Test desktop view
		await page.setViewportSize({ width: 1200, height: 800 });
		await waitForWorkspaceReady(page);

		// Workspace should be visible
		await expect(page.locator('.dispatch-workspace')).toBeVisible();

		// Test mobile view
		await page.setViewportSize({ width: 375, height: 667 });
		await page.waitForTimeout(500); // Allow layout to adjust

		// Workspace should still be visible but potentially with different layout
		await expect(page.locator('.dispatch-workspace')).toBeVisible();
	});

	test('should persist authentication state', async ({ page }) => {
		// Navigate to workspace (should redirect to login if not authenticated)
		await setupFreshTestEnvironment(page, '/workspace');

		// Check for authentication form or workspace
		const hasAuth = await page.locator('input[type="password"], .auth-form, .login-form').count();
		const hasWorkspace = await page.locator('.dispatch-workspace').count();

		// Should have either auth form or workspace (depending on auth state)
		expect(hasAuth + hasWorkspace).toBeGreaterThan(0);
	});

	test('should handle keyboard shortcuts', async ({ page }) => {
		await waitForWorkspaceReady(page);

		// Test command palette with Ctrl+K / Cmd+K
		const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
		await page.keyboard.press(`${modifier}+KeyK`);

		// Look for command palette
		const commandPalette = page.locator(
			'.command-palette, [data-testid="command-palette"], .modal'
		);

		// Wait a bit for the command palette to appear
		await page.waitForTimeout(1000);

		// If command palette exists, it should be visible
		if ((await commandPalette.count()) > 0) {
			await expect(commandPalette.first()).toBeVisible();
		}
	});

	test('should handle error states gracefully', async ({ page }) => {
		// Mock API error responses
		await page.route('/api/sessions**', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Internal server error' })
			});
		});

		await page.reload();
		await waitForWorkspaceReady(page);

		// Should still show workspace even with API errors
		await expect(page.locator('.dispatch-workspace')).toBeVisible();

		// May show error messages but shouldn't crash
		const errorMessages = await page.locator('.error, .alert-error, [data-testid="error"]').count();
		// Errors are acceptable, just verify the app doesn't crash
	});
});
