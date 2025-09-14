import { test, expect } from '@playwright/test';

test.describe('Site Verification', () => {
	test('should load the homepage and display key elements', async ({ page }) => {
		// Navigate to the homepage
		await page.goto('http://localhost:5173/');

		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Check that the page title is set
		await expect(page).toHaveTitle(/dispatch/i);

		// Check for main structural elements
		const mainContent = page.locator('main');
		await expect(mainContent).toBeVisible();

		// Check for the header toolbar
		const headerToolbar = page.locator('.header-toolbar');
		await expect(headerToolbar).toBeVisible();

		// Check for the new session button
		const newSessionButton = page.locator('button:has-text("New Session")');
		await expect(newSessionButton).toBeVisible();

		// Check that the main container exists
		const container = page.locator('.container');
		await expect(container).toBeVisible();

		// Verify no console errors (except expected ones)
		const consoleErrors = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				// Ignore expected WebSocket connection errors in dev mode
				const text = msg.text();
				if (!text.includes('WebSocket') && !text.includes('socket.io')) {
					consoleErrors.push(text);
				}
			}
		});

		// Wait a moment to catch any delayed errors
		await page.waitForTimeout(1000);

		// Check there are no unexpected console errors
		expect(consoleErrors).toHaveLength(0);
	});

	test('should open the new session modal when button is clicked', async ({ page }) => {
		await page.goto('http://localhost:5173/');
		await page.waitForLoadState('networkidle');

		// Click the new session button
		const newSessionButton = page.locator('button:has-text("New Session")');
		await newSessionButton.click();

		// Wait for the modal to appear
		const modal = page.locator('.modal-overlay');
		await expect(modal).toBeVisible();

		// Check that the modal has the expected content
		const modalTitle = page.locator('.modal-header h2');
		await expect(modalTitle).toContainText('Create Session');

		// Check for session type buttons
		const claudeButton = page.locator('button:has-text("Claude Session")');
		const shellButton = page.locator('button:has-text("Shell Session")');

		await expect(claudeButton).toBeVisible();
		await expect(shellButton).toBeVisible();

		// Close the modal by clicking the overlay
		await modal.click({ position: { x: 10, y: 10 } });
		await expect(modal).not.toBeVisible();
	});

	test('should display projects page when navigated', async ({ page }) => {
		await page.goto('http://localhost:5173/projects');
		await page.waitForLoadState('networkidle');

		// Check for the projects container
		const projectsContainer = page.locator('.projects-container');
		await expect(projectsContainer).toBeVisible();

		// Check for session list header
		const sessionHeader = page.locator('h2:has-text("Sessions")');
		await expect(sessionHeader).toBeVisible();
	});

	test('should have responsive layout', async ({ page }) => {
		await page.goto('http://localhost:5173/');
		await page.waitForLoadState('networkidle');

		// Test desktop viewport
		await page.setViewportSize({ width: 1920, height: 1080 });
		const desktopContainer = page.locator('.container');
		await expect(desktopContainer).toBeVisible();

		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		const mobileContainer = page.locator('.container');
		await expect(mobileContainer).toBeVisible();

		// Verify mobile-specific adjustments are applied
		const headerToolbar = page.locator('.header-toolbar');
		await expect(headerToolbar).toBeVisible();
	});
});
