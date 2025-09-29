/**
 * Core E2E Test Helpers for Dispatch
 * Consolidated and standardized test utilities
 */

const TEST_KEY = process.env.TERMINAL_KEY || 'testkey12345';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

/**
 * Standard authentication setup for all tests
 * @param {import('@playwright/test').Page} page
 */
export async function authenticateUser(page) {
	await page.addInitScript(() => {
		localStorage.setItem('dispatch-auth-key', 'testkey12345');
	});

	// Mock auth check endpoint
	await page.route('/api/auth/check**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ authenticated: true })
		});
	});
}

/**
 * Clean browser state and setup fresh environment
 * @param {import('@playwright/test').Page} page
 */
export async function setupFreshTestEnvironment(page) {
	// Clear all storage
	await page.addInitScript(() => {
		localStorage.clear();
		sessionStorage.clear();

		// Set test auth key
		localStorage.setItem('dispatch-auth-key', 'testkey12345');

		// Clear IndexedDB
		if (window.indexedDB) {
			indexedDB.databases().then((databases) => {
				databases.forEach((db) => {
					if (db.name) {
						indexedDB.deleteDatabase(db.name);
					}
				});
			});
		}

		// Disable service worker
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				registrations.forEach((registration) => {
					registration.unregister();
				});
			});

			// Mock registration
			navigator.serviceWorker.register = () => Promise.resolve();
		}

		// Clear caches
		if ('caches' in window) {
			caches.keys().then((names) => {
				names.forEach((name) => {
					caches.delete(name);
				});
			});
		}
	});

	// Clear cookies
	await page.context().clearCookies();
}

/**
 * Navigate to workspace with proper setup and waiting
 * @param {import('@playwright/test').Page} page
 */
export async function navigateToWorkspace(page) {
	await setupFreshTestEnvironment(page);
	await authenticateUser(page);
	await page.goto('/workspace');
	await waitForWorkspaceReady(page);
}

/**
 * Wait for workspace to be fully loaded and ready
 * @param {import('@playwright/test').Page} page
 */
export async function waitForWorkspaceReady(page) {
	// First, wait for basic page load
	try {
		await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
	} catch (e) {
		console.log('DOM content load timeout, continuing...');
	}

	// Try to wait for main content with fallback
	const workspaceSelectors = [
		'main',
		'body',
		'.dispatch-workspace',
		'.main-content',
		'.workspace',
		'.wm-root',
		'#app'
	];

	let foundElement = false;
	for (const selector of workspaceSelectors) {
		try {
			await page.waitForSelector(selector, { timeout: 5000 });
			foundElement = true;
			console.log(`✓ Found workspace element: ${selector}`);
			break;
		} catch (e) {
			// Continue to next selector
		}
	}

	if (!foundElement) {
		console.log('⚠️ No workspace elements found, but page loaded');
	}

	// Wait for network idle if possible
	try {
		await page.waitForLoadState('networkidle', { timeout: 5000 });
	} catch (e) {
		console.log('Network idle timeout, continuing...');
	}
}

/**
 * Setup API mocks for testing
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 */
export async function setupApiMocks(page, options = {}) {
	const defaultMocks = {
		sessions: [],
		workspaces: [],
		claudeProjects: []
	};

	const mocks = { ...defaultMocks, ...options };

	// Mock sessions endpoint
	await page.route('/api/sessions**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ sessions: mocks.sessions })
		});
	});

	// Mock workspaces endpoint
	await page.route('/api/workspaces**', (route) => {
		const url = new URL(route.request().url());

		if (route.request().method() === 'GET') {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ workspaces: mocks.workspaces })
			});
		} else if (route.request().method() === 'POST') {
			// Mock successful workspace creation
			const body = route.request().postData();
			const data = body ? JSON.parse(body) : {};
			const newWorkspace = {
				id: `test-workspace-${Date.now()}`,
				name: data.name || 'Test Workspace',
				path: data.path || '/tmp/test-workspace',
				createdAt: new Date().toISOString()
			};

			route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify(newWorkspace)
			});
		}
	});
}

/**
 * Safe element interaction with retry logic
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {string} action - 'click', 'fill', 'type'
 * @param {string|null} value - value for fill/type actions
 * @param {Object} options
 */
export async function safeInteract(page, selector, action, value = null, options = {}) {
	const maxAttempts = options.maxAttempts || 3;
	const waitTime = options.waitTime || 1000;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			// Wait for element to be available
			await page.waitForSelector(selector, { timeout: 10000 });

			// Ensure element is visible and stable
			const element = page.locator(selector);
			await element.waitFor({ state: 'visible', timeout: 5000 });

			// Perform action
			switch (action) {
				case 'click':
					await element.click();
					break;
				case 'fill':
					await element.fill(value);
					break;
				case 'type':
					await element.type(value);
					break;
				default:
					throw new Error(`Unknown action: ${action}`);
			}

			// Success - break out of retry loop
			return;
		} catch (error) {
			if (attempt === maxAttempts) {
				throw new Error(
					`Failed to ${action} on ${selector} after ${maxAttempts} attempts: ${error.message}`
				);
			}

			// Wait before retry
			await page.waitForTimeout(waitTime);
		}
	}
}

/**
 * Take screenshot with standardized naming
 * @param {import('@playwright/test').Page} page
 * @param {string} testName
 * @param {string} step
 */
export async function takeTestScreenshot(page, testName, step) {
	const sanitizedName = testName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
	const sanitizedStep = step.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
	const filename = `screenshots/${sanitizedName}-${sanitizedStep}.png`;

	await page.screenshot({
		path: filename,
		fullPage: true
	});

	console.log(`📸 Screenshot saved: ${filename}`);
	return filename;
}

/**
 * Mobile-friendly tap action
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {Object} options
 */
export async function mobileTap(page, selector, options = {}) {
	const isTouchSupported = await page.evaluate(() => 'ontouchstart' in window);

	if (isTouchSupported) {
		await page.tap(selector, options);
	} else {
		await page.click(selector, options);
	}
}

/**
 * Wait for session to be ready and active
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 */
export async function waitForActiveSession(page, sessionId) {
	await page.waitForSelector(`[data-session-id="${sessionId}"], .session-container`, {
		timeout: 10000
	});

	await page.waitForFunction(
		(id) => {
			const session = document.querySelector(`[data-session-id="${id}"]`);
			return session && !session.classList.contains('loading');
		},
		sessionId,
		{ timeout: 10000 }
	);
}

export { TEST_KEY, BASE_URL };
