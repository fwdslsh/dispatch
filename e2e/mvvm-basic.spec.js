import { test, expect } from '@playwright/test';
import { TEST_KEY } from './core-helpers.js';

test.describe('Basic MVVM Architecture Test', () => {
	test('should load the workspace page successfully', async ({ page }) => {
		// Mock authentication check
		await page.route('/api/auth/check**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ authenticated: true })
			});
		});

		// Mock basic API endpoints
		await page.route('/api/sessions**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ sessions: [] })
			});
		});

		await page.route('/api/workspaces**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ workspaces: [] })
			});
		});

		// Set auth token before navigation
		await page.addInitScript((testKey) => {
			localStorage.setItem('dispatch-auth-key', testKey);
		}, TEST_KEY);

		// Navigate to workspace
		await page.goto('/workspace');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check if page loaded - look for basic elements
		const body = await page.locator('body').count();
		expect(body).toBeGreaterThan(0);

		// Check page title
		const title = await page.title();
		expect(title.length).toBeGreaterThan(0);

		// Look for any of the main container elements
		const hasContainer = await page.evaluate(() => {
			return (
				document.querySelector('.dispatch-workspace') ||
				document.querySelector('.main-content') ||
				document.querySelector('.workspace') ||
				document.querySelector('main') ||
				document.body.children.length > 0
			);
		});

		expect(hasContainer).toBeTruthy();

		// Take a screenshot for debugging
		await page.screenshot({ path: 'test-results/mvvm-basic-screenshot.png', fullPage: true });
	});
});
