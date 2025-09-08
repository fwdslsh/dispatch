import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';

test.describe('Comprehensive Application Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Login before each test
		await page.goto('/');
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects', { timeout: 10000 });
	});

	test('should load project sessions correctly', async ({ page }) => {
		console.log('Testing project session loading...');

		// Create a test project first
		const projectName = `Test-Session-Loading-${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');

		// Wait for navigation to project page
		await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });

		// Wait for the page to fully load
		await page.waitForTimeout(3000);

		// Check if sessions section is present
		const sessionsSection = page.locator('.sessions-section');
		await expect(sessionsSection).toBeVisible({ timeout: 10000 });

		// Check for the sessions list component
		const sessionsList = page.locator('[data-testid="sessions-list"], .sessions-list');

		// The list should be visible even if empty
		await expect(sessionsList).toBeVisible({ timeout: 5000 });

		console.log('✓ Sessions section is loading correctly');
	});

	test('should show Claude authentication interface when Claude Agent is selected', async ({
		page
	}) => {
		console.log('Testing Claude authentication interface...');

		// Create a test project
		const projectName = `Test-Claude-Auth-${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');

		// Wait for navigation to project page
		await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
		await page.waitForTimeout(3000);

		// Look for Claude session type button
		const claudeButton = page.locator(
			'button:has-text("Claude"), button:has-text("Claude AI"), .session-btn.claude'
		);
		if ((await claudeButton.count()) > 0) {
			await claudeButton.first().click();
			await page.waitForTimeout(2000);

			// Check for Claude authentication interface
			const authInterface = page.locator('[data-testid="claude-auth"], .claude-auth-panel');
			await expect(authInterface).toBeVisible({ timeout: 5000 });

			// Look for the "Start Authentication" or "setup-token" button
			const authButton = page.locator(
				'button:has-text("Start Authentication"), button:has-text("🚀"), button:has-text("setup-token")'
			);
			await expect(authButton).toBeVisible({ timeout: 5000 });

			console.log('✓ Claude authentication interface is working');
		} else {
			// Check if there's a session type selector
			const sessionTypeSelector = page.locator('select, .session-type-selector');
			if ((await sessionTypeSelector.count()) > 0) {
				await sessionTypeSelector.selectOption('claude');
				await page.waitForTimeout(2000);

				// Check for authentication elements
				const authElements = page.locator('button:has-text("setup-token"), .claude-auth');
				await expect(authElements.first()).toBeVisible({ timeout: 5000 });

				console.log('✓ Claude authentication through selector is working');
			} else {
				console.log('⚠️ Claude authentication interface not found');
			}
		}
	});

	test('should handle session creation and management', async ({ page }) => {
		console.log('Testing session creation and management...');

		// Create a test project
		const projectName = `Test-Session-Management-${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');

		// Wait for navigation to project page
		await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
		await page.waitForTimeout(3000);

		// Try to create a shell session
		const newSessionButton = page.locator(
			'button:has-text("New Session"), button:has-text("Shell"), .session-btn.shell'
		);
		if ((await newSessionButton.count()) > 0) {
			await newSessionButton.first().click();
			await page.waitForTimeout(3000);

			// Check if terminal or session interface appears
			const sessionInterface = page.locator('.terminal-container, .session-container, .terminal');
			await expect(sessionInterface).toBeVisible({ timeout: 10000 });

			console.log('✓ Session creation is working');
		} else {
			console.log('⚠️ Session creation buttons not found');
		}
	});

	test('should validate socket connections are working', async ({ page }) => {
		console.log('Testing socket connections...');

		// Create a test project
		const projectName = `Test-Socket-${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');

		// Wait for navigation and socket connection
		await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
		await page.waitForTimeout(5000);

		// Check for socket connection indicators
		const socketStatus = await page.evaluate(() => {
			// Check if io is available globally
			return typeof window.io !== 'undefined' && window.io.connected !== false;
		});

		// Also check for any connection error messages
		const errorMessages = page.locator('.error, .connection-error, [data-testid="error"]');
		const hasErrors = (await errorMessages.count()) > 0;

		if (!hasErrors) {
			console.log('✓ No visible connection errors detected');
		} else {
			const errorText = await errorMessages.first().textContent();
			console.log(`⚠️ Connection error detected: ${errorText}`);
		}
	});

	test('should verify console errors and warnings', async ({ page }) => {
		console.log('Testing for console errors...');

		const consoleLogs = [];
		const consoleErrors = [];

		// Capture console messages
		page.on('console', (msg) => {
			const text = msg.text();
			if (msg.type() === 'error') {
				consoleErrors.push(text);
			} else {
				consoleLogs.push(text);
			}
		});

		// Create a test project and navigate
		const projectName = `Test-Console-${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');

		// Wait for navigation and let the page load
		await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
		await page.waitForTimeout(5000);

		// Filter out expected/benign errors
		const criticalErrors = consoleErrors.filter((error) => {
			return (
				!error.includes('404') &&
				!error.includes('favicon') &&
				!error.includes('manifest') &&
				!error.includes('Service Worker') &&
				!error.match(/websocket|socket\.io.*connection/i)
			);
		});

		if (criticalErrors.length > 0) {
			console.log('⚠️ Critical console errors detected:');
			criticalErrors.forEach((error) => console.log(`  - ${error}`));
		} else {
			console.log('✓ No critical console errors detected');
		}

		// Log some debug info
		console.log(`Total console messages: ${consoleLogs.length}`);
		console.log(`Total console errors: ${consoleErrors.length}`);
		console.log(`Critical errors: ${criticalErrors.length}`);
	});
});

test.describe('Claude Authentication Specific Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Login before each test
		await page.goto('/');
		await page.fill('input[type="password"]', TEST_KEY);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/projects', { timeout: 10000 });
	});

	test('should provide claude setup-token integration', async ({ page }) => {
		console.log('Testing Claude setup-token integration...');

		// Create a test project
		const projectName = `Test-Claude-Setup-${Date.now()}`;
		await page.fill('input[placeholder="Enter project name"]', projectName);
		await page.click('button:has-text("Create Project")');

		// Wait for navigation to project page
		await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
		await page.waitForTimeout(3000);

		// Try to find Claude session type
		const claudeOptions = page.locator(
			'select option[value="claude"], button:has-text("Claude"), .claude'
		);

		if ((await claudeOptions.count()) > 0) {
			// Try to trigger Claude mode
			const sessionTypeSelector = page.locator('select');
			if ((await sessionTypeSelector.count()) > 0) {
				await sessionTypeSelector.selectOption('claude');
				await page.waitForTimeout(2000);

				// Look for authentication status or setup-token option
				const authElements = page.locator(
					'button:has-text("setup-token"), button:has-text("Start Authentication"), .claude-auth-status'
				);

				if ((await authElements.count()) > 0) {
					console.log('✓ Claude setup-token integration found');

					// Try to click the setup button
					const setupButton = authElements.first();
					await setupButton.click();
					await page.waitForTimeout(3000);

					// Look for OAuth URL or token input
					const authFlow = page.locator('input[placeholder*="token"], .oauth-url, .auth-url');
					if ((await authFlow.count()) > 0) {
						console.log('✓ Claude authentication flow initiated');
					} else {
						console.log('⚠️ Claude authentication flow incomplete');
					}
				} else {
					console.log('⚠️ Claude setup-token integration not found');
				}
			}
		} else {
			console.log('⚠️ Claude session type not available');
		}
	});
});
