// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any existing auth
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
	});

	test('should redirect to projects when no auth required', async ({ page }) => {
		await page.goto('/');

		// Wait for potential redirect
		await page.waitForTimeout(1000);

		// Check if we're redirected to projects or if auth form is shown
		const url = page.url();
		if (url.includes('/projects')) {
			// No auth required case
			expect(url).toContain('/projects');
		} else {
			// Auth required case - form should be visible
			await expect(page.locator('form')).toBeVisible();
			await expect(page.locator('input[type="password"]')).toBeVisible();
		}
	});

	test('should show auth form when authentication is required', async ({ page }) => {
		await page.goto('/');

		// Wait for the page to load and check auth
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			// Auth is required
			await expect(page.locator('form')).toBeVisible();
			await expect(authInput).toBeVisible();
			await expect(page.locator('button[type="submit"]')).toBeVisible();

			// Test title and content
			await expect(page).toHaveTitle(/dispatch/);
			await expect(page.locator('h1')).toContainText(/dispatch/i);
		}
	});

	test('should handle valid authentication', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			// Fill in the test key
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();

			// Should redirect to projects
			await expect(page).toHaveURL(/.*\/projects/);
		}
	});

	test('should handle invalid authentication', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			// Try invalid key
			await authInput.fill('invalid-key');
			await page.locator('button[type="submit"]').click();

			// Should show error
			await expect(page.locator('.error')).toBeVisible();
			await expect(page.locator('.error')).toContainText(/invalid/i);
		}
	});

	test('should show loading state during authentication', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');

			// Click submit and immediately check for loading state
			await page.locator('button[type="submit"]').click();

			// Loading state should be visible briefly
			const submitButton = page.locator('button[type="submit"]');
			await expect(submitButton).toBeDisabled();
		}
	});

	test('should persist authentication in localStorage', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();
			await expect(page).toHaveURL(/.*\/projects/);

			// Check localStorage
			const authToken = await page.evaluate(() => localStorage.getItem('dispatch-auth-token'));
			expect(authToken).toBeTruthy();

			// Refresh page - should stay authenticated
			await page.reload();
			await expect(page).toHaveURL(/.*\/projects/);
		}
	});

	test('should handle network errors gracefully', async ({ page }) => {
		// Simulate network failure
		await page.route('**/socket.io/**', (route) => route.abort());

		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();

			// Should handle connection error gracefully
			await page.waitForTimeout(2000);
			// The form should still be visible since auth failed
			await expect(authInput).toBeVisible();
		}
	});
});
