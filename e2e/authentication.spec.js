/**
 * Authentication E2E Tests
 *
 * Tests for authentication flows including:
 * - API key login/logout
 * - Session persistence
 * - API key management (CRUD)
 * - Protected route access
 * - Multi-tab session synchronization
 */

import { test, expect } from '@playwright/test';
import { resetToOnboarded, resetToFreshInstall } from './helpers/index.js';

const BASE_URL = 'http://localhost:7173';

test.describe('Authentication - API Key Login', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	test('should successfully login with valid API key', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		// Fill in API key
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');

		// Should redirect to workspace
		await page.waitForURL(`${BASE_URL}/workspace`);

		// Verify we're on workspace page
		await expect(page).toHaveURL(/\/workspace$/);
	});

	test('should show error with invalid API key', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		// Fill in invalid API key
		await page.fill('input[name="key"]', 'invalid-key-12345');
		await page.click('button[type="submit"]');

		// Should stay on login page
		await expect(page).toHaveURL(/\/login$/);

		// Should show error message
		const errorMessage = page.locator('text=/Invalid.*key|Authentication.*failed/i');
		await expect(errorMessage).toBeVisible({ timeout: 5000 });
	});

	test('should show error with empty API key', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		// Submit button should be disabled when key is empty
		const submitButton = page.locator('button[type="submit"]');
		await expect(submitButton).toBeDisabled();

		// Should stay on login page
		await expect(page).toHaveURL(/\/login$/);

		// Verify key input is visible and empty
		const keyInput = page.locator('input[name="key"]');
		await expect(keyInput).toBeVisible();
		await expect(keyInput).toHaveValue('');
	});

	test('should redirect to workspace if already authenticated', async ({ page }) => {
		// Login first
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);

		// Try to visit login page again
		await page.goto(`${BASE_URL}/login`);

		// Should redirect to workspace
		await page.waitForURL(`${BASE_URL}/workspace`);
		await expect(page).toHaveURL(/\/workspace$/);
	});
});

test.describe('Authentication - Logout', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should logout and redirect to login page', async ({ page }) => {
		// Navigate to settings Keys section where logout button is located
		await page.goto(`${BASE_URL}/settings?section=keys`);

		// Find and click logout button
		const logoutButton = page.locator('button:has-text("Logout")');
		await expect(logoutButton).toBeVisible({ timeout: 5000 });
		await logoutButton.click();

		// Should redirect to login
		await page.waitForURL(`${BASE_URL}/login`);
		await expect(page).toHaveURL(/\/login$/);
	});

	test('should clear session cookie on logout', async ({ page, context }) => {
		// Logout from Keys section
		await page.goto(`${BASE_URL}/settings?section=keys`);
		const logoutButton = page.locator('button:has-text("Logout")');
		await expect(logoutButton).toBeVisible({ timeout: 5000 });
		await logoutButton.click();
		await page.waitForURL(`${BASE_URL}/login`);

		// Check that session cookie is cleared
		const cookies = await context.cookies();
		const sessionCookie = cookies.find((c) => c.name === 'dispatch_session');

		// Session cookie should be cleared or expired
		if (sessionCookie) {
			// If cookie exists, it should be expired
			expect(sessionCookie.expires).toBeLessThan(Date.now() / 1000);
		}
	});

	test('should require re-authentication after logout', async ({ page }) => {
		// Logout from Keys section
		await page.goto(`${BASE_URL}/settings?section=keys`);
		const logoutButton = page.locator('button:has-text("Logout")');
		await expect(logoutButton).toBeVisible({ timeout: 5000 });
		await logoutButton.click();
		await page.waitForURL(`${BASE_URL}/login`);

		// Try to access protected route
		await page.goto(`${BASE_URL}/workspace`);

		// Should redirect back to login (may include redirect query parameter)
		await page.waitForURL(/\/login/);
		await expect(page).toHaveURL(/\/login/);
	});
});

