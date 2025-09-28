import { test, expect } from '@playwright/test';

const TEST_KEY = process.env.TERMINAL_KEY || 'testkey12345';
const BASE_URL = 'http://localhost:5173';

test.describe('Session Persistence', () => {
	const testWorkspacePath = '/tmp/test-session-workspace';

	test.beforeEach(async ({ page }) => {
		// Navigate to application
		await page.goto(BASE_URL);

		// Handle authentication if needed
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Ensure test workspace exists
		await page.request
			.post(`${BASE_URL}/api/workspaces`, {
				data: {
					path: testWorkspacePath,
					name: 'Session Test Workspace',
					authKey: TEST_KEY
				}
			})
			.catch(() => {
				// Workspace might already exist
			});
	});

	test.afterEach(async ({ page }) => {
		// Clean up sessions
		try {
			const sessionsResponse = await page.request.get(`${BASE_URL}/api/sessions?include=all`);
			if (sessionsResponse.ok()) {
				const sessionsData = await sessionsResponse.json();
				for (const session of sessionsData.sessions || []) {
					if (session.workspacePath === testWorkspacePath) {
						await page.request.delete(`${BASE_URL}/api/sessions`, {
							data: { id: session.id }
						});
					}
				}
			}
		} catch (error) {
			console.warn('Session cleanup failed:', error);
		}

		// Clean up workspace
		try {
			await page.request.delete(
				`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}?authKey=${TEST_KEY}`
			);
		} catch {
			// Ignore cleanup errors
		}
	});

	test('should create a terminal session and persist events', async ({ page }) => {
		// Navigate to dashboard
		await page.goto(`${BASE_URL}/dashboard`);

		// Create a new terminal session
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');

		// Wait for session to be created and active
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Get the session ID from the URL or UI
		const sessionElements = await page.locator('[data-session-id]').all();
		expect(sessionElements.length).toBeGreaterThan(0);

		const sessionId = await sessionElements[0].getAttribute('data-session-id');
		expect(sessionId).toBeTruthy();

		// Send some commands to the terminal
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();
		await page.keyboard.type('echo "Hello World"');
		await page.keyboard.press('Enter');

		// Wait for command output
		await page.waitForTimeout(1000);

		// Send another command
		await page.keyboard.type('pwd');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1000);

		// Verify session exists in API
		const sessionsResponse = await page.request.get(`${BASE_URL}/api/sessions?include=all`);
		expect(sessionsResponse.status()).toBe(200);

		const sessionsData = await sessionsResponse.json();
		const session = sessionsData.sessions.find((s) => s.id === sessionId);
		expect(session).toBeDefined();
		expect(session.type).toBe('pty');
		expect(session.isActive).toBe(true);

		// Check session events/history
		const historyResponse = await page.request.get(`${BASE_URL}/api/sessions/${sessionId}/history`);
		expect(historyResponse.status()).toBe(200);

		const historyData = await historyResponse.json();
		expect(historyData.events).toBeDefined();
		expect(Array.isArray(historyData.events)).toBe(true);
		expect(historyData.events.length).toBeGreaterThan(0);

		// Verify events contain our commands
		const eventContent = historyData.events.map((e) => e.data || '').join('');
		expect(eventContent).toContain('echo "Hello World"');
		expect(eventContent).toContain('pwd');
	});

	test('should resume session after page reload', async ({ page }) => {
		// Create terminal session first
		await page.goto(`${BASE_URL}/dashboard`);
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');

		// Wait for session to be active
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Get session ID
		const sessionElements = await page.locator('[data-session-id]').all();
		const sessionId = await sessionElements[0].getAttribute('data-session-id');

		// Send a command
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();
		await page.keyboard.type('echo "Before reload"');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1000);

		// Reload the page
		await page.reload();

		// Handle authentication again if needed
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Navigate back to dashboard
		await page.goto(`${BASE_URL}/dashboard`);

		// Verify session still exists and is resumable
		const resumedSessions = await page.locator('[data-session-id]').all();
		expect(resumedSessions.length).toBeGreaterThan(0);

		// Click on the existing session to resume it
		await resumedSessions[0].click();

		// Wait for terminal to be active
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Verify the session history is preserved
		const terminalContent = await page.locator('[data-testid="terminal-container"]').textContent();
		expect(terminalContent).toContain('Before reload');

		// Send another command to verify session is still functional
		await terminal.click();
		await page.keyboard.type('echo "After reload"');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1000);

		// Verify new command appears
		const updatedContent = await page.locator('[data-testid="terminal-container"]').textContent();
		expect(updatedContent).toContain('After reload');
	});

	test('should maintain session state across browser tabs', async ({ context }) => {
		// Create session in first tab
		const page1 = await context.newPage();
		await page1.goto(BASE_URL);

		// Handle authentication
		if (await page1.locator('input[type="password"]').isVisible()) {
			await page1.fill('input[type="password"]', TEST_KEY);
			await page1.press('input[type="password"]', 'Enter');
			await page1.waitForURL('**/dashboard');
		}

		// Create terminal session
		await page1.goto(`${BASE_URL}/dashboard`);
		await page1.click('button:has-text("New Session")');
		await page1.click('button:has-text("Terminal")');
		await page1.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Send command in first tab
		const terminal1 = page1.locator('[data-testid="terminal-container"]');
		await terminal1.click();
		await page1.keyboard.type('echo "From tab 1"');
		await page1.keyboard.press('Enter');
		await page1.waitForTimeout(1000);

		// Get session ID
		const sessionElements = await page1.locator('[data-session-id]').all();
		const sessionId = await sessionElements[0].getAttribute('data-session-id');

		// Open second tab and authenticate
		const page2 = await context.newPage();
		await page2.goto(BASE_URL);

		if (await page2.locator('input[type="password"]').isVisible()) {
			await page2.fill('input[type="password"]', TEST_KEY);
			await page2.press('input[type="password"]', 'Enter');
			await page2.waitForURL('**/dashboard');
		}

		// Navigate to dashboard and attach to existing session
		await page2.goto(`${BASE_URL}/dashboard`);

		// Find and click on the existing session
		const sessionsInTab2 = await page2.locator('[data-session-id]').all();
		expect(sessionsInTab2.length).toBeGreaterThan(0);

		// Click on the session to attach
		await sessionsInTab2[0].click();
		await page2.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Verify session content is synchronized
		const terminal2Content = await page2
			.locator('[data-testid="terminal-container"]')
			.textContent();
		expect(terminal2Content).toContain('From tab 1');

		// Send command from second tab
		const terminal2 = page2.locator('[data-testid="terminal-container"]');
		await terminal2.click();
		await page2.keyboard.type('echo "From tab 2"');
		await page2.keyboard.press('Enter');
		await page2.waitForTimeout(1000);

		// Verify command appears in both tabs
		await page1.waitForTimeout(1000); // Allow sync time
		const terminal1Updated = await page1
			.locator('[data-testid="terminal-container"]')
			.textContent();
		expect(terminal1Updated).toContain('From tab 2');

		// Clean up
		await page1.close();
		await page2.close();
	});

	test('should handle session reconnection after network interruption', async ({ page }) => {
		// This test simulates network interruption by temporarily pausing network
		await page.goto(`${BASE_URL}/dashboard`);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Create terminal session
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Send initial command
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();
		await page.keyboard.type('echo "Before disconnect"');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1000);

		// Simulate network interruption
		await page.setOffline(true);
		await page.waitForTimeout(2000);

		// Restore network
		await page.setOffline(false);
		await page.waitForTimeout(3000); // Allow reconnection time

		// Verify session is still functional
		await terminal.click();
		await page.keyboard.type('echo "After reconnect"');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1000);

		// Check that both commands are visible
		const terminalContent = await terminal.textContent();
		expect(terminalContent).toContain('Before disconnect');
		expect(terminalContent).toContain('After reconnect');
	});

	test('should preserve session events order and sequence numbers', async ({ page }) => {
		await page.goto(`${BASE_URL}/dashboard`);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Create terminal session
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Get session ID
		const sessionElements = await page.locator('[data-session-id]').all();
		const sessionId = await sessionElements[0].getAttribute('data-session-id');

		// Send multiple commands in sequence
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();

		const commands = ['echo "Command 1"', 'echo "Command 2"', 'echo "Command 3"'];
		for (const command of commands) {
			await page.keyboard.type(command);
			await page.keyboard.press('Enter');
			await page.waitForTimeout(500);
		}

		// Wait for all commands to complete
		await page.waitForTimeout(2000);

		// Fetch session history
		const historyResponse = await page.request.get(`${BASE_URL}/api/sessions/${sessionId}/history`);
		expect(historyResponse.status()).toBe(200);

		const historyData = await historyResponse.json();
		expect(historyData.events).toBeDefined();
		expect(Array.isArray(historyData.events)).toBe(true);

		// Verify sequence numbers are monotonic
		const sequenceNumbers = historyData.events
			.map((e) => e.sequence)
			.filter((s) => s !== undefined);
		expect(sequenceNumbers.length).toBeGreaterThan(0);

		for (let i = 1; i < sequenceNumbers.length; i++) {
			expect(sequenceNumbers[i]).toBeGreaterThan(sequenceNumbers[i - 1]);
		}

		// Verify all commands are captured in order
		const eventContent = historyData.events.map((e) => e.data || '').join('');
		for (const command of commands) {
			expect(eventContent).toContain(command);
		}
	});
});
