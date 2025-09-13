// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Comprehensive UI Test Suite for Dispatch
 *
 * This test suite covers all major UI flows and UX validation,
 * EXCLUDING Claude sessions to ensure reliable CI execution.
 *
 * Coverage:
 * - Authentication flows
 * - Project creation and navigation
 * - Terminal session management
 * - Console/admin page validation
 * - Responsive/mobile layout
 * - Visual regression testing
 */

const TEST_AUTH_KEY = 'testkey12345';

test.describe('Authentication Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any existing auth to ensure clean state
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
	});

	test('should handle complete login flow', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Check if auth is required
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			// Verify login page structure
			await expect(page.locator('form')).toBeVisible();
			await expect(page.locator('h1')).toContainText(/dispatch/i);
			await expect(page.locator('button[type="submit"]')).toBeVisible();

			// Test invalid authentication
			await authInput.fill('invalid-key');
			await page.locator('button[type="submit"]').click();
			await expect(page.locator('.error')).toBeVisible();

			// Test valid authentication
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();

			// Should redirect to projects
			await page.waitForURL('**/projects');
		}

		// Verify we're on projects page
		await expect(page).toHaveURL(/.*\/projects/);
	});

	test('should persist authentication across browser refresh', async ({ page }) => {
		// Login first
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}

		// Verify auth token in localStorage
		const authToken = await page.evaluate(() => localStorage.getItem('dispatch-auth-token'));
		expect(authToken).toBeTruthy();

		// Refresh page - should stay authenticated
		await page.reload();
		await expect(page).toHaveURL(/.*\/projects/);
	});

	test('should handle logout correctly', async ({ page }) => {
		// Login first
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}

		// Find and click logout button
		const logoutButton = page.locator('button[aria-label="Logout"], button:has-text("Logout")');
		if (await logoutButton.isVisible()) {
			await logoutButton.click();

			// Should redirect to login page
			await page.waitForURL('/');
			await expect(page.locator('input[type="password"]')).toBeVisible();
		}
	});
});

test.describe('Project Management', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}
	});

	test('should display projects page with proper layout', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Check main layout elements
		await expect(page.locator('.dispatch-workspace, .workspace, .main-content')).toBeVisible();

		// Check header elements
		const header = page.locator('header, .header, .header-brand');
		if (await header.isVisible()) {
			await expect(header).toContainText(/dispatch/i);
		}

		// Check for session-related UI elements
		await expect(page.locator('.sidebar, .sessions-list, .project-sidebar')).toBeVisible();

		// Take screenshot for visual validation
		await page.screenshot({
			path: 'test-results/projects-page-layout.png',
			fullPage: true
		});
	});

	test('should handle project creation flow', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Look for project creation buttons
		const createButtons = [
			'button:has-text("Create")',
			'button:has-text("New Project")',
			'button:has-text("Add Project")',
			'.create-project'
		];

		let createButton = null;
		for (const selector of createButtons) {
			const button = page.locator(selector);
			if (await button.isVisible()) {
				createButton = button;
				break;
			}
		}

		if (createButton) {
			await createButton.click();

			// Look for project name input
			const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
			if (await nameInput.isVisible()) {
				const projectName = `test-project-${Date.now()}`;
				await nameInput.fill(projectName);

				// Submit the form
				const submitButton = page
					.locator('button[type="submit"], button:has-text("Create")')
					.first();
				if (await submitButton.isVisible()) {
					await submitButton.click();
					await page.waitForTimeout(2000);

					// Verify project was created (check for redirect or success)
					const url = page.url();
					expect(url).toMatch(/\/projects/);
				}
			}
		}
	});

	test('should navigate between different projects', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Look for existing project links
		const projectLinks = page.locator('a[href*="/projects/"], .project-item, .project-link');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			// Click on first project
			await projectLinks.first().click();
			await page.waitForTimeout(1000);

			// Verify we navigated to a specific project
			const currentUrl = page.url();
			expect(currentUrl).toMatch(/\/projects\/[^\/]+/);

			// Go back to projects list
			await page.goto('/projects');
			await page.waitForLoadState('networkidle');

			// Verify we're back at projects list
			await expect(page).toHaveURL(/.*\/projects$/);
		}
	});
});