test.describe('Authentication - Session Persistence', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should persist session across page reloads', async ({ page }) => {
		// Reload page
		await page.reload();

		// Should still be on workspace (not redirected to login)
		await expect(page).toHaveURL(/\/workspace$/);

		// Verify workspace content is visible
		const workspaceElement = page.locator('[data-testid="workspace"], main, .workspace-container');
		await expect(workspaceElement.first()).toBeVisible({ timeout: 5000 });
	});

	test('should persist session across navigation', async ({ page }) => {
		// Navigate to different pages
		await page.goto(`${BASE_URL}/settings`);
		await expect(page).toHaveURL(/\/settings$/);

		await page.goto(`${BASE_URL}/workspace`);
		await expect(page).toHaveURL(/\/workspace$/);

		// Should not be redirected to login
		const loginForm = page.locator('form:has(input[name="key"])');
		await expect(loginForm).not.toBeVisible();
	});

	test('should have valid session cookie after login', async ({ context }) => {
		const cookies = await context.cookies();
		const sessionCookie = cookies.find((c) => c.name === 'dispatch_session');

		expect(sessionCookie).toBeDefined();
		expect(sessionCookie.value).toBeTruthy();
		expect(sessionCookie.httpOnly).toBe(true);

		// Cookie should not be expired
		if (sessionCookie.expires) {
			expect(sessionCookie.expires).toBeGreaterThan(Date.now() / 1000);
		}
	});
});

test.describe('Authentication - Protected Routes', () => {
	test('should redirect to login when accessing protected route without auth', async ({ page }) => {
		await resetToFreshInstall();

		// Try to access workspace without authentication
		await page.goto(`${BASE_URL}/workspace`);

		// Should redirect to login (with optional redirect query parameter)
		await page.waitForURL(/\/login/);
		await expect(page).toHaveURL(/\/login/);
	});

	test('should redirect to login when accessing settings without auth', async ({ page }) => {
		await resetToFreshInstall();

		await page.goto(`${BASE_URL}/settings`);

		// Should redirect to login (with optional redirect query parameter)
		await page.waitForURL(/\/login/);
		await expect(page).toHaveURL(/\/login/);
	});

	test('should allow access to public routes without auth', async ({ page }) => {
		await resetToFreshInstall();

		// Login page should be accessible
		await page.goto(`${BASE_URL}/login`);
		await expect(page).toHaveURL(/\/login$/);

		// API status should be accessible
		const response = await page.goto(`${BASE_URL}/api/status`);
		expect(response.status()).toBe(200);
	});
});

test.describe('Authentication - API Key Management', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should create new API key', async ({ page }) => {
		// Navigate to settings Keys section
		await page.goto(`${BASE_URL}/settings?section=keys`);

		// Find API keys section
		const apiKeysSection = page.locator('text=/API Key Management/i');
		await expect(apiKeysSection).toBeVisible({ timeout: 5000 });

		// Click create new API key button
		const createButton = page.locator('button:has-text("Create New API Key")');
		await createButton.click();

		// Fill in label for new key
		const labelInput = page.locator('input#key-label');
		await labelInput.waitFor({ state: 'visible', timeout: 5000 });
		await labelInput.fill('Test Key');

		// Confirm creation - use specific button text from modal
		const confirmButton = page.locator('button:has-text("Generate Key")');
		await confirmButton.click();

		// Should show the new API key (displayed only once)
		const newKeyDisplay = page.locator(
			'[data-testid="api-key-display"], code, pre, input[readonly]'
		);
		await expect(newKeyDisplay.first()).toBeVisible({ timeout: 5000 });

		// Verify key format (should be base64url format)
		const keyText = await newKeyDisplay.first().textContent();
		expect(keyText).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	test('should list existing API keys', async ({ page }) => {
		await page.goto(`${BASE_URL}/settings?section=keys`);

		// Should show at least the current API key in the list
		const keysList = page.locator('table.keys-table');
		await expect(keysList).toBeVisible({ timeout: 5000 });

		// Should show the test key we logged in with
		const keyLabel = page.locator('text="Test API Key"');
		await expect(keyLabel).toBeVisible({ timeout: 5000 });
	});

	test('should delete API key', async ({ page }) => {
		// First create a new key to delete
		await page.goto(`${BASE_URL}/settings?section=keys`);

		const createButton = page.locator('button:has-text("Create New API Key")');
		await createButton.click();

		const labelInput = page.locator('input#key-label');
		await labelInput.waitFor({ state: 'visible', timeout: 5000 });
		await labelInput.fill('Key to Delete');

		const confirmButton = page.locator('button:has-text("Generate Key")');
		await confirmButton.click();

		// Close the "new key" dialog - must click Done button to close modal
		const closeButton = page.locator('button:has-text("Done")');
		await closeButton.waitFor({ state: 'visible', timeout: 5000 });
		await closeButton.click();

		// Wait for modal to close
		await page.waitForTimeout(500);

		// Find the row containing "Key to Delete" and click its delete button
		const keyRow = page.locator('tr:has-text("Key to Delete")');
		await keyRow.waitFor({ state: 'visible', timeout: 5000 });
		const deleteButton = keyRow.locator('button[aria-label="Delete key"]');
		await deleteButton.click();

		// Confirm deletion - look for the specific "Delete Key" button in the modal
		const confirmDeleteButton = page.locator('button:has-text("Delete Key")');
		await confirmDeleteButton.waitFor({ state: 'visible', timeout: 5000 });
		await confirmDeleteButton.click();

		// Verify key is removed from list
		await expect(page.locator('text="Key to Delete"')).not.toBeVisible({ timeout: 5000 });
	});
});

