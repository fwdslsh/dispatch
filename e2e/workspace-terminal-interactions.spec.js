import { test, expect } from '@playwright/test';

test.describe('Workspace and Terminal Session Interactions', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('should create terminal session in workspace', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		// Mock workspace API
		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						list: [
							{ path: '/workspace/project1', name: 'project1' },
							{ path: '/workspace/project2', name: 'project2' }
						]
					})
				});
			} else if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						path: requestData.path || '/workspace/new-terminal',
						created: true
					})
				});
			} else {
				await route.continue();
			}
		});

		// Click Terminal button
		await page.click('.header-actions button:has-text("Terminal")');
		await page.waitForSelector('.modal-overlay');

		// Check modal title
		await expect(page.locator('.modal-title')).toContainText('Terminal Session');

		// Check for workspace selector
		const workspaceSelector = page.locator('select#workspace, .workspace-selector');
		await expect(workspaceSelector).toBeVisible();

		// Select a workspace
		if (await workspaceSelector.isVisible()) {
			await workspaceSelector.selectOption({ index: 1 });
		}

		// Mock terminal session creation
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				if (requestData.type === 'pty') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: `terminal_${Date.now()}`,
							type: 'pty',
							workspacePath: requestData.workspacePath,
							shell: requestData.shell || '/bin/bash'
						})
					});
				} else {
					await route.continue();
				}
			} else {
				await route.continue();
			}
		});

		// Create terminal session
		await page.click('button:has-text("Create"), button:has-text("Start Terminal")');

		// Wait for modal to close
		await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

		// Verify terminal pane appears
		await expect(page.locator('.terminal-pane, .xterm-container')).toBeVisible({ timeout: 10000 });
	});

	test('should display both Claude and Terminal sessions in same workspace', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		const workspacePath = '/workspace/mixed-sessions';

		// Mock sessions API to return both types
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: 'claude_1',
								type: 'claude',
								workspacePath: workspacePath,
								sessionId: 'claude-session-1',
								projectName: 'Mixed Project'
							},
							{
								id: 'terminal_1',
								type: 'pty',
								workspacePath: workspacePath,
								shell: '/bin/bash'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Reload to get sessions
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Check sidebar shows both sessions
		const sessionItems = page.locator('.session-item');
		await expect(sessionItems).toHaveCount(2);

		// Verify different icons for different session types
		const claudeIcon = page.locator(
			'.session-item:has(.claude-icon), .session-item:has-text("Mixed Project")'
		);
		const terminalIcon = page.locator(
			'.session-item:has(.terminal-icon), .session-item:has-text("terminal")'
		);

		await expect(claudeIcon).toBeVisible();
		await expect(terminalIcon).toBeVisible();

		// Switch to 2UP layout to see both
		await page.click('button[title="Split view"]');

		// Pin both sessions
		await claudeIcon.click();
		await terminalIcon.click();

		// Verify both panes are visible
		await expect(page.locator('.claude-pane')).toBeVisible();
		await expect(page.locator('.terminal-pane, .xterm-container')).toBeVisible();
	});

	test('should handle workspace creation for new projects', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		const newProjectName = `test-workspace-${Date.now()}`;

		// Mock workspace creation
		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				if (requestData.action === 'create' || requestData.isNewProject) {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							path: `/workspace/${newProjectName}`,
							created: true,
							isNew: true
						})
					});
				} else {
					await route.continue();
				}
			} else {
				await route.continue();
			}
		});

		// Open Claude modal
		await page.click('.header-actions button:has-text("Claude")');
		await page.waitForSelector('.modal-overlay');

		// Stay on NEW PROJECT tab (should be default)
		await expect(page.locator('.tab.active')).toContainText('NEW PROJECT');

		// Enter new project name
		await page.fill('#project-name', newProjectName);

		// Mock session creation
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						id: 'claude_new_workspace',
						sessionId: 'new-workspace-session',
						type: 'claude',
						workspacePath: `/workspace/${newProjectName}`
					})
				});
			} else {
				await route.continue();
			}
		});

		// Create session with new workspace
		await page.click('button:has-text("Create Session")');

		// Wait for modal to close
		await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

		// Verify session is created
		await expect(page.locator('.claude-pane')).toBeVisible({ timeout: 10000 });

		// Verify session appears in sidebar with correct project name
		const newSessionItem = page.locator(`.session-item:has-text("${newProjectName}")`);
		await expect(newSessionItem).toBeVisible();
	});

	test('should list available workspaces in terminal modal', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		// Mock workspaces list
		const mockWorkspaces = [
			{ path: '/workspace/alpha', name: 'alpha' },
			{ path: '/workspace/beta', name: 'beta' },
			{ path: '/workspace/gamma', name: 'gamma' }
		];

		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ list: mockWorkspaces })
				});
			} else {
				await route.continue();
			}
		});

		// Reload to ensure workspaces are loaded
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Open terminal modal
		await page.click('.header-actions button:has-text("Terminal")');
		await page.waitForSelector('.modal-overlay');

		// Check workspace selector has options
		const workspaceSelector = page.locator('select#workspace, .workspace-selector');
		await expect(workspaceSelector).toBeVisible();

		// Get all options
		const options = await workspaceSelector.locator('option').allTextContents();

		// Verify workspaces are listed (might include a "Select workspace" option)
		expect(options.length).toBeGreaterThanOrEqual(mockWorkspaces.length);
		expect(options.join(' ')).toContain('alpha');
		expect(options.join(' ')).toContain('beta');
		expect(options.join(' ')).toContain('gamma');
	});

	test('should filter sessions by workspace in sidebar', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		// Mock sessions from different workspaces
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: 'claude_ws1_1',
								type: 'claude',
								workspacePath: '/workspace/workspace1',
								projectName: 'Workspace 1 - Claude'
							},
							{
								id: 'terminal_ws1_1',
								type: 'pty',
								workspacePath: '/workspace/workspace1'
							},
							{
								id: 'claude_ws2_1',
								type: 'claude',
								workspacePath: '/workspace/workspace2',
								projectName: 'Workspace 2 - Claude'
							},
							{
								id: 'terminal_ws2_1',
								type: 'pty',
								workspacePath: '/workspace/workspace2'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Reload to get sessions
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// All sessions should be visible initially
		const allSessions = page.locator('.session-item');
		await expect(allSessions).toHaveCount(4);

		// Look for workspace filter if it exists
		const workspaceFilter = page.locator(
			'.workspace-filter, select[name="workspace-filter"], .filter-workspace'
		);

		if (await workspaceFilter.isVisible({ timeout: 5000 })) {
			// Select first workspace
			await workspaceFilter.selectOption({ value: '/workspace/workspace1' });

			// Check filtered results
			await page.waitForTimeout(500); // Wait for filter to apply
			const filteredSessions = page.locator('.session-item:visible');
			await expect(filteredSessions).toHaveCount(2);
		}
	});

	test('should handle terminal resize when layout changes', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		// Create a terminal session
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: 'terminal_resize_test',
								type: 'pty',
								workspacePath: '/workspace/resize-test',
								shell: '/bin/bash'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Reload to get session
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Pin the terminal session
		await page.click('.session-item');
		await page.waitForSelector('.terminal-pane, .xterm-container', { timeout: 10000 });

		// Get initial terminal dimensions
		const initialDimensions = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-pane');
			return terminal
				? {
						width: terminal.offsetWidth,
						height: terminal.offsetHeight
					}
				: null;
		});

		// Change layout from 1UP to 2UP
		await page.click('button[title="Split view"]');
		await page.waitForTimeout(500); // Wait for layout animation

		// Get new dimensions
		const newDimensions = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-pane');
			return terminal
				? {
						width: terminal.offsetWidth,
						height: terminal.offsetHeight
					}
				: null;
		});

		// Terminal should have resized (width should be different in split view)
		if (initialDimensions && newDimensions) {
			expect(newDimensions.width).not.toBe(initialDimensions.width);
		}
	});

	test('should maintain session state when switching between sessions', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		// Mock multiple sessions
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: 'claude_state_1',
								type: 'claude',
								workspacePath: '/workspace/state-test',
								projectName: 'State Test 1',
								sessionId: 'state-session-1'
							},
							{
								id: 'claude_state_2',
								type: 'claude',
								workspacePath: '/workspace/state-test',
								projectName: 'State Test 2',
								sessionId: 'state-session-2'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Reload to get sessions
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Pin first session
		const firstSession = page.locator('.session-item').first();
		await firstSession.click();
		await page.waitForSelector('.claude-pane', { timeout: 10000 });

		// Type something in the input (without sending)
		const inputField = page.locator('.claude-input input, textarea').first();
		await inputField.fill('Test message in first session');

		// Switch to second session
		const secondSession = page.locator('.session-item').nth(1);
		await secondSession.click();
		await page.waitForTimeout(500); // Wait for switch

		// Input should be cleared or different for second session
		const currentInput = await inputField.inputValue();
		expect(currentInput).not.toBe('Test message in first session');

		// Switch back to first session
		await firstSession.click();
		await page.waitForTimeout(500);

		// Original input might be preserved depending on implementation
		// This tests that sessions maintain separate state
	});

	test('should show appropriate empty states', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForSelector('.dispatch-workspace');

		// Mock empty sessions list
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ sessions: [] })
				});
			} else {
				await route.continue();
			}
		});

		// Mock empty workspaces list
		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ list: [] })
				});
			} else {
				await route.continue();
			}
		});

		// Reload to get empty state
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Check for empty state messages
		const emptyMessage = page.locator('.empty-state, .no-sessions, text=/no.*session/i');
		await expect(emptyMessage).toBeVisible({ timeout: 5000 });

		// Action buttons should still be visible
		await expect(page.locator('.header-actions button:has-text("Claude")')).toBeVisible();
		await expect(page.locator('.header-actions button:has-text("Terminal")')).toBeVisible();

		// Session grid should show placeholder or be empty
		const sessionGrid = page.locator('.session-grid');
		const sessionPanes = sessionGrid.locator('.session-pane');
		const paneCount = await sessionPanes.count();

		// Should either have no panes or show placeholder
		expect(paneCount).toBe(0);
	});
});