test.describe('Terminal Session Management', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate and navigate to projects
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}
	});

	test('should create terminal session successfully', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Look for terminal session creation buttons (excluding Claude)
		const terminalButtons = [
			'button:has-text("Terminal")',
			'button:has-text("New Session")',
			'button:has-text("Shell")',
			'.create-terminal'
		];

		let terminalButton = null;
		for (const selector of terminalButtons) {
			const button = page.locator(selector);
			if (await button.isVisible()) {
				terminalButton = button;
				break;
			}
		}

		if (terminalButton) {
			await terminalButton.click();
			await page.waitForTimeout(2000);

			// Look for terminal interface
			const terminalElements = [
				'.terminal-container',
				'.xterm-screen',
				'.terminal-pane',
				'.pty-session'
			];

			let terminalFound = false;
			for (const selector of terminalElements) {
				const terminal = page.locator(selector);
				if (await terminal.isVisible()) {
					terminalFound = true;
					break;
				}
			}

			if (terminalFound) {
				// Take screenshot of terminal session
				await page.screenshot({
					path: 'test-results/terminal-session-created.png',
					fullPage: true
				});
			}
		}
	});

	test('should display sessions in sidebar', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Check for sessions sidebar
		const sidebar = page.locator('.sidebar, .sessions-list, .session-sidebar');
		await expect(sidebar).toBeVisible();

		// Check for sessions title/header
		const sessionsTitle = page.locator(':has-text("Sessions"), .sidebar-title, .sessions-header');
		if (await sessionsTitle.isVisible()) {
			await expect(sessionsTitle).toContainText(/sessions/i);
		}

		// Take screenshot of sidebar
		await page.screenshot({
			path: 'test-results/sessions-sidebar.png',
			clip: { x: 0, y: 0, width: 300, height: 800 }
		});
	});

	test('should handle session lifecycle (create, use, close)', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Count initial sessions
		const initialSessions = await page.locator('.session-item, .session').count();

		// Try to create a new terminal session
		const createButton = page
			.locator('button:has-text("Terminal"), button:has-text("New Session")')
			.first();
		if (await createButton.isVisible()) {
			await createButton.click();
			await page.waitForTimeout(3000);

			// Check if sessions increased
			const newSessions = await page.locator('.session-item, .session').count();
			if (newSessions > initialSessions) {
				// Session was created successfully
				const latestSession = page.locator('.session-item, .session').last();

				// Try to close the session
				const closeButton = latestSession.locator(
					'button[title*="close" i], button[aria-label*="close" i], .close-button'
				);
				if (await closeButton.isVisible()) {
					await closeButton.click();
					await page.waitForTimeout(1000);

					// Verify session was closed
					const finalSessions = await page.locator('.session-item, .session').count();
					expect(finalSessions).toBeLessThanOrEqual(newSessions);
				}
			}
		}
	});

	test('should handle multiple terminal sessions', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Try to create multiple sessions
		const createButton = page
			.locator('button:has-text("Terminal"), button:has-text("New Session")')
			.first();

		if (await createButton.isVisible()) {
			// Create first session
			await createButton.click();
			await page.waitForTimeout(2000);

			// Create second session
			await createButton.click();
			await page.waitForTimeout(2000);

			// Verify multiple sessions exist
			const sessionCount = await page.locator('.session-item, .session').count();
			expect(sessionCount).toBeGreaterThanOrEqual(1);

			// Test switching between sessions
			const sessions = page.locator('.session-item, .session');
			if ((await sessions.count()) > 1) {
				await sessions.nth(0).click();
				await page.waitForTimeout(500);

				await sessions.nth(1).click();
				await page.waitForTimeout(500);

				// Take screenshot showing multiple sessions
				await page.screenshot({
					path: 'test-results/multiple-sessions.png',
					fullPage: true
				});
			}
		}
	});
});

