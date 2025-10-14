import { test, expect } from '@playwright/test';

test.describe('Login Page Animation Capture', () => {
	test('capture animation stages for visual review', async ({ page }) => {
		// Set viewport to standard desktop size
		await page.setViewportSize({ width: 1920, height: 1080 });

		// Navigate to login page
		await page.goto('http://localhost:7173');

		// Wait for page to be fully loaded
		await page.waitForLoadState('networkidle');

		// Capture initial state (before animations start)
		await page.screenshot({
			path: 'e2e/screenshots/login-00-initial.png',
			fullPage: true
		});

		// Wait 200ms - early in title slide-in
		await page.waitForTimeout(200);
		await page.screenshot({
			path: 'e2e/screenshots/login-01-title-start.png',
			fullPage: true
		});

		// Wait 700ms total - mid title animation
		await page.waitForTimeout(500);
		await page.screenshot({
			path: 'e2e/screenshots/login-02-title-mid.png',
			fullPage: true
		});

		// Wait 1400ms total - title animation complete, card starting
		await page.waitForTimeout(700);
		await page.screenshot({
			path: 'e2e/screenshots/login-03-title-complete.png',
			fullPage: true
		});

		// Wait 2000ms total - card materialized
		await page.waitForTimeout(600);
		await page.screenshot({
			path: 'e2e/screenshots/login-04-card-complete.png',
			fullPage: true
		});

		// Wait 3000ms total - all animations settled
		await page.waitForTimeout(1000);
		await page.screenshot({
			path: 'e2e/screenshots/login-05-settled.png',
			fullPage: true
		});

		// Wait 5000ms total - capture glow animation mid-cycle
		await page.waitForTimeout(2000);
		await page.screenshot({
			path: 'e2e/screenshots/login-06-glow-cycle.png',
			fullPage: true
		});

		// Wait 8000ms total - capture TV static lines at different position
		await page.waitForTimeout(3000);
		await page.screenshot({
			path: 'e2e/screenshots/login-07-static-moved.png',
			fullPage: true
		});

		// Hover over the card to see hover effects
		const card = page.locator('.card');
		await card.hover();
		await page.waitForTimeout(300);
		await page.screenshot({
			path: 'e2e/screenshots/login-08-card-hover.png',
			fullPage: true
		});

		// Verify key elements are visible
		await expect(page.locator('h1')).toContainText('dispatch');
		await expect(page.locator('label[for="api-key"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();

		console.log('\n✨ Screenshots captured in e2e/screenshots/');
		console.log('📸 Review the following files:');
		console.log('  - login-00-initial.png (page load)');
		console.log('  - login-01-title-start.png (title animation begins)');
		console.log('  - login-02-title-mid.png (title mid-animation)');
		console.log('  - login-03-title-complete.png (title fully visible)');
		console.log('  - login-04-card-complete.png (card materialized)');
		console.log('  - login-05-settled.png (all animations complete)');
		console.log('  - login-06-glow-cycle.png (glow animation cycling)');
		console.log('  - login-07-static-moved.png (TV static progressed)');
		console.log('  - login-08-card-hover.png (card hover effect)\n');
	});

	test('capture mobile viewport', async ({ page }) => {
		// Set viewport to mobile size
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('http://localhost:7173');
		await page.waitForLoadState('networkidle');

		// Wait for animations to complete
		await page.waitForTimeout(2500);

		await page.screenshot({
			path: 'e2e/screenshots/login-mobile.png',
			fullPage: true
		});

		console.log('📱 Mobile screenshot captured: login-mobile.png\n');
	});
});
