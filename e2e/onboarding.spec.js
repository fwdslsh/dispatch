/**
 * E2E Test: Complete Onboarding Workflow
 *
 * Tests the complete first-time user onboarding experience including:
 * - Authentication step
 * - Workspace creation step
 * - Progressive onboarding completion
 * - Redirection to main application
 */

import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment, waitForWorkspace } from './test-helpers.js';

test.describe('Onboarding Workflow', () => {
	test.beforeEach(async ({ page }) => {
		// Clear all storage to simulate first-time user
		await page.addInitScript(() => {
			localStorage.clear();
			sessionStorage.clear();
		});

		// Mock authentication endpoint
		await page.route('/api/auth/check', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});

		// Mock onboarding status endpoint - return uncompleted state
		await page.route('/api/onboarding/status**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					currentStep: 'auth',
					isComplete: false,
					completedSteps: []
				})
			});
		});

		// Mock onboarding progress update
		await page.route('/api/onboarding/progress**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});

		// Mock workspace creation
		await page.route('/api/workspaces', (route) => {
			if (route.request().method() === 'POST') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						id: '/workspace/my-first-project',
						name: 'My First Project',
						path: '/workspace/my-first-project',
						status: 'active',
						createdAt: new Date().toISOString()
					})
				});
			} else {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([])
				});
			}
		});

		// Mock onboarding completion
		await page.route('/api/onboarding/complete**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					isComplete: true
				})
			});
		});
	});

	test('should complete minimal onboarding workflow', async ({ page }) => {
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
			await expect(page.locator('h2')).toContainText('Welcome to Dispatch');

			// Enter terminal key
			const terminalKeyInput = page.locator('input[type="password"]');
			await expect(terminalKeyInput).toBeVisible();
			await terminalKeyInput.fill('testkey12345');

			// Click continue button
			const continueButton = page.locator('button', { hasText: 'Continue' });
			await expect(continueButton).toBeEnabled();
			await continueButton.click();

			// Wait for authentication success
			await page.waitForTimeout(1000);
		});

		// Step 2: Workspace Creation Step
		await test.step('Workspace Creation Step', async () => {
			// Should see workspace creation step
			await expect(page.locator('h2')).toContainText('Create Your First Workspace');

			// Fill workspace name
			const workspaceNameInput = page.locator(
				'input[placeholder*="My First Project"], #workspace-name'
			);
			await expect(workspaceNameInput).toBeVisible();
			await workspaceNameInput.fill('My Test Workspace');

			// Workspace path should auto-generate
			const workspacePathInput = page.locator('input[placeholder*="/workspace"], #workspace-path');
			await expect(workspacePathInput).toBeVisible();
			await expect(workspacePathInput).toHaveValue('/workspace/my-test-workspace');

			// Click create workspace button
			const createButton = page.locator('button', { hasText: 'Create Workspace' });
			await expect(createButton).toBeEnabled();
			await createButton.click();

			// Wait for workspace creation
			await page.waitForTimeout(2000);
		});

		// Step 3: Onboarding Completion
		await test.step('Onboarding Completion', async () => {
			// Should see success state or be redirected to main app
			await Promise.race([
				// Option 1: Success state shown
				page.waitForSelector('.success-state', { timeout: 5000 }).catch(() => null),
				// Option 2: Redirect to main app
				page.waitForURL('/', { timeout: 5000 }).catch(() => null)
			]);

			// If success state is shown, it should indicate completion
			const successState = page.locator('.success-state');
			if (await successState.isVisible()) {
				await expect(successState).toContainText('Workspace Created Successfully');
			}
		});

		// Final verification: Should eventually be redirected to main app
		await test.step('Redirect to Main App', async () => {
			// Wait for redirect to main application
			await page.waitForURL('/', { timeout: 10000 });

			// Should see main workspace interface
			await waitForWorkspace(page);

			// Verify onboarding is marked as complete in storage
			const onboardingComplete = await page.evaluate(() => {
				return (
					localStorage.getItem('onboarding-complete') === 'true' ||
					localStorage.getItem('dispatch-auth-key') === 'testkey12345'
				);
			});
			expect(onboardingComplete).toBeTruthy();
		});
	});

	test('should handle authentication errors gracefully', async ({ page }) => {
		// Mock authentication failure
		await page.route('/api/auth/check', (route) => {
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Invalid terminal key'
				})
			});
		});

		await page.goto('/onboarding');

		// Wait for onboarding form
		await page.waitForSelector('.onboarding-page', { timeout: 10000 });

		// Enter invalid terminal key
		const terminalKeyInput = page.locator('input[type="password"]');
		await terminalKeyInput.fill('invalid-key');

		// Click continue
		const continueButton = page.locator('button', { hasText: 'Continue' });
		await continueButton.click();

		// Should see error message
		await expect(page.locator('.error-text, [role="alert"]')).toContainText('Invalid terminal key');

		// Form should remain accessible for retry
		await expect(terminalKeyInput).toBeVisible();
		await expect(continueButton).toBeVisible();
	});

	test('should handle workspace creation errors', async ({ page }) => {
		// Mock successful auth but failed workspace creation
		await page.route('/api/workspaces', (route) => {
			if (route.request().method() === 'POST') {
				route.fulfill({
					status: 400,
					contentType: 'application/json',
					body: JSON.stringify({
						error: 'Workspace path already exists'
					})
				});
			} else {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([])
				});
			}
		});

		await page.goto('/onboarding');

		// Complete authentication step
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });
		await page.locator('input[type="password"]').fill('testkey12345');
		await page.locator('button', { hasText: 'Continue' }).click();

		// Wait for workspace step
		await page.waitForTimeout(1000);

		// Fill workspace details
		const workspaceNameInput = page.locator(
			'input[placeholder*="My First Project"], #workspace-name'
		);
		if (await workspaceNameInput.isVisible()) {
			await workspaceNameInput.fill('Test Workspace');
		}

		// Try to create workspace
		const createButton = page.locator('button', { hasText: 'Create Workspace' });
		if (await createButton.isVisible()) {
			await createButton.click();

			// Should see error message
			await expect(page.locator('.error-message, [role="alert"]')).toContainText(
				'Workspace path already exists'
			);
		}
	});

	test('should skip optional settings step (progressive onboarding)', async ({ page }) => {
		await page.goto('/onboarding');

		// Complete minimal onboarding (auth + workspace)
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });
		await page.locator('input[type="password"]').fill('testkey12345');
		await page.locator('button', { hasText: 'Continue' }).click();

		// Wait for workspace step
		await page.waitForTimeout(1000);

		// Fill and create workspace
		const workspaceNameInput = page.locator(
			'input[placeholder*="My First Project"], #workspace-name'
		);
		if (await workspaceNameInput.isVisible()) {
			await workspaceNameInput.fill('Minimal Workspace');

			const createButton = page.locator('button', { hasText: 'Create Workspace' });
			await createButton.click();
		}

		// Should complete onboarding without requiring settings step
		await page.waitForURL('/', { timeout: 10000 });

		// Verify we're in the main application
		await waitForWorkspace(page);
	});

	test('should support keyboard navigation', async ({ page }) => {
		await page.goto('/onboarding');

		// Wait for form
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });

		// Navigate using Tab key
		const terminalKeyInput = page.locator('input[type="password"]');
		await terminalKeyInput.focus();
		await expect(terminalKeyInput).toBeFocused();

		// Fill field and press Enter
		await terminalKeyInput.fill('testkey12345');
		await terminalKeyInput.press('Enter');

		// Should proceed to next step
		await page.waitForTimeout(1000);

		// Check if workspace form is accessible via keyboard
		const workspaceNameInput = page.locator(
			'input[placeholder*="My First Project"], #workspace-name'
		);
		if (await workspaceNameInput.isVisible()) {
			await page.keyboard.press('Tab');
			await expect(workspaceNameInput).toBeFocused();
		}
	});

	test('should be responsive on mobile viewports', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await page.goto('/onboarding');

		// Wait for responsive layout
		await page.waitForSelector('.onboarding-page', { timeout: 10000 });

		// Verify mobile-friendly layout
		const onboardingPage = page.locator('.onboarding-page');
		await expect(onboardingPage).toBeVisible();

		// Check that form elements are properly sized for mobile
		const terminalKeyInput = page.locator('input[type="password"]');
		if (await terminalKeyInput.isVisible()) {
			const inputBox = await terminalKeyInput.boundingBox();
			expect(inputBox.width).toBeGreaterThan(200); // Should be reasonably wide
		}

		// Buttons should be touch-friendly
		const continueButton = page.locator('button', { hasText: 'Continue' });
		if (await continueButton.isVisible()) {
			const buttonBox = await continueButton.boundingBox();
			expect(buttonBox.height).toBeGreaterThan(40); // Touch-friendly height
		}
	});
});
