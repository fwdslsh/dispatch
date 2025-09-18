import { test, expect } from '@playwright/test';

test.describe('Terminal Session Basic Test', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('should create and interact with terminal session', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Mock workspace API
		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						list: [{ path: '/workspace/test-terminal', name: 'test-terminal' }]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Mock terminal session creation
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				if (requestData.type === 'pty') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'test_terminal_123',
							type: 'pty',
							workspacePath: requestData.workspacePath,
							shell: '/bin/bash'
						})
					});
				} else {
					await route.continue();
				}
			} else if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: []
					})
				});
			} else {
				await route.continue();
			}
		});

		// Create terminal session
		await page.click('.header-actions button:has-text("Terminal")');
		await page.waitForSelector('.modal-overlay');

		// Select workspace if selector is present
		const workspaceSelector = page.locator('select#workspace, .workspace-selector');
		if (await workspaceSelector.isVisible({ timeout: 2000 })) {
			await workspaceSelector.selectOption({ index: 0 });
		}

		// Create terminal session
		await page.click('button:has-text("Create"), button:has-text("Start Terminal")');
		await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

		// Wait for terminal pane to appear
		await expect(page.locator('.terminal-pane, .xterm-container')).toBeVisible({ timeout: 10000 });

		// Wait a moment for terminal to initialize
		await page.waitForTimeout(1000);

		// Try to type in the terminal
		await page.keyboard.type('echo "Hello Terminal"');
		await page.keyboard.press('Enter');

		// Wait for command to process
		await page.waitForTimeout(500);

		// Verify terminal is responsive
		const terminalElement = page.locator('.terminal-pane, .xterm-container');
		await expect(terminalElement).toBeVisible();
	});
});
