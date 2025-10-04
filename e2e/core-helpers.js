/**
 * Core E2E Test Helpers for Dispatch
 * Consolidated and standardized test utilities
 */

const TEST_KEY = process.env.TERMINAL_KEY || 'test-automation-key-12345';
const BASE_URL = process.env.BASE_URL || 'http://localhost:7173';

/**
 * Pre-authenticate user by setting localStorage with terminal key
 * This bypasses the login form completely
 * @param {import('@playwright/test').Page} page
 */
export async function preAuthenticateUser(page) {
	await page.addInitScript((testKey) => {
		// Set authentication key
		localStorage.setItem('dispatch-auth-token', testKey);

		// Set session info (simulating successful login)
		localStorage.setItem('authSessionId', `test-session-${Date.now()}`);
		localStorage.setItem(
			'authExpiresAt',
			new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
		);

		// Mark onboarding as complete
		localStorage.setItem('onboarding-complete', 'true');
	}, TEST_KEY);

	console.log(`✓ Pre-authenticated with key: ${TEST_KEY}`);
}

/**
 * Standard authentication setup for all tests
 * @param {import('@playwright/test').Page} page
 * @deprecated Use preAuthenticateUser() instead for better reliability
 */
export async function authenticateUser(page) {
	await preAuthenticateUser(page);

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
	// Clear all storage and set up authentication
	await page.addInitScript((testKey) => {
		localStorage.clear();
		sessionStorage.clear();

		// Set test auth key with full session info
		localStorage.setItem('dispatch-auth-key', testKey);
		localStorage.setItem('authSessionId', `test-session-${Date.now()}`);
		localStorage.setItem(
			'authExpiresAt',
			new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
		);
		localStorage.setItem('onboarding-complete', 'true');

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
	}, TEST_KEY);

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

/**
 * Complete onboarding via API to bypass onboarding flow in tests
 * This seeds the database with completed onboarding state
 * @param {import('@playwright/test').Page} page
 */
export async function completeOnboardingViaApi(page) {
	// Use POST to initialize onboarding as complete
	await page.request.post(`${BASE_URL}/api/settings/onboarding`, {
		data: {
			currentStep: 'complete',
			completedSteps: ['auth', 'workspace', 'settings', 'complete'],
			isComplete: true,
			firstWorkspaceId: '/workspace/test-workspace'
		}
	});

	console.log('✓ Onboarding marked as complete via API');
}

/**
 * Setup complete test environment with onboarding bypassed
 * Use this for tests that don't need to test the onboarding flow itself
 * @param {import('@playwright/test').Page} page
 */
export async function setupCompleteTestEnvironment(page) {
	// First complete onboarding via API
	await completeOnboardingViaApi(page);

	// Then setup fresh environment (auth, clear storage, etc.)
	await setupFreshTestEnvironment(page);

	// Mock onboarding as complete for client-side checks
	await page.addInitScript(() => {
		localStorage.setItem('onboarding-complete', 'true');
	});

	console.log('✓ Test environment ready with onboarding complete');
}

/**
 * Mock all required API endpoints for workspace testing
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Override default mock data
 */
export async function setupWorkspaceTestMocks(page, options = {}) {
	const defaults = {
		sessions: [],
		workspaces: [],
		onboardingComplete: true
	};

	const config = { ...defaults, ...options };

	// Mock environment endpoint (called early in page load)
	await page.route('/api/environment**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				enableTunnel: false,
				hasClaudeProjects: false
			})
		});
	});

	// Mock auth config endpoint (called early in page load)
	await page.route('/api/auth/config**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				requiresAuth: true,
				sessionDuration: 30 * 24 * 60 * 60 * 1000 // 30 days
			})
		});
	});

	// Mock onboarding as complete
	await page.route('/api/settings/onboarding**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				currentStep: 'complete',
				isComplete: config.onboardingComplete,
				completedSteps: config.onboardingComplete
					? ['auth', 'workspace', 'settings', 'complete']
					: []
			})
		});
	});

	// Mock sessions
	await page.route('/api/sessions**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ sessions: config.sessions })
		});
	});

	// Mock workspaces
	await page.route('/api/workspaces**', (route) => {
		if (route.request().method() === 'GET') {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					workspaces: config.workspaces,
					pagination: { total: config.workspaces.length, limit: 50, offset: 0, hasMore: false }
				})
			});
		} else {
			route.continue();
		}
	});

	// Mock auth check
	await page.route('/api/auth/check**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ authenticated: true })
		});
	});

	console.log('✓ Workspace test mocks configured');
}

/**
 * Navigate to workspace with onboarding already complete
 * This is the recommended approach for most workspace tests
 * @param {import('@playwright/test').Page} page
 */
export async function navigateToWorkspaceWithOnboardingComplete(page) {
	// Pre-authenticate first (sets localStorage)
	await preAuthenticateUser(page);

	// Setup mocks
	await setupWorkspaceTestMocks(page);

	// Navigate to workspace
	await page.goto('/workspace');
	await waitForWorkspaceReady(page);

	console.log('✓ Navigated to workspace with onboarding complete');
}

/**
 * Navigate directly to a route with authentication pre-configured
 * Use this when you need to test specific pages like /settings or /console
 * @param {import('@playwright/test').Page} page
 * @param {string} route - The route to navigate to (e.g., '/settings', '/console')
 */
export async function navigateToRouteAuthenticated(page, route) {
	// Pre-authenticate first
	await preAuthenticateUser(page);

	// Setup basic mocks
	await setupWorkspaceTestMocks(page);

	// Navigate to the specified route
	await page.goto(route);
	await page.waitForLoadState('domcontentloaded');

	console.log(`✓ Navigated to ${route} with authentication`);
}

/**
 * Quick authentication helper for tests that just need auth without full workspace setup
 * @param {import('@playwright/test').Page} page
 */
export async function quickAuth(page) {
	await preAuthenticateUser(page);

	// Mock environment endpoint to prevent auth warnings
	await page.route('/api/environment**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				enableTunnel: false,
				hasClaudeProjects: false
			})
		});
	});

	// Mock auth config endpoint
	await page.route('/api/auth/config**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				requiresAuth: true,
				sessionDuration: 30 * 24 * 60 * 60 * 1000
			})
		});
	});

	await page.route('/api/auth/check**', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				authenticated: true,
				success: true,
				sessionId: 'test-session',
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
			})
		});
	});
	console.log('✓ Quick auth configured');
}

export { TEST_KEY, BASE_URL };