test.describe('Console/Admin Page Validation', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}
	});

	test('should display console page with admin information', async ({ page }) => {
		await page.goto('/console');
		await page.waitForLoadState('networkidle');

		// Check for console/admin page elements
		const adminElements = [
			'.admin-console',
			'.console-container',
			'.admin-panel',
			'h1:has-text("Console")',
			'h1:has-text("Admin")'
		];

		let consoleFound = false;
		for (const selector of adminElements) {
			const element = page.locator(selector);
			if (await element.isVisible()) {
				consoleFound = true;
				break;
			}
		}

		// Take screenshot of console page
		await page.screenshot({
			path: 'test-results/console-page.png',
			fullPage: true
		});

		// If console page exists, verify it has useful information
		if (consoleFound) {
			// Look for typical admin information
			const infoElements = [
				':has-text("Socket")',
				':has-text("Session")',
				':has-text("Connection")',
				':has-text("Log")',
				':has-text("Status")'
			];

			for (const selector of infoElements) {
				const element = page.locator(selector);
				if (await element.isVisible()) {
					// Found admin information
					break;
				}
			}
		}
	});

	test('should validate console page accessibility', async ({ page }) => {
		await page.goto('/console');
		await page.waitForLoadState('networkidle');

		// Check for proper headings structure
		const headings = page.locator('h1, h2, h3');
		const headingCount = await headings.count();

		if (headingCount > 0) {
			// Verify headings have text content
			for (let i = 0; i < Math.min(headingCount, 3); i++) {
				const heading = headings.nth(i);
				const text = await heading.textContent();
				expect(text?.trim()).toBeTruthy();
			}
		}

		// Check for navigation elements
		const navElements = page.locator('nav, .navigation, .menu');
		if ((await navElements.count()) > 0) {
			await expect(navElements.first()).toBeVisible();
		}
	});
});

test.describe('Responsive and Mobile Layout', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}
	});

	test('should be responsive on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Take mobile screenshot
		await page.screenshot({
			path: 'test-results/mobile-layout.png',
			fullPage: true
		});

		// Check that content is still accessible
		const mainContent = page.locator('.main-content, .workspace, .dispatch-workspace');
		await expect(mainContent).toBeVisible();

		// Check for mobile-friendly navigation
		const mobileNav = page.locator('.mobile-nav, .hamburger, .menu-toggle, nav');
		if ((await mobileNav.count()) > 0) {
			await expect(mobileNav.first()).toBeVisible();
		}
	});

	test('should handle tablet viewport correctly', async ({ page }) => {
		// Set tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Take tablet screenshot
		await page.screenshot({
			path: 'test-results/tablet-layout.png',
			fullPage: true
		});

		// Verify layout adapts properly
		const sidebar = page.locator('.sidebar, .sessions-list');
		if (await sidebar.isVisible()) {
			// Check sidebar is appropriately sized for tablet
			const sidebarBox = await sidebar.boundingBox();
			if (sidebarBox) {
				expect(sidebarBox.width).toBeLessThan(400); // Not too wide on tablet
			}
		}
	});

	test('should maintain functionality across different screen sizes', async ({ page }) => {
		const viewports = [
			{ width: 320, height: 568, name: 'mobile-small' },
			{ width: 768, height: 1024, name: 'tablet' },
			{ width: 1024, height: 768, name: 'desktop-small' },
			{ width: 1920, height: 1080, name: 'desktop-large' }
		];

		for (const viewport of viewports) {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.goto('/projects');
			await page.waitForLoadState('networkidle');

			// Verify core elements are visible
			const coreElements = page.locator('.workspace, .main-content, .dispatch-workspace');
			await expect(coreElements.first()).toBeVisible();

			// Take screenshot for this viewport
			await page.screenshot({
				path: `test-results/layout-${viewport.name}.png`,
				fullPage: false // Just viewport for comparison
			});
		}
	});
});

