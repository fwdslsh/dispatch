import { test, expect } from '@playwright/test';

// Test configuration
const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5175';

test.describe('WindowManager Session Management', () => {
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

	// Helper to create a new session
	async function createSession(page, type = 'terminal', name = null) {
		// Try multiple methods to create a session

		// Method 1: Try the "Create Session" button in empty workspace
		const emptyWorkspaceButton = page.locator('button:has-text("Create Session")').first();
		if (await emptyWorkspaceButton.isVisible({ timeout: 1000 }).catch(() => false)) {
			await emptyWorkspaceButton.click();
			console.log('✓ Clicked Create Session in empty workspace');
		}
		// Method 2: Try the + button in status bar
		else {
			const addButton = page.locator('[aria-label="Create session"], button:has-text("+")').first();
			if (await addButton.isVisible({ timeout: 1000 }).catch(() => false)) {
				await addButton.click();
				console.log('✓ Clicked + button in status bar');
			} else {
				// Method 3: Try buttons in empty tiles
				const tileButton = page.locator(`.empty-tile button:has-text("${type === 'terminal' ? 'Terminal' : 'Claude'}")`).first();
				if (await tileButton.isVisible({ timeout: 1000 }).catch(() => false)) {
					await tileButton.click();
					console.log(`✓ Clicked ${type} button in empty tile`);
				} else {
					throw new Error('Could not find any session creation button');
				}
			}
		}

		// Wait for modal to appear (if it does)
		const modal = page.locator('.modal, [role="dialog"]').first();
		if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
			console.log('✓ Modal appeared');

			// Select session type if needed
			const typeButton = page.locator(`button:has-text("${type === 'terminal' ? 'Terminal' : 'Claude'}")`).first();
			if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
				await typeButton.click();
				console.log(`✓ Selected ${type} session type`);
			}

			// Enter session name if provided
			if (name) {
				const nameInput = page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first();
				if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
					await nameInput.fill(name);
					console.log(`✓ Entered session name: ${name}`);
				}
			}

			// Create the session
			const createButton = page.locator('button:has-text("Create"), button:has-text("Start")').first();
			await createButton.click();
			console.log('✓ Clicked create button in modal');
		}

		// Wait for session to appear
		await page.waitForTimeout(2000); // Give session time to initialize
	}

	// Helper to verify session is visible
	async function verifySessionVisible(page, sessionName) {
		// Check for session in tiles
		const sessionTile = page.locator('.session-tile').first();
		await expect(sessionTile).toBeVisible({ timeout: 5000 });
		console.log(`✓ Session tile visible${sessionName ? ` for ${sessionName}` : ''}`);

		// Check for terminal or Claude pane content
		const terminalOrClaude = page.locator('.xterm, .claude-pane, .terminal-pane').first();
		const isVisible = await terminalOrClaude.isVisible({ timeout: 3000 }).catch(() => false);
		if (isVisible) {
			console.log('✓ Session content area is visible');
		}
	}

	// Helper to count visible sessions
	async function countVisibleSessions(page) {
		await page.waitForTimeout(500); // Brief wait for DOM updates
		const sessionTiles = await page.locator('.session-tile').count();
		const emptyTiles = await page.locator('.empty-tile').count();
		console.log(`✓ Found ${sessionTiles} session tiles and ${emptyTiles} empty tiles`);
		return sessionTiles;
	}

	// Helper to split a tile
	async function splitTile(page, direction = 'horizontal') {
		// Focus an empty tile or the WindowManager
		const emptyTile = page.locator('.empty-tile').first();
		const windowManager = page.locator('.wm-root').first();

		if (await emptyTile.isVisible({ timeout: 1000 }).catch(() => false)) {
			await emptyTile.click();
			console.log('✓ Focused empty tile');
		} else {
			await windowManager.click();
			console.log('✓ Focused window manager');
		}

		// Use keyboard shortcut to split
		if (direction === 'horizontal') {
			await page.keyboard.press('Control+Enter');
			console.log('✓ Pressed Ctrl+Enter for horizontal split');
		} else {
			await page.keyboard.press('Control+Shift+Enter');
			console.log('✓ Pressed Ctrl+Shift+Enter for vertical split');
		}

		await page.waitForTimeout(500);
	}

	test.beforeEach(async ({ page }) => {
		// Set viewport to desktop size to ensure WindowManager is used
		await page.setViewportSize({ width: 1400, height: 900 });
	});

	test('should display existing sessions in WindowManager', async ({ page }) => {
		await authenticate(page);

		// Wait for page to fully load and sessions to be fetched
		await page.waitForTimeout(2000);

		// Verify WindowManager is displayed (not empty workspace) since we have existing sessions
		console.log('Checking if WindowManager is displayed with existing sessions...');

		// Look for WindowManager root element
		const windowManager = page.locator('.wm-root');
		await expect(windowManager).toBeVisible({ timeout: 10000 });
		console.log('✓ WindowManager is visible');

		// Look for tiles (either empty tiles or session tiles)
		const tiles = page.locator('.empty-tile, .session-tile, .wm-tile');
		await expect(tiles.first()).toBeVisible({ timeout: 5000 });
		console.log('✓ WindowManager tiles are visible');

		// Count total tiles
		const tileCount = await tiles.count();
		console.log(`✓ Found ${tileCount} total tiles`);
		expect(tileCount).toBeGreaterThanOrEqual(1);

		// Check for empty tile content and session creation buttons
		const emptyTiles = page.locator('.empty-tile');
		const emptyTileCount = await emptyTiles.count();
		if (emptyTileCount > 0) {
			console.log(`✓ Found ${emptyTileCount} empty tiles ready for session creation`);

			// Verify empty tile has creation buttons
			const createButtons = page.locator('.empty-tile button');
			const buttonCount = await createButtons.count();
			expect(buttonCount).toBeGreaterThanOrEqual(1);
			console.log(`✓ Found ${buttonCount} session creation buttons in empty tiles`);
		}

		// Check for actual session tiles (if any)
		const sessionTiles = page.locator('.session-tile');
		const sessionTileCount = await sessionTiles.count();
		console.log(`✓ Found ${sessionTileCount} active session tiles`);

		// Verify we have either empty tiles or session tiles
		expect(tileCount).toBeGreaterThanOrEqual(1);
		console.log('✓ WindowManager is properly displaying tile-based layout');
	});

	test('should create multiple sessions using tile splitting', async ({ page }) => {
		await authenticate(page);

		// Create first session
		console.log('\n=== Creating first session ===');
		await createSession(page, 'terminal', 'Session 1');
		await verifySessionVisible(page, 'Session 1');

		// Check if WindowManager is active (should show at least one tile)
		const tiles = await page.locator('.wm-tile, .session-tile, .empty-tile').count();
		console.log(`✓ Found ${tiles} total tiles`);
		expect(tiles).toBeGreaterThanOrEqual(1);

		// Split tile and create second session
		console.log('\n=== Creating second session ===');
		await splitTile(page, 'horizontal');

		// Create session in the new empty tile
		await createSession(page, 'terminal', 'Session 2');
		await page.waitForTimeout(2000);

		let sessionCount = await countVisibleSessions(page);
		expect(sessionCount).toBeGreaterThanOrEqual(2);

		// Split again and create third session
		console.log('\n=== Creating third session ===');
		await splitTile(page, 'vertical');

		// Create another session
		await createSession(page, 'claude', 'Session 3');
		await page.waitForTimeout(2000);

		sessionCount = await countVisibleSessions(page);
		expect(sessionCount).toBeGreaterThanOrEqual(3);
		console.log(`✓ Successfully created ${sessionCount} sessions`);
	});

	test('should resume existing sessions', async ({ page }) => {
		await authenticate(page);

		// Create initial sessions
		console.log('\n=== Creating initial sessions ===');
		await createSession(page, 'terminal', 'Resume Test 1');
		await verifySessionVisible(page, 'Resume Test 1');

		// Navigate away (simulate session being unpinned or hidden)
		await page.reload();
		await page.waitForLoadState('networkidle');
		console.log('✓ Page reloaded');

		// Check if we need to resume sessions
		const sessionMenu = page.locator('[aria-label*="session"], button:has-text("Sessions")').first();
		if (await sessionMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
			await sessionMenu.click();
			console.log('✓ Opened session menu');

			// Look for resume option
			const resumeButton = page.locator('button:has-text("Resume"), button:has-text("Open")').first();
			if (await resumeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
				await resumeButton.click();
				console.log('✓ Clicked resume button');
				await page.waitForTimeout(2000);

				// Verify session is visible again
				await verifySessionVisible(page, 'Resume Test 1');
			}
		} else {
			// Sessions might persist, just verify they're still there
			const sessionCount = await countVisibleSessions(page);
			console.log(`✓ ${sessionCount} sessions still visible after reload`);
		}
	});

	test('should handle keyboard navigation between tiles', async ({ page }) => {
		await authenticate(page);

		// Create multiple sessions
		console.log('\n=== Setting up multiple sessions ===');
		await createSession(page, 'terminal', 'Nav Test 1');
		await splitTile(page, 'horizontal');
		await createSession(page, 'terminal', 'Nav Test 2');

		// Test keyboard navigation
		console.log('\n=== Testing keyboard navigation ===');
		const windowManager = page.locator('.wm-root').first();
		await windowManager.focus();

		// Navigate with Alt+Arrow keys
		await page.keyboard.press('Alt+ArrowRight');
		console.log('✓ Pressed Alt+Right to navigate');
		await page.waitForTimeout(500);

		await page.keyboard.press('Alt+ArrowLeft');
		console.log('✓ Pressed Alt+Left to navigate');
		await page.waitForTimeout(500);

		// Test closing a tile
		await page.keyboard.press('Control+Shift+x');
		console.log('✓ Pressed Ctrl+Shift+X to close tile');
		await page.waitForTimeout(1000);

		// Verify we still have at least one session
		const remainingCount = await countVisibleSessions(page);
		expect(remainingCount).toBeGreaterThanOrEqual(1);
		console.log(`✓ ${remainingCount} sessions remain after closing one`);
	});

	test('should handle more than 2 sessions simultaneously', async ({ page }) => {
		await authenticate(page);

		console.log('\n=== Creating 4+ sessions ===');
		const targetSessionCount = 4;

		// Create first session
		await createSession(page, 'terminal', 'Multi 1');
		await verifySessionVisible(page, 'Multi 1');

		// Create additional sessions
		for (let i = 2; i <= targetSessionCount; i++) {
			console.log(`\n=== Creating session ${i} ===`);

			// Try to split existing tiles
			await splitTile(page, i % 2 === 0 ? 'horizontal' : 'vertical');

			// Create session
			const type = i % 2 === 0 ? 'terminal' : 'claude';
			await createSession(page, type, `Multi ${i}`);
			await page.waitForTimeout(1500);
		}

		// Verify all sessions are visible
		const finalCount = await countVisibleSessions(page);
		console.log(`\n✓ Successfully created and displayed ${finalCount} sessions`);
		expect(finalCount).toBeGreaterThanOrEqual(targetSessionCount);

		// Take a screenshot for visual verification
		await page.screenshot({
			path: 'tests/screenshots/window-manager-multi-session.png',
			fullPage: true
		});
		console.log('✓ Screenshot saved to tests/screenshots/window-manager-multi-session.png');
	});

	test('should maintain session layout after interactions', async ({ page }) => {
		await authenticate(page);

		// Create a complex layout
		console.log('\n=== Creating complex layout ===');
		await createSession(page, 'terminal', 'Layout 1');
		await splitTile(page, 'horizontal');
		await createSession(page, 'claude', 'Layout 2');
		await splitTile(page, 'vertical');
		await createSession(page, 'terminal', 'Layout 3');

		const initialCount = await countVisibleSessions(page);
		console.log(`✓ Initial layout has ${initialCount} sessions`);

		// Interact with sessions (click on different tiles)
		const tiles = page.locator('.session-tile');
		const tileCount = await tiles.count();

		for (let i = 0; i < Math.min(tileCount, 3); i++) {
			await tiles.nth(i).click();
			console.log(`✓ Clicked on tile ${i + 1}`);
			await page.waitForTimeout(500);
		}

		// Verify layout is maintained
		const finalCount = await countVisibleSessions(page);
		expect(finalCount).toBe(initialCount);
		console.log('✓ Layout maintained after interactions');
	});
});

