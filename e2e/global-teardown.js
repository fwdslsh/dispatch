// e2e/global-teardown.js
/**
 * Global teardown for Playwright tests
 * Cleanup the test server if we started it
 */

export default async function globalTeardown() {
	console.log('[Global Teardown] Tests complete');

	// Kill the server process if we started it
	if (global.__SERVER_PROCESS__) {
		console.log('[Global Teardown] Stopping test server...');
		global.__SERVER_PROCESS__.kill('SIGTERM');

		// Give it a moment to clean up
		await new Promise((resolve) => setTimeout(resolve, 1000));

		console.log('[Global Teardown] Test server stopped');
	}
}
