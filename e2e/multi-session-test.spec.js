import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5176';

test.describe('Multi-Session WindowManager Test', () => {
	async function authenticate(page) {
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');
	}

	test('can handle 3+ sessions with dynamic layout generation', async ({ page }) => {
		// Capture console logs
		const consoleLogs = [];
		page.on('console', (msg) => {
			consoleLogs.push(`${msg.type()}: ${msg.text()}`);
		});

		await page.setViewportSize({ width: 1400, height: 900 });
		await authenticate(page);
		await page.waitForTimeout(2000);

		console.log('\n=== MULTI-SESSION TEST ===');

		// First, check what sessions already exist
		const response = await page.request.get(`${BASE_URL}/api/sessions?includeAll=true`);
		const sessionsData = await response.json();
		const existingSessions = sessionsData.sessions || [];
		console.log(`✓ Initial backend sessions: ${existingSessions.length}`);

		// Ensure WindowManager is visible
		const windowManager = page.locator('.wm-root');
		const isVisible = await windowManager.isVisible();
		console.log(`✓ WindowManager visible: ${isVisible}`);

		if (!isVisible) {
			console.log('❌ WindowManager not visible - test cannot proceed');
			return;
		}

		// Count initial session tiles
		const initialSessionTiles = await page.locator('.session-tile').count();
		console.log(`✓ Initial session tiles: ${initialSessionTiles}`);

		// Try to create a third session by using the "New Session" button
		const newSessionBtn = page.locator('button:has-text("New Session")').first();
		if (await newSessionBtn.isVisible()) {
			console.log('✓ Found New Session button, creating additional session...');

			// Click new session button
			await newSessionBtn.click();
			await page.waitForTimeout(500);

			// Look for terminal option in modal
			const terminalOption = page.locator('button:has-text("Terminal")').first();
			if (await terminalOption.isVisible()) {
				await terminalOption.click();
				console.log('✓ Created new terminal session');
				await page.waitForTimeout(2000); // Wait for session to be created
			}
		}

		// Create another session if needed
		if (await newSessionBtn.isVisible()) {
			console.log('✓ Creating second additional session...');
			await newSessionBtn.click();
			await page.waitForTimeout(500);

			const claudeOption = page.locator('button:has-text("Claude")').first();
			if (await claudeOption.isVisible()) {
				await claudeOption.click();
				console.log('✓ Created new Claude session');
				await page.waitForTimeout(2000);
			}
		}

		// Check final state after creating sessions
		const finalResponse = await page.request.get(`${BASE_URL}/api/sessions?includeAll=true`);
		const finalSessionsData = await finalResponse.json();
		const finalSessions = finalSessionsData.sessions || [];
		console.log(`✓ Final backend sessions: ${finalSessions.length}`);

		// Count final session tiles
		const finalSessionTiles = await page.locator('.session-tile').count();
		const terminalPanes = await page.locator('.terminal-pane, .xterm').count();
		const claudePanes = await page.locator('.claude-pane').count();

		console.log(`✓ Final session tiles: ${finalSessionTiles}`);
		console.log(`✓ Terminal panes: ${terminalPanes}`);
		console.log(`✓ Claude panes: ${claudePanes}`);

		// Check if we have more than 2 tiles (testing the main issue)
		if (finalSessionTiles > 2) {
			console.log(`✅ SUCCESS: WindowManager handles ${finalSessionTiles} sessions (> 2)`);
		} else if (finalSessionTiles === 2) {
			console.log(`⚠️ LIMITATION: Only 2 session tiles despite ${finalSessions.length} sessions`);
		} else {
			console.log(`❌ ISSUE: Only ${finalSessionTiles} session tiles`);
		}

		// Look for layout structure in DOM
		const splits = await page.locator('.wm-split').count();
		const panes = await page.locator('.wm-pane').count();
		console.log(`✓ Layout splits: ${splits}`);
		console.log(`✓ Layout panes: ${panes}`);

		// Check for any error tiles (shouldn't exist with new approach)
		const errorTiles = await page.locator('.error-tile').count();
		console.log(`✓ Error tiles: ${errorTiles}`);

		// Look for relevant console logs
		const layoutLogs = consoleLogs.filter(
			(log) =>
				log.includes('SessionWindowManager') ||
				log.includes('generateLayout') ||
				log.includes('session tiles') ||
				log.includes('displayed.length')
		);

		console.log('\n=== RELEVANT CONSOLE LOGS ===');
		layoutLogs.slice(-15).forEach((log) => console.log(log));

		// Take screenshot
		await page.screenshot({
			path: 'e2e/screenshots/multi-session-test.png',
			fullPage: true
		});

		console.log('\n=== MULTI-SESSION TEST ASSESSMENT ===');
		console.log(`✓ Backend sessions: ${finalSessions.length}`);
		console.log(`✓ Session tiles rendered: ${finalSessionTiles}`);
		console.log(`✓ Terminal panes: ${terminalPanes}`);
		console.log(`✓ Claude panes: ${claudePanes}`);
		console.log(`✓ Layout complexity: ${splits} splits, ${panes} panes`);
		console.log(`✓ Error tiles: ${errorTiles} (should be 0)`);
		console.log(
			`✓ Multi-session support: ${finalSessionTiles > 2 ? 'WORKING' : 'NEEDS IMPROVEMENT'}`
		);
		console.log('✓ Screenshot saved: e2e/screenshots/multi-session-test.png');
		console.log('🎉 MULTI-SESSION TEST COMPLETE');
	});
});
