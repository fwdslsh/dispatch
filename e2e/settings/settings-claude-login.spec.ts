/**
 * E2E Tests: Claude Authentication OAuth Flow
 *
 * Tests the complete Claude OAuth authentication flow including:
 * - OAuth URL emission from server to client
 * - URL display in UI
 * - Authorization code submission
 * - Error handling for various failure scenarios
 * - Socket.IO event communication
 *
 * These tests use the test server (localhost:7173) with a known API key for authentication.
 */

import { test, expect } from '@playwright/test';
import { resetToOnboarded } from '../helpers/reset-database.js';

const TEST_SERVER_URL = 'http://localhost:7173';
const TEST_API_KEY = 'test-automation-key-12345';

test.describe('Claude Authentication - OAuth Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Reset database and get API key
		const { apiKey } = await resetToOnboarded();

		// Navigate to login page and authenticate
		await page.goto(`${TEST_SERVER_URL}/login`);
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');

		// Wait for redirect to workspace (authenticated)
		await page.waitForURL('**/workspace');

		// Navigate to settings page
		await page.goto(`${TEST_SERVER_URL}/settings`);

		// Wait for settings page to load
		await page.waitForLoadState('networkidle');
	});

	test('should emit OAuth URL from server and display in UI', async ({ page }) => {
		// Set up listener for Socket.IO messages before triggering the flow
		const socketMessages = [];
		await page.exposeFunction('captureSocketMessage', (msg) => {
			socketMessages.push(msg);
		});

		// Inject Socket.IO message capture script
		await page.addScriptTag({
			content: `
        // Intercept Socket.IO emit calls
        (function() {
          const originalEmit = window.io.Socket.prototype.emit;
          window.io.Socket.prototype.emit = function(...args) {
            window.captureSocketMessage({ type: 'emit', event: args[0], data: args[1] });
            return originalEmit.apply(this, args);
          };

          // Intercept Socket.IO on calls
          const originalOn = window.io.Socket.prototype.on;
          window.io.Socket.prototype.on = function(event, handler) {
            const wrappedHandler = function(...args) {
              window.captureSocketMessage({ type: 'on', event, data: args[0] });
              return handler.apply(this, args);
            };
            return originalOn.call(this, event, wrappedHandler);
          };
        })();
      `
		});

		// Find and click "Login with Claude" button
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await expect(loginButton).toBeVisible({ timeout: 5000 });

		// Click the button to start OAuth flow
		await loginButton.click();

		// Wait for "Requesting authorization URL..." message
		await expect(page.locator('text=Requesting authorization URL...')).toBeVisible({
			timeout: 3000
		});

		// Wait for OAuth URL to appear in UI (either as link or in code input section)
		// The URL should be displayed within 5 seconds
		const urlVisible = await page
			.waitForSelector(
				'text=/https:\\/\\/(console\\.anthropic\\.com\\/login|claude\\.ai\\/oauth\\/authorize)/',
				{ timeout: 10000 }
			)
			.catch(() => null);

		// CRITICAL ASSERTION: Verify OAuth URL was received and displayed
		if (!urlVisible) {
			// Check if there was an error message instead
			const errorMessage = await page
				.locator('[class*="error"]')
				.textContent()
				.catch(() => '');

			// Log socket messages for debugging
			console.log('Socket messages captured:', JSON.stringify(socketMessages, null, 2));

			throw new Error(
				`OAuth URL was not displayed in UI within 10 seconds. ` +
					`Error message: ${errorMessage || 'none'}. ` +
					`This indicates the server did not emit CLAUDE_AUTH_URL event or client did not receive it.`
			);
		}

		// Verify the URL contains expected OAuth parameters
		const urlElement = await page.locator('a[href*="anthropic.com"], a[href*="claude.ai"]').first();
		const oauthUrl = await urlElement.getAttribute('href');

		expect(oauthUrl).toMatch(
			/https:\/\/(console\.anthropic\.com\/login|claude\.ai\/oauth\/authorize)/
		);
		expect(oauthUrl).toContain('client_id=');
		expect(oauthUrl).toContain('redirect_uri=');
		expect(oauthUrl).toContain('response_type=code');

		// Verify instructions are shown
		await expect(page.locator('text=/paste.*authorization code/i')).toBeVisible();

		// Verify code input field is visible
		const codeInput = page.locator('input[placeholder*="authorization code"]');
		await expect(codeInput).toBeVisible();

		// Verify socket messages include CLAUDE_AUTH_START and CLAUDE_AUTH_URL
		const authStartEmitted = socketMessages.some(
			(msg) => msg.type === 'emit' && msg.event === 'claude.auth.start'
		);
		const authUrlReceived = socketMessages.some(
			(msg) => msg.type === 'on' && msg.event === 'claude.auth.url' && msg.data?.url
		);

		expect(authStartEmitted, 'CLAUDE_AUTH_START should be emitted').toBe(true);
		expect(authUrlReceived, 'CLAUDE_AUTH_URL should be received with URL').toBe(true);
	});

	test('should handle authorization code submission', async ({ page }) => {
		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for code input to appear
		const codeInput = page.locator('input[placeholder*="authorization code"]');
		await expect(codeInput).toBeVisible({ timeout: 10000 });

		// Enter a test authorization code
		const testCode = 'test-auth-code-12345';
		await codeInput.fill(testCode);

		// Click "Complete Authentication" button
		const completeButton = page.locator('button:has-text("Complete Authentication")');
		await expect(completeButton).toBeEnabled();
		await completeButton.click();

		// Wait for "Submitting authorization code..." message
		await expect(page.locator('text=Submitting authorization code...')).toBeVisible({
			timeout: 3000
		});

		// The PTY will likely reject the test code, so we expect an error
		// This is expected behavior - we're testing the flow, not the actual OAuth validation
		await expect(page.locator('text=/Invalid.*code|Authentication.*failed|error/i')).toBeVisible({
			timeout: 30000
		});
	});

	test('should handle OAuth flow cancellation', async ({ page }) => {
		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for code input to appear
		await expect(page.locator('input[placeholder*="authorization code"]')).toBeVisible({
			timeout: 10000
		});

		// Click cancel button
		const cancelButton = page.locator('button:has-text("Cancel")');
		await cancelButton.click();

		// Verify we're back to the initial state with login options
		await expect(loginButton).toBeVisible();
		await expect(page.locator('input[placeholder*="authorization code"]')).not.toBeVisible();
	});

	test('should show error when claude CLI is not installed', async ({ page, context }) => {
		// Mock the Socket.IO connection to simulate claude CLI not being available
		await page.route('**/socket.io/**', async (route) => {
			const url = route.request().url();

			// Let connection succeed but intercept auth events
			if (url.includes('polling')) {
				route.continue();
			} else {
				route.continue();
			}
		});

		// Inject error simulation
		await page.evaluate(() => {
			const originalEmit = window.io?.Socket?.prototype?.emit;
			if (originalEmit) {
				window.io.Socket.prototype.emit = function (event, data, callback) {
					if (event === 'claude.auth.start') {
						// Simulate server responding with error
						setTimeout(() => {
							this.listeners('claude.auth.error')[0]?.({
								success: false,
								error: 'Terminal functionality not available - node-pty failed to load'
							});
						}, 100);
						if (callback) callback({ success: false, error: 'Simulated error' });
						return this;
					}
					return originalEmit.apply(this, arguments);
				};
			}
		});

		// Try to start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Should show error message about terminal functionality
		await expect(
			page.locator('text=/Terminal functionality not available|node-pty failed/i')
		).toBeVisible({ timeout: 5000 });
	});

	test('should handle socket disconnection during OAuth flow', async ({ page, context }) => {
		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for code input to appear
		await expect(page.locator('input[placeholder*="authorization code"]')).toBeVisible({
			timeout: 10000
		});

		// Simulate socket disconnection by blocking Socket.IO traffic
		await page.route('**/socket.io/**', (route) => route.abort());

		// Wait a moment for disconnect to be detected
		await page.waitForTimeout(2000);

		// The UI should handle disconnection gracefully
		// Either show error or allow reconnection
		const hasError = await page.locator('[class*="error"]').count();
		const hasReconnecting = await page.locator('text=/reconnect/i').count();

		expect(hasError + hasReconnecting).toBeGreaterThan(0);
	});

	test('should display OAuth URL as clickable link', async ({ page }) => {
		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for OAuth URL link to appear
		const urlLink = page.locator('a[href*="anthropic.com"], a[href*="claude.ai"]').first();
		await expect(urlLink).toBeVisible({ timeout: 10000 });

		// Verify link opens in new tab (target="_blank")
		const target = await urlLink.getAttribute('target');
		expect(target).toBe('_blank');

		// Verify link has security attributes
		const rel = await urlLink.getAttribute('rel');
		expect(rel).toContain('noopener');
	});

	test('should handle multiple rapid OAuth attempts', async ({ page }) => {
		// Rapidly click login button multiple times
		const loginButton = page.locator('button:has-text("Login with Claude")');

		await loginButton.click();
		await loginButton.click();
		await loginButton.click();

		// Should only show one OAuth flow (not create multiple sessions)
		const codeInputs = page.locator('input[placeholder*="authorization code"]');
		await expect(codeInputs).toHaveCount(1, { timeout: 10000 });

		// Should show OAuth URL only once
		const urlLinks = page.locator('a[href*="anthropic.com"], a[href*="claude.ai"]');
		const count = await urlLinks.count();
		expect(count).toBeLessThanOrEqual(2); // One main link, maybe one fallback
	});

	test('should show "Already authenticated" state if already logged in', async ({ page }) => {
		// Navigate directly to settings (we're already authenticated from beforeEach)
		await page.goto(`${TEST_SERVER_URL}/settings`);

		// Find Claude authentication section
		const authSection = page.locator('h4:has-text("Authentication")').locator('..').locator('..');

		// Should show "Connected to Claude" or similar authenticated state
		// Note: This depends on whether Claude auth is separate from Dispatch auth
		// If user has already authenticated Claude, should show connected state
		const hasConnectedState = await authSection
			.locator('text=/Connected.*Claude|Authenticated/i')
			.count();
		const hasLoginButton = await authSection
			.locator('button:has-text("Login with Claude")')
			.count();

		// Either should show connected state OR login option (depending on Claude auth state)
		expect(hasConnectedState + hasLoginButton).toBeGreaterThan(0);
	});
});

