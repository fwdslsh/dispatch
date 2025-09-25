import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment } from './test-helpers.js';

test.describe('Authentication User Interaction Flows', () => {
	test.beforeEach(async ({ page }) => {
		// Setup clean test environment
		await setupFreshTestEnvironment(page, '/');
	});

	test.describe('Login Modal Display', () => {
		test('shows login modal when authentication is required', async ({ page }) => {
			// Navigate to a protected route that should trigger authentication
			await page.goto('/workspace');

			// Should show authentication modal
			await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-modal"] h2')).toContainText('Authentication Required');
		});

		test('login modal adapts to available authentication methods', async ({ page }) => {
			// Mock authentication configuration with multiple methods
			await page.route('/api/auth/config', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						methods: {
							local: { enabled: true },
							webauthn: { enabled: true, available: true },
							oauth: {
								enabled: true,
								providers: ['google', 'github']
							}
						}
					})
				});
			});

			await page.goto('/workspace');

			// Should show all available authentication methods
			await expect(page.locator('[data-testid="auth-local"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-webauthn"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-oauth-google"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-oauth-github"]')).toBeVisible();
		});

		test('hides unavailable authentication methods', async ({ page }) => {
			// Mock configuration with limited methods
			await page.route('/api/auth/config', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						methods: {
							local: { enabled: true },
							webauthn: { enabled: false, available: false },
							oauth: {
								enabled: true,
								providers: ['google']
							}
						}
					})
				});
			});

			await page.goto('/workspace');

			// Should only show available methods
			await expect(page.locator('[data-testid="auth-local"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-webauthn"]')).not.toBeVisible();
			await expect(page.locator('[data-testid="auth-oauth-google"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-oauth-github"]')).not.toBeVisible();
		});
	});

	test.describe('Local Authentication Flow', () => {
		test('successful local authentication', async ({ page }) => {
			// Mock successful authentication
			await page.route('/api/auth/local', async route => {
				const request = route.request();
				const postData = JSON.parse(request.postData());

				if (postData.accessCode === 'valid-code') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							user: { id: 'user-1', email: 'test@example.com' },
							token: 'auth-token-123'
						})
					});
				} else {
					await route.fulfill({
						status: 400,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Invalid access code'
						})
					});
				}
			});

			await page.goto('/workspace');

			// Fill in access code
			await page.locator('[data-testid="access-code-input"]').fill('valid-code');
			await page.locator('[data-testid="auth-local-submit"]').click();

			// Should redirect to workspace after successful authentication
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible();
		});

		test('handles invalid access code', async ({ page }) => {
			// Mock failed authentication
			await page.route('/api/auth/local', async route => {
				await route.fulfill({
					status: 400,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Invalid access code'
					})
				});
			});

			await page.goto('/workspace');

			// Fill in invalid access code
			await page.locator('[data-testid="access-code-input"]').fill('invalid-code');
			await page.locator('[data-testid="auth-local-submit"]').click();

			// Should show error message
			await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-error"]')).toContainText('Invalid access code');

			// Modal should remain visible
			await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();
		});

		test('shows loading state during authentication', async ({ page }) => {
			// Mock slow authentication response
			await page.route('/api/auth/local', async route => {
				await new Promise(resolve => setTimeout(resolve, 1000));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						user: { id: 'user-1' },
						token: 'auth-token-123'
					})
				});
			});

			await page.goto('/workspace');

			await page.locator('[data-testid="access-code-input"]').fill('valid-code');

			// Start authentication
			await page.locator('[data-testid="auth-local-submit"]').click();

			// Should show loading state
			await expect(page.locator('[data-testid="auth-loading"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-local-submit"]')).toBeDisabled();

			// Wait for completion
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();
		});
	});

	test.describe('OAuth Authentication Flow', () => {
		test('redirects to OAuth provider on button click', async ({ page }) => {
			await page.goto('/workspace');

			// Click Google OAuth button
			const googleButton = page.locator('[data-testid="auth-oauth-google"]');
			await expect(googleButton).toBeVisible();

			// Monitor navigation
			const navigationPromise = page.waitForNavigation();
			await googleButton.click();

			await navigationPromise;

			// Should redirect to OAuth URL
			expect(page.url()).toContain('/api/auth/google');
			expect(page.url()).toContain('returnTo=%2Fworkspace');
		});

		test('handles OAuth callback success', async ({ page }) => {
			// Simulate OAuth callback with success
			await page.goto('/auth/callback?provider=google&code=auth-code&state=valid-state');

			// Mock successful OAuth completion
			await page.route('/api/auth/google/callback*', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						user: {
							id: 'oauth-user-1',
							email: 'user@gmail.com',
							name: 'OAuth User'
						},
						token: 'oauth-token-123'
					})
				});
			});

			// Should redirect to original destination
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();
		});

		test('handles OAuth callback errors', async ({ page }) => {
			// Simulate OAuth callback with error
			await page.goto('/auth/callback?provider=google&error=access_denied&state=valid-state');

			// Should show error message
			await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-error"]')).toContainText('OAuth authentication was cancelled');
		});
	});

	test.describe('WebAuthn Authentication Flow', () => {
		test('shows WebAuthn option when available', async ({ page }) => {
			// Mock WebAuthn availability
			await page.addInitScript(() => {
				// Mock WebAuthn API
				window.PublicKeyCredential = {
					isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
				};
				window.navigator.credentials = {
					create: () => Promise.resolve(null),
					get: () => Promise.resolve(null)
				};
			});

			await page.route('/api/auth/config', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						methods: {
							webauthn: { enabled: true, available: true }
						}
					})
				});
			});

			await page.goto('/workspace');

			// Should show WebAuthn authentication option
			await expect(page.locator('[data-testid="auth-webauthn"]')).toBeVisible();
			await expect(page.locator('[data-testid="webauthn-signin-btn"]')).toBeVisible();
		});

		test('hides WebAuthn when not available', async ({ page }) => {
			// Mock WebAuthn unavailability
			await page.addInitScript(() => {
				// Remove WebAuthn API
				delete window.PublicKeyCredential;
			});

			await page.route('/api/auth/config', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						methods: {
							webauthn: { enabled: true, available: false }
						}
					})
				});
			});

			await page.goto('/workspace');

			// Should not show WebAuthn option
			await expect(page.locator('[data-testid="auth-webauthn"]')).not.toBeVisible();
		});

		test('handles WebAuthn authentication success', async ({ page }) => {
			// Mock WebAuthn API responses
			await page.addInitScript(() => {
				window.PublicKeyCredential = {
					isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
				};
				window.navigator.credentials = {
					get: () => Promise.resolve({
						id: 'credential-id',
						rawId: new ArrayBuffer(8),
						type: 'public-key',
						response: {
							clientDataJSON: new ArrayBuffer(8),
							authenticatorData: new ArrayBuffer(8),
							signature: new ArrayBuffer(8),
							userHandle: new ArrayBuffer(8)
						}
					})
				};
			});

			// Mock WebAuthn API endpoints
			await page.route('/api/webauthn/authenticate/begin', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'webauthn-session',
						challenge: {
							challenge: 'Y2hhbGxlbmdl', // base64 "challenge"
							allowCredentials: []
						}
					})
				});
			});

			await page.route('/api/webauthn/authenticate/complete', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						user: {
							id: 'webauthn-user-1',
							email: 'user@example.com'
						},
						token: 'webauthn-token-123'
					})
				});
			});

			await page.goto('/workspace');

			// Click WebAuthn authentication button
			await page.locator('[data-testid="webauthn-signin-btn"]').click();

			// Should complete authentication and show workspace
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();
		});

		test('handles WebAuthn authentication errors', async ({ page }) => {
			// Mock WebAuthn API with error
			await page.addInitScript(() => {
				window.PublicKeyCredential = {
					isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true)
				};
				window.navigator.credentials = {
					get: () => Promise.reject(new Error('User cancelled authentication'))
				};
			});

			await page.route('/api/webauthn/authenticate/begin', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						sessionId: 'webauthn-session',
						challenge: {
							challenge: 'Y2hhbGxlbmdl',
							allowCredentials: []
						}
					})
				});
			});

			await page.goto('/workspace');

			// Click WebAuthn authentication button
			await page.locator('[data-testid="webauthn-signin-btn"]').click();

			// Should show error message
			await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-error"]')).toContainText('User cancelled authentication');
		});
	});

	test.describe('Authentication State Persistence', () => {
		test('maintains authentication across page reloads', async ({ page }) => {
			// Mock successful authentication
			await page.route('/api/auth/local', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						user: { id: 'user-1', email: 'test@example.com' },
						token: 'auth-token-123'
					})
				});
			});

			// Mock authentication verification
			await page.route('/api/auth/verify', async route => {
				const authHeader = route.request().headers()['authorization'];
				if (authHeader === 'Bearer auth-token-123') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							user: { id: 'user-1', email: 'test@example.com' }
						})
					});
				} else {
					await route.fulfill({
						status: 401,
						contentType: 'application/json',
						body: JSON.stringify({ success: false, error: 'Unauthorized' })
					});
				}
			});

			await page.goto('/workspace');

			// Authenticate
			await page.locator('[data-testid="access-code-input"]').fill('valid-code');
			await page.locator('[data-testid="auth-local-submit"]').click();
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();

			// Reload page
			await page.reload();

			// Should remain authenticated
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible();
		});

		test('redirects to login when authentication expires', async ({ page }) => {
			// Mock expired token
			await page.route('/api/auth/verify', async route => {
				await route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Token expired'
					})
				});
			});

			await page.goto('/workspace');

			// Should show authentication modal due to expired token
			await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();
		});
	});

	test.describe('User Experience and Accessibility', () => {
		test('supports keyboard navigation in authentication modal', async ({ page }) => {
			await page.goto('/workspace');

			// Modal should be focused
			await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();

			// Tab through authentication methods
			await page.keyboard.press('Tab');
			await expect(page.locator('[data-testid="access-code-input"]')).toBeFocused();

			await page.keyboard.press('Tab');
			await expect(page.locator('[data-testid="auth-local-submit"]')).toBeFocused();

			// Enter should submit the form
			await page.locator('[data-testid="access-code-input"]').fill('test-code');
			await page.keyboard.press('Enter');

			// Should trigger authentication (form submission)
			await expect(page.locator('[data-testid="auth-loading"]')).toBeVisible();
		});

		test('provides proper ARIA labels for screen readers', async ({ page }) => {
			await page.goto('/workspace');

			// Check modal accessibility
			await expect(page.locator('[data-testid="auth-modal"]')).toHaveAttribute('role', 'dialog');
			await expect(page.locator('[data-testid="auth-modal"]')).toHaveAttribute('aria-labelledby');

			// Check form accessibility
			await expect(page.locator('[data-testid="access-code-input"]')).toHaveAttribute('aria-label');
			await expect(page.locator('[data-testid="auth-local-submit"]')).toHaveAttribute('aria-label');
		});

		test('shows appropriate loading indicators', async ({ page }) => {
			await page.route('/api/auth/local', async route => {
				// Add delay to see loading state
				await new Promise(resolve => setTimeout(resolve, 500));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						user: { id: 'user-1' },
						token: 'auth-token-123'
					})
				});
			});

			await page.goto('/workspace');

			await page.locator('[data-testid="access-code-input"]').fill('valid-code');
			await page.locator('[data-testid="auth-local-submit"]').click();

			// Should show loading spinner
			await expect(page.locator('[data-testid="auth-loading"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-loading"] svg')).toBeVisible();

			// Should disable form during loading
			await expect(page.locator('[data-testid="access-code-input"]')).toBeDisabled();
			await expect(page.locator('[data-testid="auth-local-submit"]')).toBeDisabled();

			// Complete authentication
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();
		});

		test('displays appropriate error messages', async ({ page }) => {
			await page.route('/api/auth/local', async route => {
				await route.fulfill({
					status: 400,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Invalid access code',
						details: 'The provided access code is incorrect or has expired'
					})
				});
			});

			await page.goto('/workspace');

			await page.locator('[data-testid="access-code-input"]').fill('invalid-code');
			await page.locator('[data-testid="auth-local-submit"]').click();

			// Should show detailed error message
			await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
			await expect(page.locator('[data-testid="auth-error"]')).toContainText('The provided access code is incorrect or has expired');

			// Error should have proper ARIA attributes
			await expect(page.locator('[data-testid="auth-error"]')).toHaveAttribute('role', 'alert');
		});
	});

	test.describe('Mobile Authentication Experience', () => {
		test('authentication modal is responsive on mobile', async ({ page }) => {
			// Set mobile viewport
			await page.setViewportSize({ width: 375, height: 667 });

			await page.goto('/workspace');

			// Modal should be visible and properly sized
			await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();

			const modal = page.locator('[data-testid="auth-modal"]');
			const boundingBox = await modal.boundingBox();

			// Should fit within mobile viewport
			expect(boundingBox.width).toBeLessThanOrEqual(375);
			expect(boundingBox.height).toBeLessThanOrEqual(667);

			// Touch targets should be appropriately sized
			const button = page.locator('[data-testid="auth-local-submit"]');
			const buttonBox = await button.boundingBox();
			expect(buttonBox.height).toBeGreaterThanOrEqual(44); // Minimum touch target size
		});

		test('supports touch interactions on mobile', async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });

			await page.route('/api/auth/local', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						user: { id: 'user-1' },
						token: 'auth-token-123'
					})
				});
			});

			await page.goto('/workspace');

			// Fill in access code
			await page.locator('[data-testid="access-code-input"]').fill('valid-code');

			// Use tap instead of click for mobile
			await page.locator('[data-testid="auth-local-submit"]').tap();

			// Should complete authentication
			await expect(page.locator('[data-testid="workspace-container"]')).toBeVisible();
		});
	});
});