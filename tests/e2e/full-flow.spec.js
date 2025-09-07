import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';
const BASE_URL = 'http://localhost:5173';

test.describe('Dispatch End-to-End Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage to start fresh
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
	});

	test('1. Login flow', async ({ page }) => {
		// Go to login page
		await page.goto(BASE_URL);

		// Check if we're on the login page
		await expect(page.locator('h1')).toContainText('dispatch');
		await expect(page.locator('input[type="password"]')).toBeVisible();

		// Enter wrong key first
		await page.fill('input[type="password"]', 'wrongkey');
		await page.click('button[type="submit"]');

		// Should show error
		await expect(page.locator('.error')).toBeVisible();

		// Now enter correct key
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');

		// Should redirect to projects page
		await page.waitForURL('**/projects');
		await expect(page.locator('h2')).toContainText('Projects');
	});

	test('2. Create and manage projects', async ({ page }) => {
		// Login first
		await page.goto(BASE_URL);
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects');

		// Create a new project
		const projectName = `Test Project ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.fill('input[placeholder="Enter project description"]', 'Test description');
		await page.click('button:has-text("Create Project")');

		// Wait for project to be created
		await page.waitForTimeout(1000);

		// Check if project appears in the list
		await expect(page.locator('.project-item').filter({ hasText: projectName })).toBeVisible();

		// Click on the project to open it
		await page.locator('.project-item').filter({ hasText: projectName }).click();

		// Should navigate to project detail page
		await page.waitForURL(/\/projects\/[a-f0-9-]+/);

		// Check if we're on the project page
		await expect(page.locator('.sessions-panel')).toBeVisible();
	});

	test('3. Create and manage sessions', async ({ page }) => {
		// Login first
		await page.goto(BASE_URL);
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects');

		// Create a project first
		const projectName = `Session Test ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');
		await page.waitForTimeout(1000);

		// Open the project
		await page.locator('.project-item').filter({ hasText: projectName }).click();
		await page.waitForURL(/\/projects\/[a-f0-9-]+/);

		// Create a new session
		await page.click('button:has-text("New Session")');

		// Wait for session to be created
		await page.waitForTimeout(2000);

		// Check if terminal is visible
		await expect(page.locator('.terminal-container')).toBeVisible();

		// Check if we can type in the terminal (xterm.js should be loaded)
		const terminal = page.locator('.xterm-screen');
		await expect(terminal).toBeVisible();
	});

	test('4. Navigate between pages', async ({ page }) => {
		// Login
		await page.goto(BASE_URL);
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects');

		// Check logout button exists
		await expect(page.locator('button[aria-label="Logout"]')).toBeVisible();

		// Logout
		await page.click('button[aria-label="Logout"]');

		// Should be back at login page
		await page.waitForURL(BASE_URL);
		await expect(page.locator('input[type="password"]')).toBeVisible();
	});

	test('5. Project deletion', async ({ page }) => {
		// Login
		await page.goto(BASE_URL);
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects');

		// Create a project to delete
		const projectName = `Delete Test ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');
		await page.waitForTimeout(1000);

		// Find the project and click delete button
		const projectCard = page.locator('.project-item').filter({ hasText: projectName });
		await projectCard.locator('button[title="Delete project"]').click();

		// Confirm deletion in dialog
		await page.waitForSelector('.confirmation-dialog');
		await page.click('button:has-text("Delete")');

		// Wait for deletion
		await page.waitForTimeout(1000);

		// Project should no longer exist
		await expect(projectCard).not.toBeVisible();
	});

	test('6. Multiple socket connections', async ({ page, context }) => {
		// Login in first tab
		await page.goto(BASE_URL);
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects');

		// Create a project
		const projectName = `Multi Tab ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');
		await page.waitForTimeout(1000);

		// Open a second tab
		const page2 = await context.newPage();
		await page2.goto(BASE_URL + '/projects');

		// The project should be visible in the second tab
		await expect(page2.locator('.project-item').filter({ hasText: projectName })).toBeVisible();
	});

	test('7. Session persistence', async ({ page }) => {
		// Login
		await page.goto(BASE_URL);
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects');

		// Create a project
		const projectName = `Persist Test ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');
		await page.waitForTimeout(1000);

		// Open the project
		await page.locator('.project-item').filter({ hasText: projectName }).click();
		await page.waitForURL(/\/projects\/[a-f0-9-]+/);

		// Store the URL
		const projectUrl = page.url();

		// Navigate away
		await page.goto(BASE_URL + '/projects');

		// Navigate back
		await page.goto(projectUrl);

		// Should still be able to see the project page
		await expect(page.locator('.sessions-panel')).toBeVisible();
	});
});

test.describe('Error Handling', () => {
	test('Handle network errors gracefully', async ({ page }) => {
		// Login
		await page.goto(BASE_URL);
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects');

		// Block network requests to simulate network error
		await page.route('**/socket.io/**', (route) => route.abort());

		// Try to create a project
		await page.fill('input[placeholder="Enter project name"]', 'Network Test');
		await page.click('button:has-text("Create Project")');

		// Should handle the error gracefully (not crash)
		await page.waitForTimeout(2000);

		// Page should still be responsive
		await expect(page.locator('input[placeholder="Enter project name"]')).toBeVisible();
	});
});
