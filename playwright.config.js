// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: './e2e',

	/* Run tests in files in parallel */
	fullyParallel: true,

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,

	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,

	/* Run tests serially to avoid database conflicts */
	/* TODO: Implement per-test database isolation for parallel execution */
	workers: 1,

	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		['html', { outputFolder: 'playwright-report' }],
		['line'],
		['json', { outputFile: 'test-results/results.json' }]
	],

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		// Use test server (no SSL) by default. Override with USE_SSL=true for SSL-specific tests
		baseURL: process.env.USE_SSL === 'true' ? 'https://127.0.0.1:5173' : 'http://127.0.0.1:7173',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',

		/* Capture video on failure */
		video: 'retain-on-failure',

		/* Test setup options */
		// Only ignore HTTPS errors when using SSL server
		ignoreHTTPSErrors: process.env.USE_SSL === 'true',

		/* Grant clipboard permissions for automated testing */
		permissions: ['clipboard-read', 'clipboard-write'],

		/* Timeout settings */
		actionTimeout: 10000,
		navigationTimeout: 30000
	},

	/* Global setup and teardown */
	globalSetup: './e2e/global-setup.js',
	globalTeardown: './e2e/global-teardown.js',

	/* Configure projects for major browsers */
	projects: [
		// Setup project - runs first and sets up the database
		{
			name: 'setup',
			testMatch: /.*seed\.spec\.ts/
		},

		// Browser test projects - depend on setup
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup']
		},

		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
			dependencies: ['setup']
		},

		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
			dependencies: ['setup']
		},

		/* Test against mobile viewports. */
		{
			name: 'Mobile Chrome',
			use: {
				...devices['Pixel 5'],
				hasTouch: true
			},
			dependencies: ['setup']
		},
		{
			name: 'Mobile Safari',
			use: {
				...devices['iPhone 12'],
				hasTouch: true
			},
			dependencies: ['setup']
		}
	]

	/* Note: Server is started by global-setup.js instead of webServer config
	 * This is more reliable in different execution contexts (MCP, CI, local)
	 */
});
