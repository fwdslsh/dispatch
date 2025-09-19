import { test, expect } from '@playwright/test';

// Test configuration
const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5176';

test.describe('Debug Session Display Issue', () => {
	// Helper to authenticate
	async function authenticate(page) {
		// Set auth token in localStorage before navigation
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});

		// Navigate to workspace
		await page.goto(`${BASE_URL}/workspace`);

		// Wait for page to load
		await page.waitForLoadState('networkidle');
		console.log('✓ Authenticated and navigated to workspace');
	}

	test('should debug session loading and display issues', async ({ page }) => {
		// Capture console logs
		const consoleLogs = [];
		page.on('console', (msg) => {
			consoleLogs.push(`${msg.type()}: ${msg.text()}`);
		});

		await page.setViewportSize({ width: 1400, height: 900 });
		await authenticate(page);

		// Wait for initial load and session loading
		await page.waitForTimeout(3000);

		// Check if there are any sessions in the backend first
		console.log('\n=== Checking backend sessions ===');
		const response = await page.request.get(`${BASE_URL}/api/sessions?includeAll=true`);
		const sessionsData = await response.json();
		console.log('Backend sessions:', JSON.stringify(sessionsData, null, 2));

		// Check WindowManager state
		const windowManager = page.locator('.wm-root');
		const isVisible = await windowManager.isVisible({ timeout: 5000 }).catch(() => false);
		console.log('WindowManager visible:', isVisible);

		if (isVisible) {
			const sessionTiles = await page.locator('.session-tile').count();
			const emptyTiles = await page.locator('.empty-tile').count();
			const totalTiles = await page.locator('.wm-tile, .session-tile, .empty-tile').count();

			console.log(`Tiles - Session: ${sessionTiles}, Empty: ${emptyTiles}, Total: ${totalTiles}`);
		}

		// Print all console logs to see debug output
		console.log('\n=== Browser Console Logs ===');
		consoleLogs.forEach((log) => console.log(log));

		// If no sessions exist, create one and see what happens
		if (!sessionsData.sessions || sessionsData.sessions.length === 0) {
			console.log('\n=== Creating test session via API ===');
			const createResponse = await page.request.post(`${BASE_URL}/api/sessions`, {
				data: {
					action: 'create',
					type: 'pty',
					workspacePath:
						'/home/founder3/code/github/fwdslsh/dispatch/.testing-home/workspaces/test',
					title: 'Debug Test Session'
				}
			});
			const createResult = await createResponse.json();
			console.log('Session creation result:', JSON.stringify(createResult, null, 2));

			// Wait for session to be processed
			await page.waitForTimeout(2000);

			// Check console logs again after session creation
			console.log('\n=== Console logs after session creation ===');
			const newLogs = consoleLogs.slice(-20); // Get last 20 logs
			newLogs.forEach((log) => console.log(log));

			// Check if session now appears in UI
			const sessionTilesAfter = await page.locator('.session-tile').count();
			console.log('Session tiles after creation:', sessionTilesAfter);
		}

		// Take a screenshot for debugging
		await page.screenshot({
			path: 'e2e/screenshots/debug-session-display.png',
			fullPage: true
		});
	});
});
