import { test, expect } from '@playwright/test';

const TERMINAL_KEY = 'testkey12345';

// Helper function to setup authenticated session
async function authenticate(page) {
	await page.goto('/workspace');
	await page.fill('[name="key"]', TERMINAL_KEY);
	await page.click('button[type="submit"]');
	await page.waitForURL('**/workspace');
}

// Helper function to create a workspace
async function createWorkspace(page, name) {
	await page.click('button:has-text("Create Workspace")');
	await page.fill('input[placeholder*="workspace"]', name);
	await page.click('button:has-text("Create")');
	await page.waitForTimeout(1000);
}

// Helper function to open a session
async function openSession(page, type = 'terminal') {
	if (type === 'terminal') {
		await page.click('button:has-text("New Terminal")');
	} else {
		await page.click('button:has-text("New Claude Session")');
	}
	await page.waitForTimeout(2000);
}

test.describe('Desktop Screenshots', () => {
	test.use({ viewport: { width: 1920, height: 1080 } });

	test('Desktop - Authentication Screen', async ({ page }) => {
		await page.goto('/workspace');
		await page.screenshot({ path: 'screenshots/desktop-auth.png', fullPage: true });
	});

	test('Desktop - Empty Workspace List', async ({ page }) => {
		await authenticate(page);
		await page.screenshot({ path: 'screenshots/desktop-empty-workspace.png', fullPage: true });
	});

	test('Desktop - Create Workspace Modal', async ({ page }) => {
		await authenticate(page);
		await page.click('button:has-text("Create Workspace")');
		await page.waitForTimeout(500);
		await page.screenshot({
			path: 'screenshots/desktop-create-workspace-modal.png',
			fullPage: true
		});
	});

	test('Desktop - Workspace with Sessions', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'test-workspace');
		await page.screenshot({ path: 'screenshots/desktop-workspace-created.png', fullPage: true });

		// Open terminal session
		await openSession(page, 'terminal');
		await page.screenshot({ path: 'screenshots/desktop-terminal-session.png', fullPage: true });

		// Try to capture multiple sessions
		await openSession(page, 'terminal');
		await page.screenshot({ path: 'screenshots/desktop-multiple-sessions.png', fullPage: true });
	});

	test('Desktop - Session Header Actions', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'actions-workspace');
		await openSession(page, 'terminal');

		// Hover over session header to show actions
		const sessionHeader = page.locator('.session-header').first();
		await sessionHeader.hover();
		await page.screenshot({
			path: 'screenshots/desktop-session-header-actions.png',
			fullPage: true
		});
	});

	test('Desktop - Claude Session Modal', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'claude-workspace');
		await page.click('button:has-text("New Claude Session")');
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'screenshots/desktop-claude-modal.png', fullPage: true });
	});

	test('Desktop - Terminal with Output', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'terminal-workspace');
		await openSession(page, 'terminal');

		// Type some commands to generate output
		await page.keyboard.type('echo "Hello from Dispatch Terminal"');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(500);
		await page.keyboard.type('ls -la');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'screenshots/desktop-terminal-output.png', fullPage: true });
	});

	test('Desktop - Workspace Switcher', async ({ page }) => {
		await authenticate(page);

		// Create multiple workspaces
		await createWorkspace(page, 'workspace-1');
		await createWorkspace(page, 'workspace-2');
		await createWorkspace(page, 'workspace-3');

		// Click workspace selector
		const workspaceSelector = page
			.locator('.workspace-selector, select, [aria-label*="workspace"]')
			.first();
		if (await workspaceSelector.isVisible()) {
			await workspaceSelector.click();
			await page.waitForTimeout(500);
		}

		await page.screenshot({ path: 'screenshots/desktop-workspace-switcher.png', fullPage: true });
	});

	test('Desktop - Tiled Window Layout', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'tiled-workspace');

		// Open multiple sessions
		await openSession(page, 'terminal');
		await openSession(page, 'terminal');
		await openSession(page, 'terminal');

		// Try to trigger tiling if available
		await page.keyboard.press('Control+Shift+L'); // Common tiling shortcut
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'screenshots/desktop-tiled-layout.png', fullPage: true });
	});
});

