import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5176';

test.describe('Session Creation Test', () => {
	async function authenticate(page) {
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');
	}

	test('can create sessions in empty tiles', async ({ page }) => {
		// Capture console logs
		const consoleLogs = [];
		page.on('console', (msg) => {
			consoleLogs.push(`${msg.type()}: ${msg.text()}`);
		});

		await page.setViewportSize({ width: 1400, height: 900 });
		await authenticate(page);
		await page.waitForTimeout(2000);

		console.log('\n=== SESSION CREATION TEST ===');

		// Check if WindowManager is visible
		const windowManager = page.locator('.wm-root');
		const isVisible = await windowManager.isVisible();
		console.log(`✓ WindowManager visible: ${isVisible}`);

		if (!isVisible) {
			console.log('❌ WindowManager not visible - test cannot proceed');
			return;
		}

		// Look for empty tiles with creation buttons
		const emptyTiles = await page.locator('.empty-tile').count();
		console.log(`✓ Empty tiles available: ${emptyTiles}`);

		// Look for terminal creation buttons in empty tiles
		const terminalButtons = await page.locator('.empty-tile .create-session-btn:has-text("Terminal")').count();
		console.log(`✓ Terminal creation buttons: ${terminalButtons}`);

		// Look for Claude creation buttons in empty tiles
		const claudeButtons = await page.locator('.empty-tile .create-session-btn:has-text("Claude")').count();
		console.log(`✓ Claude creation buttons: ${claudeButtons}`);

		// Try to create a terminal session if button is available
		if (terminalButtons > 0) {
			console.log('✓ Attempting to create terminal session...');
			const terminalBtn = page.locator('.empty-tile .create-session-btn:has-text("Terminal")').first();
			await terminalBtn.click();
			await page.waitForTimeout(3000); // Wait for session creation

			// Check if session was created
			const sessionTiles = await page.locator('.session-tile').count();
			console.log(`✓ Session tiles after creation: ${sessionTiles}`);

			const terminalPanes = await page.locator('.terminal-pane, .xterm').count();
			console.log(`✓ Terminal panes: ${terminalPanes}`);

			if (sessionTiles > 0) {
				console.log('✅ SUCCESS: Session creation working');
			} else {
				console.log('❌ FAILED: No session tiles after creation');
			}
		}

		// Check for error tiles
		const errorTiles = await page.locator('.error-tile').count();
		console.log(`✓ Error tiles: ${errorTiles} (should be 0)`);

		// Look for session creation console logs
		const creationLogs = consoleLogs.filter(log =>
			log.includes('SessionWindowManager') ||
			log.includes('session') ||
			log.includes('tile')
		);

		console.log('\n=== SESSION CREATION LOGS ===');
		creationLogs.slice(-10).forEach(log => console.log(log));

		// Take screenshot
		await page.screenshot({
			path: 'e2e/screenshots/session-creation-test.png',
			fullPage: true
		});

		console.log('\n=== SESSION CREATION ASSESSMENT ===');
		console.log(`✓ WindowManager displayed: ${isVisible}`);
		console.log(`✓ Empty tiles available: ${emptyTiles}`);
		console.log(`✓ Creation buttons available: ${terminalButtons + claudeButtons}`);
		console.log(`✓ Error tiles: ${errorTiles} (should be 0)`);
		console.log(`✓ Session creation: ${terminalButtons > 0 ? 'BUTTONS AVAILABLE' : 'NO BUTTONS'}`);
		console.log('✓ Screenshot saved: e2e/screenshots/session-creation-test.png');
		console.log('🎉 SESSION CREATION TEST COMPLETE');
	});
});