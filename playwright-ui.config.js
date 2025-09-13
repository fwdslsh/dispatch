// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Non-Claude UI Tests
 * 
 * This configuration focuses on terminal and core UI functionality,
 * excluding Claude sessions to ensure reliable CI execution without
 * external API dependencies.
 */
export default defineConfig({
	testDir: './e2e',
	
	// Test file patterns - exclude Claude-specific tests
	testMatch: [
		'comprehensive-ui.spec.js',
		'command-palette.spec.js',
		'working-directory.spec.js',
		'working-directory-validation.spec.js',
		'socket-reconnection.spec.js',
		'workspace-terminal-interactions.spec.js',
		'terminal-session-resumption.spec.js'
	],
	
	// Ignore Claude-specific test files
	testIgnore: [
		'**/claude-*.spec.js',
		'**/activity-summaries.spec.js',  // Often Claude-dependent
		'**/project-page-claude-*.spec.js'
	],

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
		baseURL: 'http://localhost:5173',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		
		/* Capture video on failure */
		video: 'retain-on-failure',
		
		/* Global test timeout */
		actionTimeout: 10000,
		navigationTimeout: 30000
	},

	/* Test timeout */
	timeout: 60000,
	expect: {
		timeout: 10000
	},

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
			use: { ...devices['Pixel 5'] }
		},
		{
			name: 'Mobile Safari',
			use: { ...devices['iPhone 12'] }
		}
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
		env: {
			// Ensure consistent test environment
			TERMINAL_KEY: 'testkey12345',
			PTY_MODE: 'shell',  // Force shell mode, not Claude
			NODE_ENV: 'test'
		}
	},

	/* Global setup and teardown */
	globalSetup: undefined,
	globalTeardown: undefined,

	/* Output directory for test artifacts */
	outputDir: 'test-results/',
	
	/* Fail fast on first error in CI */
	...(process.env.CI && { 
		maxFailures: 5,
		fullyParallel: false,
		workers: 1
	})
});