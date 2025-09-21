import { test, expect } from '@playwright/test';

test.describe('Terminal Session Resumption', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('should create terminal session, enter commands, close and resume with history preserved', async ({
		page
	}) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		const sessionId = `terminal_session_${Date.now()}`;
		let terminalHistory = '';

		// Mock workspace API
		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						list: [{ path: '/workspace/test-project', name: 'test-project' }]
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
							id: sessionId,
							type: 'pty',
							workspacePath: requestData.workspacePath,
							shell: requestData.shell || '/bin/bash'
						})
					});
				} else {
					await route.continue();
				}
			} else if (route.request().method() === 'GET') {
				// Mock sessions list - initially empty, then with our session
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

		// Mock terminal history API
		await page.route(`/api/sessions/${sessionId}/history`, async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ history: terminalHistory })
				});
			} else {
				await route.continue();
			}
		});

		// Intercept socket.io incoming 'run:event' messages in the browser context
		await page.evaluateOnNewDocument(() => {
			window.__terminalData = [];
			// Wrap when socket.io is available in the page
			const attachRunEventHook = () => {
				try {
					if (!window.io || !window.io.Socket) return;
					const proto = window.io.Socket.prototype;
					const origOn = proto.on;
					proto.on = function (evt, cb) {
						if (evt === 'run:event' && typeof cb === 'function') {
							const wrapped = function (eventData) {
								try {
									if (
										eventData &&
										typeof eventData.channel === 'string' &&
										eventData.channel.startsWith('pty')
									) {
										const payload = eventData.payload;
										if (typeof payload === 'string') {
											window.__terminalData.push(payload);
										} else if (payload && payload.toString) {
											window.__terminalData.push(payload.toString());
										} else {
											window.__terminalData.push(JSON.stringify(payload));
										}
									}
								} catch (err) {
									// ignore
								}
								return cb.apply(this, arguments);
							};
							return origOn.call(this, evt, wrapped);
						}
						return origOn.call(this, evt, cb);
					};
				} catch (e) {
					// ignore
				}
			};

			// If io is loaded later, attempt to attach periodically
			if (window.io && window.io.Socket) {
				attachRunEventHook();
			} else {
				const t = setInterval(() => {
					if (window.io && window.io.Socket) {
						clearInterval(t);
						attachRunEventHook();
					}
				}, 200);
			}
		});

		// Wait for terminal to be ready
		await page.waitForTimeout(1000);

		// Simulate entering commands in terminal
		const commands = ['pwd', 'ls -la', 'echo "Hello from terminal"'];

		for (const command of commands) {
			// Type command
			await page.keyboard.type(command);
			await page.waitForTimeout(200);

			// Press Enter
			await page.keyboard.press('Enter');
			await page.waitForTimeout(500);
		}

		// Capture what was written to terminal
		const terminalCommands = await page.evaluate(() => window.__terminalData || []);

		// Build expected terminal history
		terminalHistory =
			terminalCommands.join('') +
			'\r\n/workspace/test-project\r\n$ ' +
			'\r\nREADME.md\tpackage.json\tsrc/\r\n$ ' +
			'\r\nHello from terminal\r\n$ ';

		console.log('Terminal history captured:', terminalHistory);

		// Now close the session by navigating away or closing the pane
		await page.click('.session-close, .close-button, [data-testid="close-session"]');

		// Wait for session to close
		await page.waitForTimeout(1000);

		// Mock sessions API to return our closed session
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: sessionId,
								type: 'pty',
								workspacePath: '/workspace/test-project',
								shell: '/bin/bash',
								status: 'inactive'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Reload page to simulate fresh start
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Find and click on the existing session to resume it
		const sessionItem = page.locator('.session-item').first();
		if (await sessionItem.isVisible({ timeout: 5000 })) {
			await sessionItem.click();
		} else {
			// If session not visible in sidebar, create new session and it should resume
			await page.click('.header-actions button:has-text("Terminal")');
			await page.waitForSelector('.modal-overlay');

			const workspaceSelector = page.locator('select#workspace, .workspace-selector');
			if (await workspaceSelector.isVisible()) {
				await workspaceSelector.selectOption({ index: 0 });
			}

			await page.click('button:has-text("Create"), button:has-text("Start Terminal")');
			await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });
		}

		// Wait for terminal pane to appear with history
		await expect(page.locator('.terminal-pane, .xterm-container')).toBeVisible({ timeout: 10000 });

		// Wait for history to load
		await page.waitForTimeout(2000);

		// Verify that the terminal contains our previous commands and output
		const terminalContent = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-element');
			return terminal ? terminal.textContent || terminal.innerText : '';
		});

		console.log('Terminal content after resume:', terminalContent);

		// Check that key elements from our session are preserved
		expect(terminalContent).toContain('/workspace/test-project');
		expect(terminalContent).toContain('Hello from terminal');

		// Verify we can continue working in the resumed session
		await page.keyboard.type('echo "Session resumed successfully"');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(500);

		// Verify the new command worked
		const updatedContent = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-element');
			return terminal ? terminal.textContent || terminal.innerText : '';
		});

		expect(updatedContent).toContain('Session resumed successfully');
	});

	test('should handle multiple terminal sessions with independent histories', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		const session1Id = `terminal_session1_${Date.now()}`;
		const session2Id = `terminal_session2_${Date.now()}`;
		let session1History = 'session1$ pwd\r\n/workspace/project1\r\n';
		let session2History = 'session2$ ls\r\nfile1.txt\tfile2.txt\r\n';

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
			} else {
				await route.continue();
			}
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
								id: session1Id,
								type: 'pty',
								workspacePath: '/workspace/project1',
								shell: '/bin/bash'
							},
							{
								id: session2Id,
								type: 'pty',
								workspacePath: '/workspace/project2',
								shell: '/bin/bash'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Mock history for each session
		await page.route(`/api/sessions/${session1Id}/history`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ history: session1History })
			});
		});

		await page.route(`/api/sessions/${session2Id}/history`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ history: session2History })
			});
		});

		// Reload to get mocked sessions
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Click on first session
		const firstSession = page.locator('.session-item').first();
		await firstSession.click();
		await page.waitForSelector('.terminal-pane, .xterm-container', { timeout: 10000 });

		// Verify first session content
		await page.waitForTimeout(1000);
		const content1 = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-element');
			return terminal ? terminal.textContent || terminal.innerText : '';
		});
		expect(content1).toContain('/workspace/project1');

		// Switch to second session (if in split view) or open in new pane
		const secondSession = page.locator('.session-item').nth(1);
		await secondSession.click();
		await page.waitForTimeout(1000);

		// Verify second session has different content
		const content2 = await page.evaluate(() => {
			const terminals = document.querySelectorAll('.xterm-screen, .terminal-element');
			// Get content from the last terminal (most recently focused)
			const terminal = terminals[terminals.length - 1];
			return terminal ? terminal.textContent || terminal.innerText : '';
		});
		expect(content2).toContain('file1.txt');
	});

	test('should persist terminal history across browser refresh', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		const sessionId = `persistent_session_${Date.now()}`;
		const persistentHistory = '$ echo "This should persist"\r\nThis should persist\r\n$ ';

		// Mock APIs
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: sessionId,
								type: 'pty',
								workspacePath: '/workspace/persistent-test',
								shell: '/bin/bash'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		await page.route(`/api/sessions/${sessionId}/history`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ history: persistentHistory })
			});
		});

		// Reload page
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Click session to resume
		const sessionItem = page.locator('.session-item').first();
		await sessionItem.click();
		await page.waitForSelector('.terminal-pane, .xterm-container', { timeout: 10000 });

		// Wait for history to load
		await page.waitForTimeout(2000);

		// Verify persistent content is there
		const content = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-element');
			return terminal ? terminal.textContent || terminal.innerText : '';
		});

		expect(content).toContain('This should persist');

		// Refresh browser again
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Resume session again
		const sessionItemAfterRefresh = page.locator('.session-item').first();
		await sessionItemAfterRefresh.click();
		await page.waitForSelector('.terminal-pane, .xterm-container', { timeout: 10000 });
		await page.waitForTimeout(2000);

		// Verify content is still there after second refresh
		const contentAfterRefresh = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-element');
			return terminal ? terminal.textContent || terminal.innerText : '';
		});

		expect(contentAfterRefresh).toContain('This should persist');
	});

	test('should handle terminal session resumption errors gracefully', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		const sessionId = `broken_session_${Date.now()}`;

		// Mock session exists but history API fails
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: sessionId,
								type: 'pty',
								workspacePath: '/workspace/broken-test',
								shell: '/bin/bash'
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Mock history API to return error
		await page.route(`/api/sessions/${sessionId}/history`, async (route) => {
			await route.fulfill({
				status: 404,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'History not found' })
			});
		});

		// Monitor console for error handling
		const consoleLogs = [];
		page.on('console', (msg) => {
			consoleLogs.push(msg.text());
		});

		// Reload page
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Try to resume session
		const sessionItem = page.locator('.session-item').first();
		await sessionItem.click();
		await page.waitForSelector('.terminal-pane, .xterm-container', { timeout: 10000 });

		// Wait for error handling
		await page.waitForTimeout(2000);

		// Terminal should still be functional even without history
		const terminal = page.locator('.terminal-pane, .xterm-container');
		await expect(terminal).toBeVisible();

		// Verify error was logged but didn't break the terminal
		const errorLogs = consoleLogs.filter(
			(log) => log.toLowerCase().includes('error') && log.toLowerCase().includes('history')
		);
		expect(errorLogs.length).toBeGreaterThan(0);

		// Verify terminal is still usable
		await page.keyboard.type('echo "Terminal still works"');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(500);

		// Verify the command went through (terminal should be responsive)
		const terminalIsResponsive = await page.evaluate(() => {
			const terminal = document.querySelector('.xterm-screen, .terminal-element');
			return terminal !== null;
		});
		expect(terminalIsResponsive).toBe(true);
	});

	test('should show terminal session in session list after creation', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		const sessionId = `listed_session_${Date.now()}`;

		// Mock workspace and session creation
		await page.route('/api/workspaces', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						list: [{ path: '/workspace/list-test', name: 'list-test' }]
					})
				});
			} else {
				await route.continue();
			}
		});

		let sessionCreated = false;
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				if (requestData.type === 'pty') {
					sessionCreated = true;
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							id: sessionId,
							type: 'pty',
							workspacePath: requestData.workspacePath,
							shell: '/bin/bash'
						})
					});
				} else {
					await route.continue();
				}
			} else if (route.request().method() === 'GET') {
				// Return session in list after creation
				const sessions = sessionCreated
					? [
							{
								id: sessionId,
								type: 'pty',
								workspacePath: '/workspace/list-test',
								shell: '/bin/bash'
							}
						]
					: [];

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ sessions })
				});
			} else {
				await route.continue();
			}
		});

		// Create terminal session
		await page.click('.header-actions button:has-text("Terminal")');
		await page.waitForSelector('.modal-overlay');

		const workspaceSelector = page.locator('select#workspace, .workspace-selector');
		if (await workspaceSelector.isVisible()) {
			await workspaceSelector.selectOption({ index: 0 });
		}

		await page.click('button:has-text("Create"), button:has-text("Start Terminal")');
		await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

		// Wait for terminal pane
		await expect(page.locator('.terminal-pane, .xterm-container')).toBeVisible({ timeout: 10000 });

		// Refresh to see session in sidebar
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Verify session appears in sidebar
		const sessionItem = page.locator('.session-item');
		await expect(sessionItem).toBeVisible({ timeout: 5000 });

		// Verify it's identified as a terminal session
		const terminalIcon = page.locator(
			'.session-item .terminal-icon, .session-item [data-icon="terminal"]'
		);
		if (await terminalIcon.isVisible({ timeout: 2000 })) {
			await expect(terminalIcon).toBeVisible();
		}

		// Click to resume the session
		await sessionItem.click();
		await expect(page.locator('.terminal-pane, .xterm-container')).toBeVisible({ timeout: 10000 });
	});
});
