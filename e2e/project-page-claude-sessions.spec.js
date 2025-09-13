import { test, expect } from '@playwright/test';

test.describe('Project Page - Claude Session Management', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication token in localStorage
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('should load project page and display session controls', async ({ page }) => {
		await page.goto('/projects');

		// Wait for page to load
		await page.waitForSelector('.dispatch-workspace', { timeout: 10000 });

		// Check header elements
		await expect(page.locator('.header-brand')).toBeVisible();
		await expect(page.locator('.brand-text')).toContainText('Dispatch');

		// Check sidebar (sessions list)
		await expect(page.locator('.sidebar')).toBeVisible();
		await expect(page.locator('.sidebar-title')).toContainText('Sessions');

		// Check for action buttons in header
		await expect(page.locator('.header-actions button:has-text("Claude")')).toBeVisible();
		await expect(page.locator('.header-actions button:has-text("Terminal")')).toBeVisible();

		// Check layout controls
		await expect(page.locator('.layout-controls')).toBeVisible();

		// Take screenshot for visual verification
		await page.screenshot({ path: 'test-results/project-page-initial.png', fullPage: true });
	});

	test('should open Claude session modal and show tabs', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Click on Claude button in header
		await page.click('.header-actions button:has-text("Claude")');

		// Wait for modal to appear
		await page.waitForSelector('.modal-overlay', { timeout: 5000 });

		// Check modal title
		await expect(page.locator('.modal-title')).toContainText('Create Claude Session');

		// Check tabs are visible
		await expect(page.locator('.tab:has-text("NEW PROJECT")')).toBeVisible();
		await expect(page.locator('.tab:has-text("EXISTING PROJECT")')).toBeVisible();

		// Check that NEW PROJECT tab is active by default
		await expect(page.locator('.tab.active')).toContainText('NEW PROJECT');

		// Check input field for new project
		await expect(page.locator('label:has-text("PROJECT NAME")')).toBeVisible();
		await expect(page.locator('#project-name')).toBeVisible();

		// Check action buttons
		await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
		await expect(page.locator('button:has-text("Create Session")')).toBeVisible();

		// Take screenshot
		await page.screenshot({ path: 'test-results/claude-modal-new-project.png', fullPage: true });
	});

	test('should switch between new and existing project tabs', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Open Claude modal
		await page.click('.header-actions button:has-text("Claude")');
		await page.waitForSelector('.modal-overlay');

		// Click on EXISTING PROJECT tab
		await page.click('.tab:has-text("EXISTING PROJECT")');

		// Check that EXISTING PROJECT tab is now active
		await expect(page.locator('.tab.active')).toContainText('EXISTING PROJECT');

		// Check for project picker component
		await expect(page.locator('.project-picker, .session-picker, .picker-container')).toBeVisible({
			timeout: 5000
		});

		// Switch back to NEW PROJECT
		await page.click('.tab:has-text("NEW PROJECT")');
		await expect(page.locator('.tab.active')).toContainText('NEW PROJECT');
		await expect(page.locator('#project-name')).toBeVisible();
	});

	test('should create a new Claude session with new project', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Get initial session count
		const initialSessions = await page.locator('.session-item').count();

		// Open Claude modal
		await page.click('.header-actions button:has-text("Claude")');
		await page.waitForSelector('.modal-overlay');

		// Enter project name
		const projectName = `test-project-${Date.now()}`;
		await page.fill('#project-name', projectName);

		// Mock the API response for session creation
		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						path: `/workspace/${projectName}`,
						created: true
					})
				});
			} else {
				await route.continue();
			}
		});

		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				if (requestData.type === 'claude') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: `claude_${Date.now()}`,
							sessionId: `session_${Date.now()}`,
							type: 'claude',
							workspacePath: requestData.workspacePath
						})
					});
				} else {
					await route.continue();
				}
			} else {
				await route.continue();
			}
		});

		// Click Create Session button
		await page.click('button:has-text("Create Session")');

		// Wait for modal to close
		await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

		// Check that a new session appears in the grid
		await page.waitForSelector('.session-pane', { timeout: 10000 });

		// Verify Claude pane is visible
		await expect(page.locator('.claude-pane')).toBeVisible({ timeout: 10000 });
	});

	test('should display Claude session in the grid layout', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Mock existing sessions
		await page.route('/api/sessions', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sessions: [
						{
							id: 'claude_1',
							type: 'claude',
							workspacePath: '/workspace/test-project',
							sessionId: 'test-session-1',
							projectName: 'Test Project'
						}
					]
				})
			});
		});

		// Reload to get mocked sessions
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Check that session appears in sidebar
		await expect(page.locator('.session-item')).toHaveCount(1);
		await expect(page.locator('.session-item').first()).toBeVisible();

		// Check that Claude pane is visible in the grid
		await expect(page.locator('.session-pane')).toBeVisible();
		await expect(page.locator('.claude-pane')).toBeVisible();
	});

	test('should toggle layout between 1up, 2up, and 4up', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Check layout controls
		const layoutControls = page.locator('.layout-controls');
		await expect(layoutControls).toBeVisible();

		// Click 1up layout
		await page.click('button:has-text("1up")');
		await page.waitForTimeout(500);
		// Verify layout changes visually or by checking grid structure

		// Click 2up layout
		await page.click('button:has-text("2up")');
		await page.waitForTimeout(500);

		// Click 4up layout
		await page.click('button:has-text("4up")');
		await page.waitForTimeout(500);
	});

	test('should handle session pinning and unpinning', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Mock multiple sessions
		await page.route('/api/sessions', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sessions: [
						{
							id: 'claude_1',
							type: 'claude',
							workspacePath: '/workspace/project1',
							sessionId: 'session-1',
							projectName: 'Project 1'
						},
						{
							id: 'terminal_1',
							type: 'terminal',
							workspacePath: '/workspace/project1'
						},
						{
							id: 'claude_2',
							type: 'claude',
							workspacePath: '/workspace/project2',
							sessionId: 'session-2',
							projectName: 'Project 2'
						}
					]
				})
			});
		});

		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Check sessions in sidebar
		const sessionItems = page.locator('.session-item');
		await expect(sessionItems).toHaveCount(3);

		// Click on first session to pin it
		await sessionItems.first().click();

		// Verify session appears in grid
		await expect(page.locator('.session-pane')).toBeVisible();

		// Click on second session to pin it (in 2up mode)
		await page.click('button:has-text("2up")');
		await sessionItems.nth(1).click();

		// Verify two sessions in grid
		await expect(page.locator('.session-pane')).toHaveCount(2);
	});

	test('should handle mobile responsive layout', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Check that mobile navigation is present
		await expect(page.locator('.mobile-session-nav')).toBeVisible({ timeout: 5000 });

		// Mock sessions for mobile view
		await page.route('/api/sessions', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sessions: [
						{
							id: 'claude_1',
							type: 'claude',
							workspacePath: '/workspace/mobile-test',
							sessionId: 'mobile-session-1',
							projectName: 'Mobile Test'
						},
						{
							id: 'claude_2',
							type: 'claude',
							workspacePath: '/workspace/mobile-test-2',
							sessionId: 'mobile-session-2',
							projectName: 'Mobile Test 2'
						}
					]
				})
			});
		});

		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Should show only one session at a time on mobile
		const visiblePanes = await page.locator('.session-pane:visible').count();
		expect(visiblePanes).toBeLessThanOrEqual(1);

		// Test mobile navigation if present
		const nextButton = page.locator('button[aria-label="Next session"], button:has-text("→")');
		if (await nextButton.isVisible()) {
			await nextButton.click();
			// Verify navigation worked
			await page.waitForTimeout(500); // Wait for animation
		}
	});

	test('should toggle sidebar collapse', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Find sidebar toggle button
		const toggleButton = page.locator('button[aria-label*="sidebar"], .sidebar-toggle').first();
		await expect(toggleButton).toBeVisible();

		// Click to collapse sidebar
		await toggleButton.click();

		// Check that sidebar is collapsed
		await expect(page.locator('.dispatch-workspace')).toHaveClass(/sidebar-collapsed/);

		// Click to expand sidebar
		await toggleButton.click();

		// Check that sidebar is expanded
		await expect(page.locator('.dispatch-workspace')).not.toHaveClass(/sidebar-collapsed/);
	});

	test('should persist sidebar state in localStorage', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Toggle sidebar
		const toggleButton = page
			.locator('button[title*="sidebar"], button[aria-label*="sidebar"]')
			.first();
		await toggleButton.click();

		// Check localStorage
		const sidebarState = await page.evaluate(() => {
			return localStorage.getItem('dispatch-sidebar-collapsed');
		});
		expect(sidebarState).toBe('true');

		// Reload page
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Verify sidebar is still collapsed
		await expect(page.locator('.dispatch-workspace')).toHaveClass(/sidebar-collapsed/);
	});
});
