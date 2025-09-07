import { test, expect } from '@playwright/test';

test.describe('Verify Sessions Display in Project', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication token in localStorage
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('sessions display correctly in project view', async ({ page }) => {
		// Go to projects page
		await page.goto('/projects');
		await page.waitForTimeout(1000);

		// Create a project with unique name
		const projectName = `Test Project ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');
		await page.waitForTimeout(1000);

		// Navigate to the project
		await page.click(`text="${projectName}"`);
		await page.waitForTimeout(2000);

		// Verify we're on the project page
		await expect(page.locator('.sessions-panel')).toBeVisible();
		await expect(page.locator('.session-form')).toBeVisible();

		// Create multiple sessions with different names
		const sessions = [
			{ name: 'Development Session', type: 'shell' },
			{ name: 'Testing Session', type: 'shell' },
			{ name: 'Debug Session', type: 'shell' }
		];

		for (const session of sessions) {
			console.log(`Creating session: ${session.name}`);

			// Fill session details
			await page.fill('input#session-name', session.name);

			// Select session type if needed
			if (session.type) {
				await page.selectOption('#session-mode', session.type);
			}

			// Create the session
			await page.click('button:has-text("Create Session")');
			await page.waitForTimeout(2000);

			// Clear the input for next session
			await page.fill('input#session-name', '');
		}

		// Verify all sessions are displayed
		const sessionItems = await page.locator('.session-item').all();
		console.log(`Number of sessions displayed: ${sessionItems.length}`);
		expect(sessionItems.length).toBe(sessions.length);

		// Verify each session name is correct
		for (let i = 0; i < sessions.length; i++) {
			const sessionName = await sessionItems[i].locator('.session-name').textContent();
			console.log(`Session ${i} name: ${sessionName}`);
			expect(sessionName).toBe(sessions[i].name);
		}

		// Test session persistence - reload the page
		console.log('Testing session persistence after reload...');
		await page.reload();
		await page.waitForTimeout(2000);

		// Verify sessions still appear after reload
		const sessionItemsAfterReload = await page.locator('.session-item').all();
		console.log(`Sessions after reload: ${sessionItemsAfterReload.length}`);
		expect(sessionItemsAfterReload.length).toBe(sessions.length);

		// Verify names are still correct after reload
		for (let i = 0; i < sessions.length; i++) {
			const sessionName = await sessionItemsAfterReload[i].locator('.session-name').textContent();
			console.log(`Session ${i} name after reload: ${sessionName}`);
			expect(sessionName).toBe(sessions[i].name);
		}

		// Take final screenshot
		await page.screenshot({ path: 'test-results/sessions-display-complete.png', fullPage: true });

		console.log('All sessions displayed correctly!');
	});
});