test.describe('Authentication - Multi-tab Session Synchronization', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	test('should share session across multiple tabs', async ({ context }) => {
		// Create first tab and login
		const page1 = await context.newPage();
		await page1.goto(`${BASE_URL}/login`);
		await page1.fill('input[name="key"]', apiKey);
		await page1.click('button[type="submit"]');
		await page1.waitForURL(`${BASE_URL}/workspace`);

		// Create second tab
		const page2 = await context.newPage();
		await page2.goto(`${BASE_URL}/workspace`);

		// Second tab should also be authenticated (not redirected to login)
		await expect(page2).toHaveURL(/\/workspace$/);

		// Cleanup
		await page1.close();
		await page2.close();
	});

	test('should logout from all tabs when one tab logs out', async ({ context }) => {
		// Create first tab and login
		const page1 = await context.newPage();
		await page1.goto(`${BASE_URL}/login`);
		await page1.fill('input[name="key"]', apiKey);
		await page1.click('button[type="submit"]');
		await page1.waitForURL(`${BASE_URL}/workspace`);

		// Create second tab
		const page2 = await context.newPage();
		await page2.goto(`${BASE_URL}/workspace`);
		await expect(page2).toHaveURL(/\/workspace$/);

		// Logout from first tab - navigate to Keys section
		await page1.goto(`${BASE_URL}/settings?section=keys`);
		const logoutButton = page1.locator('button:has-text("Logout")');
		await expect(logoutButton).toBeVisible({ timeout: 5000 });
		await logoutButton.click();
		await page1.waitForURL(`${BASE_URL}/login`);

		// Second tab should also be logged out (or redirect to login on next navigation)
		await page2.reload();
		await page2.waitForURL(/\/login/);
		await expect(page2).toHaveURL(/\/login/);

		// Cleanup
		await page1.close();
		await page2.close();
	});
});

test.describe('Authentication - API Routes with Bearer Token', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	test('should access protected API route with valid Bearer token', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data).toHaveProperty('workspaces');
		expect(Array.isArray(data.workspaces)).toBe(true);
	});

	test('should reject protected API route without Bearer token', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/workspaces`);

		expect(response.status()).toBe(401);
	});

	test('should reject protected API route with invalid Bearer token', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: 'Bearer invalid-token-12345'
			}
		});

		expect(response.status()).toBe(401);
	});

	test('should accept either cookie or Bearer token for authentication', async ({
		page,
		request
	}) => {
		// First, login via browser to get cookie
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);

		// API call with cookie (from browser context)
		const response1 = await page.request.get(`${BASE_URL}/api/workspaces`);
		expect(response1.status()).toBe(200);

		// API call with Bearer token (no cookie)
		const response2 = await request.get(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});
		expect(response2.status()).toBe(200);
	});
});