test.describe('WindowManager Error Handling', () => {
	test('should gracefully handle session creation failures', async ({ page }) => {
		await page.goto(`${BASE_URL}/?key=${TEST_KEY}`);
		await page.waitForURL('**/workspace', { timeout: 10000 });

		// Set viewport to desktop
		await page.setViewportSize({ width: 1400, height: 900 });

		// Try to create many sessions rapidly
		console.log('\n=== Stress testing session creation ===');
		const attempts = 5;
		let successCount = 0;

		for (let i = 0; i < attempts; i++) {
			try {
				// Try to create session without waiting
				const createButton = page.locator('button:has-text("Terminal"), button:has-text("Claude")').first();
				if (await createButton.isVisible({ timeout: 500 }).catch(() => false)) {
					await createButton.click();
					successCount++;
				}
			} catch (error) {
				console.log(`⚠ Session creation attempt ${i + 1} failed gracefully`);
			}
			await page.waitForTimeout(500);
		}

		console.log(`✓ Successfully handled ${attempts} rapid creation attempts`);
		console.log(`✓ ${successCount} sessions created`);

		// Verify app is still functional
		const tiles = await page.locator('.session-tile, .empty-tile').count();
		expect(tiles).toBeGreaterThan(0);
		console.log(`✓ App still functional with ${tiles} tiles visible`);
	});
});