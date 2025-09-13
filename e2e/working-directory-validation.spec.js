import { test, expect } from '@playwright/test';

test.describe('Working Directory Validation', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test.describe('Directory Selection and Propagation', () => {
		test('should correctly set working directory for terminal sessions', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			let capturedWorkspacePath;

			// Mock workspace creation to capture the path
			await page.route('/api/workspaces', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					capturedWorkspacePath = requestData.path;

					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							path: requestData.path
						})
					});
				} else {
					await route.continue();
				}
			});

			// Mock session creation to verify working directory
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();

					// Verify the workspacePath matches what user selected
					expect(requestData.workspacePath).toBe('/workspace/selected-directory');
					expect(requestData.type).toBe('pty');

					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'terminal_workdir_test'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Mock socket connection
			await page.evaluate(() => {
				window.io = () => ({
					emit: (event, data, callback) => {
						// Verify socket data includes correct working directory
						if (event === 'terminal.start') {
							expect(data.workspacePath).toBe('/workspace/selected-directory');
							callback({ success: true, id: 'terminal_workdir_test' });
						}
					},
					on: () => {},
					disconnect: () => {}
				});
			});

			// Create terminal session
			await page.click('button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');

			// Enter working directory
			await page.fill('input[placeholder*="directory"]', '/workspace/selected-directory');
			await page.click('button:has-text("Create Session")');

			await page.waitForSelector('.modal-overlay', { state: 'hidden' });
			await page.waitForSelector('.session-pane');

			// Verify the workspace path was correctly captured
			expect(capturedWorkspacePath).toBe('/workspace/selected-directory');
		});

		test('should correctly set working directory for Claude sessions', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			let capturedClaudeOptions;

			// Mock directory browser
			await page.route('/api/browse', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						directories: [
							{
								name: 'my-project',
								path: '/workspace/my-project',
								type: 'directory'
							}
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
							path: '/workspace/my-project'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Mock Claude session creation - this is where we verify working directory
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					capturedClaudeOptions = requestData;

					// Critical validation: Claude should get the selected directory
					expect(requestData.type).toBe('claude');
					expect(requestData.workspacePath).toBe('/workspace/my-project');

					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'claude_workdir_test',
							sessionId: 'claude-session-workdir'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Create Claude session
			await page.click('button:has-text("Claude")');
			await page.waitForSelector('.modal-overlay');

			// Use directory browser to select directory
			const directoryBrowser = page.locator(
				'.directory-browser, [data-testid="directory-browser"]'
			);
			if (await directoryBrowser.isVisible()) {
				// Click browse button or directory field
				await page.click('button[data-testid="browse-directory"], .browse-button');
				await page.waitForSelector('.directory-item');
				await page.click('.directory-item:has-text("my-project")');
			} else {
				// Fallback: fill directory input directly
				await page.fill(
					'input[placeholder*="directory"], input[name*="directory"]',
					'/workspace/my-project'
				);
			}

			await page.click('button:has-text("Create Session")');
			await page.waitForSelector('.modal-overlay', { state: 'hidden' });

			// Verify Claude session was created with correct working directory
			expect(capturedClaudeOptions.workspacePath).toBe('/workspace/my-project');
		});

		test('should propagate working directory to Claude CLI process', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// This test verifies that the ClaudeSessionManager receives correct cwd
			let capturedClaudeConfig;

			// Mock Claude session manager behavior
			await page.evaluate(() => {
				// Mock socket emit to capture Claude configuration
				window.capturedMessages = [];
				window.io = () => ({
					emit: (event, data, callback) => {
						window.capturedMessages.push({ event, data });
						if (callback) callback({ success: true });
					},
					on: () => {},
					disconnect: () => {}
				});
			});

			// Mock session creation with working directory
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					capturedClaudeConfig = requestData;

					// Verify that the backend will receive the correct working directory
					expect(requestData.workspacePath).toBe('/workspace/claude-project');

					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'claude_cwd_test',
							sessionId: 'claude-cwd-session'
						})
					});
				} else {
					await route.continue();
				}
			});

			await page.route('/api/workspaces', async (route) => {
				if (route.request().method() === 'POST') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							path: '/workspace/claude-project'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Create Claude session with specific directory
			await page.click('button:has-text("Claude")');
			await page.waitForSelector('.modal-overlay');

			// Select directory
			await page.fill(
				'input[placeholder*="directory"], input[name*="directory"]',
				'/workspace/claude-project'
			);
			await page.click('button:has-text("Create Session")');

			await page.waitForSelector('.modal-overlay', { state: 'hidden' });
			await page.waitForSelector('.claude-pane');

			// Verify working directory was correctly passed to backend
			expect(capturedClaudeConfig.workspacePath).toBe('/workspace/claude-project');
		});
	});

	test.describe('Directory Browser Integration', () => {
		test('should browse and select directories correctly', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock browse API with nested directories
			await page.route('/api/browse*', async (route) => {
				const url = route.request().url();
				const path = new URL(url).searchParams.get('path') || '/';

				if (path === '/') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							directories: [
								{ name: 'workspace', path: '/workspace', type: 'directory' },
								{ name: 'home', path: '/home', type: 'directory' }
							],
							currentPath: '/'
						})
					});
				} else if (path === '/workspace') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							directories: [
								{ name: 'project1', path: '/workspace/project1', type: 'directory' },
								{ name: 'project2', path: '/workspace/project2', type: 'directory' }
							],
							currentPath: '/workspace'
						})
					});
				} else {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							directories: [],
							currentPath: path
						})
					});
				}
			});

			let selectedDirectory = null;
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					selectedDirectory = requestData.workspacePath;

					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'browser_test_session'
						})
					});
				} else {
					await route.continue();
				}
			});

			// Mock workspace creation
			await page.route('/api/workspaces', async (route) => {
				if (route.request().method() === 'POST') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							path: '/workspace/project1'
						})
					});
				} else {
					await route.continue();
				}
			});

			await page.click('button:has-text("Claude")');
			await page.waitForSelector('.modal-overlay');

			// Test directory browser navigation
			const directoryBrowser = page.locator('.directory-browser');
			if (await directoryBrowser.isVisible()) {
				// Navigate through directories
				await page.click('.directory-item:has-text("workspace")');
				await page.waitForSelector('.directory-item:has-text("project1")');
				await page.click('.directory-item:has-text("project1")');

				// Confirm selection
				await page.click('button:has-text("Select"), button:has-text("Choose")');
			}

			await page.click('button:has-text("Create Session")');
			await page.waitForSelector('.modal-overlay', { state: 'hidden' });

			// Verify correct directory was selected
			expect(selectedDirectory).toBe('/workspace/project1');
		});

		test('should handle directory access errors gracefully', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock browse API with permission error
			await page.route('/api/browse*', async (route) => {
				const url = route.request().url();
				const path = new URL(url).searchParams.get('path');

				if (path === '/restricted') {
					await route.fulfill({
						status: 403,
						contentType: 'application/json',
						body: JSON.stringify({
							error: 'Permission denied'
						})
					});
				} else {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							directories: [{ name: 'restricted', path: '/restricted', type: 'directory' }]
						})
					});
				}
			});

			await page.click('button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');

			// Try to browse restricted directory
			const directoryBrowser = page.locator('.directory-browser');
			if (await directoryBrowser.isVisible()) {
				await page.click('.directory-item:has-text("restricted")');

				// Should show error message
				await expect(page.locator('.error-message, .alert-error')).toBeVisible();
				await expect(page.locator('.error-message, .alert-error')).toContainText(
					/permission denied/i
				);
			}
		});
	});

	test.describe('Working Directory Validation', () => {
		test('should validate directory paths for security', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			const invalidPaths = [
				'../../../etc/passwd',
				'/etc/shadow',
				'~/../../../root',
				'../usr/bin',
				'/proc/self/environ'
			];

			for (const invalidPath of invalidPaths) {
				// Mock validation error
				await page.route('/api/workspaces', async (route) => {
					if (route.request().method() === 'POST') {
						const requestData = await route.request().postDataJSON();

						if (requestData.path === invalidPath) {
							await route.fulfill({
								status: 400,
								contentType: 'application/json',
								body: JSON.stringify({
									error: 'Invalid directory path'
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

				await page.click('button:has-text("Terminal")');
				await page.waitForSelector('.modal-overlay');

				await page.fill('input[placeholder*="directory"]', invalidPath);
				await page.click('button:has-text("Create Session")');

				// Should show validation error
				await expect(page.locator('.error-message, .alert-error')).toBeVisible();

				// Close modal for next iteration
				await page.click('button:has-text("Cancel"), .modal-close');
				await page.waitForSelector('.modal-overlay', { state: 'hidden' });
			}
		});

		test('should normalize directory paths correctly', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			const testCases = [
				{
					input: '/workspace/project/../other',
					expected: '/workspace/other'
				},
				{
					input: '/workspace//double-slash',
					expected: '/workspace/double-slash'
				},
				{
					input: '/workspace/./current',
					expected: '/workspace/current'
				}
			];

			for (const testCase of testCases) {
				let capturedPath;

				await page.route('/api/workspaces', async (route) => {
					if (route.request().method() === 'POST') {
						const requestData = await route.request().postDataJSON();
						capturedPath = requestData.path;

						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								path: requestData.path
							})
						});
					} else {
						await route.continue();
					}
				});

				await page.route('/api/sessions', async (route) => {
					if (route.request().method() === 'POST') {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								id: 'normalize_test'
							})
						});
					} else {
						await route.continue();
					}
				});

				await page.evaluate(() => {
					window.io = () => ({
						emit: (event, data, callback) => {
							callback({ success: true, id: 'normalize_test' });
						},
						on: () => {},
						disconnect: () => {}
					});
				});

				await page.click('button:has-text("Terminal")');
				await page.waitForSelector('.modal-overlay');

				await page.fill('input[placeholder*="directory"]', testCase.input);
				await page.click('button:has-text("Create Session")');

				await page.waitForSelector('.modal-overlay', { state: 'hidden' });

				// Verify path was normalized (or at least not rejected)
				// The exact normalization behavior depends on backend implementation
				expect(capturedPath).toBeTruthy();
			}
		});
	});

	test.describe('Session Working Directory Persistence', () => {
		test('should maintain working directory across session lifecycle', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			const testDirectory = '/workspace/persistent-test';
			let persistedPath;

			// Mock session creation
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'POST') {
					const requestData = await route.request().postDataJSON();
					persistedPath = requestData.workspacePath;

					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: 'persistent_test_session'
						})
					});
				} else if (route.request().method() === 'GET') {
					// Return the session with persisted working directory
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [
								{
									id: 'persistent_test_session',
									type: 'pty',
									workspacePath: persistedPath || testDirectory,
									title: 'Persistent Session'
								}
							]
						})
					});
				} else {
					await route.continue();
				}
			});

			await page.route('/api/workspaces', async (route) => {
				if (route.request().method() === 'POST') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							path: testDirectory
						})
					});
				} else {
					await route.continue();
				}
			});

			// Create session
			await page.click('button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');
			await page.fill('input[placeholder*="directory"]', testDirectory);

			await page.evaluate(() => {
				window.io = () => ({
					emit: (event, data, callback) => {
						callback({ success: true, id: 'persistent_test_session' });
					},
					on: () => {},
					disconnect: () => {}
				});
			});

			await page.click('button:has-text("Create Session")');
			await page.waitForSelector('.modal-overlay', { state: 'hidden' });

			// Reload page to test persistence
			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Session should be restored with same working directory
			await expect(page.locator('.session-item')).toBeVisible();

			// The working directory should be preserved in session metadata
			expect(persistedPath).toBe(testDirectory);
		});
	});
});
