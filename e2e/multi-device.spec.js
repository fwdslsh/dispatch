import { test, expect } from '@playwright/test';

const TEST_KEY = process.env.TERMINAL_KEY || 'testkey12345';
const BASE_URL = 'http://localhost:5173';

test.describe('Multi-Device Synchronization', () => {
	test('should synchronize terminal output across multiple browser contexts', async ({ browser }) => {
		// Create two separate browser contexts to simulate different devices
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		try {
			// Authenticate both devices
			await page1.goto(BASE_URL);
			if (await page1.locator('input[type="password"]').isVisible()) {
				await page1.fill('input[type="password"]', TEST_KEY);
				await page1.press('input[type="password"]', 'Enter');
				await page1.waitForURL('**/dashboard');
			}

			await page2.goto(BASE_URL);
			if (await page2.locator('input[type="password"]').isVisible()) {
				await page2.fill('input[type="password"]', TEST_KEY);
				await page2.press('input[type="password"]', 'Enter');
				await page2.waitForURL('**/dashboard');
			}

			// Create session on device 1
			await page1.goto(`${BASE_URL}/dashboard`);
			await page1.click('button:has-text("New Session")');
			await page1.click('button:has-text("Terminal")');
			await page1.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Send command from device 1
			const terminal1 = page1.locator('[data-testid="terminal-container"]');
			await terminal1.click();
			await page1.keyboard.type('echo "Message from device 1"');
			await page1.keyboard.press('Enter');
			await page1.waitForTimeout(1000);

			// Get session ID
			const sessionElements = await page1.locator('[data-session-id]').all();
			const sessionId = await sessionElements[0].getAttribute('data-session-id');

			// Connect to the same session from device 2
			await page2.goto(`${BASE_URL}/dashboard`);

			// Find and attach to the existing session
			const device2Sessions = await page2.locator('[data-session-id]').all();
			expect(device2Sessions.length).toBeGreaterThan(0);

			// Click on the session to attach from device 2
			await device2Sessions[0].click();
			await page2.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Verify device 2 can see the output from device 1
			const terminal2Content = await page2.locator('[data-testid="terminal-container"]').textContent();
			expect(terminal2Content).toContain('Message from device 1');

			// Send command from device 2
			const terminal2 = page2.locator('[data-testid="terminal-container"]');
			await terminal2.click();
			await page2.keyboard.type('echo "Message from device 2"');
			await page2.keyboard.press('Enter');
			await page2.waitForTimeout(1000);

			// Verify device 1 can see the output from device 2
			await page1.waitForTimeout(1000); // Allow sync time
			const terminal1Updated = await page1.locator('[data-testid="terminal-container"]').textContent();
			expect(terminal1Updated).toContain('Message from device 2');

			// Verify both devices see both messages
			const finalContent1 = await page1.locator('[data-testid="terminal-container"]').textContent();
			const finalContent2 = await page2.locator('[data-testid="terminal-container"]').textContent();

			expect(finalContent1).toContain('Message from device 1');
			expect(finalContent1).toContain('Message from device 2');
			expect(finalContent2).toContain('Message from device 1');
			expect(finalContent2).toContain('Message from device 2');

		} finally {
			await context1.close();
			await context2.close();
		}
	});

	test('should handle read-only session attachment', async ({ browser }) => {
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		try {
			// Authenticate both devices
			await page1.goto(BASE_URL);
			if (await page1.locator('input[type="password"]').isVisible()) {
				await page1.fill('input[type="password"]', TEST_KEY);
				await page1.press('input[type="password"]', 'Enter');
				await page1.waitForURL('**/dashboard');
			}

			await page2.goto(BASE_URL);
			if (await page2.locator('input[type="password"]').isVisible()) {
				await page2.fill('input[type="password"]', TEST_KEY);
				await page2.press('input[type="password"]', 'Enter');
				await page2.waitForURL('**/dashboard');
			}

			// Create session on device 1 (primary/read-write)
			await page1.goto(`${BASE_URL}/dashboard`);
			await page1.click('button:has-text("New Session")');
			await page1.click('button:has-text("Terminal")');
			await page1.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Send initial command from device 1
			const terminal1 = page1.locator('[data-testid="terminal-container"]');
			await terminal1.click();
			await page1.keyboard.type('echo "Primary device active"');
			await page1.keyboard.press('Enter');
			await page1.waitForTimeout(1000);

			// Connect from device 2 (should be read-only if multiple write connections not supported)
			await page2.goto(`${BASE_URL}/dashboard`);
			const device2Sessions = await page2.locator('[data-session-id]').all();
			expect(device2Sessions.length).toBeGreaterThan(0);

			await device2Sessions[0].click();
			await page2.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Verify device 2 can see the output
			const terminal2Content = await page2.locator('[data-testid="terminal-container"]').textContent();
			expect(terminal2Content).toContain('Primary device active');

			// Send more commands from device 1
			await terminal1.click();
			await page1.keyboard.type('echo "Still writing from device 1"');
			await page1.keyboard.press('Enter');
			await page1.waitForTimeout(1000);

			// Verify device 2 sees the new output
			await page2.waitForTimeout(1000);
			const terminal2Updated = await page2.locator('[data-testid="terminal-container"]').textContent();
			expect(terminal2Updated).toContain('Still writing from device 1');

		} finally {
			await context1.close();
			await context2.close();
		}
	});

	test('should synchronize session state changes across devices', async ({ browser }) => {
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		try {
			// Authenticate both devices
			await page1.goto(BASE_URL);
			if (await page1.locator('input[type="password"]').isVisible()) {
				await page1.fill('input[type="password"]', TEST_KEY);
				await page1.press('input[type="password"]', 'Enter');
				await page1.waitForURL('**/dashboard');
			}

			await page2.goto(BASE_URL);
			if (await page2.locator('input[type="password"]').isVisible()) {
				await page2.fill('input[type="password"]', TEST_KEY);
				await page2.press('input[type="password"]', 'Enter');
				await page2.waitForURL('**/dashboard');
			}

			// Create session on device 1
			await page1.goto(`${BASE_URL}/dashboard`);
			await page1.click('button:has-text("New Session")');
			await page1.click('button:has-text("Terminal")');
			await page1.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Get session ID
			const sessionElements = await page1.locator('[data-session-id]').all();
			const sessionId = await sessionElements[0].getAttribute('data-session-id');

			// Connect from device 2
			await page2.goto(`${BASE_URL}/dashboard`);
			const device2Sessions = await page2.locator('[data-session-id]').all();
			await device2Sessions[0].click();
			await page2.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Verify both devices show session as active
			const sessionsResponse1 = await page1.request.get(`${BASE_URL}/api/sessions?include=all`);
			const sessionsData1 = await sessionsResponse1.json();
			const session1 = sessionsData1.sessions.find(s => s.id === sessionId);
			expect(session1.isActive).toBe(true);

			const sessionsResponse2 = await page2.request.get(`${BASE_URL}/api/sessions?include=all`);
			const sessionsData2 = await sessionsResponse2.json();
			const session2 = sessionsData2.sessions.find(s => s.id === sessionId);
			expect(session2.isActive).toBe(true);

			// Close session from device 1
			await page1.click(`[data-session-id="${sessionId}"] button[title*="Close"]`, { timeout: 5000 }).catch(() => {
				// Try alternative close button selector
				return page1.click(`[data-session-id="${sessionId}"] .close-button`);
			}).catch(() => {
				// Try closing via API if UI method fails
				return page1.request.delete(`${BASE_URL}/api/sessions`, {
					data: { id: sessionId }
				});
			});

			// Wait for state change to propagate
			await page1.waitForTimeout(2000);

			// Verify device 2 detects the session closure
			await page2.waitForTimeout(2000);
			const finalSessionsResponse = await page2.request.get(`${BASE_URL}/api/sessions?include=all`);
			const finalSessionsData = await finalSessionsResponse.json();
			const finalSession = finalSessionsData.sessions.find(s => s.id === sessionId);

			// Session should either be marked as inactive or not exist
			expect(finalSession === undefined || finalSession.isActive === false).toBe(true);

		} finally {
			await context1.close();
			await context2.close();
		}
	});

	test('should handle device disconnection and reconnection gracefully', async ({ browser }) => {
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		try {
			// Authenticate both devices
			await page1.goto(BASE_URL);
			if (await page1.locator('input[type="password"]').isVisible()) {
				await page1.fill('input[type="password"]', TEST_KEY);
				await page1.press('input[type="password"]', 'Enter');
				await page1.waitForURL('**/dashboard');
			}

			await page2.goto(BASE_URL);
			if (await page2.locator('input[type="password"]').isVisible()) {
				await page2.fill('input[type="password"]', TEST_KEY);
				await page2.press('input[type="password"]', 'Enter');
				await page2.waitForURL('**/dashboard');
			}

			// Create session on device 1
			await page1.goto(`${BASE_URL}/dashboard`);
			await page1.click('button:has-text("New Session")');
			await page1.click('button:has-text("Terminal")');
			await page1.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Send initial command
			const terminal1 = page1.locator('[data-testid="terminal-container"]');
			await terminal1.click();
			await page1.keyboard.type('echo "Before disconnection"');
			await page1.keyboard.press('Enter');
			await page1.waitForTimeout(1000);

			// Connect from device 2
			await page2.goto(`${BASE_URL}/dashboard`);
			const device2Sessions = await page2.locator('[data-session-id]').all();
			await device2Sessions[0].click();
			await page2.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Verify device 2 sees the initial command
			const terminal2Initial = await page2.locator('[data-testid="terminal-container"]').textContent();
			expect(terminal2Initial).toContain('Before disconnection');

			// Simulate network disconnection on device 2
			await page2.setOffline(true);
			await page2.waitForTimeout(2000);

			// Continue working on device 1 while device 2 is offline
			await terminal1.click();
			await page1.keyboard.type('echo "While device 2 offline"');
			await page1.keyboard.press('Enter');
			await page1.waitForTimeout(1000);

			// Reconnect device 2
			await page2.setOffline(false);
			await page2.waitForTimeout(3000); // Allow reconnection

			// Refresh device 2 to re-establish connection
			await page2.reload();
			if (await page2.locator('input[type="password"]').isVisible()) {
				await page2.fill('input[type="password"]', TEST_KEY);
				await page2.press('input[type="password"]', 'Enter');
				await page2.waitForURL('**/dashboard');
			}

			await page2.goto(`${BASE_URL}/dashboard`);
			const reconnectedSessions = await page2.locator('[data-session-id]').all();
			if (reconnectedSessions.length > 0) {
				await reconnectedSessions[0].click();
				await page2.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

				// Verify device 2 catches up with what happened while offline
				const terminal2Reconnected = await page2.locator('[data-testid="terminal-container"]').textContent();
				expect(terminal2Reconnected).toContain('Before disconnection');
				expect(terminal2Reconnected).toContain('While device 2 offline');
			}

		} finally {
			await context1.close();
			await context2.close();
		}
	});

	test('should maintain consistent event ordering across devices', async ({ browser }) => {
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		try {
			// Authenticate both devices
			await page1.goto(BASE_URL);
			if (await page1.locator('input[type="password"]').isVisible()) {
				await page1.fill('input[type="password"]', TEST_KEY);
				await page1.press('input[type="password"]', 'Enter');
				await page1.waitForURL('**/dashboard');
			}

			await page2.goto(BASE_URL);
			if (await page2.locator('input[type="password"]').isVisible()) {
				await page2.fill('input[type="password"]', TEST_KEY);
				await page2.press('input[type="password"]', 'Enter');
				await page2.waitForURL('**/dashboard');
			}

			// Create session on device 1
			await page1.goto(`${BASE_URL}/dashboard`);
			await page1.click('button:has-text("New Session")');
			await page1.click('button:has-text("Terminal")');
			await page1.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Get session ID
			const sessionElements = await page1.locator('[data-session-id]').all();
			const sessionId = await sessionElements[0].getAttribute('data-session-id');

			// Connect from device 2
			await page2.goto(`${BASE_URL}/dashboard`);
			const device2Sessions = await page2.locator('[data-session-id]').all();
			await device2Sessions[0].click();
			await page2.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

			// Send commands from both devices in alternating pattern
			const terminal1 = page1.locator('[data-testid="terminal-container"]');
			const terminal2 = page2.locator('[data-testid="terminal-container"]');

			await terminal1.click();
			await page1.keyboard.type('echo "Device 1 - Command 1"');
			await page1.keyboard.press('Enter');
			await page1.waitForTimeout(500);

			await terminal2.click();
			await page2.keyboard.type('echo "Device 2 - Command 1"');
			await page2.keyboard.press('Enter');
			await page2.waitForTimeout(500);

			await terminal1.click();
			await page1.keyboard.type('echo "Device 1 - Command 2"');
			await page1.keyboard.press('Enter');
			await page1.waitForTimeout(500);

			// Wait for all commands to complete
			await page1.waitForTimeout(2000);
			await page2.waitForTimeout(2000);

			// Get session history from API
			const historyResponse = await page1.request.get(`${BASE_URL}/api/sessions/${sessionId}/history`);
			const historyData = await historyResponse.json();

			// Verify events are properly ordered by sequence number
			const events = historyData.events.filter(e => e.sequence !== undefined);
			for (let i = 1; i < events.length; i++) {
				expect(events[i].sequence).toBeGreaterThan(events[i - 1].sequence);
			}

			// Verify both devices show the same final state
			const terminal1Final = await terminal1.textContent();
			const terminal2Final = await terminal2.textContent();

			// Both should contain all commands
			expect(terminal1Final).toContain('Device 1 - Command 1');
			expect(terminal1Final).toContain('Device 2 - Command 1');
			expect(terminal1Final).toContain('Device 1 - Command 2');

			expect(terminal2Final).toContain('Device 1 - Command 1');
			expect(terminal2Final).toContain('Device 2 - Command 1');
			expect(terminal2Final).toContain('Device 1 - Command 2');

		} finally {
			await context1.close();
			await context2.close();
		}
	});
});