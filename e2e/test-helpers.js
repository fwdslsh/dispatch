/**
 * E2E Test Helpers
 * Common utilities for Playwright tests with MVVM architecture support
 */

/**
 * Wait for the main workspace to be ready
 * @param {import('@playwright/test').Page} page
 */
export async function waitForWorkspace(page) {
	// Wait for either the new dispatch-workspace or fallback selectors
	await page.waitForSelector('.dispatch-workspace, .main-content, .workspace', {
		timeout: 15000
	});

	// Wait for network idle to ensure all initial API calls are complete
	await page.waitForLoadState('networkidle');
}

/**
 * Setup fresh test environment with proper storage clearing
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
export async function setupFreshTestEnvironment(page, url = '/workspace') {
	// Clear all storage and disable service worker
	await page.addInitScript(() => {
		// Clear localStorage and sessionStorage
		localStorage.clear();
		sessionStorage.clear();

		// Set authentication token for tests
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

		// Disable service worker registration
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				registrations.forEach((registration) => {
					registration.unregister();
				});
			});

			// Mock service worker registration
			const originalRegister = navigator.serviceWorker.register;
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

	// Clear cookies at context level
	await page.context().clearCookies();

	// Mock authentication endpoint to return success
	await page.route('/api/auth/check**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ authenticated: true })
		});
	});

	// Navigate to the page
	await page.goto(url);

	// Wait for workspace to be ready
	await waitForWorkspace(page);
}

/**
 * Handle mobile touch events properly
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {Object} options
 */
export async function mobileTap(page, selector, options = {}) {
	// Check if the browser context supports touch
	const isTouchSupported = await page.evaluate(() => 'ontouchstart' in window);

	if (isTouchSupported) {
		await page.tap(selector, options);
	} else {
		// Fallback to click for desktop contexts
		await page.click(selector, options);
	}
}

/**
 * Wait for session to be ready and active
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 */
export async function waitForActiveSession(page, sessionId) {
	// Wait for session container to be visible
	await page.waitForSelector(`[data-session-id="${sessionId}"], .session-container`, {
		timeout: 10000
	});

	// Wait for session to be marked as active/ready
	await page.waitForFunction(
		(id) => {
			const session = document.querySelector(`[data-session-id="${id}"]`);
			return session && !session.classList.contains('loading');
		},
		sessionId,
		{ timeout: 10000 }
	);
}

/**
 * Mock API responses for testing
 * @param {import('@playwright/test').Page} page
 * @param {Object} mocks
 */
export async function setupApiMocks(page, mocks = {}) {
	// Default mocks
	const defaultMocks = {
		sessions: [],
		workspaces: [],
		claudeProjects: []
	};

	const allMocks = { ...defaultMocks, ...mocks };

	// Mock sessions endpoint
	await page.route('/api/sessions**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ sessions: allMocks.sessions })
		});
	});

	// Mock workspaces endpoint
	await page.route('/api/workspaces**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ workspaces: allMocks.workspaces })
		});
	});

	// Mock Claude projects endpoint
	await page.route('/api/claude/projects**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ projects: allMocks.claudeProjects })
		});
	});
}
