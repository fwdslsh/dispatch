/**
 * Performance benchmarks for event replay functionality
 * Tests the core constitutional requirement: event replay must be <100ms
 */

import { test, expect } from '@playwright/test';

const TEST_KEY = process.env.TERMINAL_KEY || 'testkey12345';
const BASE_URL = 'http://localhost:5173';

test.describe('Event Replay Performance Benchmarks', () => {
	const testWorkspacePath = '/tmp/perf-test-workspace';

	test.beforeEach(async ({ page }) => {
		// Ensure test workspace exists
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: 'Performance Test Workspace',
				authKey: TEST_KEY
			}
		}).catch(() => {
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
		} catch {
			// Ignore cleanup errors
		}

		// Clean up workspace
		try {
			await page.request.delete(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}?authKey=${TEST_KEY}`);
		} catch {
			// Ignore cleanup errors
		}
	});

	test('should replay small session history (<1K events) in <100ms', async ({ page }) => {
		await page.goto(BASE_URL);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Create terminal session
		await page.goto(`${BASE_URL}/dashboard`);
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Get session ID
		const sessionElements = await page.locator('[data-session-id]').all();
		const sessionId = await sessionElements[0].getAttribute('data-session-id');

		// Generate small amount of events (100 commands)
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();

		console.log('Generating events for small session...');
		for (let i = 0; i < 100; i++) {
			await page.keyboard.type(`echo "Event ${i}"`);
			await page.keyboard.press('Enter');
			if (i % 20 === 0) {
				await page.waitForTimeout(100); // Periodic pause to avoid overwhelming
			}
		}

		// Wait for all events to be processed
		await page.waitForTimeout(2000);

		// Measure event replay performance
		console.log('Measuring event replay performance...');
		const startTime = Date.now();

		const historyResponse = await page.request.get(`${BASE_URL}/api/sessions/${sessionId}/history`);
		expect(historyResponse.status()).toBe(200);

		const historyData = await historyResponse.json();
		const endTime = Date.now();

		const replayTime = endTime - startTime;
		console.log(`Event replay time for ${historyData.events.length} events: ${replayTime}ms`);

		// Constitutional requirement: event replay must be <100ms
		expect(replayTime).toBeLessThan(100);
		expect(historyData.events.length).toBeGreaterThan(100); // Should have captured all events
	});

	test('should replay medium session history (1K-10K events) in <100ms', async ({ page }) => {
		await page.goto(BASE_URL);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Create terminal session
		await page.goto(`${BASE_URL}/dashboard`);
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Get session ID
		const sessionElements = await page.locator('[data-session-id]').all();
		const sessionId = await sessionElements[0].getAttribute('data-session-id');

		// Generate medium amount of events (500 commands for faster test)
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();

		console.log('Generating events for medium session...');
		for (let i = 0; i < 500; i++) {
			await page.keyboard.type(`echo "Medium event ${i}"`);
			await page.keyboard.press('Enter');
			if (i % 50 === 0) {
				await page.waitForTimeout(100);
				console.log(`Generated ${i + 1} commands...`);
			}
		}

		// Wait for all events to be processed
		await page.waitForTimeout(3000);

		// Measure event replay performance
		console.log('Measuring event replay performance for medium session...');
		const startTime = Date.now();

		const historyResponse = await page.request.get(`${BASE_URL}/api/sessions/${sessionId}/history`);
		expect(historyResponse.status()).toBe(200);

		const historyData = await historyResponse.json();
		const endTime = Date.now();

		const replayTime = endTime - startTime;
		console.log(`Event replay time for ${historyData.events.length} events: ${replayTime}ms`);

		// Constitutional requirement: event replay must be <100ms even for larger histories
		expect(replayTime).toBeLessThan(100);
		expect(historyData.events.length).toBeGreaterThan(500);
	});

	test('should handle concurrent session creation performance', async ({ page, browser }) => {
		// Test creating multiple sessions concurrently to stress test the system
		await page.goto(BASE_URL);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		const numSessions = 5;
		const sessionPromises = [];

		console.log(`Creating ${numSessions} concurrent sessions...`);
		const startTime = Date.now();

		// Create multiple sessions concurrently
		for (let i = 0; i < numSessions; i++) {
			const context = await browser.newContext();
			const sessionPage = await context.newPage();

			sessionPromises.push((async () => {
				try {
					await sessionPage.goto(BASE_URL);

					// Handle authentication
					if (await sessionPage.locator('input[type="password"]').isVisible()) {
						await sessionPage.fill('input[type="password"]', TEST_KEY);
						await sessionPage.press('input[type="password"]', 'Enter');
						await sessionPage.waitForURL('**/dashboard');
					}

					// Create session
					await sessionPage.goto(`${BASE_URL}/dashboard`);
					await sessionPage.click('button:has-text("New Session")');
					await sessionPage.click('button:has-text("Terminal")');
					await sessionPage.waitForSelector('[data-testid="terminal-container"]', { timeout: 15000 });

					// Send a command to generate events
					const terminal = sessionPage.locator('[data-testid="terminal-container"]');
					await terminal.click();
					await sessionPage.keyboard.type(`echo "Concurrent session ${i}"`);
					await sessionPage.keyboard.press('Enter');
					await sessionPage.waitForTimeout(500);

					return { success: true, sessionIndex: i };
				} catch (error) {
					console.error(`Session ${i} failed:`, error);
					return { success: false, sessionIndex: i, error };
				} finally {
					await context.close();
				}
			})());
		}

		// Wait for all sessions to complete
		const results = await Promise.all(sessionPromises);
		const endTime = Date.now();

		const totalTime = endTime - startTime;
		console.log(`Created ${numSessions} sessions in ${totalTime}ms (avg: ${totalTime / numSessions}ms per session)`);

		// Verify all sessions were created successfully
		const successfulSessions = results.filter(r => r.success);
		expect(successfulSessions.length).toBe(numSessions);

		// Performance expectation: should create sessions reasonably fast
		expect(totalTime).toBeLessThan(30000); // 30 seconds for 5 sessions
		expect(totalTime / numSessions).toBeLessThan(6000); // 6 seconds per session average
	});

	test('should maintain performance with large event payloads', async ({ page }) => {
		await page.goto(BASE_URL);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Create terminal session
		await page.goto(`${BASE_URL}/dashboard`);
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Get session ID
		const sessionElements = await page.locator('[data-session-id]').all();
		const sessionId = await sessionElements[0].getAttribute('data-session-id');

		// Generate events with large payloads
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();

		console.log('Generating events with large payloads...');
		for (let i = 0; i < 50; i++) {
			// Create large command output
			const largeText = 'x'.repeat(1000); // 1KB of text per command
			await page.keyboard.type(`echo "${largeText}"`);
			await page.keyboard.press('Enter');
			if (i % 10 === 0) {
				await page.waitForTimeout(200);
			}
		}

		// Wait for all events to be processed
		await page.waitForTimeout(3000);

		// Measure performance with large payloads
		console.log('Measuring performance with large event payloads...');
		const startTime = Date.now();

		const historyResponse = await page.request.get(`${BASE_URL}/api/sessions/${sessionId}/history`);
		expect(historyResponse.status()).toBe(200);

		const historyData = await historyResponse.json();
		const endTime = Date.now();

		const replayTime = endTime - startTime;
		const totalDataSize = JSON.stringify(historyData).length;

		console.log(`Event replay time for ${historyData.events.length} events (${Math.round(totalDataSize / 1024)}KB): ${replayTime}ms`);

		// Performance should still be good even with large payloads
		expect(replayTime).toBeLessThan(200); // Slightly higher threshold for large data
		expect(historyData.events.length).toBeGreaterThan(50);
		expect(totalDataSize).toBeGreaterThan(50000); // Should have significant data size
	});

	test('should measure session attachment performance', async ({ page, browser }) => {
		// Test how quickly a new device can attach to an existing session
		await page.goto(BASE_URL);

		// Handle authentication
		if (await page.locator('input[type="password"]').isVisible()) {
			await page.fill('input[type="password"]', TEST_KEY);
			await page.press('input[type="password"]', 'Enter');
			await page.waitForURL('**/dashboard');
		}

		// Create session with some history
		await page.goto(`${BASE_URL}/dashboard`);
		await page.click('button:has-text("New Session")');
		await page.click('button:has-text("Terminal")');
		await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 10000 });

		// Generate some events first
		const terminal = page.locator('[data-testid="terminal-container"]');
		await terminal.click();

		for (let i = 0; i < 100; i++) {
			await page.keyboard.type(`echo "History event ${i}"`);
			await page.keyboard.press('Enter');
			if (i % 25 === 0) {
				await page.waitForTimeout(100);
			}
		}

		await page.waitForTimeout(2000);

		// Now test attachment performance from a new context
		const newContext = await browser.newContext();
		const newPage = await newContext.newPage();

		try {
			const attachStartTime = Date.now();

			await newPage.goto(BASE_URL);

			// Handle authentication
			if (await newPage.locator('input[type="password"]').isVisible()) {
				await newPage.fill('input[type="password"]', TEST_KEY);
				await newPage.press('input[type="password"]', 'Enter');
				await newPage.waitForURL('**/dashboard');
			}

			// Navigate to dashboard and attach to existing session
			await newPage.goto(`${BASE_URL}/dashboard`);
			const existingSessions = await newPage.locator('[data-session-id]').all();
			expect(existingSessions.length).toBeGreaterThan(0);

			// Click to attach
			await existingSessions[0].click();
			await newPage.waitForSelector('[data-testid="terminal-container"]', { timeout: 15000 });

			const attachEndTime = Date.now();
			const attachmentTime = attachEndTime - attachStartTime;

			console.log(`Session attachment and history replay time: ${attachmentTime}ms`);

			// Verify the history was replayed correctly
			const terminalContent = await newPage.locator('[data-testid="terminal-container"]').textContent();
			expect(terminalContent).toContain('History event 0');
			expect(terminalContent).toContain('History event 99');

			// Performance expectation: attachment should be fast
			expect(attachmentTime).toBeLessThan(5000); // 5 seconds for full attachment and replay

		} finally {
			await newContext.close();
		}
	});
});