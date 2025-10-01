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

	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,

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
		baseURL: process.env.USE_SSL === 'true' ? 'https://localhost:5173' : 'http://localhost:7173',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',

		/* Capture video on failure */
		video: 'retain-on-failure',

		/* Test setup options */
		// Only ignore HTTPS errors when using SSL server
		ignoreHTTPSErrors: process.env.USE_SSL === 'true',

		/* Timeout settings */
		actionTimeout: 10000,
		navigationTimeout: 30000
	},

	/* Global setup to disable service worker */
	globalSetup: './e2e/global-setup.js',

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},

		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		},

		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] }
		},

		/* Test against mobile viewports. */
		{
			name: 'Mobile Chrome',
			use: {
				...devices['Pixel 5'],
				hasTouch: true
			}
		},
		{
			name: 'Mobile Safari',
			use: {
				...devices['iPhone 12'],
				hasTouch: true
			}
		}
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		// Use test server (no SSL) by default. Override with USE_SSL=true for SSL-specific tests
		command: process.env.USE_SSL === 'true' ? 'npm run dev' : 'npm run dev:test',
		url: process.env.USE_SSL === 'true' ? 'https://localhost:5173' : 'http://localhost:7173',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
		ignoreHTTPSErrors: process.env.USE_SSL === 'true'
	}
});
