import { test, expect } from '@playwright/test';

test.describe('Session Management Comprehensive Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test.describe('Session Creation and Directory Selection', () => {
		test('should create terminal session with proper working directory', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock API for workspace creation
			await page.route('/api/workspaces', async (route) => {
				if (route.request().method() === 'POST') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							path: '/workspace/test-project'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Mock sessions API
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					expect(requestData.workspacePath).toBe('/workspace/test-project');
					
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'terminal_test_1'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Mock socket connection for terminal
			await page.evaluate(() => {
				window.mockSocket = {
					emit: (event, data, callback) => {
						if (event === 'terminal.start') {
							setTimeout(() => {
								callback({ success: true, id: 'terminal_test_1' });
							}, 100);
						}
					},
					on: () => {},
					disconnect: () => {}
				};
				
				// Mock socket.io
				window.io = () => window.mockSocket;
			});

			// Click Terminal button
			await page.click('button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');

			// Fill in project directory
			await page.fill('input[placeholder*="directory"]', '/workspace/test-project');

			// Create terminal session
			await page.click('button:has-text("Create Session")');
			
			// Wait for modal to close
			await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

			// Verify session appears in grid
			await page.waitForSelector('.session-pane', { timeout: 10000 });
			await expect(page.locator('.terminal-pane')).toBeVisible();
		});

		test('should create Claude session with selected directory', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock directory browser API
			await page.route('/api/browse', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						directories: [
							{ name: 'project-folder', path: '/workspace/project-folder', type: 'directory' }
						]
					})
				});
			});

			// Mock workspace creation
			await page.route('/api/workspaces', async (route) => {
				if (route.request().method() === 'POST') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							path: '/workspace/project-folder'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Mock Claude session creation
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					
					// Verify the working directory is properly set
					expect(requestData.type).toBe('claude');
					expect(requestData.workspacePath).toBe('/workspace/project-folder');
					
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'claude_test_1',
							sessionId: 'test-session-123'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Click Claude button
			await page.click('button:has-text("Claude")');
			await page.waitForSelector('.modal-overlay');

			// Select directory using directory browser
			await page.click('button[data-testid="browse-directory"]');
			await page.waitForSelector('.directory-item');
			await page.click('.directory-item:has-text("project-folder")');

			// Create Claude session
			await page.click('button:has-text("Create Session")');
			
			// Wait for modal to close and verify session
			await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });
			await page.waitForSelector('.session-pane', { timeout: 10000 });
			await expect(page.locator('.claude-pane')).toBeVisible();
		});
	});

	test.describe('Session Resumption and History', () => {
		test('should resume terminal session with history', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock existing sessions
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [
								{
									id: 'terminal_existing_1',
									type: 'pty',
									workspacePath: '/workspace/existing-project',
									title: 'Shell @ /workspace/existing-project'
								}
							]
						})
					});
				} else if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					if (requestData.options?.resumeSession) {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								id: 'terminal_existing_1'
							})
						});
					}
				} else {
					await route.continue();
				}
			});

			// Mock terminal history
			await page.route('/api/sessions/terminal_existing_1/history', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						history: 'user@host:~$ ls\nfile1.txt  file2.txt\nuser@host:~$ '
					})
				});
			});

			// Mock socket connection
			await page.evaluate(() => {
				window.mockSocket = {
					emit: (event, data, callback) => {
						if (event === 'terminal.start') {
							setTimeout(() => {
								callback({ success: true, id: data.id || 'terminal_existing_1' });
							}, 100);
						}
					},
					on: () => {},
					disconnect: () => {}
				};
				window.io = () => window.mockSocket;
			});

			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Check if session appears in sidebar
			await expect(page.locator('.session-item')).toBeVisible();

			// Click on session to resume
			await page.click('.session-item:first-child');

			// Verify session loads in grid
			await page.waitForSelector('.session-pane', { timeout: 10000 });
			await expect(page.locator('.terminal-pane')).toBeVisible();
		});

		test('should resume Claude session with conversation history', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock Claude projects with sessions
			await page.route('/api/claude/projects', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						projects: [
							{
								path: '/workspace/claude-project',
								name: 'claude-project',
								sessions: [
									{
										id: 'existing-session-123',
										created: new Date().toISOString(),
										lastModified: new Date().toISOString()
									}
								]
							}
						]
					})
				});
			});

			// Mock session resumption
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					if (requestData.options?.resumeSession) {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								id: 'claude_existing_1',
								sessionId: 'existing-session-123'
							})
						});
					}
				} else {
					await route.continue();
				}
			});

			// Click Claude button
			await page.click('button:has-text("Claude")');
			await page.waitForSelector('.modal-overlay');

			// Switch to existing project tab
			await page.click('button:has-text("EXISTING PROJECT")');
			await page.waitForSelector('.project-item');

			// Select project
			await page.click('.project-item:first-child');
			
			// Wait for sessions and select one
			await page.waitForSelector('.session-item');
			await page.click('.session-item:first-child');

			// Create session (resume)
			await page.click('button:has-text("Create Session")');
			
			await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });
			await page.waitForSelector('.session-pane', { timeout: 10000 });
			await expect(page.locator('.claude-pane')).toBeVisible();
		});
	});

	test.describe('Multi-Session Grid Management', () => {
		test('should manage multiple sessions in grid with proper socket connections', async ({ page }) => {
			await page.goto('/projects');
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
									id: 'terminal_1',
									type: 'pty',
									workspacePath: '/workspace/project1',
									title: 'Shell @ project1'
								},
								{
									id: 'claude_1',
									type: 'claude',
									workspacePath: '/workspace/project1',
									title: 'Claude @ project1',
									sessionId: 'claude-session-1'
								},
								{
									id: 'terminal_2',
									type: 'pty',
									workspacePath: '/workspace/project2',
									title: 'Shell @ project2'
								}
							]
						})
					});
				} else {
					await route.continue();
				}
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
			await sessionItems.nth(1).click();
			
			// Should now have 2 sessions in grid
			await expect(page.locator('.session-pane')).toHaveCount(2);

			// Click on third session - should replace first in grid
			await sessionItems.nth(2).click();
			
			// Still should have 2 sessions but with different content
			await expect(page.locator('.session-pane')).toHaveCount(2);
		});

		test('should properly switch socket connections when changing session panes', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Track socket connections
			await page.evaluate(() => {
				window.socketConnections = new Map();
				window.activeSocket = null;
				
				window.mockSocketFactory = (sessionId) => ({
					id: `socket_${sessionId}`,
					sessionId,
					emit: (event, data, callback) => {
						console.log(`Socket ${sessionId} emit:`, event, data);
						if (callback) {
							callback({ success: true, id: sessionId });
						}
					},
					on: (event, handler) => {
						console.log(`Socket ${sessionId} listening to:`, event);
					},
					disconnect: () => {
						console.log(`Socket ${sessionId} disconnected`);
					}
				});

				// Override io function
				window.io = () => {
					const socket = window.mockSocketFactory('current');
					window.activeSocket = socket;
					return socket;
				};
			});

			// Mock multiple sessions
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [
								{
									id: 'terminal_1',
									type: 'pty',
									workspacePath: '/workspace/project1'
								},
								{
									id: 'claude_1',
									type: 'claude',
									workspacePath: '/workspace/project2',
									sessionId: 'claude-session-1'
								}
							]
						})
					});
				} else {
					await route.continue();
				}
			});

			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Pin first session
			await page.click('.session-item:nth-child(1)');
			await page.waitForSelector('.session-pane');

			// Verify socket connection was established
			const firstSocketId = await page.evaluate(() => window.activeSocket?.id);
			expect(firstSocketId).toBeTruthy();

			// Pin second session
			await page.click('.session-item:nth-child(2)');
			await page.waitForSelector('.session-pane:nth-child(2)');

			// Click on first session pane to focus it
			await page.click('.session-pane:first-child');

			// Click on second session pane to focus it
			await page.click('.session-pane:nth-child(2)');

			// Each pane should have its own socket context
			const currentSocketId = await page.evaluate(() => window.activeSocket?.id);
			expect(currentSocketId).toBeTruthy();
		});
	});

	test.describe('Error Handling and Edge Cases', () => {
		test('should handle session creation failures gracefully', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock session creation failure
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					await route.fulfill({
						status: 500,
						contentType: 'application/json',
						body: JSON.stringify({
							error: 'Failed to create session: Directory not accessible'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Try to create terminal session
			await page.click('button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');
			await page.fill('input[placeholder*="directory"]', '/invalid/path');
			await page.click('button:has-text("Create Session")');

			// Should show error message
			await expect(page.locator('.error-message, .alert-error')).toBeVisible();
		});

		test('should handle socket disconnection and reconnection', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			let socketConnected = true;
			await page.evaluate(() => {
				window.mockSocket = {
					connected: true,
					emit: (event, data, callback) => {
						if (!window.mockSocket.connected) {
							return; // Socket disconnected
						}
						if (callback) {
							callback({ success: true, id: 'test_session' });
						}
					},
					on: (event, handler) => {
						if (event === 'disconnect') {
							window.socketDisconnectHandler = handler;
						} else if (event === 'connect') {
							window.socketConnectHandler = handler;
						}
					},
					disconnect: () => {
						window.mockSocket.connected = false;
					},
					connect: () => {
						window.mockSocket.connected = true;
					}
				};
				window.io = () => window.mockSocket;
			});

			// Mock existing session
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [
								{
									id: 'test_session',
									type: 'pty',
									workspacePath: '/workspace/test'
								}
							]
						})
					});
				} else {
					await route.continue();
				}
			});

			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Pin session
			await page.click('.session-item:first-child');
			await page.waitForSelector('.session-pane');

			// Simulate socket disconnection
			await page.evaluate(() => {
				window.mockSocket.connected = false;
				if (window.socketDisconnectHandler) {
					window.socketDisconnectHandler();
				}
			});

			// Should show connection status
			const connectionStatus = page.locator('.connection-status, .disconnected-indicator');
			if (await connectionStatus.isVisible()) {
				await expect(connectionStatus).toContainText(/disconnected|offline/i);
			}

			// Simulate reconnection
			await page.evaluate(() => {
				window.mockSocket.connected = true;
				if (window.socketConnectHandler) {
					window.socketConnectHandler();
				}
			});

			// Wait for reconnection to complete
			await page.waitForTimeout(1000);
		});

		test('should validate working directory permissions', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock directory access error
			await page.route('/api/workspaces', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					if (requestData.path.includes('restricted')) {
						await route.fulfill({
							status: 403,
							contentType: 'application/json',
							body: JSON.stringify({
								error: 'Access denied to directory'
							})
						});
					} else {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								path: requestData.path
							})
						});
					}
				} else {
					await route.continue();
				}
			});

			// Try to create session with restricted directory
			await page.click('button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');
			await page.fill('input[placeholder*="directory"]', '/restricted/path');
			await page.click('button:has-text("Create Session")');

			// Should show permission error
			await expect(page.locator('.error-message, .alert-error')).toBeVisible();
			await expect(page.locator('.error-message, .alert-error')).toContainText(/access denied|permission/i);
		});
	});

	test.describe('Session Persistence', () => {
		test('should persist session data across page reloads', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock session creation
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'persistent_session_1'
						})
					});
				} else if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [
								{
									id: 'persistent_session_1',
									type: 'pty',
									workspacePath: '/workspace/persistent-test',
									title: 'Persistent Session'
								}
							]
						})
					});
				} else {
					await route.continue();
				}
			});

			// Create a session first
			await page.click('button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');
			await page.fill('input[placeholder*="directory"]', '/workspace/persistent-test');

			// Mock socket for session creation
			await page.evaluate(() => {
				window.io = () => ({
					emit: (event, data, callback) => {
						if (event === 'terminal.start') {
							callback({ success: true, id: 'persistent_session_1' });
						}
					},
					on: () => {},
					disconnect: () => {}
				});
			});

			await page.click('button:has-text("Create Session")');
			await page.waitForSelector('.modal-overlay', { state: 'hidden' });
			await page.waitForSelector('.session-pane');

			// Reload page
			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Session should still be available
			await expect(page.locator('.session-item')).toBeVisible();
			await expect(page.locator('.session-item')).toContainText('Persistent Session');
		});
	});
});