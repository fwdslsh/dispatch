// e2e/global-setup.js
/**
 * Global setup for Playwright tests
 *
 * NOTE: This expects the dev:test server to already be running
 * Run: npm run dev:test (in a separate terminal)
 *
 * The actual database reset and onboarding is handled by e2e/seed.spec.ts
 * which runs first before all other tests.
 */

export default async function globalSetup() {
	const baseURL = 'http://localhost:7173';

	console.log('\n===========================================');
	console.log('[Global Setup] E2E Test Setup');
	console.log(`[Global Setup] Checking server at ${baseURL}`);
	console.log('===========================================\n');

	// Wait for server to be ready
	const maxAttempts = 30;
	let serverReady = false;

	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch(`${baseURL}/api/status`);
			if (response.ok) {
				console.log('[Global Setup] ✓ Server is ready');
				serverReady = true;
				break;
			}
		} catch (err) {
			if (i === 0) {
				console.log('[Global Setup] Waiting for server to start...');
				console.log('[Global Setup] If server is not running, start it with: npm run dev:test');
			}
			if (i === maxAttempts - 1) {
				console.error('\n[Global Setup] ✗ ERROR: Server is not running!');
				console.error('[Global Setup] Please start the dev server in a separate terminal:');
				console.error('[Global Setup]   npm run dev:test');
				console.error('[Global Setup] Then run the tests again.\n');
				throw new Error('Server not running on http://localhost:7173');
			}
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}

	console.log('[Global Setup] ✓ Server check complete');
	console.log('[Global Setup] Database reset and onboarding will be handled by seed.spec.ts\n');
}
