import { test, expect } from '@playwright/test';

test.describe('Project Page Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Set up authentication token in localStorage
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-token', 'testkey12345');
		});
	});

	test('project page should load correctly and show controls', async ({ page }) => {
		// Navigate to the specific project page
		await page.goto('/projects/499e71e7-a7b4-4738-8350-909784640ca1');

		// Wait for page to load
		await page.waitForTimeout(2000);

		// Take a screenshot for debugging
		await page.screenshot({ path: 'test-results/project-page-initial.png' });

		// Check if we're stuck on "Connecting..." or if controls are displayed
		const connectingText = await page.getByText('Connecting...').isVisible();
		const loadingText = await page.getByText('Loading project...').isVisible();

		console.log('Connecting visible:', connectingText);
		console.log('Loading project visible:', loadingText);

		// If we're stuck on connecting, let's debug the socket connection
		if (connectingText || loadingText) {
			console.log('Page is stuck in loading state. Debugging...');

			// Check for any JavaScript errors in the console
			const logs = [];
			page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
			page.on('pageerror', (error) => logs.push(`PAGE ERROR: ${error.message}`));

			// Wait a bit more and check again
			await page.waitForTimeout(5000);

			console.log('Console logs:', logs);

			// Take another screenshot
			await page.screenshot({ path: 'test-results/project-page-after-wait.png' });
		}

		// Check if project controls are visible (after successful load)
		const projectHeader = page.locator('h2');
		const sessionsPanel = page.locator('.sessions-panel');
		const contentPanel = page.locator('.content-panel');
		const createSessionForm = page.locator('.session-form');

		// Give more time for the page to fully load
		await page.waitForTimeout(3000);

		// Check current page state
		const currentUrl = page.url();
		const pageContent = await page.content();

		console.log('Current URL:', currentUrl);
		console.log('Page title:', await page.title());

		// Look for key elements
		const headerExists = (await projectHeader.count()) > 0;
		const sessionsPanelExists = (await sessionsPanel.count()) > 0;
		const contentPanelExists = (await contentPanel.count()) > 0;
		const createFormExists = (await createSessionForm.count()) > 0;

		console.log('Header exists:', headerExists);
		console.log('Sessions panel exists:', sessionsPanelExists);
		console.log('Content panel exists:', contentPanelExists);
		console.log('Create form exists:', createFormExists);

		// Check if there's an error state
		const errorElement = page.locator('.error');
		const errorExists = (await errorElement.count()) > 0;
		if (errorExists) {
			const errorText = await errorElement.textContent();
			console.log('Error displayed:', errorText);
		}

		// Final screenshot
		await page.screenshot({ path: 'test-results/project-page-final.png' });

		// If controls aren't visible, this test should fail to highlight the issue
		if (!sessionsPanelExists || !contentPanelExists) {
			throw new Error(
				`Project controls not visible. Sessions panel: ${sessionsPanelExists}, Content panel: ${contentPanelExists}`
			);
		}

		// Assert that key components are present
		await expect(sessionsPanel).toBeVisible();
		await expect(contentPanel).toBeVisible();
		await expect(createSessionForm).toBeVisible();
	});

	test('verify socket connection and authentication flow', async ({ page }) => {
		// Monitor network and console for socket.io connection issues
		const logs = [];
		page.on('console', (msg) => {
			logs.push(`${msg.type()}: ${msg.text()}`);
			console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
		});

		page.on('pageerror', (error) => {
			logs.push(`PAGE ERROR: ${error.message}`);
			console.log(`PAGE ERROR: ${error.message}`);
		});

		// Navigate to project page
		await page.goto('/projects/499e71e7-a7b4-4738-8350-909784640ca1');

		// Wait for socket connection attempts
		await page.waitForTimeout(5000);

		// Look for socket-related logs
		const socketLogs = logs.filter(
			(log) =>
				log.toLowerCase().includes('socket') ||
				log.toLowerCase().includes('connect') ||
				log.toLowerCase().includes('auth')
		);

		console.log('Socket-related logs:', socketLogs);

		// Check if authentication succeeded
		const authLogs = logs.filter((log) => log.includes('Auth response'));
		console.log('Auth logs:', authLogs);
	});

	test('check for missing components or imports', async ({ page }) => {
		// Navigate to project page
		await page.goto('/projects/499e71e7-a7b4-4738-8350-909784640ca1');

		// Check for 404 errors on component imports
		const failedRequests = [];
		page.on('response', (response) => {
			if (response.status() >= 400) {
				failedRequests.push(`${response.status()}: ${response.url()}`);
			}
		});

		await page.waitForTimeout(3000);

		if (failedRequests.length > 0) {
			console.log('Failed requests:', failedRequests);
		}

		// Check if Svelte components are mounting correctly
		const componentErrors = [];
		page.on('pageerror', (error) => {
			componentErrors.push(error.message);
		});

		if (componentErrors.length > 0) {
			console.log('Component errors:', componentErrors);
		}
	});
});