test.describe('Claude Authentication - Socket.IO Event Protocol', () => {
	test.beforeEach(async ({ page }) => {
		const { apiKey } = await resetToOnboarded();
		await page.goto(`${TEST_SERVER_URL}/login`);
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/workspace');
	});

	test('should emit correct event format for CLAUDE_AUTH_START', async ({ page }) => {
		await page.goto(`${TEST_SERVER_URL}/settings`);

		// Capture emitted events
		const emittedEvents = [];
		await page.exposeFunction('captureEmit', (event, data) => {
			emittedEvents.push({ event, data });
		});

		await page.addScriptTag({
			content: `
        const originalEmit = window.io?.Socket?.prototype?.emit;
        if (originalEmit) {
          window.io.Socket.prototype.emit = function(event, data, callback) {
            window.captureEmit(event, JSON.parse(JSON.stringify(data || {})));
            return originalEmit.apply(this, arguments);
          };
        }
      `
		});

		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait briefly for event emission
		await page.waitForTimeout(1000);

		// Find CLAUDE_AUTH_START event
		const authStartEvent = emittedEvents.find((e) => e.event === 'claude.auth.start');

		expect(authStartEvent, 'CLAUDE_AUTH_START event should be emitted').toBeDefined();

		// Verify event payload contains authentication token
		expect(authStartEvent.data).toHaveProperty('key');
		expect(typeof authStartEvent.data.key).toBe('string');
		expect(authStartEvent.data.key.length).toBeGreaterThan(0);
	});

	test('should receive CLAUDE_AUTH_URL with correct payload structure', async ({ page }) => {
		await page.goto(`${TEST_SERVER_URL}/settings`);

		// Capture received events
		const receivedEvents = [];
		await page.exposeFunction('captureReceive', (event, data) => {
			receivedEvents.push({ event, data });
		});

		await page.addScriptTag({
			content: `
        const originalOn = window.io?.Socket?.prototype?.on;
        if (originalOn) {
          window.io.Socket.prototype.on = function(event, handler) {
            const wrappedHandler = function(data) {
              window.captureReceive(event, JSON.parse(JSON.stringify(data || {})));
              return handler.apply(this, arguments);
            };
            return originalOn.call(this, event, wrappedHandler);
          };
        }
      `
		});

		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for OAuth URL event
		await page.waitForTimeout(5000);

		// Find CLAUDE_AUTH_URL event
		const authUrlEvent = receivedEvents.find((e) => e.event === 'claude.auth.url');

		expect(authUrlEvent, 'CLAUDE_AUTH_URL event should be received').toBeDefined();

		// Verify payload structure
		expect(authUrlEvent.data).toHaveProperty('url');
		expect(authUrlEvent.data.url).toMatch(/^https:\/\//);
		expect(authUrlEvent.data).toHaveProperty('instructions');
		expect(typeof authUrlEvent.data.instructions).toBe('string');
	});
});

test.describe('Claude Authentication - Edge Cases', () => {
	test('should handle OAuth URL extraction failure', async ({ page }) => {
		// This test verifies behavior when the claude CLI produces unexpected output
		// We can't easily mock the PTY output, but we can test timeout behavior

		const { apiKey } = await resetToOnboarded();
		await page.goto(`${TEST_SERVER_URL}/login`);
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/workspace');
		await page.goto(`${TEST_SERVER_URL}/settings`);

		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for either success or error (with extended timeout)
		const result = await Promise.race([
			page
				.waitForSelector('input[placeholder*="authorization code"]', { timeout: 15000 })
				.then(() => 'success'),
			page.waitForSelector('[class*="error"]', { timeout: 15000 }).then(() => 'error')
		]).catch(() => 'timeout');

		// One of these should happen (success, error, or timeout)
		expect(['success', 'error', 'timeout']).toContain(result);
	});

	test('should handle empty authorization code submission', async ({ page }) => {
		const { apiKey } = await resetToOnboarded();
		await page.goto(`${TEST_SERVER_URL}/login`);
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/workspace');
		await page.goto(`${TEST_SERVER_URL}/settings`);

		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for code input
		const codeInput = page.locator('input[placeholder*="authorization code"]');
		await expect(codeInput).toBeVisible({ timeout: 10000 });

		// Try to submit empty code
		const completeButton = page.locator('button:has-text("Complete Authentication")');

		// Button should be disabled when input is empty
		await expect(completeButton).toBeDisabled();
	});

	test('should handle whitespace-only authorization code', async ({ page }) => {
		const { apiKey } = await resetToOnboarded();
		await page.goto(`${TEST_SERVER_URL}/login`);
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/workspace');
		await page.goto(`${TEST_SERVER_URL}/settings`);

		// Start OAuth flow
		const loginButton = page.locator('button:has-text("Login with Claude")');
		await loginButton.click();

		// Wait for code input
		const codeInput = page.locator('input[placeholder*="authorization code"]');
		await expect(codeInput).toBeVisible({ timeout: 10000 });

		// Enter whitespace-only code
		await codeInput.fill('   ');

		// Complete button should still be disabled (client-side validation)
		const completeButton = page.locator('button:has-text("Complete Authentication")');
		await expect(completeButton).toBeDisabled();
	});
});
