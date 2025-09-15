/**
 * Global setup for Playwright E2E tests
 * Disables service worker caching and clears storage globally
 */

async function globalSetup(config) {
	console.log('🧹 Setting up E2E test environment...');

	// Set environment variables for test context
	process.env.DISABLE_SERVICE_WORKER = 'true';
	process.env.E2E_TEST_MODE = 'true';

	// Note: Individual test storage clearing and service worker disabling
	// is handled per-test in the beforeEach hooks via setupFreshTestEnvironment()
	// This ensures each test starts with a completely fresh state

	console.log('🚫 Service worker registration disabled for all tests');
	console.log('🧹 Storage clearing configured for each test');
	console.log('✅ E2E environment setup complete');
}

export default globalSetup;
