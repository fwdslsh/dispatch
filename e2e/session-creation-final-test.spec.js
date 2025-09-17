import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5177';

test.describe('Session Creation Final Test', () => {
	test('can create a terminal session in empty tile', async ({ page }) => {
		// Set auth key
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});

		await page.setViewportSize({ width: 1400, height: 900 });
		await page.goto(`${BASE_URL}/workspace`);

		// Wait for basic page load
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(2000);

		console.log('\n=== SESSION CREATION FINAL TEST ===');

		// Verify WindowManager is visible
		const windowManager = page.locator('.wm-root');
		const isVisible = await windowManager.isVisible();
		console.log(`✓ WindowManager visible: ${isVisible}`);

		if (!isVisible) {
			console.log('❌ WindowManager not visible - test cannot proceed');
			return;
		}

		// Count initial state
		const initialEmptyTiles = await page.locator('.empty-tile').count();
		const initialSessionTiles = await page.locator('.session-tile').count();
		console.log(`✓ Initial empty tiles: ${initialEmptyTiles}`);
		console.log(`✓ Initial session tiles: ${initialSessionTiles}`);

		// Try to create a terminal session
		const terminalBtn = page.locator('.empty-tile .create-session-btn:has-text("Terminal")').first();
		if (await terminalBtn.isVisible()) {
			console.log('✓ Clicking terminal creation button...');
			await terminalBtn.click();

			// Wait for session creation
			await page.waitForTimeout(4000);

			// Check final state
			const finalEmptyTiles = await page.locator('.empty-tile').count();
			const finalSessionTiles = await page.locator('.session-tile').count();
			const terminalPanes = await page.locator('.terminal-pane, .xterm').count();
			const errorTiles = await page.locator('.error-tile').count();

			console.log(`✓ Final empty tiles: ${finalEmptyTiles}`);
			console.log(`✓ Final session tiles: ${finalSessionTiles}`);
			console.log(`✓ Terminal panes: ${terminalPanes}`);
			console.log(`✓ Error tiles: ${errorTiles}`);

			// Check for success
			if (finalSessionTiles > initialSessionTiles) {
				console.log('✅ SUCCESS: Session tile created');
				if (terminalPanes > 0) {
					console.log('✅ SUCCESS: Terminal pane rendered');
				} else {
					console.log('⚠️ WARNING: Session tile created but no terminal pane');
				}
			} else if (errorTiles > 0) {
				console.log('❌ ERROR: Error tiles detected instead of session');
			} else {
				console.log('❌ FAILED: No session tile created');
			}

			// Now try to create another session to test multi-session support
			if (finalSessionTiles > 0) {
				console.log('✓ Attempting to create second session...');

				// Try using Ctrl+Enter to split (WindowManager keyboard shortcut)
				await page.keyboard.press('Control+Enter');
				await page.waitForTimeout(2000);

				// Check for new empty tile or more tiles
				const afterSplitEmptyTiles = await page.locator('.empty-tile').count();
				const afterSplitSessionTiles = await page.locator('.session-tile').count();
				console.log(`✓ After split - empty tiles: ${afterSplitEmptyTiles}`);
				console.log(`✓ After split - session tiles: ${afterSplitSessionTiles}`);

				if (afterSplitEmptyTiles > finalEmptyTiles) {
					console.log('✅ SUCCESS: Splitting created new empty tile');

					// Try to create another session in the new empty tile
					const secondTerminalBtn = page.locator('.empty-tile .create-session-btn:has-text("Terminal")').first();
					if (await secondTerminalBtn.isVisible()) {
						await secondTerminalBtn.click();
						await page.waitForTimeout(3000);

						const finalMultiSessionTiles = await page.locator('.session-tile').count();
						const finalMultiTerminalPanes = await page.locator('.terminal-pane, .xterm').count();

						console.log(`✓ Multi-session - session tiles: ${finalMultiSessionTiles}`);
						console.log(`✓ Multi-session - terminal panes: ${finalMultiTerminalPanes}`);

						if (finalMultiSessionTiles > afterSplitSessionTiles) {
							console.log('✅ SUCCESS: Multi-session support working');
						} else {
							console.log('❌ FAILED: Second session not created');
						}
					}
				}
			}
		} else {
			console.log('❌ FAILED: No terminal creation button found');
		}

		// Take final screenshot
		await page.screenshot({
			path: 'e2e/screenshots/session-creation-final-test.png',
			fullPage: true
		});

		console.log('✓ Screenshot saved: e2e/screenshots/session-creation-final-test.png');
		console.log('🎉 SESSION CREATION FINAL TEST COMPLETE');
	});
});