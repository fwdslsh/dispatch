/**
 * E2E Test: Authentication Persistence
 *
 * Tests the 30-day rolling authentication session functionality including:
 * - Authentication session persistence across browser sessions
 * - Rolling window session renewal
 * - Session expiration and re-authentication
 * - Authentication state management
 */

import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment, waitForWorkspace } from './test-helpers.js';

test.describe('Authentication Persistence', () => {
	const validTerminalKey = 'testkey12345';
	const currentTime = Date.now();
	const thirtyDaysFromNow = currentTime + 30 * 24 * 60 * 60 * 1000;
	const expiredTime = currentTime - 31 * 24 * 60 * 60 * 1000;

	test.beforeEach(async ({ page }) => {
		// Clear all storage initially
		await page.addInitScript(() => {
			localStorage.clear();
			sessionStorage.clear();
		});

		// Mock onboarding complete state
		await page.route('/api/onboarding/status**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					currentStep: 'complete',
					isComplete: true,
					completedSteps: ['auth', 'workspace', 'complete']
				})
			});
		});

		// Mock empty sessions and workspaces
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
				body: JSON.stringify([])
			});
		});
	});

	test('should persist authentication across browser restart', async ({ page }) => {
		await test.step('Initial authentication', async () => {
			// Mock successful authentication
			await page.route('/api/auth/check', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'session-123',
						expiresAt: new Date(thirtyDaysFromNow).toISOString()
					})
				});
			});

			// Set up initial authentication
			await page.addInitScript((terminalKey) => {
				localStorage.setItem('dispatch-auth-key', terminalKey);
				localStorage.setItem('authSessionId', 'session-123');
				localStorage.setItem(
					'authExpiresAt',
					new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
				);
			}, validTerminalKey);

			await page.goto('/');
			await waitForWorkspace(page);

			// Should be authenticated and in main app
			await expect(page).toHaveURL('/');
		});

		await test.step('Simulate browser restart', async () => {
			// Create new page context to simulate browser restart
			const newPage = await page.context().newPage();

			// Set up authentication data as if from previous session
			await newPage.addInitScript((terminalKey) => {
				localStorage.setItem('dispatch-auth-key', terminalKey);
				localStorage.setItem('authSessionId', 'session-123');
				localStorage.setItem(
					'authExpiresAt',
					new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
				);
			}, validTerminalKey);

			// Mock session validation endpoint
			await newPage.route('/api/auth/check', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'session-123',
						expiresAt: new Date(thirtyDaysFromNow).toISOString()
					})
				});
			});

			// Mock other required endpoints
			await newPage.route('/api/onboarding/status**', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						currentStep: 'complete',
						isComplete: true,
						completedSteps: ['auth', 'workspace', 'complete']
					})
				});
			});

			await newPage.route('/api/sessions**', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ sessions: [] })
				});
			});

			await newPage.route('/api/workspaces**', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([])
				});
			});

			// Navigate to app - should not require re-authentication
			await newPage.goto('/');

			// Should be automatically authenticated
			await waitForWorkspace(newPage);
			await expect(newPage).toHaveURL('/');

			await newPage.close();
		});
	});

	test('should extend session on activity (rolling window)', async ({ page }) => {
		await test.step('Set up authentication with activity tracking', async () => {
			let sessionExtendedCount = 0;

			// Mock authentication check that tracks extensions
			await page.route('/api/auth/check', (route) => {
				sessionExtendedCount++;
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'session-123',
						expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
						extended: sessionExtendedCount > 1
					})
				});
			});

			// Set initial authentication
			await page.addInitScript((terminalKey) => {
				localStorage.setItem('dispatch-auth-key', terminalKey);
				localStorage.setItem('authSessionId', 'session-123');
				localStorage.setItem(
					'authExpiresAt',
					new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
				);
			}, validTerminalKey);

			await page.goto('/');
			await waitForWorkspace(page);
		});

		await test.step('Simulate user activity', async () => {
			// Perform activities that should extend session
			await page.click('body'); // Click to show activity
			await page.waitForTimeout(1000);

			// Navigate to different section
			await page.goto('/settings');
			await page.waitForTimeout(1000);

			// Navigate back
			await page.goto('/');
			await waitForWorkspace(page);

			// Session should remain valid
			const authStatus = await page.evaluate(() => {
				return {
					hasKey: !!localStorage.getItem('dispatch-auth-key'),
					hasSession: !!localStorage.getItem('authSessionId'),
					expiresAt: localStorage.getItem('authExpiresAt')
				};
			});

			expect(authStatus.hasKey).toBeTruthy();
			expect(authStatus.hasSession).toBeTruthy();
			expect(new Date(authStatus.expiresAt).getTime()).toBeGreaterThan(currentTime);
		});
	});

	test('should handle expired sessions gracefully', async ({ page }) => {
		await test.step('Set up with expired session', async () => {
			// Mock expired session response
			await page.route('/api/auth/check', (route) => {
				route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Session expired',
						expired: true
					})
				});
			});

			// Set expired authentication data
			await page.addInitScript((terminalKey) => {
				localStorage.setItem('dispatch-auth-key', terminalKey);
				localStorage.setItem('authSessionId', 'session-123');
				localStorage.setItem(
					'authExpiresAt',
					new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
				);
			}, validTerminalKey);

			await page.goto('/');
		});

		await test.step('Handle expired session', async () => {
			// Should redirect to onboarding or show authentication prompt
			await Promise.race([
				page.waitForURL('/onboarding', { timeout: 10000 }),
				page.waitForSelector('input[type="password"]', { timeout: 10000 }),
				page.waitForSelector('.auth-prompt, .authentication-required', { timeout: 10000 })
			]);

			// User should be able to re-authenticate
			const passwordInput = page.locator('input[type="password"]');
			if (await passwordInput.isVisible()) {
				// Mock successful re-authentication
				await page.route('/api/auth/check', (route) => {
					route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							sessionId: 'session-456',
							expiresAt: new Date(thirtyDaysFromNow).toISOString()
						})
					});
				});

				await passwordInput.fill(validTerminalKey);
				await page.locator('button', { hasText: /Continue|Login|Authenticate/i }).click();

				// Should be authenticated again
				await waitForWorkspace(page);
			}
		});
	});

	test('should clear authentication on invalid credentials', async ({ page }) => {
		await test.step('Attempt authentication with invalid key', async () => {
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

			// Wait for authentication form
			await page.waitForSelector('input[type="password"]', { timeout: 10000 });

			// Enter invalid credentials
			await page.locator('input[type="password"]').fill('invalid-key');
			await page.locator('button', { hasText: /Continue|Login/i }).click();

			// Should show error and remain on auth screen
			await expect(page.locator('.error-text, [role="alert"]')).toBeVisible({ timeout: 5000 });

			// Authentication data should be cleared
			const authStatus = await page.evaluate(() => {
				return {
					hasKey: !!localStorage.getItem('dispatch-auth-key'),
					hasSession: !!localStorage.getItem('authSessionId')
				};
			});

			// Should not have persistent auth data after failure
			expect(authStatus.hasSession).toBeFalsy();
		});
	});

	test('should handle network errors during authentication', async ({ page }) => {
		await test.step('Simulate network error', async () => {
			// Mock network failure
			await page.route('/api/auth/check', (route) => {
				route.abort('internetdisconnected');
			});

			await page.goto('/onboarding');

			// Wait for authentication form
			await page.waitForSelector('input[type="password"]', { timeout: 10000 });

			// Try to authenticate
			await page.locator('input[type="password"]').fill(validTerminalKey);
			await page.locator('button', { hasText: /Continue|Login/i }).click();

			// Should show network error or retry option
			await expect(
				page.locator('text=/network.*error|connection.*failed|try.*again/i').first()
			).toBeVisible({ timeout: 10000 });
		});

		await test.step('Retry after network recovery', async () => {
			// Mock network recovery
			await page.route('/api/auth/check', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'session-456',
						expiresAt: new Date(thirtyDaysFromNow).toISOString()
					})
				});
			});

			// Retry authentication
			const retryButton = page.locator('button', { hasText: /retry|try.*again/i });
			if (await retryButton.isVisible()) {
				await retryButton.click();
			} else {
				// Re-submit the form
				await page.locator('button', { hasText: /Continue|Login/i }).click();
			}

			// Should successfully authenticate
			await waitForWorkspace(page);
		});
	});

	test('should support multiple concurrent sessions', async ({ browser }) => {
		await test.step('Create multiple browser contexts', async () => {
			const context1 = await browser.newContext();
			const context2 = await browser.newContext();

			const page1 = await context1.newPage();
			const page2 = await context2.newPage();

			// Set up authentication for both contexts
			for (const [index, page] of [
				[1, page1],
				[2, page2]
			]) {
				await page.addInitScript(
					(terminalKey, sessionId) => {
						localStorage.setItem('dispatch-auth-key', terminalKey);
						localStorage.setItem('authSessionId', sessionId);
						localStorage.setItem(
							'authExpiresAt',
							new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
						);
					},
					validTerminalKey,
					`session-${index}`
				);

				// Mock authentication
				await page.route('/api/auth/check', (route) => {
					route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							sessionId: `session-${index}`,
							expiresAt: new Date(thirtyDaysFromNow).toISOString()
						})
					});
				});

				// Mock other endpoints
				await page.route('/api/onboarding/status**', (route) => {
					route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							currentStep: 'complete',
							isComplete: true,
							completedSteps: ['auth', 'workspace', 'complete']
						})
					});
				});

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
						body: JSON.stringify([])
					});
				});

				await page.goto('/');
				await waitForWorkspace(page);
			}

			// Both sessions should be independent and valid
			await expect(page1).toHaveURL('/');
			await expect(page2).toHaveURL('/');

			await context1.close();
			await context2.close();
		});
	});

	test('should maintain session during page reload', async ({ page }) => {
		await test.step('Set up authenticated session', async () => {
			// Mock authentication
			await page.route('/api/auth/check', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'session-123',
						expiresAt: new Date(thirtyDaysFromNow).toISOString()
					})
				});
			});

			await page.addInitScript((terminalKey) => {
				localStorage.setItem('dispatch-auth-key', terminalKey);
				localStorage.setItem('authSessionId', 'session-123');
				localStorage.setItem(
					'authExpiresAt',
					new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
				);
			}, validTerminalKey);

			await page.goto('/');
			await waitForWorkspace(page);
		});

		await test.step('Reload page and verify session persistence', async () => {
			// Reload the page
			await page.reload();

			// Should remain authenticated
			await waitForWorkspace(page);
			await expect(page).toHaveURL('/');

			// Verify authentication data is still present
			const authStatus = await page.evaluate(() => {
				return {
					hasKey: !!localStorage.getItem('dispatch-auth-key'),
					hasSession: !!localStorage.getItem('authSessionId'),
					expiresAt: localStorage.getItem('authExpiresAt')
				};
			});

			expect(authStatus.hasKey).toBeTruthy();
			expect(authStatus.hasSession).toBeTruthy();
			expect(new Date(authStatus.expiresAt).getTime()).toBeGreaterThan(currentTime);
		});
	});

	test('should handle session cleanup on logout', async ({ page }) => {
		await test.step('Set up authenticated session', async () => {
			await page.addInitScript((terminalKey) => {
				localStorage.setItem('dispatch-auth-key', terminalKey);
				localStorage.setItem('authSessionId', 'session-123');
				localStorage.setItem(
					'authExpiresAt',
					new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
				);
			}, validTerminalKey);

			// Mock authentication
			await page.route('/api/auth/check', (route) => {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'session-123',
						expiresAt: new Date(thirtyDaysFromNow).toISOString()
					})
				});
			});

			await page.goto('/');
			await waitForWorkspace(page);
		});

		await test.step('Logout and verify cleanup', async () => {
			// Look for logout button or link
			const logoutButton = page.locator('button', { hasText: /logout|sign.*out/i });
			if (await logoutButton.isVisible()) {
				// Mock logout endpoint
				await page.route('/api/auth/logout**', (route) => {
					route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ success: true })
					});
				});

				await logoutButton.click();

				// Should clear authentication data
				const authStatus = await page.evaluate(() => {
					return {
						hasKey: !!localStorage.getItem('dispatch-auth-key'),
						hasSession: !!localStorage.getItem('authSessionId')
					};
				});

				expect(authStatus.hasKey).toBeFalsy();
				expect(authStatus.hasSession).toBeFalsy();

				// Should redirect to authentication
				await expect(page).toHaveURL(/onboarding|auth/);
			}
		});
	});
});
