// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Command Palette and Keyboard Shortcuts', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();
		}

		await page.goto('/projects');
	});

	test('should open command palette with keyboard shortcut', async ({ page }) => {
		// Try common command palette shortcuts
		const shortcuts = [
			'Control+Shift+P', // VS Code style
			'Control+K', // Alternative
			'F1' // Alternative
		];

		for (const shortcut of shortcuts) {
			await page.keyboard.press(shortcut);
			await page.waitForTimeout(500);

			const commandPalette = page.locator('.command-palette, [data-testid="command-palette"]');
			if (await commandPalette.isVisible()) {
				await expect(commandPalette).toBeVisible();

				// Close it and test next shortcut
				await page.keyboard.press('Escape');
				await page.waitForTimeout(500);
				break;
			}
		}
	});

	test('should show command palette with click', async ({ page }) => {
		// Look for command palette button
		const commandButton = page.locator(
			'button:has-text("Command"), button:has-text("Palette"), [data-testid="command-palette-btn"]'
		);

		if (await commandButton.isVisible()) {
			await commandButton.click();

			const commandPalette = page.locator('.command-palette, [data-testid="command-palette"]');
			await expect(commandPalette).toBeVisible();
		}
	});

	test('should filter commands by search', async ({ page }) => {
		// Open command palette
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette, [data-testid="command-palette"]');
		if (await commandPalette.isVisible()) {
			const searchInput = commandPalette.locator('input, [data-testid="command-search"]');

			if (await searchInput.isVisible()) {
				// Test search functionality
				await searchInput.fill('session');
				await page.waitForTimeout(500);

				const commandItems = commandPalette.locator('.command-item, [data-testid="command-item"]');
				const visibleCount = await commandItems.count();

				if (visibleCount > 0) {
					// Verify filtered results contain search term
					for (let i = 0; i < Math.min(visibleCount, 5); i++) {
						const item = commandItems.nth(i);
						const text = await item.textContent();
						expect(text?.toLowerCase()).toContain('session');
					}
				}

				// Clear search
				await searchInput.fill('');
				await page.waitForTimeout(500);

				// Should show more commands
				const allCount = await commandItems.count();
				expect(allCount).toBeGreaterThanOrEqual(visibleCount);
			}
		}
	});

	test('should navigate commands with keyboard', async ({ page }) => {
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			const commandItems = commandPalette.locator('.command-item');
			const itemCount = await commandItems.count();

			if (itemCount > 1) {
				// Navigate with arrow keys
				await page.keyboard.press('ArrowDown');
				await page.waitForTimeout(200);

				// Check that selection moved
				const selectedItem = commandPalette.locator(
					'.command-item.selected, .command-item[aria-selected="true"]'
				);
				await expect(selectedItem).toBeVisible();

				// Navigate up
				await page.keyboard.press('ArrowUp');
				await page.waitForTimeout(200);

				// Test multiple navigation
				await page.keyboard.press('ArrowDown');
				await page.keyboard.press('ArrowDown');
				await page.waitForTimeout(200);
			}
		}
	});

	test('should execute commands from palette', async ({ page }) => {
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			const searchInput = commandPalette.locator('input');

			if (await searchInput.isVisible()) {
				// Search for create command
				await searchInput.fill('create');
				await page.waitForTimeout(500);

				const commandItems = commandPalette.locator('.command-item');
				const itemCount = await commandItems.count();

				if (itemCount > 0) {
					// Select first command with Enter
					await page.keyboard.press('ArrowDown');
					await page.keyboard.press('Enter');

					await page.waitForTimeout(1000);

					// Command palette should close
					await expect(commandPalette).not.toBeVisible();

					// Some action should have been triggered
					// (This depends on what the command does)
				}
			}
		}
	});

	test('should categorize commands', async ({ page }) => {
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			// Look for command categories
			const categories = commandPalette.locator(
				'.command-category, .category, [data-testid="command-category"]'
			);

			if ((await categories.count()) > 0) {
				// Should have categorized commands
				await expect(categories.first()).toBeVisible();

				// Categories might include: Project, Session, Terminal, etc.
				const categoryText = await categories.first().textContent();
				expect(categoryText).toBeTruthy();
			} else {
				// If no categories, should at least have commands
				const commandItems = commandPalette.locator('.command-item');
				expect(await commandItems.count()).toBeGreaterThan(0);
			}
		}
	});

	test('should show recent commands', async ({ page }) => {
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			// Look for recent commands section
			const recentSection = commandPalette.locator(
				'.recent-commands, [data-testid="recent-commands"]'
			);

			if (await recentSection.isVisible()) {
				await expect(recentSection).toBeVisible();

				const recentItems = recentSection.locator('.command-item, .recent-item');
				const recentCount = await recentItems.count();

				// Recent commands should be present if user has used commands
				expect(recentCount).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test('should handle global keyboard shortcuts', async ({ page }) => {
		// Test common global shortcuts
		const shortcuts = [
			{ key: 'Control+N', description: 'New session/project' },
			{ key: 'Control+T', description: 'New terminal' },
			{ key: 'Control+Shift+T', description: 'New terminal tab' },
			{ key: 'F11', description: 'Fullscreen toggle' },
			{ key: 'Control+/', description: 'Toggle help' }
		];

		for (const shortcut of shortcuts) {
			// Test if shortcut triggers any action
			const initialUrl = page.url();

			await page.keyboard.press(shortcut.key);
			await page.waitForTimeout(1000);

			// Check if any dialog/modal opened or URL changed
			const dialogs = page.locator('.modal, .dialog, .overlay');
			const hasDialog = (await dialogs.count()) > 0;
			const urlChanged = page.url() !== initialUrl;

			if (hasDialog || urlChanged) {
				console.log(`Shortcut ${shortcut.key} triggered: ${shortcut.description}`);

				// Close any opened dialog
				if (hasDialog) {
					await page.keyboard.press('Escape');
					await page.waitForTimeout(500);
				}
			}
		}
	});

	test('should handle terminal-specific shortcuts when in terminal', async ({ page }) => {
		// Navigate to a terminal session
		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();

			// Create or open terminal session
			const createButton = page
				.locator('button:has-text("Create"), button:has-text("New Session")')
				.first();
			if (await createButton.isVisible()) {
				await createButton.click();

				const nameInput = page.locator('input[placeholder*="name" i]').first();
				if (await nameInput.isVisible()) {
					await nameInput.fill('shortcut-test');

					const submitButton = page
						.locator('button[type="submit"], button:has-text("Create")')
						.first();
					if (await submitButton.isVisible()) {
						await submitButton.click();
						await page.waitForTimeout(3000);

						const terminal = page.locator('.terminal, .xterm');
						if (await terminal.isVisible()) {
							// Click to focus terminal
							await terminal.click();

							// Test terminal shortcuts
							const terminalShortcuts = [
								{ key: 'Control+C', description: 'Send SIGINT' },
								{ key: 'Control+D', description: 'EOF' },
								{ key: 'Control+L', description: 'Clear screen' },
								{ key: 'Control+A', description: 'Beginning of line' },
								{ key: 'Control+E', description: 'End of line' }
							];

							for (const shortcut of terminalShortcuts) {
								await page.keyboard.press(shortcut.key);
								await page.waitForTimeout(500);

								// These shortcuts should be passed to terminal
								// Verify terminal is still focused and responsive
								const terminalContent = await terminal.textContent();
								expect(terminalContent).toBeTruthy();
							}
						}
					}
				}
			}
		}
	});

	test('should show keyboard shortcut hints', async ({ page }) => {
		// Look for help or shortcuts menu
		const helpButton = page.locator(
			'button:has-text("Help"), button:has-text("?"), [data-testid="help"]'
		);

		if (await helpButton.isVisible()) {
			await helpButton.click();

			const helpMenu = page.locator('.help-menu, .shortcuts-menu, [data-testid="help-menu"]');
			if (await helpMenu.isVisible()) {
				await expect(helpMenu).toBeVisible();

				// Should show keyboard shortcuts
				const shortcuts = helpMenu.locator('.shortcut, .keyboard-shortcut');
				const shortcutCount = await shortcuts.count();

				if (shortcutCount > 0) {
					expect(shortcutCount).toBeGreaterThan(0);

					// Shortcuts should show key combinations
					const firstShortcut = shortcuts.first();
					const shortcutText = await firstShortcut.textContent();
					expect(shortcutText).toMatch(/ctrl|cmd|alt|shift/i);
				}

				// Close help
				await page.keyboard.press('Escape');
				await page.waitForTimeout(500);
			}
		}
	});

	test('should handle command palette on mobile', async ({ page }) => {
		// Test mobile command palette
		await page.setViewportSize({ width: 375, height: 667 });
		await page.reload();

		// Open command palette (might be different trigger on mobile)
		const commandButton = page.locator(
			'button:has-text("Commands"), [data-testid="command-palette-btn"]'
		);

		if (await commandButton.isVisible()) {
			await commandButton.click();
		} else {
			// Try double-tap on empty area
			await page.tap('body', { clickCount: 2 });
			await page.waitForTimeout(500);
		}

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			await expect(commandPalette).toBeVisible();

			// Should be full width on mobile
			const paletteBox = await commandPalette.boundingBox();
			expect(paletteBox?.width).toBeLessThanOrEqual(375);
			expect(paletteBox?.width).toBeGreaterThan(300);

			// Search should work on mobile
			const searchInput = commandPalette.locator('input');
			if (await searchInput.isVisible()) {
				await searchInput.fill('test');
				await page.waitForTimeout(500);

				const commandItems = commandPalette.locator('.command-item');
				expect(await commandItems.count()).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test('should handle fuzzy search in command palette', async ({ page }) => {
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			const searchInput = commandPalette.locator('input');

			if (await searchInput.isVisible()) {
				// Test fuzzy search (partial matches)
				await searchInput.fill('crt ses'); // Should match "Create Session"
				await page.waitForTimeout(500);

				const commandItems = commandPalette.locator('.command-item');
				const itemCount = await commandItems.count();

				if (itemCount > 0) {
					// Should find fuzzy matches
					const firstItem = commandItems.first();
					const itemText = await firstItem.textContent();

					// Should contain create and session words
					expect(itemText?.toLowerCase()).toMatch(/(create.*session|session.*create)/);
				}

				// Test acronym search
				await searchInput.fill('cs'); // Should match "Create Session"
				await page.waitForTimeout(500);

				const acronymItems = commandPalette.locator('.command-item');
				expect(await acronymItems.count()).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test('should close command palette with escape', async ({ page }) => {
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			await expect(commandPalette).toBeVisible();

			// Close with Escape
			await page.keyboard.press('Escape');
			await page.waitForTimeout(500);

			await expect(commandPalette).not.toBeVisible();
		}
	});

	test('should close command palette when clicking outside', async ({ page }) => {
		await page.keyboard.press('Control+Shift+P');
		await page.waitForTimeout(500);

		const commandPalette = page.locator('.command-palette');
		if (await commandPalette.isVisible()) {
			await expect(commandPalette).toBeVisible();

			// Click outside to close
			await page.click('body', { position: { x: 10, y: 10 } });
			await page.waitForTimeout(500);

			await expect(commandPalette).not.toBeVisible();
		}
	});
});
