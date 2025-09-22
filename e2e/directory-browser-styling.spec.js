import { test, expect } from '@playwright/test';

const TEST_AUTH_KEY = 'testkey12345';

test.describe('Directory Browser Styling', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate and authenticate
		await page.goto('/');
		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill(TEST_AUTH_KEY);
			await page.getByRole('button', { name: 'connect' }).click();
			await page.waitForURL('**/workspace');
		}
	});

	test('should display properly styled directory browser items', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForLoadState('networkidle');

		// Create a file editor session to access directory browser
		const fileEditorButton = page.getByRole('button', { name: '+ File Editor' }).first();
		if (await fileEditorButton.isVisible()) {
			await fileEditorButton.click();
			await page.waitForTimeout(2000); // Wait for session to initialize
		}

		// Check that directory browser is present
		const directoryBrowser = page.locator('.directory-browser');
		await expect(directoryBrowser).toBeVisible();

		// Navigate to repository root to ensure we have content
		const rootBreadcrumb = page.getByRole('button', { name: 'dispatch' }).last();
		if (await rootBreadcrumb.isVisible()) {
			await rootBreadcrumb.click();
			await page.waitForTimeout(1000);
		}

		// Verify parent directory button exists and is styled properly
		const parentDirButton = page.locator('.parent-dir .item-button');
		if (await parentDirButton.count() > 0) {
			await expect(parentDirButton.first()).toBeVisible();
			
			// Check that parent directory button has proper styling
			const parentDirStyles = await parentDirButton.first().evaluate((el) => {
				const computed = window.getComputedStyle(el);
				return {
					display: computed.display,
					backgroundColor: computed.backgroundColor,
					color: computed.color,
					cursor: computed.cursor
				};
			});

			// Verify the button is properly styled (not a grey box)
			expect(parentDirStyles.display).toBe('flex');
			expect(parentDirStyles.cursor).toBe('pointer');
			// Color should not be default grey/black
			expect(parentDirStyles.color).not.toBe('rgb(0, 0, 0)');
		}

		// Check for directory items (folders)
		const directoryItems = page.locator('.list-item button[aria-label*="directory"]');
		const directoryCount = await directoryItems.count();
		
		if (directoryCount > 0) {
			// Test the first few directory items
			for (let i = 0; i < Math.min(directoryCount, 3); i++) {
				const item = directoryItems.nth(i);
				await expect(item).toBeVisible();
				
				// Check styling
				const styles = await item.evaluate((el) => {
					const computed = window.getComputedStyle(el);
					return {
						display: computed.display,
						cursor: computed.cursor,
						color: computed.color,
						backgroundColor: computed.backgroundColor
					};
				});

				expect(styles.display).toBe('flex');
				expect(styles.cursor).toBe('pointer');
				// Ensure it's not a plain grey box
				expect(styles.color).not.toBe('rgb(128, 128, 128)');
			}
		}

		// Check for file items
		const fileItems = page.locator('.list-item button[aria-label*="file"]');
		const fileCount = await fileItems.count();
		
		if (fileCount > 0) {
			// Test the first few file items
			for (let i = 0; i < Math.min(fileCount, 3); i++) {
				const item = fileItems.nth(i);
				await expect(item).toBeVisible();
				
				// Check that file items have proper structure
				const icon = item.locator('.icon');
				const name = item.locator('.name');
				const type = item.locator('.type');
				
				await expect(icon).toBeVisible();
				await expect(name).toBeVisible();
				await expect(type).toBeVisible();
			}
		}
	});

	test('should have working CSS variables for directory browser', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForLoadState('networkidle');

		// Create a file editor session
		const fileEditorButton = page.getByRole('button', { name: '+ File Editor' }).first();
		if (await fileEditorButton.isVisible()) {
			await fileEditorButton.click();
			await page.waitForTimeout(2000);
		}

		// Check that CSS variables are properly resolved within directory browser context
		const cssVars = await page.evaluate(() => {
			const directoryBrowser = document.querySelector('.directory-browser');
			if (directoryBrowser) {
				const styles = window.getComputedStyle(directoryBrowser);
				return {
					dbPrimary: styles.getPropertyValue('--db-primary'),
					dbTextSecondary: styles.getPropertyValue('--db-text-secondary'),
					dbBorderSubtle: styles.getPropertyValue('--db-border-subtle')
				};
			}
			return null;
		});

		// Verify CSS variables are properly resolved
		expect(cssVars).not.toBeNull();
		expect(cssVars.dbPrimary).not.toBe('');
		expect(cssVars.dbTextSecondary).not.toBe('');
		expect(cssVars.dbBorderSubtle).not.toBe('');
	});

	test('should show directory browser toolbar buttons with proper styling', async ({ page }) => {
		await page.goto('/workspace');
		await page.waitForLoadState('networkidle');

		// Create a file editor session
		const fileEditorButton = page.getByRole('button', { name: '+ File Editor' }).first();
		if (await fileEditorButton.isVisible()) {
			await fileEditorButton.click();
			await page.waitForTimeout(2000);
		}

		// Check toolbar buttons exist and are styled
		const createDirButton = page.getByRole('button', { name: 'Create new directory' });
		const cloneDirButton = page.getByRole('button', { name: 'Clone current directory' });
		const uploadButton = page.getByRole('button', { name: 'Upload files' });
		const showHiddenButton = page.getByRole('button', { name: /Show hidden files|Hide hidden files/ });

		await expect(createDirButton).toBeVisible();
		await expect(cloneDirButton).toBeVisible();
		await expect(uploadButton).toBeVisible();
		await expect(showHiddenButton).toBeVisible();

		// Verify buttons are properly styled (clickable)
		for (const button of [createDirButton, cloneDirButton, uploadButton, showHiddenButton]) {
			const styles = await button.evaluate((el) => {
				const computed = window.getComputedStyle(el);
				return {
					cursor: computed.cursor,
					display: computed.display
				};
			});
			expect(styles.cursor).toBe('pointer');
			expect(styles.display).not.toBe('none');
		}
	});
});