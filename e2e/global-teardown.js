// e2e/global-teardown.js
/**
 * Global teardown for Playwright tests
 * Currently no cleanup needed since we don't start the server
 */

export default async function globalTeardown() {
	console.log('[Global Teardown] Tests complete');
}
