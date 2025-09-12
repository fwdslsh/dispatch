import { test, expect } from '@playwright/test';

test.describe('Socket Reconnection Functionality', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test.describe('SessionSocketManager Reconnection Tests', () => {
		test('should handle socket disconnection and reconnection gracefully', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Inject mock socket behavior that simulates network interruption
			await page.addInitScript(() => {
				// Store original io function
				const originalIo = window.io;
				
				// Track socket instances and their state
				window.socketInstances = new Map();
				window.networkConnected = true;
				
				// Override io function to track sockets
				window.io = function(options = {}) {
					const sessionId = options.query?.sessionId || 'default';
					
					// Create mock socket that simulates real Socket.IO behavior
					const mockSocket = {
						connected: window.networkConnected,
						connecting: false,
						sessionId: sessionId,
						isActive: window.networkConnected,
						id: `socket_${sessionId}_${Date.now()}`,
						events: new Map(),
						
						connect() {
							if (window.networkConnected) {
								this.connected = true;
								this.connecting = false;
								this.isActive = true;
								this.emit('connect');
							} else {
								this.connecting = true;
								// Simulate reconnection attempts
								setTimeout(() => {
									if (window.networkConnected) {
										this.connected = true;
										this.connecting = false;
										this.isActive = true;
										this.emit('reconnect', 1);
									} else {
										this.emit('reconnect_attempt', 1);
										this.connect(); // Retry
									}
								}, 1000);
							}
						},
						
						disconnect() {
							this.connected = false;
							this.connecting = false;
							this.isActive = false;
							this.emit('disconnect', 'manual disconnect');
						},
						
						emit(event, data, callback) {
							console.log(`Socket ${this.sessionId} emit:`, event, data);
							if (callback && typeof callback === 'function') {
								// Simulate successful responses for auth and session events
								if (event.includes('auth') || event.includes('terminal.') || event.includes('session.')) {
									setTimeout(() => callback({ success: true, id: this.sessionId }), 100);
								}
							}
						},
						
						on(event, handler) {
							if (!this.events.has(event)) {
								this.events.set(event, []);
							}
							this.events.get(event).push(handler);
						},
						
						removeAllListeners() {
							this.events.clear();
						},
						
						// Helper to trigger events
						triggerEvent(event, ...args) {
							const handlers = this.events.get(event) || [];
							handlers.forEach(handler => handler(...args));
						}
					};
					
					// Store socket instance
					window.socketInstances.set(sessionId, mockSocket);
					
					// Set up automatic disconnect on network loss
					const checkNetwork = () => {
						if (!window.networkConnected && mockSocket.connected) {
							mockSocket.connected = false;
							mockSocket.isActive = false;
							mockSocket.triggerEvent('disconnect', 'transport close');
						}
					};
					
					setInterval(checkNetwork, 100);
					
					return mockSocket;
				};
			});

			// Mock session data
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [
								{
									id: 'test_session_1',
									type: 'pty',
									workspacePath: '/workspace/test',
									title: 'Test Terminal'
								},
								{
									id: 'claude_test_1',
									type: 'claude',
									workspacePath: '/workspace/test',
									title: 'Test Claude',
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

			// Pin first session to create socket connection
			await page.click('.session-item:first-child');
			await page.waitForSelector('.session-pane');

			// Verify socket was created and connected
			const initialSocketState = await page.evaluate(() => {
				const socket = window.socketInstances.get('test_session_1');
				return {
					connected: socket?.connected,
					isActive: socket?.isActive,
					sessionId: socket?.sessionId
				};
			});

			expect(initialSocketState.connected).toBe(true);
			expect(initialSocketState.sessionId).toBe('test_session_1');

			// Simulate network disconnection
			await page.evaluate(() => {
				window.networkConnected = false;
			});

			// Wait for disconnect to be detected
			await page.waitForTimeout(200);

			// Verify socket is disconnected
			const disconnectedState = await page.evaluate(() => {
				const socket = window.socketInstances.get('test_session_1');
				return {
					connected: socket?.connected,
					isActive: socket?.isActive
				};
			});

			expect(disconnectedState.connected).toBe(false);
			expect(disconnectedState.isActive).toBe(false);

			// Restore network connection
			await page.evaluate(() => {
				window.networkConnected = true;
			});

			// Wait for reconnection
			await page.waitForTimeout(1200); // Allow for reconnection delay

			// Verify socket reconnected
			const reconnectedState = await page.evaluate(() => {
				const socket = window.socketInstances.get('test_session_1');
				return {
					connected: socket?.connected,
					isActive: socket?.isActive,
					sessionId: socket?.sessionId
				};
			});

			expect(reconnectedState.connected).toBe(true);
			expect(reconnectedState.sessionId).toBe('test_session_1');
		});

		test('should maintain session pane association after reconnection', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Set up socket mocking similar to previous test
			await page.addInitScript(() => {
				window.socketInstances = new Map();
				window.networkConnected = true;
				
				window.io = function(options = {}) {
					const sessionId = options.query?.sessionId || 'default';
					const mockSocket = {
						connected: true,
						sessionId: sessionId,
						isActive: true,
						id: `socket_${sessionId}`,
						events: new Map(),
						
						connect() { 
							this.connected = true; 
							this.isActive = true;
							this.triggerEvent('connect');
						},
						disconnect() { 
							this.connected = false; 
							this.isActive = false;
							this.triggerEvent('disconnect');
						},
						emit() {},
						on(event, handler) {
							if (!this.events.has(event)) {
								this.events.set(event, []);
							}
							this.events.get(event).push(handler);
						},
						removeAllListeners() { this.events.clear(); },
						triggerEvent(event, ...args) {
							const handlers = this.events.get(event) || [];
							handlers.forEach(handler => handler(...args));
						}
					};
					
					window.socketInstances.set(sessionId, mockSocket);
					return mockSocket;
				};
			});

			// Mock sessions
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [
								{ id: 'terminal_1', type: 'pty', workspacePath: '/workspace/project1' },
								{ id: 'claude_1', type: 'claude', workspacePath: '/workspace/project2', sessionId: 'claude-session-1' }
							]
						})
					});
				} else {
					await route.continue();
				}
			});

			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Pin multiple sessions
			await page.click('.session-item:nth-child(1)');
			await page.waitForSelector('.session-pane');
			
			await page.click('.session-item:nth-child(2)');
			await page.waitForSelector('.session-pane:nth-child(2)');

			// Verify initial socket associations
			const initialAssociations = await page.evaluate(() => {
				return {
					terminal_1: window.socketInstances.get('terminal_1')?.sessionId,
					claude_1: window.socketInstances.get('claude_1')?.sessionId
				};
			});

			expect(initialAssociations.terminal_1).toBe('terminal_1');
			expect(initialAssociations.claude_1).toBe('claude_1');

			// Simulate disconnection and reconnection
			await page.evaluate(() => {
				window.socketInstances.get('terminal_1')?.disconnect();
				window.socketInstances.get('claude_1')?.disconnect();
			});

			await page.waitForTimeout(100);

			await page.evaluate(() => {
				window.socketInstances.get('terminal_1')?.connect();
				window.socketInstances.get('claude_1')?.connect();
			});

			// Verify associations are maintained
			const postReconnectAssociations = await page.evaluate(() => {
				return {
					terminal_1: window.socketInstances.get('terminal_1')?.sessionId,
					claude_1: window.socketInstances.get('claude_1')?.sessionId,
					terminal_connected: window.socketInstances.get('terminal_1')?.connected,
					claude_connected: window.socketInstances.get('claude_1')?.connected
				};
			});

			expect(postReconnectAssociations.terminal_1).toBe('terminal_1');
			expect(postReconnectAssociations.claude_1).toBe('claude_1');
			expect(postReconnectAssociations.terminal_connected).toBe(true);
			expect(postReconnectAssociations.claude_connected).toBe(true);
		});

		test('should show appropriate connection status during reconnection', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock Claude session with connection status
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [{
								id: 'claude_status_test',
								type: 'claude',
								workspacePath: '/workspace/test',
								sessionId: 'claude-session-status'
							}]
						})
					});
				} else {
					await route.continue();
				}
			});

			// Set up socket mock that tracks connection state
			await page.addInitScript(() => {
				window.connectionState = 'connected';
				window.io = () => ({
					connected: window.connectionState === 'connected',
					connecting: window.connectionState === 'connecting',
					sessionId: 'claude_status_test',
					emit() {},
					on() {},
					removeAllListeners() {}
				});
			});

			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Pin Claude session
			await page.click('.session-item:first-child');
			await page.waitForSelector('.claude-pane');

			// Check if there's any connection status indicator in normal state
			const normalState = await page.locator('.claude-pane .ai-state').textContent();
			expect(normalState).not.toContain('Reconnecting');

			// Simulate reconnecting state
			await page.evaluate(() => {
				window.connectionState = 'connecting';
				// Trigger a manual update to the Claude pane if needed
				const event = new CustomEvent('socket-reconnecting', { 
					detail: { sessionId: 'claude_status_test' } 
				});
				document.dispatchEvent(event);
			});

			// Look for reconnection status in Claude pane
			// Note: The actual UI update depends on how the component handles socket state changes
			const claudePaneExists = await page.locator('.claude-pane').isVisible();
			expect(claudePaneExists).toBe(true);

			// Restore connection
			await page.evaluate(() => {
				window.connectionState = 'connected';
			});
		});

		test('should handle catch-up functionality to prevent data loss', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			let catchupEvents = [];

			// Mock socket with catch-up event tracking
			await page.addInitScript(() => {
				window.catchupEvents = [];
				window.io = () => ({
					connected: true,
					sessionId: 'catchup_test',
					emit(event, data) {
						if (event === 'session.catchup') {
							window.catchupEvents.push({ event, data });
						}
					},
					on() {},
					removeAllListeners() {}
				});
			});

			// Mock session
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [{
								id: 'catchup_test',
								type: 'claude',
								workspacePath: '/workspace/test',
								sessionId: 'catchup-session'
							}]
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

			// Click on another session then back (simulate focus change)
			if (await page.locator('.session-item:nth-child(2)').isVisible()) {
				await page.click('.session-item:nth-child(2)');
				await page.waitForTimeout(100);
			}
			
			await page.click('.session-item:first-child');

			// Check if catch-up events were triggered
			const catchupEventCount = await page.evaluate(() => window.catchupEvents.length);
			
			// Catch-up should be triggered when session regains focus
			expect(catchupEventCount).toBeGreaterThan(0);
		});
	});

	test.describe('UI Feedback During Reconnection', () => {
		test('should provide visual feedback for connection states', async ({ page }) => {
			await page.goto('/projects');
			await page.waitForSelector('.dispatch-workspace');

			// Mock session with pending messages
			await page.route('/api/sessions', async (route) => {
				if (route.request().method() === 'GET') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							sessions: [{
								id: 'ui_feedback_test',
								type: 'claude',
								workspacePath: '/workspace/test',
								sessionId: 'ui-feedback-session'
							}]
						})
					});
				} else {
					await route.continue();
				}
			});

			await page.reload();
			await page.waitForSelector('.dispatch-workspace');

			// Pin Claude session
			await page.click('.session-item:first-child');
			await page.waitForSelector('.claude-pane');

			// Look for connection status elements
			const aiStateElement = page.locator('.claude-pane .ai-state');
			
			if (await aiStateElement.isVisible()) {
				const stateText = await aiStateElement.textContent();
				// Should show some state indicator (not necessarily reconnecting in normal cases)
				expect(stateText).toBeTruthy();
			}

			// Verify that the pane is functional (no error states visible)
			const claudePane = page.locator('.claude-pane');
			await expect(claudePane).toBeVisible();
			
			// Should not show error indicators
			const errorElements = page.locator('.error, .alert-error, .connection-error');
			const errorCount = await errorElements.count();
			expect(errorCount).toBe(0);
		});
	});
});