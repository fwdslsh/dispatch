import { test, expect } from '@playwright/test';

test.describe('Project and Session Creation', () => {
	let projectId;

	test.beforeEach(async ({ page }) => {
		// Set up authentication token in localStorage
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('create project and verify sessions display', async ({ page }) => {
		// Go to projects page
		await page.goto('/projects');

		// Wait for page to load
		await page.waitForTimeout(1000);

		// Create a new project with unique name
		const projectName = `Test Project ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.fill('input[placeholder="Enter project description"]', 'Test Description');
		await page.click('button:has-text("Create Project")');

		// Wait for project to be created
		await page.waitForTimeout(1000);

		// Click on the newly created project - need to find the specific open button
		// Use a more specific selector that finds the project and then its open button
		const projectItem = page.locator('li').filter({ hasText: projectName });
		await projectItem.locator('button[title="Open project"]').click();

		// Wait for project page to load
		await page.waitForTimeout(2000);

		// Get the project ID from URL
		const url = page.url();
		const match = url.match(/\/projects\/([a-f0-9-]+)/);
		if (match) {
			projectId = match[1];
			console.log('Created project ID:', projectId);
		}

		// Verify we're on the project page with controls
		await expect(page.locator('.sessions-panel')).toBeVisible();
		await expect(page.locator('.content-panel')).toBeVisible();
		await expect(page.locator('form')).toBeVisible();

		// Create a session
		console.log('Creating a session in project...');

		// Fill session name
		await page.fill('input#session-name', 'Test Session');

		// Click create session button
		await page.click('button:has-text("Create Session")');

		// Wait for session to be created
		await page.waitForTimeout(3000);

		// Check if session appears in the sessions list
		const sessionItem = page.locator('li').first();
		await expect(sessionItem).toBeVisible({ timeout: 10000 });

		// Verify session details
		const sessionName = await sessionItem.locator('strong').textContent();
		console.log('Session name displayed:', sessionName);
		expect(sessionName).toContain('Test Session');

		// Take screenshot for debugging
		await page.screenshot({ path: 'test-results/project-with-session.png' });

		// Reload the page to verify sessions persist
		await page.reload();
		await page.waitForTimeout(2000);

		// Check if session still appears after reload
		const sessionItemAfterReload = page.locator('li').first();
		await expect(sessionItemAfterReload).toBeVisible({ timeout: 10000 });

		const sessionNameAfterReload = await sessionItemAfterReload.locator('strong').textContent();
		console.log('Session name after reload:', sessionNameAfterReload);
		expect(sessionNameAfterReload).toContain('Test Session');
	});
});
