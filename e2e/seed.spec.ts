/**
 * Seed spec for E2E tests
 *
 * This test runs FIRST before all other tests to verify the test environment
 * is properly initialized with the correct terminal key.
 *
 * IMPORTANT: Before running tests for the first time, or if tests fail with auth errors:
 * 1. Stop the test server (Ctrl+C)
 * 2. Run: rm -rf .testing-home/.dispatch
 * 3. Restart: npm run dev:test
 * 4. Run tests: npm run test:e2e
 *
 * What this seed does:
 * 1. Checks if server is ready
 * 2. Attempts to complete onboarding (if not already done)
 * 3. Verifies the terminal key works correctly
 * 4. Confirms the application loads
 */

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Seed - Environment Verification', () => {
	test('verify environment is ready for testing', async ({ page }) => {
		const baseURL = 'http://localhost:7173';
		const testKey = 'test-automation-key-12345';

		console.log('[Seed] Verifying test environment...');

		// Step 1: Verify server is ready
		console.log('[Seed] Checking server status...');
		const statusResponse = await fetch(`${baseURL}/api/status`);
		expect(statusResponse.ok).toBe(true);
		console.log('[Seed] ✓ Server is ready');

		// Step 2: Try to complete onboarding (will fail if already done, which is fine)
		console.log('[Seed] Ensuring onboarding is complete...');
		const onboardResponse = await fetch(`${baseURL}/api/settings/onboarding`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				terminalKey: testKey
			})
		});

		// Either 201 (newly onboarded) or 409 (already onboarded) is acceptable
		if (onboardResponse.status === 201) {
			console.log('[Seed] ✓ Fresh onboarding completed');
		} else if (onboardResponse.status === 409) {
			console.log('[Seed] ℹ Server already onboarded');
		} else {
			const error = await onboardResponse.text();
			console.error('[Seed] Unexpected onboarding response:', onboardResponse.status, error);
		}

		// Step 3: Verify the terminal key works
		console.log('[Seed] Verifying terminal key...');
		const authCheckResponse = await fetch(`${baseURL}/api/auth/check`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${testKey}`
			},
			body: JSON.stringify({ key: testKey })
		});

		if (!authCheckResponse.ok) {
			console.error('\n[Seed] ✗ ERROR: Terminal key verification failed!');
			console.error('[Seed] The server is configured with a different terminal key.');
			console.error('[Seed] To fix this:');
			console.error('[Seed]   1. Stop the test server (Ctrl+C)');
			console.error('[Seed]   2. Delete the database: rm -rf .testing-home/.dispatch');
			console.error('[Seed]   3. Restart server: npm run dev:test');
			console.error('[Seed]   4. Run tests again\n');
		}

		expect(authCheckResponse.ok).toBe(true);
		console.log('[Seed] ✓ Terminal key verified');

		// Step 4: Verify application loads
		console.log('[Seed] Verifying application loads...');
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveTitle(/Dispatch/i);
		console.log('[Seed] ✓ Application loads correctly');

		console.log('[Seed] ✓ Environment ready for testing\n');
	});
});
