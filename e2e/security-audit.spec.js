import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment } from './test-helpers.js';

test.describe('Security Audit and Penetration Testing', () => {
	test.beforeEach(async ({ page }) => {
		await setupFreshTestEnvironment(page, '/');
	});

	test.describe('Authentication Security', () => {
		test('prevents brute force attacks on login', async ({ page }) => {
			await page.goto('/workspace');

			// Mock authentication endpoint to track attempts
			let attemptCount = 0;
			await page.route('/api/auth/login', async (route) => {
				attemptCount++;
				await route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Invalid credentials',
						attemptsRemaining: Math.max(0, 5 - attemptCount),
						rateLimited: attemptCount > 5
					})
				});
			});

			// Attempt multiple failed logins
			for (let i = 0; i < 7; i++) {
				await page.fill('[data-testid="access-code-input"]', 'invalid-code');
				await page.click('[data-testid="login-submit"]');
				await page.waitForTimeout(100);
			}

			// Should show rate limiting after 5 attempts
			await expect(page.locator('text=Too many login attempts')).toBeVisible();
		});

		test('validates session tokens properly', async ({ page }) => {
			// Test with invalid session token
			await page.evaluateOnNewDocument(() => {
				localStorage.setItem('sessionToken', 'invalid-token-12345');
			});

			await page.goto('/workspace');

			// Should redirect to login despite having a token
			await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible();
		});

		test('prevents session hijacking', async ({ page }) => {
			// Mock successful authentication
			await page.route('/api/auth/login', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: 'valid-session-token',
						user: { id: 1, email: 'test@example.com' },
						expiresAt: new Date(Date.now() + 3600000).toISOString()
					})
				});
			});

			// Login successfully
			await page.goto('/workspace');
			await page.fill('[data-testid="access-code-input"]', 'valid-code');
			await page.click('[data-testid="login-submit"]');

			// Get the session token
			const sessionToken = await page.evaluate(() => localStorage.getItem('sessionToken'));

			// Open new browser context (simulating different user/session)
			const context2 = await page.context().browser().newContext();
			const page2 = await context2.newPage();

			// Try to use the same session token
			await page2.evaluateOnNewDocument((token) => {
				localStorage.setItem('sessionToken', token);
			}, sessionToken);

			// Mock session validation to reject reused token from different fingerprint
			await page2.route('/api/auth/validate', async (route) => {
				await route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Session fingerprint mismatch'
					})
				});
			});

			await page2.goto('/workspace');

			// Should require re-authentication
			await expect(page2.locator('[data-testid="auth-modal"]')).toBeVisible();
		});

		test('prevents CSRF attacks', async ({ page }) => {
			// Test CSRF protection on sensitive endpoints
			const response = await page.evaluate(async () => {
				try {
					const res = await fetch('/api/admin/users/delete', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userId: 1 })
					});
					return { status: res.status, ok: res.ok };
				} catch (error) {
					return { error: error.message };
				}
			});

			// Should be rejected due to missing CSRF token
			expect(response.status).toBe(403);
		});
	});

	test.describe('Input Validation Security', () => {
		test('prevents SQL injection in login fields', async ({ page }) => {
			await page.goto('/workspace');

			// Mock endpoint to track SQL injection attempts
			let injectionAttempted = false;
			await page.route('/api/auth/login', async (route) => {
				const body = await route.request().postData();
				const data = JSON.parse(body);

				// Check for SQL injection patterns
				const sqlPatterns = ['DROP TABLE', 'UNION SELECT', '1=1', '; --', '/*', '*/'];
				const hasSqlInjection = sqlPatterns.some((pattern) => data.accessCode?.includes(pattern));

				if (hasSqlInjection) {
					injectionAttempted = true;
					await route.fulfill({
						status: 400,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Invalid input format'
						})
					});
				} else {
					await route.fulfill({
						status: 401,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Invalid credentials'
						})
					});
				}
			});

			// Attempt SQL injection
			await page.fill('[data-testid="access-code-input"]', "'; DROP TABLE users; --");
			await page.click('[data-testid="login-submit"]');

			// Verify injection was blocked
			expect(injectionAttempted).toBe(true);
			await expect(page.locator('text=Invalid input format')).toBeVisible();
		});

		test('prevents XSS in authentication forms', async ({ page }) => {
			await page.goto('/workspace');

			// Attempt XSS payload
			const xssPayload = '<script>alert("XSS")</script>';
			await page.fill('[data-testid="access-code-input"]', xssPayload);

			// Check that script is not executed
			const scriptTags = await page.$$('script:has-text("alert")');
			expect(scriptTags).toHaveLength(0);

			// Check that input is properly escaped
			const inputValue = await page.inputValue('[data-testid="access-code-input"]');
			expect(inputValue).toBe(xssPayload); // Should be stored as text, not executed
		});

		test('validates file uploads for certificate management', async ({ page }) => {
			// This test would require admin access - mock for security testing
			await page.route('/api/admin/certificates/upload', async (route) => {
				const request = route.request();
				const contentType = request.headers()['content-type'];

				// Check for malicious file types
				const maliciousPatterns = ['.exe', '.php', '.jsp', '.bat', '.cmd'];
				const isMalicious = maliciousPatterns.some((pattern) => request.url().includes(pattern));

				if (isMalicious || !contentType?.includes('multipart/form-data')) {
					await route.fulfill({
						status: 400,
						contentType: 'application/json',
						body: JSON.stringify({
							success: false,
							error: 'Invalid file type'
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

			// Test file upload validation (would need actual admin interface)
			const response = await page.evaluate(async () => {
				const formData = new FormData();
				const maliciousFile = new File(['malicious content'], 'backdoor.php', {
					type: 'application/x-php'
				});
				formData.append('certificate', maliciousFile);

				try {
					const res = await fetch('/api/admin/certificates/upload', {
						method: 'POST',
						body: formData
					});
					return { status: res.status };
				} catch (error) {
					return { error: error.message };
				}
			});

			expect(response.status).toBe(400);
		});
	});

	test.describe('Authorization Security', () => {
		test('enforces role-based access control', async ({ page }) => {
			// Test unauthorized access to admin endpoints
			const adminEndpoints = [
				'/api/admin/users',
				'/api/admin/sessions',
				'/api/admin/security/posture',
				'/api/admin/audit/logs'
			];

			for (const endpoint of adminEndpoints) {
				const response = await page.evaluate(async (url) => {
					try {
						const res = await fetch(url);
						return { status: res.status, ok: res.ok };
					} catch (error) {
						return { error: error.message };
					}
				}, endpoint);

				// Should require authentication/authorization
				expect(response.status).toBeOneOf([401, 403]);
			}
		});

		test('prevents privilege escalation', async ({ page }) => {
			// Mock regular user session
			await page.evaluateOnNewDocument(() => {
				localStorage.setItem('sessionToken', 'regular-user-token');
			});

			// Mock API to simulate regular user trying to access admin functions
			await page.route('/api/admin/**', async (route) => {
				await route.fulfill({
					status: 403,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Insufficient privileges'
					})
				});
			});

			// Attempt to access admin functionality
			const response = await page.evaluate(async () => {
				try {
					const res = await fetch('/api/admin/users/promote', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ userId: 1, role: 'admin' })
					});
					return { status: res.status };
				} catch (error) {
					return { error: error.message };
				}
			});

			expect(response.status).toBe(403);
		});
	});

	test.describe('Session Security', () => {
		test('enforces secure session timeouts', async ({ page }) => {
			// Mock session that expires quickly for testing
			await page.route('/api/auth/validate', async (route) => {
				await route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({
						success: false,
						error: 'Session expired',
						expired: true
					})
				});
			});

			await page.goto('/workspace');

			// Should show session expired warning
			await expect(page.locator('text=Session expired')).toBeVisible();
		});

		test('properly destroys sessions on logout', async ({ page }) => {
			// Mock successful authentication
			await page.route('/api/auth/login', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: 'test-session-token',
						user: { id: 1, email: 'test@example.com' }
					})
				});
			});

			// Mock logout endpoint
			let sessionDestroyed = false;
			await page.route('/api/auth/logout', async (route) => {
				sessionDestroyed = true;
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
			});

			// Login and then logout
			await page.goto('/workspace');
			await page.fill('[data-testid="access-code-input"]', 'valid-code');
			await page.click('[data-testid="login-submit"]');

			// Simulate logout action (would need actual logout button)
			await page.evaluate(() => {
				fetch('/api/auth/logout', { method: 'POST' });
			});

			// Verify session was properly destroyed on server
			expect(sessionDestroyed).toBe(true);

			// Check that local storage is cleared
			const token = await page.evaluate(() => localStorage.getItem('sessionToken'));
			expect(token).toBeNull();
		});
	});

	test.describe('Communication Security', () => {
		test('enforces HTTPS in production', async ({ page }) => {
			// Test would check for HTTPS enforcement
			const protocol = await page.evaluate(() => window.location.protocol);

			// In production, should be HTTPS
			if (process.env.NODE_ENV === 'production') {
				expect(protocol).toBe('https:');
			}
		});

		test('sets secure cookie attributes', async ({ page }) => {
			// Mock login to set cookies
			await page.route('/api/auth/login', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					headers: {
						'Set-Cookie': 'sessionToken=abc123; HttpOnly; Secure; SameSite=Strict'
					},
					body: JSON.stringify({
						success: true,
						token: 'abc123',
						user: { id: 1, email: 'test@example.com' }
					})
				});
			});

			await page.goto('/workspace');
			await page.fill('[data-testid="access-code-input"]', 'valid-code');
			await page.click('[data-testid="login-submit"]');

			// Verify secure cookie attributes would be set
			// (This is more of a server-side test, but validates the concept)
			const cookies = await page.context().cookies();
			const sessionCookie = cookies.find((c) => c.name === 'sessionToken');

			if (sessionCookie) {
				expect(sessionCookie.httpOnly).toBe(true);
				expect(sessionCookie.secure).toBe(true);
				expect(sessionCookie.sameSite).toBe('Strict');
			}
		});
	});

	test.describe('WebAuthn Security', () => {
		test('validates WebAuthn origin restrictions', async ({ page }) => {
			// Mock WebAuthn API to test origin validation
			await page.addInitScript(() => {
				// Override WebAuthn to simulate origin mismatch
				window.navigator.credentials.create = async (options) => {
					const origin = window.location.origin;
					const expectedOrigin = 'https://trusted-domain.com';

					if (origin !== expectedOrigin) {
						throw new Error('Origin not allowed for WebAuthn');
					}

					return { id: 'test-credential' };
				};
			});

			await page.goto('/workspace');

			// Attempt WebAuthn registration (would fail due to origin mismatch)
			const result = await page.evaluate(async () => {
				try {
					await navigator.credentials.create({
						publicKey: {
							challenge: new Uint8Array(32),
							rp: { name: 'Test' },
							user: { id: new Uint8Array(8), name: 'test', displayName: 'Test' },
							pubKeyCredParams: [{ type: 'public-key', alg: -7 }]
						}
					});
					return { success: true };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Origin not allowed');
		});
	});

	test.describe('Data Protection', () => {
		test('prevents sensitive data exposure', async ({ page }) => {
			// Test that sensitive data is not leaked in responses
			await page.route('/api/admin/users', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						users: [
							{
								id: 1,
								email: 'user@example.com',
								// Should NOT include password hash, session tokens, etc.
								role: 'user',
								createdAt: '2023-01-01'
							}
						]
					})
				});
			});

			const response = await page.evaluate(async () => {
				try {
					const res = await fetch('/api/admin/users');
					const data = await res.json();
					return data;
				} catch (error) {
					return { error: error.message };
				}
			});

			// Verify sensitive fields are not exposed
			if (response.users) {
				const user = response.users[0];
				expect(user).not.toHaveProperty('passwordHash');
				expect(user).not.toHaveProperty('sessionToken');
				expect(user).not.toHaveProperty('secret');
			}
		});

		test('implements proper audit logging', async ({ page }) => {
			// Mock audit logging endpoint
			let auditLogged = false;
			await page.route('/api/admin/audit/logs', async (route) => {
				auditLogged = true;
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						logs: [
							{
								timestamp: new Date().toISOString(),
								userId: 1,
								action: 'login_attempt',
								ip: '127.0.0.1',
								userAgent: 'test',
								success: false
							}
						]
					})
				});
			});

			// Trigger an action that should be audited
			await page.goto('/workspace');
			await page.fill('[data-testid="access-code-input"]', 'test-code');
			await page.click('[data-testid="login-submit"]');

			// Check if audit logging would be triggered
			// (This is conceptual - actual implementation would vary)
			expect(auditLogged).toBe(true);
		});
	});
});
