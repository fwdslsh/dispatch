import { test, expect } from '@playwright/test';

test.describe('Directory Clone Feature', () => {
	test('should allow cloning directories via the directory browser', async ({ page }) => {
		// Navigate to the workspace
		await page.goto('/');

		// Enter terminal key
		await page.fill('input[placeholder*="terminal key"]', 'testkey12345');
		await page.click('button:has-text("connect")');

		// Wait for workspace to load
		await page.waitForURL('/workspace');

		// Create a File Editor session to access directory browser
		await page.click('button:has-text("+ File Editor")');

		// Wait for directory browser to load
		await page.waitForSelector('.directory-browser');

		// Click the clone directory button
		await page.click('button[title="Clone current directory"]');

		// Verify clone form appears
		await expect(page.locator('text=Clone Directory')).toBeVisible();
		await expect(page.locator('input[placeholder*="Source directory"]')).toBeVisible();
		await expect(page.locator('input[placeholder*="Target directory"]')).toBeVisible();

		// Verify source path is pre-filled
		const sourceInput = page.locator('input[placeholder*="Source directory"]');
		await expect(sourceInput).toHaveValue(/.*dispatch$/);

		// Verify target path has a default suggestion
		const targetInput = page.locator('input[placeholder*="Target directory"]');
		await expect(targetInput).toHaveValue(/.*-clone$/);

		// Test canceling the clone operation
		await page.click('button:has-text("Cancel")');
		await expect(page.locator('text=Clone Directory')).not.toBeVisible();

		// Test opening clone form again
		await page.click('button[title="Clone current directory"]');
		await expect(page.locator('text=Clone Directory')).toBeVisible();

		// Cancel again to clean up
		await page.click('button:has-text("Cancel")');
	});
});
