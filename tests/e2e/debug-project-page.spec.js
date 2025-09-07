import { test, expect } from '@playwright/test';

test.describe('Debug Project Page', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication token in localStorage
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('debug project creation form', async ({ page }) => {
		// Go to projects page
		await page.goto('/projects');

		// Wait for page to load
		await page.waitForTimeout(2000);

		// Take a screenshot
		await page.screenshot({ path: 'test-results/projects-page.png', fullPage: true });

		// Log all input elements on the page
		const inputs = await page.locator('input').all();
		console.log('Number of input elements:', inputs.length);

		for (let i = 0; i < inputs.length; i++) {
			const placeholder = await inputs[i].getAttribute('placeholder');
			const id = await inputs[i].getAttribute('id');
			const name = await inputs[i].getAttribute('name');
			console.log(`Input ${i}: placeholder="${placeholder}", id="${id}", name="${name}"`);
		}

		// Log all textarea elements
		const textareas = await page.locator('textarea').all();
		console.log('Number of textarea elements:', textareas.length);

		for (let i = 0; i < textareas.length; i++) {
			const placeholder = await textareas[i].getAttribute('placeholder');
			const id = await textareas[i].getAttribute('id');
			console.log(`Textarea ${i}: placeholder="${placeholder}", id="${id}"`);
		}

		// Log all buttons with "Create" text
		const createButtons = await page.locator('button:has-text("Create")').all();
		console.log('Number of Create buttons:', createButtons.length);

		for (let i = 0; i < createButtons.length; i++) {
			const text = await createButtons[i].textContent();
			console.log(`Button ${i}: text="${text}"`);
		}

		// Check if there's a form visible
		const forms = await page.locator('form').all();
		console.log('Number of forms:', forms.length);

		// Check for any element with "project" in class or id
		const projectElements = await page.locator('[class*="project"], [id*="project"]').all();
		console.log('Number of elements with "project":', projectElements.length);
	});
});
