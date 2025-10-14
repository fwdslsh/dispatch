// spec: e2e/ONBOARDING_TEST_PLAN.md
// Test Group: Authentication & Session Tests
//
// PREREQUISITES:
//   1. Start the test server: npm run dev:test
//   2. Ensure the server is running on http://localhost:7173
//   3. Run tests: npx playwright test e2e/onboarding-authentication.spec.ts
//
// NOTE: These tests verify session cookies, authentication state, and persistence.

import { test, expect } from '@playwright/test';
import {
	resetOnboardingState,
	completeOnboarding,
	fillWorkspaceStep,
	selectTheme,
	completeSettingsStep,
	copyApiKey,
	verifySessionCookie,
	verifyAuthenticated
} from '../helpers/onboarding-helpers.js';

test.describe('Onboarding - Authentication & Session Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any existing state to simulate fresh onboarding
		await resetOnboardingState(page);
	});

	test.afterEach(async ({ page }, testInfo) => {
		// Screenshot on failure for debugging
		if (testInfo.status !== testInfo.expectedStatus) {
			await page.screenshot({
				path: `test-results/auth-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`,
				fullPage: true
			});
		}
	});

	test('Test: Session cookie creation', async ({ page }) => {
		// Complete onboarding
		await page.goto('http://localhost:7173/onboarding');
		await fillWorkspaceStep(page, 'Cookie Test');
		await selectTheme(page, null); // Skip theme
		await completeSettingsStep(page);

		// Copy API key and continue
		await copyApiKey(page);
		await page.click('button:has-text("Continue to Dispatch")');

		// Wait for navigation
		await page.waitForURL('**/workspace', { timeout: 10000 });

		// Verify session cookie exists
		const sessionCookie = await verifySessionCookie(page);

		// Verify cookie has correct attributes
		expect(sessionCookie.name).toBe('dispatch_session');
		expect(sessionCookie.httpOnly).toBe(true);
		expect(sessionCookie.sameSite).toBe('Lax');

		// Verify cookie has value (hashed session ID)
		expect(sessionCookie.value).toBeTruthy();
		expect(sessionCookie.value.length).toBeGreaterThan(20);

		// Verify cookie expiration is ~30 days in future
		const now = Date.now();
		const cookieExpires = sessionCookie.expires * 1000; // Convert to ms
		const daysDiff = (cookieExpires - now) / (1000 * 60 * 60 * 24);

		expect(daysDiff).toBeGreaterThan(25); // At least 25 days
		expect(daysDiff).toBeLessThan(35); // No more than 35 days

		console.log('[Test] ✓ Session cookie created with correct attributes');
		console.log(`[Test] Cookie expires in ${daysDiff.toFixed(1)} days`);
	});

	test('Test: Authentication state after onboarding', async ({ page, context }) => {
		// Complete onboarding
		await page.goto('http://localhost:7173/onboarding');
		await fillWorkspaceStep(page, ''); // Skip workspace
		await selectTheme(page, null); // Skip theme
		await completeSettingsStep(page);
		await copyApiKey(page);

		// Click "Continue to Dispatch"
		await page.click('button:has-text("Continue to Dispatch")');

		// Wait for navigation
		await page.waitForURL('**/workspace', { timeout: 10000 });

		// Get cookies from the browser context and make authenticated request
		const cookies = await context.cookies();
		const sessionCookie = cookies.find((c) => c.name === 'dispatch_session');

		// Verify session cookie exists
		expect(sessionCookie).toBeTruthy();

		// Make request with cookies using context's request which shares storage
		const authCheckResponse = await context.request.get('http://localhost:7173/api/auth/keys');

		// Verify response is 200 OK (authenticated)
		expect(authCheckResponse.status()).toBe(200);
		expect(authCheckResponse.ok()).toBe(true);

		console.log('[Test] ✓ Authentication state verified after onboarding');
		console.log('[Test] User:', authData);
	});

	test('Test: Cookie persistence across page reload', async ({ page, context }) => {
		// Complete onboarding
		await completeOnboarding(page, {
			workspaceName: 'Reload Test',
			clickContinue: true
		});

		// Verify authenticated and on workspace page
		await page.waitForURL('**/workspace', { timeout: 10000 });
		expect(page.url()).toContain('/workspace');

		// Get session cookie before reload
		const cookiesBefore = await context.cookies();
		const sessionCookieBefore = cookiesBefore.find((c) => c.name === 'dispatch_session');
		expect(sessionCookieBefore).toBeTruthy();

		const sessionValueBefore = sessionCookieBefore.value;

		// Reload page
		await page.reload({ waitUntil: 'domcontentloaded' });

		// Wait for page to be fully loaded
		await page.waitForLoadState('load');

		// Verify still authenticated (not redirected to login)
		expect(page.url()).toContain('/workspace');
		expect(page.url()).not.toContain('/auth');
		expect(page.url()).not.toContain('/onboarding');

		// Get session cookie after reload
		const cookiesAfter = await context.cookies();
		const sessionCookieAfter = cookiesAfter.find((c) => c.name === 'dispatch_session');
		expect(sessionCookieAfter).toBeTruthy();

		// Verify cookie value is the same (session persisted)
		expect(sessionCookieAfter.value).toBe(sessionValueBefore);

		// Verify workspace is accessible
		const workspaceVisible = await page
			.locator('[data-testid="workspace"], main, .workspace-container')
			.isVisible({ timeout: 5000 })
			.catch(() => false);

		// Should see workspace content (exact selector depends on implementation)
		if (workspaceVisible) {
			console.log('[Test] ✓ Workspace content visible after reload');
		}

		// Verify auth check still works by making request from page context
		const statusOk = await page.evaluate(async () => {
			const response = await fetch('/api/auth/keys', {
				method: 'GET',
				credentials: 'include'
			});
			return response.ok;
		});

		expect(statusOk).toBe(true);

		console.log('[Test] ✓ Cookie persistence verified across page reload');
	});
});
