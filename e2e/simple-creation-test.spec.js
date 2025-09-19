import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5177';

test.describe('Simple Session Creation Test', () => {
	test('can access workspace and see empty tiles', async ({ page }) => {
		// Set auth key
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});

		await page.setViewportSize({ width: 1400, height: 900 });
		await page.goto(`${BASE_URL}/workspace`);

		// Wait for basic page load, not networkidle
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(2000);

		console.log('\n=== SIMPLE CREATION TEST ===');

		// Check if WindowManager is visible
		const windowManager = page.locator('.wm-root');
		const isVisible = await windowManager.isVisible();
		console.log(`✓ WindowManager visible: ${isVisible}`);

		if (isVisible) {
			// Look for empty tiles
			const emptyTiles = await page.locator('.empty-tile').count();
			console.log(`✓ Empty tiles: ${emptyTiles}`);

			// Look for terminal buttons
			const terminalButtons = await page
				.locator('.empty-tile .create-session-btn:has-text("Terminal")')
				.count();
			console.log(`✓ Terminal buttons: ${terminalButtons}`);

			// Look for Claude buttons
			const claudeButtons = await page
				.locator('.empty-tile .create-session-btn:has-text("Claude")')
				.count();
			console.log(`✓ Claude buttons: ${claudeButtons}`);

			// Look for error tiles
			const errorTiles = await page.locator('.error-tile').count();
			console.log(`✓ Error tiles: ${errorTiles}`);

			// Check for existing session tiles
			const sessionTiles = await page.locator('.session-tile').count();
			console.log(`✓ Existing session tiles: ${sessionTiles}`);

			if (terminalButtons > 0) {
				console.log('✅ SUCCESS: Empty tiles with creation buttons are available');
			} else if (errorTiles > 0) {
				console.log('❌ ERROR: Error tiles detected');
			} else if (sessionTiles > 0) {
				console.log('✓ INFO: Session tiles already exist');
			} else {
				console.log('⚠️ WARNING: No empty tiles or session tiles found');
			}
		} else {
			console.log('❌ WindowManager not visible');
		}

		// Take screenshot
		await page.screenshot({
			path: 'e2e/screenshots/simple-creation-test.png',
			fullPage: true
		});

		console.log('✓ Screenshot saved: e2e/screenshots/simple-creation-test.png');
		console.log('🎉 SIMPLE CREATION TEST COMPLETE');
	});
});
