/**
 * Seed spec for E2E tests
 *
 * This test runs FIRST before all other tests to verify the test environment
 * is properly initialized.
 *
 * This seed test will:
 * 1. Start the server if needed
 * 2. Verify server is ready and responding
 * 3. Reset database to fresh install state
 * 4. Verify the application loads correctly
 */

import { test, expect } from '@playwright/test';
import { resetToFreshInstall } from './helpers/index.js';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';

let serverProcess = null;

test.describe.configure({ mode: 'serial' });

test.describe('Seed - Environment Verification', () => {
	test('verify environment is ready for testing', async ({ page, request }) => {
		const baseURL = 'http://127.0.0.1:7173';

		console.log('[Seed] Verifying test environment...');

		// Step 1: Check if server is already running
		console.log('[Seed] Checking server status...');

		let statusResponse;
		let serverWasStarted = false;

		try {
			statusResponse = await request.get(`${baseURL}/api/status`);
		} catch (error) {
			// Server not running, start it
			console.log('[Seed] Server not running, starting it...');

			// Create temporary directories
			mkdirSync('/tmp/dispatch-test-home', { recursive: true });
			mkdirSync('/tmp/dispatch-test-workspaces', { recursive: true });

			// Start server
			serverProcess = spawn('npx', ['vite', 'dev', '--host', '127.0.0.1', '--port', '7173'], {
				cwd: process.cwd(),
				env: {
					...process.env,
					TERMINAL_KEY: 'test-automation-key-12345',
					HOME: '/tmp/dispatch-test-home',
					WORKSPACES_ROOT: '/tmp/dispatch-test-workspaces',
					SSL_ENABLED: 'false',
					NODE_ENV: 'test'
				},
				stdio: ['ignore', 'inherit', 'inherit']
			});

			serverWasStarted = true;

			// Wait for server to be ready
			console.log('[Seed] Waiting for server to start...');
			const maxAttempts = 60;
			for (let i = 0; i < maxAttempts; i++) {
				try {
					statusResponse = await request.get(`${baseURL}/api/status`);
					if (statusResponse.ok()) {
						console.log('[Seed] ✓ Server started successfully');
						break;
					}
				} catch (err) {
					if ((i + 1) % 10 === 0) {
						console.log(`[Seed] Still waiting... (${i + 1}s)`);
					}
					if (i === maxAttempts - 1) {
						console.error('\n[Seed] ✗ ERROR: Server failed to start!');
						console.error('[Seed] ');
						console.error('[Seed] You can manually start the server to debug:');
						console.error('[Seed]   npm run dev:test');
						console.error('');
						if (serverProcess) {
							serverProcess.kill();
						}
						throw new Error('Test server failed to start on http://127.0.0.1:7173');
					}
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}

		expect(statusResponse.ok()).toBe(true);
		const status = await statusResponse.json();
		console.log('[Seed] ✓ Server is ready');
		console.log('[Seed] Initial onboarding status:', status.onboarding);

		// Step 2: Reset database to fresh install state
		console.log('[Seed] Resetting database to fresh install...');
		try {
			const result = await resetToFreshInstall();
			console.log('[Seed] ✓ Database reset successfully');
			console.log('[Seed]   Method:', result.method);
			console.log('[Seed]   Onboarding:', result.state?.onboarding_complete || false);
		} catch (error) {
			console.error('[Seed] ✗ Failed to reset database:', error.message);
			throw error;
		}

		// Step 3: Verify onboarding is not complete
		console.log('[Seed] Verifying database state...');
		const statusCheck = await request.get(`${baseURL}/api/status`);
		const statusData = await statusCheck.json();
		expect(statusData.onboarding.isComplete).toBe(false);
		console.log('[Seed] ✓ Onboarding state verified (not complete)');

		// Step 4: Verify application loads
		console.log('[Seed] Verifying application loads...');
		await page.goto(baseURL);
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveTitle(/Dispatch/i);
		console.log('[Seed] ✓ Application loads correctly');

		console.log('[Seed] ✅ Environment ready for testing\n');
	});
});
