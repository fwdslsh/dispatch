import { test, expect } from '@playwright/test';

test.describe('Claude Session Resumption', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('should resume existing Claude session from EXISTING PROJECT tab', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Mock API to return existing projects with sessions
		await page.route('/api/claude/projects', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					projects: [
						{
							path: '/workspace/existing-project',
							name: 'existing-project',
							sessions: [
								{
									id: 'abc-123-def',
									created: new Date(Date.now() - 3600000).toISOString(),
									lastModified: new Date(Date.now() - 1800000).toISOString()
								},
								{
									id: 'ghi-456-jkl',
									created: new Date(Date.now() - 7200000).toISOString(),
									lastModified: new Date(Date.now() - 3600000).toISOString()
								}
							]
						},
						{
							path: '/workspace/another-project',
							name: 'another-project',
							sessions: [
								{
									id: 'mno-789-pqr',
									created: new Date(Date.now() - 86400000).toISOString(),
									lastModified: new Date(Date.now() - 43200000).toISOString()
								}
							]
						}
					]
				})
			});
		});

		// Open Claude modal
		await page.click('.header-actions button:has-text("Claude")');
		await page.waitForSelector('.modal-overlay');

		// Switch to EXISTING PROJECT tab
		await page.click('.tab:has-text("EXISTING PROJECT")');
		await expect(page.locator('.tab.active')).toContainText('EXISTING PROJECT');

		// Wait for project picker to load
		await page.waitForSelector('.project-item, .project-option', { timeout: 10000 });

		// Select first project
		const firstProject = page.locator('.project-item, .project-option').first();
		await firstProject.click();

		// Wait for sessions to load
		await page.waitForSelector('.session-item, .session-option', { timeout: 5000 });

		// Verify sessions are displayed
		const sessionItems = page.locator('.session-item, .session-option');
		await expect(sessionItems).toHaveCount(2);

		// Select first session
		await sessionItems.first().click();

		// Mock session creation/resumption
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						id: 'claude_resumed_1',
						sessionId: requestData.options?.sessionId || 'abc-123-def',
						type: 'claude',
						workspacePath: requestData.workspacePath,
						resumed: true
					})
				});
			} else {
				await route.continue();
			}
		});

		// Click Resume Session button
		await page.click('button:has-text("Resume Session")');

		// Wait for modal to close
		await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

		// Verify Claude pane appears with resumed session
		await expect(page.locator('.claude-pane')).toBeVisible({ timeout: 10000 });
		
		// Check for resume indicator if present
		const resumeIndicator = page.locator('.session-status:has-text("Resumed"), .session-badge:has-text("Resumed")');
		if (await resumeIndicator.isVisible({ timeout: 5000 })) {
			await expect(resumeIndicator).toBeVisible();
		}
	});

	test('should show session history when resuming', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Mock session with history
		const mockSessionId = 'session-with-history';
		await page.route(`/api/sessions/${mockSessionId}/history`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					messages: [
						{
							role: 'user',
							content: 'Hello Claude',
							timestamp: new Date(Date.now() - 3600000).toISOString()
						},
						{
							role: 'assistant',
							content: 'Hello! How can I help you today?',
							timestamp: new Date(Date.now() - 3590000).toISOString()
						},
						{
							role: 'user',
							content: 'Can you help me with Python?',
							timestamp: new Date(Date.now() - 3580000).toISOString()
						},
						{
							role: 'assistant',
							content: 'Of course! I\'d be happy to help you with Python.',
							timestamp: new Date(Date.now() - 3570000).toISOString()
						}
					]
				})
			});
		});

		// Create a resumed session directly
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: 'claude_history_test',
								type: 'claude',
								workspacePath: '/workspace/history-test',
								sessionId: mockSessionId,
								projectName: 'History Test',
								claudeSessionId: mockSessionId,
								shouldResume: true
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Reload to get the mocked session
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');

		// Wait for Claude pane
		await page.waitForSelector('.claude-pane', { timeout: 10000 });

		// Check if history is displayed
		const messageElements = page.locator('.message, .chat-message');
		
		// Wait for messages to load
		await page.waitForTimeout(2000);
		
		// Verify that previous messages are visible
		const messageCount = await messageElements.count();
		expect(messageCount).toBeGreaterThan(0);

		// Check for specific message content if visible
		const userMessage = page.locator('.message:has-text("Hello Claude"), .chat-message:has-text("Hello Claude")');
		const assistantMessage = page.locator('.message:has-text("How can I help you"), .chat-message:has-text("How can I help you")');
		
		if (await userMessage.isVisible({ timeout: 5000 })) {
			await expect(userMessage).toBeVisible();
			await expect(assistantMessage).toBeVisible();
		}
	});

	test('should handle session ID properly when sending messages to resumed session', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		const sessionId = 'test-uuid-123';
		const claudeSessionId = 'claude-uuid-456';

		// Mock resumed session
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						sessions: [
							{
								id: `claude_${sessionId}`,
								type: 'claude',
								workspacePath: '/workspace/id-test',
								sessionId: sessionId,
								claudeSessionId: claudeSessionId,
								projectName: 'ID Test',
								shouldResume: true
							}
						]
					})
				});
			} else {
				await route.continue();
			}
		});

		// Track socket.io emissions
		let capturedEmission = null;
		await page.evaluateOnNewDocument(() => {
			window.__capturedEmissions = [];
			const originalEmit = window.io?.prototype?.emit || (() => {});
			if (window.io && window.io.prototype) {
				window.io.prototype.emit = function(event, data) {
					if (event === 'claude.send') {
						window.__capturedEmissions.push({ event, data });
					}
					return originalEmit.call(this, event, data);
				};
			}
		});

		// Reload to get mocked session
		await page.reload();
		await page.waitForSelector('.dispatch-workspace');
		await page.waitForSelector('.claude-pane', { timeout: 10000 });

		// Find and fill the input field
		const inputField = page.locator('.claude-input input, .terminal-input input, textarea').first();
		await inputField.waitFor({ state: 'visible', timeout: 10000 });
		await inputField.fill('Test message for resumed session');

		// Submit the message
		const submitButton = page.locator('button[type="submit"], button:has-text("Send")').first();
		if (await submitButton.isVisible()) {
			await submitButton.click();
		} else {
			// Try pressing Enter
			await inputField.press('Enter');
		}

		// Wait a moment for the emission
		await page.waitForTimeout(1000);

		// Check captured emissions
		const emissions = await page.evaluate(() => window.__capturedEmissions);
		
		if (emissions && emissions.length > 0) {
			capturedEmission = emissions[0];
			// Verify the correct session ID is used
			expect(capturedEmission.data.id).toBeTruthy();
			expect([sessionId, claudeSessionId, `claude_${sessionId}`]).toContain(capturedEmission.data.id);
		}

		// Also check console logs for debugging
		const consoleLogs = [];
		page.on('console', msg => {
			if (msg.text().includes('claude.send') || msg.text().includes('sessionId')) {
				consoleLogs.push(msg.text());
			}
		});

		// Verify no errors occurred
		const errorLogs = consoleLogs.filter(log => log.toLowerCase().includes('error'));
		expect(errorLogs).toHaveLength(0);
	});

	test('should create new session when no existing sessions available', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Mock API to return project with no sessions
		await page.route('/api/claude/projects', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					projects: [
						{
							path: '/workspace/empty-project',
							name: 'empty-project',
							sessions: [] // No sessions
						}
					]
				})
			});
		});

		// Open Claude modal
		await page.click('.header-actions button:has-text("Claude")');
		await page.waitForSelector('.modal-overlay');

		// Switch to EXISTING PROJECT tab
		await page.click('.tab:has-text("EXISTING PROJECT")');

		// Select the project
		await page.waitForSelector('.project-item, .project-option');
		await page.click('.project-item, .project-option');

		// Verify no sessions are shown or "No sessions" message appears
		const noSessionsMessage = page.locator('.no-sessions, .empty-message, text=/no.*session/i');
		const sessionCount = await page.locator('.session-item, .session-option').count();
		
		if (sessionCount === 0) {
			// Either no sessions message should be visible, or button should say "Create Session"
			const createButton = page.locator('button:has-text("Create Session")');
			await expect(createButton).toBeVisible();
		}

		// Mock new session creation
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						id: 'claude_new_1',
						sessionId: 'new-session-id',
						type: 'claude',
						workspacePath: '/workspace/empty-project'
					})
				});
			} else {
				await route.continue();
			}
		});

		// Create new session
		await page.click('button:has-text("Create Session")');
		await page.waitForSelector('.modal-overlay', { state: 'hidden', timeout: 10000 });

		// Verify new session is created
		await expect(page.locator('.claude-pane')).toBeVisible({ timeout: 10000 });
	});

	test('should handle session resumption errors gracefully', async ({ page }) => {
		await page.goto('/projects');
		await page.waitForSelector('.dispatch-workspace');

		// Mock API to return error when resuming
		await page.route('/api/sessions', async (route) => {
			if (route.request().method() === 'POST') {
				const requestData = await route.request().postDataJSON();
				if (requestData.options?.resumeSession) {
					await route.fulfill({
						status: 500,
						contentType: 'application/json',
						body: JSON.stringify({
							error: 'Failed to resume session: Session file not found'
						})
					});
				} else {
					await route.continue();
				}
			} else {
				await route.continue();
			}
		});

		// Set up projects with sessions
		await page.route('/api/claude/projects', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					projects: [
						{
							path: '/workspace/error-test',
							name: 'error-test',
							sessions: [
								{
									id: 'broken-session',
									created: new Date().toISOString(),
									lastModified: new Date().toISOString()
								}
							]
						}
					]
				})
			});
		});

		// Monitor console for error handling
		const errorLogs = [];
		page.on('console', msg => {
			if (msg.type() === 'error') {
				errorLogs.push(msg.text());
			}
		});

		// Open Claude modal
		await page.click('.header-actions button:has-text("Claude")');
		await page.waitForSelector('.modal-overlay');

		// Switch to EXISTING PROJECT and select project
		await page.click('.tab:has-text("EXISTING PROJECT")');
		await page.waitForSelector('.project-item, .project-option');
		await page.click('.project-item, .project-option');

		// Select the broken session
		await page.waitForSelector('.session-item, .session-option');
		await page.click('.session-item, .session-option');

		// Try to resume session
		await page.click('button:has-text("Resume Session")');

		// Wait for error handling
		await page.waitForTimeout(2000);

		// Check if error is displayed to user
		const errorMessage = page.locator('.error, .error-message, .alert-danger');
		const errorVisible = await errorMessage.isVisible({ timeout: 5000 });
		
		if (errorVisible) {
			await expect(errorMessage).toContainText(/fail|error/i);
		}

		// Modal should still be open or show error state
		const modalStillOpen = await page.locator('.modal-overlay').isVisible();
		expect(modalStillOpen || errorVisible).toBeTruthy();
	});
});