test.describe('Mobile Screenshots', () => {
	test.use({
		viewport: { width: 375, height: 812 }, // iPhone X size
		isMobile: true,
		hasTouch: true
	});

	test('Mobile - Authentication Screen', async ({ page }) => {
		await page.goto('/workspace');
		await page.screenshot({ path: 'screenshots/mobile-auth.png', fullPage: true });
	});

	test('Mobile - Empty Workspace List', async ({ page }) => {
		await authenticate(page);
		await page.screenshot({ path: 'screenshots/mobile-empty-workspace.png', fullPage: true });
	});

	test('Mobile - Create Workspace Modal', async ({ page }) => {
		await authenticate(page);
		await page.tap('button:has-text("Create Workspace")');
		await page.waitForTimeout(500);
		await page.screenshot({
			path: 'screenshots/mobile-create-workspace-modal.png',
			fullPage: true
		});
	});

	test('Mobile - Bottom Sheet Navigation', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'mobile-workspace');

		// Look for bottom navigation or menu
		const bottomNav = page.locator('.bottom-sheet, .mobile-nav, [role="navigation"]').first();
		if (await bottomNav.isVisible()) {
			await bottomNav.tap();
			await page.waitForTimeout(500);
		}

		await page.screenshot({ path: 'screenshots/mobile-bottom-navigation.png', fullPage: true });
	});

	test('Mobile - Terminal Session', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'mobile-terminal');
		await openSession(page, 'terminal');

		await page.screenshot({ path: 'screenshots/mobile-terminal-session.png', fullPage: true });
	});

	test('Mobile - Session Actions Menu', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'mobile-actions');
		await openSession(page, 'terminal');

		// Try to access session actions
		const moreButton = page
			.locator('button[aria-label*="more"], button[aria-label*="menu"], .session-menu')
			.first();
		if (await moreButton.isVisible()) {
			await moreButton.tap();
			await page.waitForTimeout(500);
		}

		await page.screenshot({ path: 'screenshots/mobile-session-actions.png', fullPage: true });
	});

	test('Mobile - Swipe Gestures', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'mobile-swipe');
		await openSession(page, 'terminal');
		await openSession(page, 'terminal');

		// Simulate swipe gesture
		await page.touchscreen.tap(187, 400); // Center of screen
		await page.waitForTimeout(100);
		await page.touchscreen.tap(50, 400); // Swipe simulation
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'screenshots/mobile-swipe-gesture.png', fullPage: true });
	});

	test('Mobile - Claude Session Modal', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'mobile-claude');
		await page.tap('button:has-text("New Claude Session")');
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'screenshots/mobile-claude-modal.png', fullPage: true });
	});

	test('Mobile - Keyboard Open', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'mobile-keyboard');
		await openSession(page, 'terminal');

		// Focus terminal to open keyboard
		const terminal = page.locator('.xterm-helper-textarea, .terminal-input, textarea').first();
		if (await terminal.isVisible()) {
			await terminal.tap();
			await page.waitForTimeout(1000); // Wait for keyboard animation
		}

		await page.screenshot({ path: 'screenshots/mobile-keyboard-open.png', fullPage: true });
	});

	test('Mobile - Workspace List', async ({ page }) => {
		await authenticate(page);

		// Create multiple workspaces
		await createWorkspace(page, 'mobile-ws-1');
		await createWorkspace(page, 'mobile-ws-2');
		await createWorkspace(page, 'mobile-ws-3');

		await page.screenshot({ path: 'screenshots/mobile-workspace-list.png', fullPage: true });
	});
});

test.describe('Tablet Screenshots', () => {
	test.use({
		viewport: { width: 768, height: 1024 }, // iPad size
		isMobile: true,
		hasTouch: true
	});

	test('Tablet - Main Interface', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'tablet-workspace');
		await openSession(page, 'terminal');

		await page.screenshot({ path: 'screenshots/tablet-main-interface.png', fullPage: true });
	});

	test('Tablet - Split View', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'tablet-split');
		await openSession(page, 'terminal');
		await openSession(page, 'terminal');

		await page.screenshot({ path: 'screenshots/tablet-split-view.png', fullPage: true });
	});
});

test.describe('Dark Mode Screenshots', () => {
	test.use({
		viewport: { width: 1920, height: 1080 },
		colorScheme: 'dark'
	});

	test('Dark Mode - Main Interface', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'dark-workspace');
		await openSession(page, 'terminal');

		await page.screenshot({ path: 'screenshots/dark-mode-interface.png', fullPage: true });
	});
});

test.describe('Light Mode Screenshots', () => {
	test.use({
		viewport: { width: 1920, height: 1080 },
		colorScheme: 'light'
	});

	test('Light Mode - Main Interface', async ({ page }) => {
		await authenticate(page);
		await createWorkspace(page, 'light-workspace');
		await openSession(page, 'terminal');

		await page.screenshot({ path: 'screenshots/light-mode-interface.png', fullPage: true });
	});
});

// Clean up helper
test.afterAll(async () => {
	console.log('Screenshots captured successfully in screenshots/ directory');
});
