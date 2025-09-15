/**
 * E2E Test Utilities
 * Provides helper functions for test setup and cleanup
 */

/**
 * Clear all browser storage and disable service worker caching
 * @param {import('@playwright/test').Page} page
 */
export async function clearStorageAndDisableServiceWorker(page) {
	// Clear all storage types
	await page.evaluate(() => {
		// Clear localStorage
		localStorage.clear();

		// Clear sessionStorage
		sessionStorage.clear();

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
	});

	// Disable service worker registration
	await page.addInitScript(() => {
		// Override service worker registration to prevent caching
		if ('serviceWorker' in navigator) {
			// Unregister any existing service workers
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				registrations.forEach((registration) => {
					registration.unregister();
				});
			});

			// Mock service worker registration to do nothing
			const originalRegister = navigator.serviceWorker.register;
			navigator.serviceWorker.register = () => Promise.resolve();
		}
	});

	// Clear cookies
	const context = page.context();
	await context.clearCookies();

	// Clear cache storage
	await page.evaluate(() => {
		if ('caches' in window) {
			caches.keys().then((names) => {
				names.forEach((name) => {
					caches.delete(name);
				});
			});
		}
	});
}

/**
 * Set up test environment with fresh state
 * @param {import('@playwright/test').Page} page
 * @param {string} url - URL to navigate to after clearing storage
 */
export async function setupFreshTestEnvironment(page, url = '/') {
	await clearStorageAndDisableServiceWorker(page);
	await page.goto(url);

	// Wait for page to be ready
	await page.waitForLoadState('networkidle');
}
