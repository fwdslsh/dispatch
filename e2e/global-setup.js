// e2e/global-setup.js
/**
 * Global setup for Playwright tests
 *
 * This will start the test server if it's not already running.
 * The actual database reset and onboarding is handled by e2e/seed.spec.ts
 * which runs first before all other tests.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let serverProcess = null;

export default async function globalSetup() {
	const baseURL = 'http://127.0.0.1:7173';

	console.log('\n===========================================');
	console.log('[Global Setup] E2E Test Setup');
	console.log(`[Global Setup] Checking for server at ${baseURL}`);
	console.log('===========================================\n');

	// Quick check if server is already running
	try {
		const response = await fetch(`${baseURL}/api/status`);
		if (response.ok) {
			console.log('[Global Setup] ✓ Test server is already running');
			console.log('[Global Setup] ✓ Ready to run tests\n');
			return;
		}
	} catch (err) {
		// Server not running, need to start it
	}

	// Start the server
	console.log('[Global Setup] Starting test server...');

	// Create temporary directories
	const { mkdirSync } = await import('fs');
	mkdirSync('/tmp/dispatch-test-home', { recursive: true });
	mkdirSync('/tmp/dispatch-test-workspaces', { recursive: true });

	const projectRoot = resolve(__dirname, '..');

	serverProcess = spawn('npx', ['vite', 'dev', '--host', '127.0.0.1', '--port', '7173'], {
		cwd: projectRoot,
		env: {
			...process.env,
			TERMINAL_KEY: 'test-automation-key-12345',
			HOME: '/tmp/dispatch-test-home',
			WORKSPACES_ROOT: '/tmp/dispatch-test-workspaces',
			SSL_ENABLED: 'false',
			NODE_ENV: 'test'
		},
		stdio: ['ignore', 'pipe', 'pipe']
	});

	// Capture output for debugging
	serverProcess.stdout.on('data', (data) => {
		const msg = data.toString();
		if (msg.includes('Local:') || msg.includes('ready in')) {
			console.log('[Global Setup]', msg.trim());
		}
	});

	serverProcess.stderr.on('data', (data) => {
		console.error('[Global Setup] Server error:', data.toString());
	});

	serverProcess.on('error', (error) => {
		console.error('[Global Setup] Failed to start server:', error);
	});

	// Wait for server to be ready
	const maxAttempts = 60; // 60 seconds
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch(`${baseURL}/api/status`);
			if (response.ok) {
				console.log('[Global Setup] ✓ Server is now ready');
				console.log('[Global Setup] ✓ Tests can proceed\n');

				// Store server process for cleanup
				global.__SERVER_PROCESS__ = serverProcess;
				return;
			}
		} catch (err) {
			if ((i + 1) % 10 === 0) {
				console.log(`[Global Setup] Still waiting... (${i + 1}s elapsed)`);
			}
			if (i === maxAttempts - 1) {
				console.error('\n[Global Setup] ✗ ERROR: Server failed to start!');
				if (serverProcess) {
					serverProcess.kill();
				}
				throw new Error('Test server failed to start on http://127.0.0.1:7173');
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
}
