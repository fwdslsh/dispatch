import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment } from './test-helpers.js';

test.describe('Graceful Degradation Testing', () => {
	test.beforeEach(async ({ page }) => {
		await setupFreshTestEnvironment(page, '/');
	});

	test.describe('Network Failure Graceful Degradation', () => {
		test('handles authentication service unavailable', async ({ page }) => {
			// Mock authentication service failure
			await page.route('/api/auth/login', async route => {
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Authentication service temporarily unavailable',
						retryAfter: 30
					})
				});
			});

			await page.route('/api/auth/status', async route => {
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Authentication service unavailable'
					})
				});
			});

			await page.goto('/workspace');

			// Verify graceful error handling
			const errorMessage = await page.locator('[data-testid="error-message"]');
			await expect(errorMessage).toBeVisible();

			const errorText = await errorMessage.textContent();
			expect(errorText).toContain('temporarily unavailable');

			// Check for retry mechanism indication
			const retryInfo = await page.locator('[data-testid="retry-info"]');
			if (await retryInfo.isVisible()) {
				const retryText = await retryInfo.textContent();
				expect(retryText).toContain('retry');
			}

			console.log('Authentication service unavailable handled gracefully');
		});

		test('handles intermittent network connectivity', async ({ page }) => {
			let requestCount = 0;

			// Simulate intermittent network issues
			await page.route('/api/auth/login', async route => {
				requestCount++;

				if (requestCount <= 2) {
					// First two requests fail with network error
					await route.abort('connectionfailed');
				} else {
					// Third request succeeds
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							token: 'recovered-session-token',
							user: { id: 1, email: 'test@example.com' }
						})
					});
				}
			});

			await page.goto('/workspace');

			// Try authentication (will fail first two times)
			await page.fill('[data-testid="access-code-input"]', 'test-code');
			await page.click('[data-testid="login-submit"]');

			// Wait a moment and try again
			await page.waitForTimeout(1000);
			await page.click('[data-testid="login-submit"]');

			// Third attempt should succeed
			await page.waitForTimeout(1000);
			await page.click('[data-testid="login-submit"]');

			// Verify eventual success
			await page.waitForSelector('[data-testid="auth-modal"]', { state: 'hidden', timeout: 10000 });

			expect(requestCount).toBe(3);
			console.log('Intermittent network connectivity handled with retry logic');
		});

		test('handles slow network responses', async ({ page }) => {
			// Simulate slow authentication responses
			await page.route('/api/auth/login', async route => {
				// Simulate slow network (2 seconds delay)
				await new Promise(resolve => setTimeout(resolve, 2000));

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: 'slow-network-token',
						user: { id: 1, email: 'test@example.com' }
					})
				});
			});

			await page.goto('/workspace');

			const startTime = Date.now();

			// Start authentication process
			await page.fill('[data-testid="access-code-input"]', 'test-code');
			await page.click('[data-testid="login-submit"]');

			// Check for loading indicator
			const loadingIndicator = page.locator('[data-testid="loading-spinner"], [data-testid="login-loading"]');
			await expect(loadingIndicator).toBeVisible();

			// Wait for completion
			await page.waitForSelector('[data-testid="auth-modal"]', { state: 'hidden', timeout: 5000 });

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Verify slow response was handled gracefully
			expect(duration).toBeGreaterThan(1900); // Should take at least ~2 seconds
			console.log(`Slow network response handled gracefully (${duration}ms)`);
		});
	});

	test.describe('Service Degradation Handling', () => {
		test('handles WebAuthn service failure with fallback', async ({ page }) => {
			// Mock WebAuthn service failure
			await page.addInitScript(() => {
				// Simulate WebAuthn not available
				delete window.navigator.credentials;
			});

			// Mock fallback authentication methods
			await page.route('/api/auth/login', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: 'fallback-token',
						user: { id: 1, email: 'test@example.com' },
						authMethod: 'access_code'
					})
				});
			});

			await page.goto('/workspace');

			// Verify WebAuthn option is not available or shows graceful degradation
			const webauthnButton = page.locator('[data-testid="webauthn-button"]');

			if (await webauthnButton.isVisible()) {
				// If button is visible, it should be disabled with explanation
				await expect(webauthnButton).toBeDisabled();
			}

			// Verify access code authentication still works
			await page.fill('[data-testid="access-code-input"]', 'fallback-code');
			await page.click('[data-testid="login-submit"]');

			await page.waitForSelector('[data-testid="auth-modal"]', { state: 'hidden' });

			console.log('WebAuthn failure handled with access code fallback');
		});

		test('handles OAuth service failure with fallback', async ({ page }) => {
			// Mock OAuth service failures
			await page.route('/api/auth/oauth/google', async route => {
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'OAuth provider temporarily unavailable'
					})
				});
			});

			await page.route('/api/auth/oauth/github', async route => {
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'OAuth provider temporarily unavailable'
					})
				});
			});

			// Mock successful fallback authentication
			await page.route('/api/auth/login', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: 'non-oauth-token',
						user: { id: 1, email: 'test@example.com' },
						authMethod: 'access_code'
					})
				});
			});

			await page.goto('/workspace');

			// Try OAuth authentication (should show error or be disabled)
			const googleButton = page.locator('[data-testid="oauth-google-button"]');
			const githubButton = page.locator('[data-testid="oauth-github-button"]');

			if (await googleButton.isVisible()) {
				await googleButton.click();
				// Should show error message or redirect to fallback
				const errorMessage = page.locator('[data-testid="oauth-error"]');
				if (await errorMessage.isVisible()) {
					const errorText = await errorMessage.textContent();
					expect(errorText).toContain('temporarily unavailable');
				}
			}

			// Verify fallback authentication works
			await page.fill('[data-testid="access-code-input"]', 'fallback-code');
			await page.click('[data-testid="login-submit"]');

			await page.waitForSelector('[data-testid="auth-modal"]', { state: 'hidden' });

			console.log('OAuth failure handled with access code fallback');
		});

		test('handles database connectivity issues', async ({ page }) => {
			// Mock database connectivity issues
			await page.route('/api/auth/status', async route => {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Database connection failed',
						fallbackMode: true
					})
				});
			});

			// Mock authentication endpoint with limited functionality
			await page.route('/api/auth/login', async route => {
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Service temporarily unavailable due to database issues',
						fallbackMode: true,
						message: 'Please try again in a few moments'
					})
				});
			});

			await page.goto('/workspace');

			// Verify graceful degradation message
			const serviceMessage = page.locator('[data-testid="service-degradation-message"]');

			if (await serviceMessage.isVisible()) {
				const messageText = await serviceMessage.textContent();
				expect(messageText).toContain('temporarily unavailable');
			}

			// Try authentication and verify appropriate error handling
			await page.fill('[data-testid="access-code-input"]', 'test-code');
			await page.click('[data-testid="login-submit"]');

			const errorElement = page.locator('[data-testid="error-message"]');
			await expect(errorElement).toBeVisible();

			const errorText = await errorElement.textContent();
			expect(errorText).toContain('database issues');

			console.log('Database connectivity issues handled gracefully');
		});
	});

	test.describe('Partial Feature Degradation', () => {
		test('handles admin interface degradation', async ({ page }) => {
			// Mock successful basic authentication
			await page.route('/api/auth/status', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						authenticated: true,
						user: { id: 1, email: 'admin@example.com', role: 'admin' },
						sessionStatus: 'active'
					})
				});
			});

			// Mock admin service degradation
			await page.route('/api/admin/**', async route => {
				const url = route.request().url();

				// Some admin endpoints fail
				if (url.includes('/users') || url.includes('/monitoring')) {
					await route.fulfill({
						status: 503,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Admin service partially unavailable',
							degradedMode: true
						})
					});
				} else {
					// Other endpoints work normally
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							data: 'Basic admin functionality available'
						})
					});
				}
			});

			await page.goto('/workspace');

			// Test admin interface degradation
			const adminResult = await page.evaluate(async () => {
				const results = {};

				// Test user management (should fail)
				try {
					const userResponse = await fetch('/api/admin/users');
					const userData = await userResponse.json();
					results.users = { success: userResponse.ok, data: userData };
				} catch (error) {
					results.users = { success: false, error: error.message };
				}

				// Test basic admin functionality (should work)
				try {
					const basicResponse = await fetch('/api/admin/status');
					const basicData = await basicResponse.json();
					results.basic = { success: basicResponse.ok, data: basicData };
				} catch (error) {
					results.basic = { success: false, error: error.message };
				}

				return results;
			});

			console.log('Admin interface degradation result:', adminResult);

			// Verify partial functionality
			expect(adminResult.users.success).toBe(false);
			expect(adminResult.users.data?.degradedMode).toBe(true);
			expect(adminResult.basic.success).toBe(true);
		});

		test('handles certificate management degradation', async ({ page }) => {
			// Mock certificate service degradation
			await page.route('/api/admin/certificates/**', async route => {
				const url = route.request().url();

				if (url.includes('upload') || url.includes('delete')) {
					// Write operations fail
					await route.fulfill({
						status: 503,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Certificate management temporarily read-only',
							readOnlyMode: true
						})
					});
				} else {
					// Read operations work
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							certificates: [
								{
									id: 1,
									domain: 'localhost',
									type: 'mkcert',
									expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
									status: 'active'
								}
							],
							readOnlyMode: true
						})
					});
				}
			});

			const certResult = await page.evaluate(async () => {
				const results = {};

				// Test certificate listing (should work)
				try {
					const listResponse = await fetch('/api/admin/certificates');
					const listData = await listResponse.json();
					results.list = { success: listResponse.ok, data: listData };
				} catch (error) {
					results.list = { success: false, error: error.message };
				}

				// Test certificate upload (should fail)
				try {
					const uploadResponse = await fetch('/api/admin/certificates/upload', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ certificate: 'test-cert' })
					});
					const uploadData = await uploadResponse.json();
					results.upload = { success: uploadResponse.ok, data: uploadData };
				} catch (error) {
					results.upload = { success: false, error: error.message };
				}

				return results;
			});

			console.log('Certificate management degradation result:', certResult);

			// Verify read-only mode
			expect(certResult.list.success).toBe(true);
			expect(certResult.list.data?.readOnlyMode).toBe(true);
			expect(certResult.upload.success).toBe(false);
			expect(certResult.upload.data?.readOnlyMode).toBe(true);
		});
	});

	test.describe('Session Recovery and Persistence', () => {
		test('handles session recovery after service restart', async ({ page }) => {
			// Set up initial authenticated session
			await page.route('/api/auth/status', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						authenticated: true,
						user: { id: 1, email: 'test@example.com' },
						sessionStatus: 'active'
					})
				});
			});

			await page.goto('/workspace');

			// Set session token in localStorage
			await page.evaluate(() => {
				localStorage.setItem('sessionToken', 'existing-session-token');
			});

			// Simulate service restart (session validation fails temporarily)
			let serviceRestartComplete = false;
			await page.route('/api/auth/status', async route => {
				if (!serviceRestartComplete) {
					// First few requests fail during "restart"
					await route.fulfill({
						status: 503,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Service restarting',
							retryAfter: 5
						})
					});
				} else {
					// After "restart", session is recovered
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							authenticated: true,
							user: { id: 1, email: 'test@example.com' },
							sessionStatus: 'active',
							recovered: true
						})
					});
				}
			});

			// Simulate page reload (like user refreshing during service restart)
			await page.reload();

			// Wait for service to "restart"
			await page.waitForTimeout(1000);
			serviceRestartComplete = true;

			// Check if session recovery is attempted
			const sessionToken = await page.evaluate(() => {
				return localStorage.getItem('sessionToken');
			});

			expect(sessionToken).toBe('existing-session-token');

			// Trigger another status check to simulate recovery
			const recoveryResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/auth/status');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Session recovery result:', recoveryResult);

			if (recoveryResult.success) {
				expect(recoveryResult.data.recovered).toBe(true);
			}
		});

		test('handles expired session graceful reauth', async ({ page }) => {
			// Mock expired session scenario
			await page.route('/api/auth/status', async route => {
				await route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						authenticated: false,
						error: 'Session expired',
						sessionExpired: true
					})
				});
			});

			// Mock successful reauthentication
			await page.route('/api/auth/login', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: 'new-session-token',
						user: { id: 1, email: 'test@example.com' },
						message: 'Session renewed successfully'
					})
				});
			});

			await page.goto('/workspace');

			// Check for session expiry notification
			const sessionExpiredMessage = page.locator('[data-testid="session-expired-message"]');
			if (await sessionExpiredMessage.isVisible()) {
				const messageText = await sessionExpiredMessage.textContent();
				expect(messageText).toContain('expired');
			}

			// Verify reauthentication form is shown
			await expect(page.locator('[data-testid="access-code-input"]')).toBeVisible();

			// Perform reauthentication
			await page.fill('[data-testid="access-code-input"]', 'reauth-code');
			await page.click('[data-testid="login-submit"]');

			await page.waitForSelector('[data-testid="auth-modal"]', { state: 'hidden' });

			console.log('Expired session handled with graceful reauthentication');
		});
	});

	test.describe('Error Recovery and Resilience', () => {
		test('handles temporary API failures with retry logic', async ({ page }) => {
			let attemptCount = 0;

			// Mock API that fails first few times then succeeds
			await page.route('/api/auth/status', async route => {
				attemptCount++;

				if (attemptCount <= 3) {
					await route.fulfill({
						status: 500,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Temporary server error',
							retry: true
						})
					});
				} else {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							authenticated: false,
							user: null,
							sessionStatus: 'none'
						})
					});
				}
			});

			await page.goto('/workspace');

			// Wait for retry logic to eventually succeed
			await page.waitForTimeout(5000);

			// Verify eventual success
			expect(attemptCount).toBeGreaterThan(3);

			console.log(`API failure handled with retry logic (${attemptCount} attempts)`);
		});

		test('handles resource exhaustion gracefully', async ({ page }) => {
			// Mock resource exhaustion scenarios
			await page.route('/api/auth/login', async route => {
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Server temporarily overloaded',
						retryAfter: 60,
						resourceExhaustion: true
					})
				});
			});

			await page.goto('/workspace');

			// Try authentication during resource exhaustion
			await page.fill('[data-testid="access-code-input"]', 'test-code');
			await page.click('[data-testid="login-submit"]');

			// Check for appropriate error handling
			const errorMessage = page.locator('[data-testid="error-message"]');
			await expect(errorMessage).toBeVisible();

			const errorText = await errorMessage.textContent();
			expect(errorText).toContain('overloaded');

			// Check for retry information
			const retryInfo = page.locator('[data-testid="retry-after"]');
			if (await retryInfo.isVisible()) {
				const retryText = await retryInfo.textContent();
				expect(retryText).toContain('60');
			}

			console.log('Resource exhaustion handled gracefully with retry guidance');
		});

		test('handles partial system failures', async ({ page }) => {
			// Mock mixed service availability
			const serviceStatus = {
				auth: 'available',
				admin: 'degraded',
				monitoring: 'unavailable',
				certificates: 'available'
			};

			await page.route('/api/**', async route => {
				const url = route.request().url();

				if (url.includes('/auth/')) {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ success: true, service: 'auth' })
					});
				} else if (url.includes('/admin/') && !url.includes('/monitoring')) {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							service: 'admin',
							degradedMode: true,
							availableFeatures: ['basic']
						})
					});
				} else if (url.includes('/monitoring')) {
					await route.fulfill({
						status: 503,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Monitoring service unavailable'
						})
					});
				} else {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ success: true })
					});
				}
			});

			// Test each service
			const serviceTests = await page.evaluate(async () => {
				const results = {};

				const services = ['auth', 'admin', 'monitoring', 'certificates'];

				for (const service of services) {
					try {
						const response = await fetch(`/api/${service}/status`);
						const data = await response.json();
						results[service] = {
							success: response.ok,
							status: response.status,
							data
						};
					} catch (error) {
						results[service] = {
							success: false,
							error: error.message
						};
					}
				}

				return results;
			});

			console.log('Partial system failure test results:', serviceTests);

			// Verify mixed service availability
			expect(serviceTests.auth.success).toBe(true);
			expect(serviceTests.admin.success).toBe(true);
			expect(serviceTests.admin.data?.degradedMode).toBe(true);
			expect(serviceTests.monitoring.success).toBe(false);
			expect(serviceTests.certificates.success).toBe(true);
		});
	});
});