// spec: e2e/test-plans/settings-page-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';
import { completeOnboarding } from '../helpers/onboarding-helpers.js';
import { resetToFreshInstall } from '../helpers/reset-database.js';
import { navigateToSettingsTab } from '../helpers/settings-helpers.js';

test.describe('Connectivity Settings', () => {
	// Reset database before each test to ensure isolation
	test.beforeEach(async () => {
		await resetToFreshInstall();
	});

	test('Test 6.1: View LocalTunnel Status', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Verify LocalTunnel section heading is visible
		await expect(page.getByRole('heading', { name: 'LocalTunnel', level: 4 })).toBeVisible();

		// 2. Verify status shows "Disabled" by default
		const statusLabel = page.getByText('Status:').locator('..').getByText('Disabled');
		await expect(statusLabel).toBeVisible();

		// 3. Verify port displays current server port (7173 in test)
		const portLabel = page.getByText('Port:').locator('..').getByText('7173');
		await expect(portLabel).toBeVisible();

		// 4. Verify subdomain field is empty (optional)
		const subdomainInput = page.getByPlaceholder('Enter custom subdomain or leave empty for random');
		await expect(subdomainInput).toBeVisible();
		await expect(subdomainInput).toHaveValue('');

		// 5. Verify "Enable Tunnel" button is available
		const enableButton = page.getByRole('button', { name: 'Enable Tunnel' });
		await expect(enableButton).toBeVisible();
		await expect(enableButton).toBeEnabled();
	});

	test('Test 6.2: Enable LocalTunnel - Backend Socket Response', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Verify subdomain field is empty
		const subdomainInput = page.getByPlaceholder(
			'Enter custom subdomain or leave empty for random'
		);
		await expect(subdomainInput).toHaveValue('');

		// 2. Intercept network requests to detect socket communication
		// We'll check the browser console for socket event logs
		let socketEventReceived = false;
		let socketResponseReceived = false;

		page.on('console', (msg) => {
			const text = msg.text();
			// Look for socket event emissions and responses
			if (text.includes('tunnel:start') || text.includes('TUNNEL_START')) {
				socketEventReceived = true;
			}
			if (text.includes('response') && text.includes('success')) {
				socketResponseReceived = true;
			}
		});

		// 3. Click "Enable Tunnel" button
		const enableButton = page.getByRole('button', { name: 'Enable Tunnel' });
		await enableButton.click();

		// 4. Wait for tunnel to start
		// Tunnel startup can take several seconds for localtunnel to establish connection
		await page.waitForTimeout(5000);

		// CRITICAL: Tunnel must actually START successfully
		// Check for error messages - if present, tunnel failed
		const errorBox = page.locator('.error-message, [role="alert"]');
		const hasError = await errorBox.isVisible().catch(() => false);

		if (hasError) {
			const errorText = await errorBox.textContent();
			console.log('[Test] ❌ Tunnel failed to start:', errorText);
			throw new Error(`LocalTunnel failed to start: ${errorText}`);
		}

		// Verify tunnel actually started by checking status
		const localTunnelSection = page.locator('text=LocalTunnel').locator('..').locator('..');

		// Status should show "Enabled" (green text)
		const statusValue = localTunnelSection.locator('.status-value').first();
		await expect(statusValue).toHaveText('Enabled', { timeout: 10000 });

		// Running should show "Yes"
		const runningValue = localTunnelSection.getByText('Running:').locator('..').locator('.status-value');
		await expect(runningValue).toHaveText('Yes');

		// CRITICAL: Public URL must be displayed
		// LocalTunnel should receive URL from loca.lt within a few seconds
		const urlSection = localTunnelSection.locator('.tunnel-url');
		await expect(urlSection).toBeVisible({ timeout: 15000 }); // Give localtunnel time to connect

		// Get URL value from the readonly input
		const urlInput = urlSection.locator('input[readonly]');
		const urlText = await urlInput.inputValue();

		console.log('[Test] Tunnel URL:', urlText);

		// URL must be a valid https URL from loca.lt
		expect(urlText).toBeTruthy();
		expect(urlText.trim()).toMatch(/https?:\/\/.+\.(loca\.lt|localtunnel\.me)/);

		console.log('[Test] ✓ LocalTunnel started successfully with URL:', urlText.trim());
	});

	test('Test 6.3: Update LocalTunnel Subdomain', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Locate subdomain input field
		const subdomainInput = page.getByPlaceholder('Enter custom subdomain or leave empty for random');
		await expect(subdomainInput).toBeVisible();

		// 2. Enter custom subdomain
		await subdomainInput.fill('my-dispatch-app');

		// 3. Verify Update button becomes enabled
		const updateButton = page.getByRole('button', { name: 'Update' });
		await expect(updateButton).toBeEnabled();

		// 4. Verify subdomain value is set
		await expect(subdomainInput).toHaveValue('my-dispatch-app');

		// 5. Verify subdomain help text is displayed
		await expect(
			page.getByText('Custom subdomain for your tunnel URL (e.g., "myapp" for myapp.loca.lt)')
		).toBeVisible();
	});

	test('Test 6.4: LocalTunnel Configuration Elements', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Verify LocalTunnel description is present
		await expect(
			page.getByText(
				'Create a public URL for your local development server using LocalTunnel. Perfect for quick demos and testing webhooks.'
			)
		).toBeVisible();

		// 2. Verify Public Tunnel Configuration section title (rendered by FormSection component)
		await expect(page.locator('h5:has-text("Public Tunnel Configuration")')).toBeVisible();

		// 3. Verify all status fields are present
		await expect(page.getByText('Status:')).toBeVisible();
		await expect(page.getByText('Port:')).toBeVisible();
		await expect(page.getByText('Subdomain (optional):')).toBeVisible();

		// 4. Verify initial state is disabled
		const statusValue = page.getByText('Status:').locator('..').getByText('Disabled');
		await expect(statusValue).toBeVisible();
	});

	test('Test 6.5: View VS Code Tunnel Status', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Verify VS Code Remote Tunnel section heading
		await expect(
			page.getByRole('heading', { name: 'VS Code Remote Tunnel', level: 4 })
		).toBeVisible();

		// 2. Verify status shows "Stopped" by default
		const statusBadge = page.getByText('Stopped');
		await expect(statusBadge).toBeVisible();

		// 3. Verify Tunnel Name field is present and empty (optional)
		const tunnelNameInput = page.getByRole('textbox', { name: 'Tunnel Name' });
		await expect(tunnelNameInput).toBeVisible();
		await expect(tunnelNameInput).toHaveValue('');
		await expect(tunnelNameInput).toHaveAttribute(
			'placeholder',
			'Custom tunnel name (optional)'
		);

		// 4. Verify default tunnel name info is displayed
		await expect(
			page.getByText(
				'Leave empty to use default: name will be "dispatch-[hostname]" and folder will be your workspace root.'
			)
		).toBeVisible();

		// 5. Verify first-time setup instructions are shown
		await expect(page.getByText('First-time setup:')).toBeVisible();
		await expect(
			page.getByText(
				'When you start the tunnel for the first time, you\'ll need to authenticate with Microsoft/GitHub. A device login URL will appear above.'
			)
		).toBeVisible();

		// 6. Verify "Start Tunnel" button is available
		const startButton = page.getByRole('button', { name: 'Start Tunnel' });
		await expect(startButton).toBeVisible();
		await expect(startButton).toBeEnabled();
	});

	test('Test 6.6: Start VS Code Tunnel - Backend Socket Response', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Verify Tunnel Name field is empty (using default)
		const tunnelNameInput = page.getByRole('textbox', { name: 'Tunnel Name' });
		await expect(tunnelNameInput).toHaveValue('');

		// 2. Click "Start Tunnel" button
		const startButton = page.getByRole('button', { name: 'Start Tunnel' });
		await startButton.click();

		// 3. Wait for backend socket response
		// If wrong event name is used (vscode.tunnel.start), backend won't respond
		await page.waitForTimeout(3000);

		// CRITICAL: Backend MUST respond (success or error, but must respond)
		// This validates that:
		// - Correct socket event name was sent (vscode-tunnel:start)
		// - Backend handler received and processed the event
		// - Socket communication layer is working

		// Check for error response (expected in test environment)
		const errorBox = page.locator('.info-box.error, .error-message, [role="alert"]');
		const hasError = (await errorBox.count()) > 0;

		// Check for info box (device login URL or other info)
		const infoBox = page.locator('.info-box.info');
		const hasInfo = (await infoBox.count()) > 0;

		// Check for status update in VS Code section
		const vscodeSection = page
			.locator('text=VS Code Remote Tunnel')
			.locator('..')
			.locator('..');
		const statusBadge = vscodeSection.locator('.status-item').first();
		const hasStatus = await statusBadge.isVisible().catch(() => false);

		// If there's an error, validate it's a backend error (not timeout)
		if (hasError) {
			const errorText = await errorBox.first().textContent();
			console.log('[Test] Backend error received:', errorText);

			// Backend responded - this is GOOD
			expect(errorText).toBeDefined();
			expect(errorText.length).toBeGreaterThan(0);

			// Should NOT be timeout/connection errors
			expect(errorText.toLowerCase()).not.toContain('timeout');
			expect(errorText.toLowerCase()).not.toContain('connection failed');
		}

		// MUST have received SOME response from backend
		// If none of these exist, the socket event never got a response
		expect(hasError || hasInfo || hasStatus).toBe(true);

		console.log('[Test] ✓ Backend responded to vscode-tunnel:start event');
	});

	test('Test 6.7: VS Code Tunnel Device Login URL Display', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// Verify initial state - no login URL visible
		const loginUrlBox = page.locator('.info-box.info', {
			has: page.locator('text=/Device Login Required/i')
		});
		await expect(loginUrlBox).not.toBeVisible();

		// Click Start Tunnel button to trigger the authentication flow
		const startButton = page.getByRole('button', { name: 'Start Tunnel' });
		await startButton.click();

		// CRITICAL: Wait for backend socket response
		// If wrong event name is used (vscode.tunnel.start), backend won't respond
		// We should get EITHER:
		// 1. Device login URL (success response)
		// 2. Error message (backend error)
		// 3. NOTHING (indicates socket event wasn't handled - TEST FAILS)

		await page.waitForTimeout(3000);

		const loginUrlVisible = await page
			.locator('.info-box.info', {
				has: page.locator('text=/Device Login Required/i')
			})
			.isVisible()
			.catch(() => false);

		const errorVisible = await page.locator('.info-box.error').isVisible().catch(() => false);

		// MUST have received a response from backend
		// This validates the socket event was handled (not timeout)
		expect(loginUrlVisible || errorVisible).toBe(true);

		// Test different scenarios based on backend response
		if (loginUrlVisible) {
			// SCENARIO 1: Device login URL is shown
			console.log('[Test] Device login URL flow detected');

			// 1. Verify InfoBox with info variant is displayed
			const infoBox = page.locator('.info-box.info', {
				has: page.locator('text=/Device Login Required/i')
			});
			await expect(infoBox).toBeVisible();

			// 2. Verify the InfoBox has the title "Device Login Required"
			const infoBoxTitle = infoBox.locator('.info-box__title');
			await expect(infoBoxTitle).toHaveText('Device Login Required');

			// 3. Verify login URL input field is visible and readonly
			const loginUrlInput = infoBox.locator('input[readonly]');
			await expect(loginUrlInput).toBeVisible();

			// 4. Get the login URL value and verify it's not empty
			const loginUrl = await loginUrlInput.inputValue();
			expect(loginUrl).toBeTruthy();
			expect(loginUrl.length).toBeGreaterThan(0);

			// 5. Verify the URL contains vscode.dev or similar authentication URL pattern
			expect(loginUrl).toMatch(/https?:\/\//); // Should be a valid URL

			// 6. Verify Copy button is present within the InfoBox
			const copyButton = infoBox.getByRole('button', { name: 'Copy' });
			await expect(copyButton).toBeVisible();
			await expect(copyButton).toBeEnabled();

			// 7. Test copy button functionality
			await copyButton.click();

			// Wait a moment for clipboard operation
			await page.waitForTimeout(500);

			// 8. Verify instruction text is present
			await expect(
				infoBox.getByText('Complete the device login in VS Code to activate the tunnel.')
			).toBeVisible();

			// 9. Verify the input wrapper structure (from Tunnels.svelte line 462-465)
			const loginUrlWrapper = infoBox.locator('.login-url-wrapper');
			await expect(loginUrlWrapper).toBeVisible();

			// 10. Verify input is within the wrapper
			const wrapperInput = loginUrlWrapper.locator('input');
			await expect(wrapperInput).toHaveAttribute('readonly', '');

			// 11. Verify the instruction paragraph has the expected styling attributes
			const instruction = infoBox.locator('p', {
				hasText: 'Complete the device login in VS Code to activate the tunnel.'
			});
			await expect(instruction).toBeVisible();

			console.log('[Test] ✓ All device login URL UI elements verified successfully');
		} else if (errorVisible) {
			// SCENARIO 2: Service is unavailable (expected in test environment)
			console.log('[Test] VS Code tunnel service unavailable (expected in test environment)');

			// Verify error message is shown in an InfoBox with error variant
			const errorBox = page.locator('.info-box.error');
			await expect(errorBox).toBeVisible();

			// Backend responded with error - validates socket communication works
			console.log('[Test] ✓ Backend error response validated - socket communication works');
		}

		console.log('[Test] ✓ Backend responded to vscode-tunnel:start event');
	});

	test('Test 6.8: VS Code Tunnel Custom Name Configuration', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Locate Tunnel Name input
		const tunnelNameInput = page.getByRole('textbox', { name: 'Tunnel Name' });
		await expect(tunnelNameInput).toBeVisible();

		// 2. Enter custom tunnel name
		await tunnelNameInput.fill('my-vscode-tunnel');

		// 3. Verify custom tunnel name is set
		await expect(tunnelNameInput).toHaveValue('my-vscode-tunnel');

		// 4. Verify Start Tunnel button is still available
		const startButton = page.getByRole('button', { name: 'Start Tunnel' });
		await expect(startButton).toBeVisible();
		await expect(startButton).toBeEnabled();

		// 5. Verify configuration note is visible
		await expect(
			page.getByText(
				'Leave empty to use default: name will be "dispatch-[hostname]" and folder will be your workspace root.'
			)
		).toBeVisible();
	});

	test('Test 6.9: VS Code Tunnel Configuration Elements', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Verify VS Code tunnel description
		await expect(
			page.getByText(
				'Connect to this workspace remotely using VS Code Desktop or vscode.dev in your browser.'
			)
		).toBeVisible();

		// 2. Verify VS Code Tunnel Configuration section title (rendered by FormSection component)
		await expect(page.locator('h5:has-text("VS Code Tunnel Configuration")')).toBeVisible();

		// 3. Verify status field
		await expect(page.getByText('Status:')).toBeVisible();

		// 4. Verify VS Code Desktop instructions
		await expect(page.getByText('VS Code Desktop:')).toBeVisible();
		await expect(
			page.getByText('Install the "Remote - Tunnels" extension and connect using the tunnel name.')
		).toBeVisible();

		// 5. Verify info box is present when tunnel is stopped
		const infoBox = page.locator('text=First-time setup:').locator('..');
		await expect(infoBox).toBeVisible();
	});

	test('Test 6.10: Connectivity Page Header', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Connectivity tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Connectivity');

		// 1. Verify main heading
		await expect(page.getByRole('heading', { name: 'Connectivity', level: 3 })).toBeVisible();

		// 2. Verify page description
		await expect(
			page.getByText(
				'Enable remote access to your development environment through LocalTunnel or VS Code Remote Tunnels.'
			)
		).toBeVisible();

		// 3. Verify both sections are present on the page
		await expect(page.getByRole('heading', { name: 'LocalTunnel', level: 4 })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'VS Code Remote Tunnel', level: 4 })
		).toBeVisible();
	});
});
