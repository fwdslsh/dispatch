import { test, expect } from '@playwright/test';

test.describe('Terminal Input Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication token in localStorage
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('terminal should not duplicate keystrokes', async ({ page }) => {
		// Go to projects page
		await page.goto('/projects');
		await page.waitForTimeout(1000);

		// Create a project quickly
		const projectName = `Terminal Test ${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');
		await page.waitForTimeout(1000);

		// Open the project
		const projectItem = page.locator('li').filter({ hasText: projectName });
		await projectItem.locator('button[title="Open project"]').click();
		await page.waitForTimeout(2000);

		// Create a session
		await page.fill('input#session-name', 'Terminal Input Test');
		await page.click('button[type="submit"]');

		// Wait for terminal to load
		await page.waitForTimeout(5000);

		// Check if terminal is active
		const terminalContainer = page.locator('.session-content');
		await expect(terminalContainer).toBeVisible();

		// Focus on the terminal (xterm.js canvas element)
		const terminal = page.locator('.xterm-screen');
		await terminal.click();

		// Type some characters and check for duplicates
		console.log('Typing test input...');
		await page.keyboard.type('echo "hello world"');

		// Wait a bit for the output to appear
		await page.waitForTimeout(2000);

		// Check that "hello world" appears exactly twice in the terminal container
		const terminalText = await terminalContainer.innerText();
		const helloWorldMatches = terminalText.match(/hello world/g) || [];
		expect(helloWorldMatches.length).toBe(2);

		// Press Enter to execute the command
		await page.keyboard.press('Enter');

		// Wait for command execution
		await page.waitForTimeout(3000);

		// Check the terminal content
		// Note: This is a basic test - in practice you'd need to check the actual terminal buffer
		// For now, we'll just verify the terminal is responsive

		// Type another simple command
		await page.keyboard.type('pwd');
		await page.waitForTimeout(1000);
		await page.keyboard.press('Enter');
		await page.waitForTimeout(2000);

		// Take a screenshot for manual verification
		await page.screenshot({ path: 'test-results/terminal-input-test.png', fullPage: true });

		console.log('Terminal input test completed - check screenshot for duplication');
	});
});
