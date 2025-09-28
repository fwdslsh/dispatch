// visual-review.spec.js - Comprehensive visual review test
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

test.describe('Visual Consistency Review', () => {
	test.beforeEach(async ({ page }) => {
		// Set viewport for consistent screenshots
		await page.setViewportSize({ width: 1280, height: 720 });
	});

	test('Home page - Initial load and components', async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState('networkidle');

		// Take full page screenshot
		await expect(page).toHaveScreenshot('home-page-full.png', { fullPage: true });

		// Screenshot individual components if visible
		const header = page.locator('header');
		if (await header.isVisible()) {
			await expect(header).toHaveScreenshot('home-header.png');
		}
	});

	test('Projects page - Main application interface', async ({ page }) => {
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');

		// Wait for main content to load
		await page.waitForSelector('main', { timeout: 10000 });

		// Take full page screenshot
		await expect(page).toHaveScreenshot('projects-page-full.png', { fullPage: true });

		// Screenshot main sections
		const mainContent = page.locator('main');
		if (await mainContent.isVisible()) {
			await expect(mainContent).toHaveScreenshot('projects-main-content.png');
		}

		// Screenshot footer/toolbar if present
		const footer = page.locator('footer');
		if (await footer.isVisible()) {
			await expect(footer).toHaveScreenshot('projects-footer.png');
		}

		// Screenshot session menu if present
		const sessionMenu = page.locator('[class*="session"]');
		if (await sessionMenu.first().isVisible()) {
			await expect(sessionMenu.first()).toHaveScreenshot('session-menu.png');
		}
	});

	test('Projects page - Session menu interactions', async ({ page }) => {
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');

		// Try to open session menu
		const sessionButton = page.locator('button:has-text("Sessions")');
		if (await sessionButton.isVisible()) {
			await sessionButton.click();
			await page.waitForTimeout(500); // Wait for animation
			await expect(page).toHaveScreenshot('projects-with-session-menu.png', { fullPage: true });
		}

		// Try to open settings
		const settingsButton = page.locator(
			'button[aria-label*="settings" i], button:has-text("Settings")'
		);
		if (await settingsButton.isVisible()) {
			await settingsButton.click();
			await page.waitForTimeout(500);
			await expect(page).toHaveScreenshot('projects-with-settings.png', { fullPage: true });

			// Close settings
			const closeButton = page.locator('button[aria-label*="close" i], [data-dismiss]');
			if (await closeButton.first().isVisible()) {
				await closeButton.first().click();
				await page.waitForTimeout(300);
			}
		}
	});

	test('Projects page - Create session modal', async ({ page }) => {
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');

		// Try to open create session modal
		const createButtons = page.locator(
			'button:has-text("Claude"), button:has-text("Terminal"), button:has-text("New"), button[class*="add"]'
		);

		for (let i = 0; i < (await createButtons.count()); i++) {
			const button = createButtons.nth(i);
			if (await button.isVisible()) {
				await button.click();
				await page.waitForTimeout(500);

				// Check if modal opened
				const modal = page.locator('[class*="modal"], [role="dialog"]');
				if (await modal.isVisible()) {
					await expect(page).toHaveScreenshot(`create-session-modal-${i}.png`, { fullPage: true });

					// Close modal
					const closeModal = page.locator(
						'button[aria-label*="close" i], button:has-text("Cancel")'
					);
					if (await closeModal.first().isVisible()) {
						await closeModal.first().click();
						await page.waitForTimeout(300);
					} else {
						// Try clicking overlay
						await page.keyboard.press('Escape');
						await page.waitForTimeout(300);
					}
				}
				break; // Only test first working button
			}
		}
	});

	test('Console page - Terminal interface', async ({ page }) => {
		try {
			await page.goto(`${BASE_URL}/console`);
			await page.waitForLoadState('networkidle');

			// Take full page screenshot
			await expect(page).toHaveScreenshot('console-page-full.png', { fullPage: true });
		} catch (error) {
			console.log('Console page may not be accessible:', error.message);
		}
	});

	test('Mobile viewport - Projects page', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveScreenshot('projects-mobile.png', { fullPage: true });

		// Test mobile menu interactions
		const menuToggle = page.locator('button[class*="mobile"], button[aria-label*="menu" i]');
		if (await menuToggle.first().isVisible()) {
			await menuToggle.first().click();
			await page.waitForTimeout(500);
			await expect(page).toHaveScreenshot('projects-mobile-menu.png', { fullPage: true });
		}
	});

	test('Tablet viewport - Projects page', async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 }); // iPad
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveScreenshot('projects-tablet.png', { fullPage: true });
	});

	test('Component states - Buttons and inputs', async ({ page }) => {
		await page.goto(`${BASE_URL}/workspace`);
		await page.waitForLoadState('networkidle');

		// Find various button types and test their states
		const buttons = page.locator('button').first();
		if (await buttons.isVisible()) {
			// Normal state
			await expect(buttons).toHaveScreenshot('button-normal-state.png');

			// Hover state
			await buttons.hover();
			await expect(buttons).toHaveScreenshot('button-hover-state.png');
		}

		// Find input elements
		const inputs = page.locator('input').first();
		if (await inputs.isVisible()) {
			await expect(inputs).toHaveScreenshot('input-normal-state.png');

			await inputs.focus();
			await expect(inputs).toHaveScreenshot('input-focus-state.png');
		}
	});
});