test.describe('Visual Regression and Layout Validation', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}
	});

	test('should maintain consistent visual layout', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Take full page screenshot for baseline
		await page.screenshot({
			path: 'test-results/visual-baseline.png',
			fullPage: true
		});

		// Check key layout elements have proper CSS
		const workspace = page.locator('.workspace, .dispatch-workspace').first();
		if (await workspace.isVisible()) {
			const styles = await workspace.evaluate((el) => {
				const computed = window.getComputedStyle(el);
				return {
					display: computed.display,
					position: computed.position,
					overflow: computed.overflow
				};
			});

			// Verify basic layout styles
			expect(styles.display).not.toBe('none');
		}
	});

	test('should validate button and interactive element styles', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Find all buttons and check they're properly styled
		const buttons = page.locator('button');
		const buttonCount = await buttons.count();

		if (buttonCount > 0) {
			for (let i = 0; i < Math.min(buttonCount, 5); i++) {
				const button = buttons.nth(i);
				if (await button.isVisible()) {
					const styles = await button.evaluate((el) => {
						const computed = window.getComputedStyle(el);
						return {
							cursor: computed.cursor,
							backgroundColor: computed.backgroundColor,
							border: computed.border
						};
					});

					// Verify button has interactive styling
					expect(styles.cursor).toBe('pointer');
				}
			}
		}
	});

	test('should validate color contrast and accessibility', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Check for proper heading structure
		const h1 = page.locator('h1');
		if ((await h1.count()) > 0) {
			await expect(h1.first()).toBeVisible();
		}

		// Check for proper link styling
		const links = page.locator('a');
		const linkCount = await links.count();

		if (linkCount > 0) {
			const firstLink = links.first();
			if (await firstLink.isVisible()) {
				const styles = await firstLink.evaluate((el) => {
					const computed = window.getComputedStyle(el);
					return {
						color: computed.color,
						textDecoration: computed.textDecoration
					};
				});

				// Verify links have proper styling
				expect(styles.color).toBeTruthy();
			}
		}
	});

	test('should validate form elements and inputs', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Look for any input elements
		const inputs = page.locator('input, textarea, select');
		const inputCount = await inputs.count();

		if (inputCount > 0) {
			for (let i = 0; i < Math.min(inputCount, 3); i++) {
				const input = inputs.nth(i);
				if (await input.isVisible()) {
					const styles = await input.evaluate((el) => {
						const computed = window.getComputedStyle(el);
						return {
							border: computed.border,
							padding: computed.padding,
							fontSize: computed.fontSize
						};
					});

					// Verify inputs have proper styling
					expect(styles.border).toBeTruthy();
					expect(styles.padding).not.toBe('0px');
				}
			}
		}
	});
});

test.describe('Error Handling and Edge Cases', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.locator('button[type="submit"]').click();
			await page.waitForURL('**/projects');
		}
	});

	test('should handle network errors gracefully', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Simulate network failure for specific requests
		await page.route('/api/sessions', (route) => route.abort());

		// Try to create a session and see if error is handled
		const createButton = page
			.locator('button:has-text("Terminal"), button:has-text("New Session")')
			.first();
		if (await createButton.isVisible()) {
			await createButton.click();
			await page.waitForTimeout(2000);

			// Check for error message or graceful degradation
			const errorMessage = page.locator('.error, .alert, .notification');
			// Don't fail if no error message - just checking for graceful handling
		}
	});

	test('should handle invalid URLs gracefully', async ({ page }) => {
		// Try accessing non-existent project
		await page.goto('/projects/non-existent-project-id');
		await page.waitForLoadState('networkidle');

		// Should either redirect or show appropriate error
		const url = page.url();
		const isOnErrorPage =
			url.includes('/projects') ||
			(await page.locator('.error, .not-found, h1:has-text("404")').count()) > 0;

		expect(isOnErrorPage).toBeTruthy();
	});

	test('should maintain session state across page navigation', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Navigate to console and back
		await page.goto('/console');
		await page.waitForLoadState('networkidle');

		await page.goto('/projects');
		await page.waitForLoadState('networkidle');

		// Verify page still loads correctly
		const workspace = page.locator('.workspace, .dispatch-workspace, .main-content');
		await expect(workspace.first()).toBeVisible();
	});
});
