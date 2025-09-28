// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Inspect Session Menu', () => {
	test.beforeEach(async ({ page }) => {
		// Set terminal key in local storage before navigating
		await page.addInitScript(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});
		await page.goto('http://localhost:3030/workspace');
	});

	test('inspect session menu tabs and content', async ({ page }) => {
		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Wait for the session menu to be visible
		await expect(page.locator('.session-menu')).toBeVisible();

		// Check if tabs are present
		const tabs = page.locator('.tab-button');
		await expect(tabs).toHaveCount(3);

		// Get tab texts
		const tabTexts = await tabs.allTextContents();
		console.log('Tab texts found:', tabTexts);

		// Click on each tab and inspect content
		for (let i = 0; i < 3; i++) {
			await tabs.nth(i).click();
			await page.waitForTimeout(500); // Wait for transition

			const tabText = await tabs.nth(i).textContent();
			console.log(`\nClicked tab ${i}: "${tabText}"`);

			// Check what content is visible
			const sessionsList = page.locator('.sessions-list');
			const isSessionsVisible = await sessionsList.isVisible().catch(() => false);

			const workspacesList = page.locator('.workspaces-list');
			const isWorkspacesVisible = await workspacesList.isVisible().catch(() => false);

			const commandsList = page.locator('.commands-list');
			const isCommandsVisible = await commandsList.isVisible().catch(() => false);

			console.log('  Sessions list visible:', isSessionsVisible);
			console.log('  Workspaces list visible:', isWorkspacesVisible);
			console.log('  Commands list visible:', isCommandsVisible);

			// Check for any content in the active tab
			const activeContent = page.locator('.tab-content.active');
			const contentText = await activeContent.textContent().catch(() => 'No content');
			console.log('  Active content preview:', contentText?.substring(0, 100));
		}

		// Keep browser open for manual inspection
		await page.pause();
	});
});
