/**
 * E2E Test: Complete Onboarding Workflow
 *
 * Tests the complete first-time user onboarding experience including:
 * - Authentication step
 * - Workspace creation step
 * - Settings step
 * - Single atomic POST submission at the end
 */

import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment, waitForWorkspaceReady, TEST_KEY } from './core-helpers.js';

test.describe('Onboarding Workflow', () => {
	test.beforeEach(async ({ page }) => {
		// Clear all storage to simulate first-time user
		await page.addInitScript(() => {
			localStorage.clear();
			sessionStorage.clear();
		});

		// Mock status endpoint - return uncompleted state
		await page.route('/api/status', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					onboarding: {
						isComplete: false,
						completedAt: null,
						firstWorkspaceId: null
					},
					authentication: { configured: false },
					server: { version: '1.0.0', uptime: 0 }
				})
			});
		});

		// Mock onboarding submission endpoint (POST only)
		await page.route('/api/settings/onboarding', (route) => {
			if (route.request().method() === 'POST') {
				route.fulfill({
					status: 201,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						onboarding: {
							isComplete: true,
							completedAt: new Date().toISOString(),
							firstWorkspaceId: '/workspace/my-test-workspace'
						},
						workspace: {
							id: '/workspace/my-test-workspace',
							name: 'My Test Workspace',
							path: '/workspace/my-test-workspace'
						}
					})
				});
			} else {
				// Should not support GET or PUT anymore
				route.fulfill({
					status: 405,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Method not allowed' })
				});
			}
		});
	});

	test('should complete minimal onboarding workflow with single POST', async ({ page }) => {
		// Track API calls to verify single submission
		const apiCalls = [];
		await page.route('/api/settings/onboarding', (route) => {
			apiCalls.push({
				method: route.request().method(),
				body: route.request().postData()
			});
			route.continue();
		});

		// Navigate to application root
		await page.goto('/');

		// Should be redirected to onboarding page
		await expect(page).toHaveURL(/\/onboarding/);

		// Should see onboarding page loading
		await page.waitForSelector('.onboarding-page', { timeout: 10000 });

		// Wait for OnboardingFlow component to load
		await page.waitForSelector('[data-testid="onboarding-flow"], .onboarding-flow', {
			timeout: 10000
		});

		// Step 1: Authentication Step
		await test.step('Authentication Step', async () => {
			// Should see authentication step
			await expect(page.locator('h2')).toContainText('Authentication Setup');

			// Enter terminal key
			const terminalKeyInput = page.locator('input[type="password"]').first();
			await expect(terminalKeyInput).toBeVisible();
			await terminalKeyInput.fill(TEST_KEY);

			// Enter confirmation
			const confirmKeyInput = page.locator('input[type="password"]').nth(1);
			await confirmKeyInput.fill(TEST_KEY);

			// Click continue button (should NOT submit to API yet)
			const continueButton = page.locator('button', { hasText: 'Continue to Workspace Setup' });
			await expect(continueButton).toBeEnabled();
			await continueButton.click();

			// Verify NO API call was made yet
			expect(apiCalls.length).toBe(0);

			// Wait for navigation to workspace step
			await page.waitForTimeout(500);
		});

		// Step 2: Workspace Creation Step
		await test.step('Workspace Creation Step', async () => {
			// Should see workspace creation step
			await expect(page.locator('h2')).toContainText('Workspace Setup');

			// Fill workspace name
			const workspaceNameInput = page.locator('input[placeholder*="Workspace name"]');
			await expect(workspaceNameInput).toBeVisible();
			await workspaceNameInput.fill('My Test Workspace');

			// Workspace path should auto-generate
			const workspacePathInput = page.locator('input[placeholder*="Workspace path"]');
			await expect(workspacePathInput).toBeVisible();
			await expect(workspacePathInput).toHaveValue('/workspace/my-test-workspace');

			// Click continue button (should NOT submit to API yet)
			const continueButton = page.locator('button', { hasText: 'Continue' });
			await expect(continueButton).toBeEnabled();
			await continueButton.click();

			// Verify STILL no API call was made
			expect(apiCalls.length).toBe(0);

			// Wait for navigation to settings step
			await page.waitForTimeout(500);
		});

		// Step 3: Settings Step and Final Submission
		await test.step('Settings Step and Submission', async () => {
			// Should see settings step
			await expect(page.locator('h2')).toContainText('Basic Settings');

			// Click complete setup button - THIS should trigger the single POST
			const completeButton = page.locator('button', { hasText: 'Complete Setup' });
			await expect(completeButton).toBeEnabled();
			await completeButton.click();

			// Wait for API call
			await page.waitForTimeout(1000);

			// Verify EXACTLY ONE POST call was made
			expect(apiCalls.length).toBe(1);
			expect(apiCalls[0].method).toBe('POST');

			// Verify the POST body contains all collected data
			const postBody = JSON.parse(apiCalls[0].body);
			expect(postBody.terminalKey).toBe(TEST_KEY);
			expect(postBody.workspaceName).toBe('My Test Workspace');
			expect(postBody.workspacePath).toBe('/workspace/my-test-workspace');
		});

		// Step 4: Completion
		await test.step('Onboarding Completion', async () => {
			// Should see completion state
			await expect(page.locator('h2')).toContainText('Welcome to Dispatch');

			// Should eventually be redirected to main app
			await page.waitForURL('/', { timeout: 10000 });

			// Verify localStorage was updated
			const authKey = await page.evaluate(() => localStorage.getItem('dispatch-auth-token'));
			expect(authKey).toBe(TEST_KEY);

			const onboardingComplete = await page.evaluate(() =>
				localStorage.getItem('onboarding-complete')
			);
			expect(onboardingComplete).toBe('true');
		});
	});

	test('should skip workspace creation and only submit auth', async ({ page }) => {
		const apiCalls = [];
		await page.route('/api/settings/onboarding', (route) => {
			apiCalls.push({
				method: route.request().method(),
				body: route.request().postData()
			});
			route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					onboarding: {
						isComplete: true,
						completedAt: new Date().toISOString(),
						firstWorkspaceId: null
					},
					workspace: null
				})
			});
		});

		await page.goto('/onboarding');

		// Complete auth step
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });
		await page.locator('input[type="password"]').first().fill(TEST_KEY);
		await page.locator('input[type="password"]').nth(1).fill(TEST_KEY);
		await page.locator('button', { hasText: 'Continue to Workspace Setup' }).click();

		// Skip workspace step
		await page.waitForTimeout(500);
		await page.locator('button', { hasText: 'Skip Workspace' }).click();

		// Complete settings step
		await page.waitForTimeout(500);
		await page.locator('button', { hasText: 'Complete Setup' }).click();

		// Wait for API call
		await page.waitForTimeout(1000);

		// Verify POST was made with only terminalKey (no workspace data)
		expect(apiCalls.length).toBe(1);
		const postBody = JSON.parse(apiCalls[0].body);
		expect(postBody.terminalKey).toBe(TEST_KEY);
		expect(postBody.workspaceName).toBeUndefined();
		expect(postBody.workspacePath).toBeUndefined();
	});

	test('should handle submission errors gracefully', async ({ page }) => {
		// Mock error response
		await page.route('/api/settings/onboarding', (route) => {
			if (route.request().method() === 'POST') {
				route.fulfill({
					status: 409,
					contentType: 'application/json',
					body: JSON.stringify({
						error: 'Onboarding has already been completed'
					})
				});
			}
		});

		await page.goto('/onboarding');

		// Complete all steps
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });
		await page.locator('input[type="password"]').first().fill(TEST_KEY);
		await page.locator('input[type="password"]').nth(1).fill(TEST_KEY);
		await page.locator('button', { hasText: 'Continue to Workspace Setup' }).click();

		await page.waitForTimeout(500);
		await page.locator('button', { hasText: 'Skip Workspace' }).click();

		await page.waitForTimeout(500);
		await page.locator('button', { hasText: 'Complete Setup' }).click();

		// Should see error message
		await expect(page.locator('.alert-error, [role="alert"]')).toContainText(
			'Onboarding has already been completed'
		);

		// Should remain on onboarding page
		await expect(page).toHaveURL(/\/onboarding/);
	});

	test('should validate terminal key before proceeding', async ({ page }) => {
		await page.goto('/onboarding');

		await page.waitForSelector('input[type="password"]', { timeout: 10000 });

		// Try to proceed with short password
		const terminalKeyInput = page.locator('input[type="password"]').first();
		await terminalKeyInput.fill('short');

		const continueButton = page.locator('button', { hasText: 'Continue to Workspace Setup' });
		await expect(continueButton).toBeDisabled();

		// Try with mismatched confirmation
		await terminalKeyInput.fill('longenoughkey');
		await page.locator('input[type="password"]').nth(1).fill('differentkey');
		await expect(continueButton).toBeDisabled();

		// Try with matching keys
		await page.locator('input[type="password"]').nth(1).fill('longenoughkey');
		await expect(continueButton).toBeEnabled();
	});

	test('should support keyboard navigation', async ({ page }) => {
		await page.goto('/onboarding');

		// Wait for form
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });

		// Navigate using Tab and Enter
		const terminalKeyInput = page.locator('input[type="password"]').first();
		await terminalKeyInput.focus();
		await terminalKeyInput.fill(TEST_KEY);

		await page.keyboard.press('Tab');
		const confirmKeyInput = page.locator('input[type="password"]').nth(1);
		await confirmKeyInput.fill(TEST_KEY);

		// Press Enter to proceed
		await confirmKeyInput.press('Enter');

		// Should navigate to workspace step
		await page.waitForTimeout(500);
		await expect(page.locator('h2')).toContainText('Workspace Setup');
	});

	test('should be responsive on mobile viewports', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await page.goto('/onboarding');

		// Wait for responsive layout
		await page.waitForSelector('.onboarding-page', { timeout: 10000 });

		// Check that form elements are properly sized for mobile
		const terminalKeyInput = page.locator('input[type="password"]').first();
		if (await terminalKeyInput.isVisible()) {
			const inputBox = await terminalKeyInput.boundingBox();
			expect(inputBox.width).toBeGreaterThan(200); // Should be reasonably wide
		}

		// Buttons should be touch-friendly
		const continueButton = page.locator('button', { hasText: 'Continue to Workspace Setup' });
		if (await continueButton.isVisible()) {
			const buttonBox = await continueButton.boundingBox();
			expect(buttonBox.height).toBeGreaterThan(40); // Touch-friendly height
		}
	});
});
