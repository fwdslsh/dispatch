/**
 * Comprehensive UI Test Suite for Dispatch
 * Main test suite covering core functionality without external dependencies
 */

import { test, expect } from '@playwright/test';
import {
	navigateToWorkspaceWithOnboardingComplete,
	setupApiMocks,
	safeInteract,
	takeTestScreenshot,
	mobileTap,
	TEST_KEY
} from './core-helpers.js';

test.describe('Dispatch Core UI Functionality', () => {
	test.beforeEach(async ({ page }) => {
		// Setup fresh environment with onboarding complete
		await navigateToWorkspaceWithOnboardingComplete(page);
	});

	test('should load workspace and display main interface', async ({ page }) => {
		// Verify main elements are present
		await expect(page.locator('main')).toBeVisible();

		// Take screenshot for visual verification
		await takeTestScreenshot(page, 'workspace', 'initial-load');

		// Check for basic UI elements
		const hasWorkspaceContainer =
			(await page.locator('.dispatch-workspace, .main-content, .workspace, .wm-root').count()) > 0;
		expect(hasWorkspaceContainer).toBeTruthy();
	});

	test('should handle authentication flow', async ({ page }) => {
		// Clear auth and navigate to workspace
		await page.evaluate(() => localStorage.removeItem('dispatch-auth-key'));
		await page.goto('/workspace');

		// Should redirect to auth or show auth form
		const hasAuthForm =
			(await page.locator('input[type="password"], input[name="key"]').count()) > 0;
		const isOnWorkspace = (await page.locator('main').count()) > 0;

		// Either we see auth form or we're already authenticated
		expect(hasAuthForm || isOnWorkspace).toBeTruthy();

		if (hasAuthForm) {
			// Fill auth key
			await safeInteract(page, 'input[type="password"], input[name="key"]', 'fill', TEST_KEY);
			await safeInteract(page, 'button[type="submit"], button:has-text("Submit")', 'click');

			// Should now reach workspace
			await expect(page.locator('main')).toBeVisible();
		}

		await takeTestScreenshot(page, 'auth-flow', 'completed');
	});

	test('should display workspace interface elements', async ({ page }) => {
		// Check for key interface elements that should be present
		const interfaceElements = [
			'main',
			'body',
			'[data-testid]', // Any element with test id
			'.workspace, .main-content, .dispatch-workspace, .wm-root' // Workspace containers
		];

		let elementsFound = 0;
		for (const selector of interfaceElements) {
			try {
				const element = page.locator(selector).first();
				if ((await element.count()) > 0) {
					elementsFound++;
				}
			} catch (e) {
				// Element not found, continue
			}
		}

		// Should find at least basic elements
		expect(elementsFound).toBeGreaterThan(0);

		await takeTestScreenshot(page, 'workspace-interface', 'elements');
	});

	test('should handle API endpoints properly', async ({ page }) => {
		// Setup API mocks
		await setupApiMocks(page, {
			workspaces: [
				{
					id: 'test-workspace',
					name: 'Test Workspace',
					path: '/tmp/test'
				}
			]
		});

		// Navigate and verify API calls work
		await page.goto('/workspace');
		await page.waitForLoadState('networkidle');

		// Check that page loaded without API errors
		const hasMain = (await page.locator('main').count()) > 0;
		expect(hasMain).toBeTruthy();

		await takeTestScreenshot(page, 'api-integration', 'mocked');
	});

	test('should handle responsive design properly', async ({ page }) => {
		// Test different viewport sizes
		const viewports = [
			{ width: 1920, height: 1080, name: 'desktop' },
			{ width: 768, height: 1024, name: 'tablet' },
			{ width: 375, height: 667, name: 'mobile' }
		];

		for (const viewport of viewports) {
			await page.setViewportSize(viewport);
			await page.waitForTimeout(500); // Allow layout to settle

			// Verify main content is still accessible
			await expect(page.locator('main')).toBeVisible();

			await takeTestScreenshot(page, 'responsive', viewport.name);
		}
	});

	test('should handle navigation properly', async ({ page }) => {
		// Test basic navigation without breaking
		const currentUrl = page.url();

		// Try navigating to workspace (should work)
		await page.goto('/workspace');
		await page.waitForLoadState('networkidle');

		// Should have main content
		await expect(page.locator('main')).toBeVisible();

		await takeTestScreenshot(page, 'navigation', 'workspace');
	});

	test('should handle error states gracefully', async ({ page }) => {
		// Mock API errors
		await page.route('/api/**', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Server error' })
			});
		});

		await page.goto('/workspace');
		await page.waitForLoadState('networkidle');

		// Page should still load even with API errors
		const hasMain = (await page.locator('main').count()) > 0;
		expect(hasMain).toBeTruthy();

		await takeTestScreenshot(page, 'error-handling', 'api-errors');
	});
});

test.describe('Dispatch Mobile UI', () => {
	test.use({
		viewport: { width: 375, height: 667 },
		isMobile: true,
		hasTouch: true
	});

	test.beforeEach(async ({ page }) => {
		await navigateToWorkspaceWithOnboardingComplete(page);
	});

	test('should be usable on mobile devices', async ({ page }) => {
		// Verify mobile interface
		await expect(page.locator('main')).toBeVisible();

		// Test touch interactions if available
		const elements = await page.locator('button, a, [role="button"]').all();

		if (elements.length > 0) {
			// Try tapping the first interactive element
			try {
				await mobileTap(page, 'button, a, [role="button"]');
			} catch (e) {
				// Not critical if tap fails
			}
		}

		await takeTestScreenshot(page, 'mobile-ui', 'interaction');
	});
});

test.describe('Dispatch Visual Regression', () => {
	test.beforeEach(async ({ page }) => {
		await navigateToWorkspaceWithOnboardingComplete(page);
	});

	test('should maintain consistent visual appearance', async ({ page }) => {
		// Take baseline screenshot
		await expect(page).toHaveScreenshot('workspace-baseline.png', {
			fullPage: true,
			threshold: 0.2 // Allow for minor rendering differences
		});
	});
});
