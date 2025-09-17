import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5177';

test.describe('Session Management Tests', () => {
	async function authenticate(page) {
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForSelector('main', { timeout: 10000 });
		await page.waitForTimeout(2000);
	}

	test('can create and close terminal sessions', async ({ page }) => {
		await page.setViewportSize({ width: 1400, height: 900 });
		await authenticate(page);

		console.log('\n=== SESSION MANAGEMENT TEST ===');

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

		// Test 1: Create a terminal session via empty tile button
		console.log('\n--- Test 1: Creating Terminal Session ---');
		const terminalBtn = page.locator('.empty-tile .create-session-btn:has-text("Terminal")').first();
		if (await terminalBtn.isVisible()) {
			console.log('✓ Clicking terminal creation button...');
			await terminalBtn.click();

			// Wait for potential modal or session creation
			await page.waitForTimeout(3000);

			// Check if a modal appeared (directory picker issue)
			const modal = page.locator('.modal, [role="dialog"]').first();
			const modalVisible = await modal.isVisible();
			console.log(`✓ Modal appeared: ${modalVisible}`);

			if (modalVisible) {
				console.log('⚠️ Modal detected - checking if it\'s directory picker');

				// Look for workspace/directory picker elements
				const workspaceInput = page.locator('input[type="text"]').first();
				const createBtn = page.locator('button:has-text("Create")').first();
				const cancelBtn = page.locator('button:has-text("Cancel")').first();

				const hasWorkspaceInput = await workspaceInput.isVisible();
				const hasCreateBtn = await createBtn.isVisible();
				const hasCancelBtn = await cancelBtn.isVisible();

				console.log(`✓ Has workspace input: ${hasWorkspaceInput}`);
				console.log(`✓ Has create button: ${hasCreateBtn}`);
				console.log(`✓ Has cancel button: ${hasCancelBtn}`);

				if (hasCreateBtn) {
					const isEnabled = await createBtn.isEnabled();
					console.log(`✓ Create button enabled: ${isEnabled}`);
					if (isEnabled) {
						console.log('✓ Attempting to proceed with session creation...');
						await createBtn.click();
						await page.waitForTimeout(3000);
					} else {
						console.log('⚠️ Create button is disabled - session creation failed');
					}
				}
			}

			// Check final state after creation attempt
			const afterCreateSessionTiles = await page.locator('.session-tile').count();
			const afterCreateTerminalPanes = await page.locator('.terminal-pane, .xterm').count();
			const afterCreateErrorTiles = await page.locator('.error-tile').count();

			console.log(`✓ Session tiles after creation: ${afterCreateSessionTiles}`);
			console.log(`✓ Terminal panes after creation: ${afterCreateTerminalPanes}`);
			console.log(`✓ Error tiles after creation: ${afterCreateErrorTiles}`);

			if (afterCreateSessionTiles > initialSessionTiles || afterCreateTerminalPanes > 0) {
				console.log('✅ SUCCESS: Terminal session created');

				// Test 2: Try to close the session
				console.log('\n--- Test 2: Closing Terminal Session ---');

				// Look for close button in session header
				const closeBtn = page.locator('.session-tile .session-header button[title*="Close"], .session-tile .session-header button:has-text("×"), .session-tile .session-header .close-btn').first();
				const closeBtnVisible = await closeBtn.isVisible();
				console.log(`✓ Close button visible: ${closeBtnVisible}`);

				if (closeBtnVisible) {
					console.log('✓ Clicking close button...');
					await closeBtn.click();
					await page.waitForTimeout(2000);

					// Check if session was closed
					const afterCloseSessionTiles = await page.locator('.session-tile').count();
					const afterCloseTerminalPanes = await page.locator('.terminal-pane, .xterm').count();

					console.log(`✓ Session tiles after close: ${afterCloseSessionTiles}`);
					console.log(`✓ Terminal panes after close: ${afterCloseTerminalPanes}`);

					if (afterCloseSessionTiles < afterCreateSessionTiles) {
						console.log('✅ SUCCESS: Session closed successfully');
					} else {
						console.log('❌ FAILED: Session not closed');
					}
				} else {
					console.log('❌ FAILED: No close button found');

					// Debug: Look for any button-like elements in session header
					const headerButtons = await page.locator('.session-tile .session-header button').count();
					console.log(`✓ Debug - buttons in session header: ${headerButtons}`);

					// Look for alternative close mechanisms
					const contextMenu = page.locator('.session-tile').first();
					if (await contextMenu.isVisible()) {
						console.log('✓ Attempting right-click for context menu...');
						await contextMenu.click({ button: 'right' });
						await page.waitForTimeout(1000);

						const contextMenuItems = await page.locator('[role="menu"], .context-menu, .dropdown-menu').count();
						console.log(`✓ Context menu items: ${contextMenuItems}`);
					}
				}
			} else {
				console.log('❌ FAILED: Terminal session not created');

				// Debug info
				console.log(`✓ Debug - Error tiles: ${afterCreateErrorTiles}`);
				if (afterCreateErrorTiles > 0) {
					const errorText = await page.locator('.error-tile').first().textContent();
					console.log(`✓ Debug - Error message: ${errorText}`);
				}
			}
		} else {
			console.log('❌ FAILED: No terminal creation button found');
		}

		// Take final screenshot
		await page.screenshot({
			path: 'e2e/screenshots/session-management-test.png',
			fullPage: true
		});

		console.log('✓ Screenshot saved: e2e/screenshots/session-management-test.png');
		console.log('🎉 SESSION MANAGEMENT TEST COMPLETE');
	});

	test('directory picker modal behavior', async ({ page }) => {
		await page.setViewportSize({ width: 1400, height: 900 });
		await authenticate(page);

		console.log('\n=== DIRECTORY PICKER TEST ===');

		// Try to create a session to trigger directory picker
		const terminalBtn = page.locator('.empty-tile .create-session-btn:has-text("Terminal")').first();
		if (await terminalBtn.isVisible()) {
			await terminalBtn.click();
			await page.waitForTimeout(2000);

			// Check for modal
			const modal = page.locator('.modal, [role="dialog"]').first();
			const modalVisible = await modal.isVisible();
			console.log(`✓ Modal visible: ${modalVisible}`);

			if (modalVisible) {
				// Test modal elements
				const modalTitle = await page.locator('.modal-title, .modal h1, .modal h2').first().textContent().catch(() => 'No title found');
				console.log(`✓ Modal title: ${modalTitle}`);

				// Test input field
				const workspaceInput = page.locator('input[type="text"]').first();
				if (await workspaceInput.isVisible()) {
					console.log('✓ Testing workspace input field...');
					await workspaceInput.fill('/test/workspace/path');

					const inputValue = await workspaceInput.inputValue();
					console.log(`✓ Input value set to: ${inputValue}`);
				}

				// Test buttons
				const buttons = await page.locator('.modal button').count();
				console.log(`✓ Modal buttons count: ${buttons}`);

				const buttonTexts = await page.locator('.modal button').allTextContents();
				console.log(`✓ Button texts: ${buttonTexts.join(', ')}`);

				// Test cancel behavior
				const cancelBtn = page.locator('button:has-text("Cancel")').first();
				if (await cancelBtn.isVisible()) {
					console.log('✓ Testing cancel button...');
					await cancelBtn.click();
					await page.waitForTimeout(1000);

					const modalStillVisible = await modal.isVisible();
					console.log(`✓ Modal closed after cancel: ${!modalStillVisible}`);
				}
			} else {
				console.log('⚠️ No modal appeared - session creation might be direct');
			}
		}

		console.log('🎉 DIRECTORY PICKER TEST COMPLETE');
	});
});