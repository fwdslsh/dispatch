/**
 * Example Test - Database Reset Helpers
 *
 * This file demonstrates how to use the database reset helpers in E2E tests.
 * Copy these patterns for your own tests.
 */

import { test, expect } from '@playwright/test';
import { resetToFreshInstall, resetToOnboarded, resetDatabase } from './index.js';

// Example 1: Fresh Install Tests (Onboarding Flow)
test.describe('Example: Fresh Install Pattern', () => {
	// Reset database before each test to fresh install state
	test.beforeEach(async () => {
		await resetToFreshInstall();
	});

	test('should show onboarding page on fresh install', async ({ page }) => {
		await page.goto('/');

		// Fresh install should redirect to onboarding
		await page.waitForURL('/onboarding');
		await expect(page).toHaveURL('/onboarding');
	});

	test('should complete onboarding flow', async ({ page }) => {
		await page.goto('/onboarding');

		// Test the onboarding steps...
		// (Fill out forms, create workspace, etc.)
	});
});

// Example 2: Authenticated Tests
test.describe('Example: Authenticated Pattern', () => {
	let apiKey: string;

	// Reset database to onboarded state before each test
	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Auto-login for all tests in this suite
		await page.goto('/login');
		await page.fill('[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL('/workspace');
	});

	test('should access workspace when authenticated', async ({ page }) => {
		// Already logged in from beforeEach
		await expect(page).toHaveURL('/workspace');
	});

	test('should create a new session', async ({ page }) => {
		// Test session creation...
	});
});

// Example 3: Custom Database State
test.describe('Example: Custom State Pattern', () => {
	test('custom state with specific configuration', async ({ page }) => {
		// Reset with custom options
		const result = await resetDatabase({
			onboarded: true,
			seedData: true
		});

		const apiKey = result.apiKey.key;

		// Now you have a known state with API key
		await page.goto('/login');
		await page.fill('[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL('/workspace');

		// Additional custom setup could go here
		// (e.g., create specific sessions, workspaces via API)
	});
});

// Example 4: Isolated Test with Fresh State
test.describe('Example: Isolated Test Pattern', () => {
	test('test A with fresh state', async ({ page }) => {
		await resetToFreshInstall();

		// This test starts with completely fresh database
		await page.goto('/');
		// Test onboarding...
	});

	test('test B with fresh state', async ({ page }) => {
		await resetToFreshInstall();

		// This test ALSO starts with completely fresh database
		// No data from test A will affect this test
		await page.goto('/');
		// Different onboarding test...
	});
});

// Example 5: Testing with Multiple States
test.describe('Example: Multiple States Pattern', () => {
	test('transition from fresh to onboarded', async ({ page }) => {
		// Start with fresh install
		await resetToFreshInstall();
		await page.goto('/');
		await expect(page).toHaveURL('/onboarding');

		// Complete onboarding...
		// (simulate user completing onboarding)

		// Now reset to onboarded state
		const result = await resetToOnboarded();
		await page.goto('/login');
		await page.fill('[name="key"]', result.apiKey.key);
		await page.click('button[type="submit"]');

		// Should now be in authenticated workspace
		await expect(page).toHaveURL('/workspace');
	});
});
