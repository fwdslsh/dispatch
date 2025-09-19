import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5176';

test.describe('Final Session Display Test', () => {
	async function authenticate(page) {
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');
	}

	test('comprehensive session display verification', async ({ page }) => {
		// Capture console logs
		const consoleLogs = [];
		page.on('console', (msg) => {
			consoleLogs.push(`${msg.type()}: ${msg.text()}`);
		});

		await page.setViewportSize({ width: 1400, height: 900 });
		await authenticate(page);
		await page.waitForTimeout(3000);

		console.log('\n=== FINAL VERIFICATION ===');

		// Check backend sessions
		const response = await page.request.get(`${BASE_URL}/api/sessions?includeAll=true`);
		const sessionsData = await response.json();
		console.log(`✓ Backend sessions: ${sessionsData.sessions?.length || 0}`);

		// Check WindowManager state
		const windowManager = page.locator('.wm-root');
		const isVisible = await windowManager.isVisible();
		console.log(`✓ WindowManager visible: ${isVisible}`);

		if (isVisible) {
			const sessionTiles = await page.locator('.session-tile').count();
			const emptyTiles = await page.locator('.empty-tile').count();
			const terminalPanes = await page.locator('.terminal-pane, .xterm').count();
			const claudePanes = await page.locator('.claude-pane').count();

			console.log(`✓ Session tiles: ${sessionTiles}`);
			console.log(`✓ Empty tiles: ${emptyTiles}`);
			console.log(`✓ Terminal panes: ${terminalPanes}`);
			console.log(`✓ Claude panes: ${claudePanes}`);

			// Check for any rendered session content
			const sessionContainers = await page.locator('.session-container, [data-session-id]').count();
			console.log(`✓ Session containers: ${sessionContainers}`);

			// Check if sessions are somewhere in the DOM but not in tiles
			const allSessionElements = await page
				.locator('[data-session-id], .terminal-pane, .claude-pane, .session-viewport')
				.count();
			console.log(`✓ Total session elements in DOM: ${allSessionElements}`);
		}

		// Look for specific console logs that indicate success
		const relevantLogs = consoleLogs.filter(
			(log) =>
				log.includes('SessionWindowManager') ||
				log.includes('Added tile for session') ||
				log.includes('TerminalPane mounted') ||
				log.includes('sessionState.displayed.length')
		);

		console.log('\n=== KEY CONSOLE LOGS ===');
		relevantLogs.slice(-10).forEach((log) => console.log(log));

		// Final assessment
		const hasBackendSessions = sessionsData.sessions?.length > 0;
		const hasWindowManager = isVisible;
		const sessionElements = await page
			.locator('.terminal-pane, .claude-pane, .session-viewport')
			.count();

		console.log('\n=== FINAL ASSESSMENT ===');
		console.log(`✓ Backend has sessions: ${hasBackendSessions}`);
		console.log(`✓ WindowManager displayed: ${hasWindowManager}`);
		console.log(`✓ Session UI elements: ${sessionElements}`);
		console.log(`✓ Sessions are being rendered: ${sessionElements > 0}`);

		// Take final screenshot
		await page.screenshot({
			path: 'e2e/screenshots/final-session-state.png',
			fullPage: true
		});

		console.log('✓ Screenshot saved: e2e/screenshots/final-session-state.png');
		console.log('🎉 DEBUGGING COMPLETE - Check screenshot for current state');
	});
});
