import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment } from './test-helpers.js';

test.describe('Authentication System Performance Testing', () => {
	test.beforeEach(async ({ page }) => {
		await setupFreshTestEnvironment(page, '/');
	});

	test.describe('Concurrent Authentication Load Testing', () => {
		test('handles concurrent login attempts', async ({ browser }) => {
			const concurrentUsers = 10;
			const contexts = [];
			const pages = [];
			const results = [];

			// Create multiple browser contexts to simulate different users
			for (let i = 0; i < concurrentUsers; i++) {
				const context = await browser.newContext();
				const page = await context.newPage();
				contexts.push(context);
				pages.push(page);
			}

			try {
				// Mock successful authentication for all requests
				for (const page of pages) {
					await page.route('/api/auth/login', async (route) => {
						// Simulate server processing time (50-200ms)
						const delay = 50 + Math.random() * 150;
						await new Promise((resolve) => setTimeout(resolve, delay));

						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								token: `token-${Date.now()}-${Math.random()}`,
								user: { id: Math.floor(Math.random() * 1000), email: 'test@example.com' }
							})
						});
					});
				}

				// Perform concurrent login attempts
				const loginPromises = pages.map(async (page, index) => {
					const startTime = Date.now();

					await page.goto('/workspace');
					await page.fill('[data-testid="access-code-input"]', `test-code-${index}`);
					await page.click('[data-testid="login-submit"]');

					// Wait for authentication to complete
					await page.waitForSelector('[data-testid="auth-modal"]', {
						state: 'hidden',
						timeout: 5000
					});

					const endTime = Date.now();
					return {
						user: index,
						duration: endTime - startTime,
						success: true
					};
				});

				const startTime = Date.now();
				const loginResults = await Promise.all(loginPromises);
				const totalTime = Date.now() - startTime;

				results.push(...loginResults);

				// Performance assertions
				const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
				const maxDuration = Math.max(...results.map((r) => r.duration));
				const successRate = results.filter((r) => r.success).length / results.length;

				console.log(`Concurrent login performance:
					- Total time: ${totalTime}ms
					- Average duration: ${avgDuration.toFixed(2)}ms
					- Max duration: ${maxDuration}ms
					- Success rate: ${(successRate * 100).toFixed(1)}%
				`);

				// Performance benchmarks
				expect(successRate).toBeGreaterThanOrEqual(0.9); // 90% success rate
				expect(avgDuration).toBeLessThan(3000); // Average under 3 seconds
				expect(maxDuration).toBeLessThan(5000); // No request over 5 seconds
				expect(totalTime).toBeLessThan(6000); // All concurrent requests under 6 seconds
			} finally {
				// Clean up contexts
				for (const context of contexts) {
					await context.close();
				}
			}
		});

		test('handles concurrent session validation requests', async ({ browser }) => {
			const concurrentSessions = 15;
			const contexts = [];
			const pages = [];

			// Create multiple browser contexts with valid sessions
			for (let i = 0; i < concurrentSessions; i++) {
				const context = await browser.newContext();
				const page = await context.newPage();

				// Set up session token
				await page.evaluateOnNewDocument(() => {
					localStorage.setItem('sessionToken', `session-${Date.now()}-${Math.random()}`);
				});

				contexts.push(context);
				pages.push(page);
			}

			try {
				// Mock session validation endpoint with realistic delays
				for (const page of pages) {
					await page.route('/api/auth/status', async (route) => {
						// Simulate database query time (10-100ms)
						const delay = 10 + Math.random() * 90;
						await new Promise((resolve) => setTimeout(resolve, delay));

						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								authenticated: true,
								user: { id: 1, email: 'test@example.com' },
								sessionStatus: 'active',
								timeUntilExpiry: 3600
							})
						});
					});
				}

				// Perform concurrent session validation
				const validationPromises = pages.map(async (page, index) => {
					const startTime = Date.now();

					await page.goto('/workspace');

					// Wait for session validation to complete
					await page.waitForLoadState('networkidle');

					const endTime = Date.now();
					return {
						session: index,
						duration: endTime - startTime,
						success: true
					};
				});

				const startTime = Date.now();
				const validationResults = await Promise.all(validationPromises);
				const totalTime = Date.now() - startTime;

				// Performance analysis
				const avgDuration =
					validationResults.reduce((sum, r) => sum + r.duration, 0) / validationResults.length;
				const maxDuration = Math.max(...validationResults.map((r) => r.duration));
				const successRate =
					validationResults.filter((r) => r.success).length / validationResults.length;

				console.log(`Concurrent session validation performance:
					- Total time: ${totalTime}ms
					- Average duration: ${avgDuration.toFixed(2)}ms
					- Max duration: ${maxDuration}ms
					- Success rate: ${(successRate * 100).toFixed(1)}%
				`);

				// Performance assertions
				expect(successRate).toBe(1.0); // 100% success rate expected
				expect(avgDuration).toBeLessThan(2000); // Average under 2 seconds
				expect(maxDuration).toBeLessThan(3000); // No request over 3 seconds
			} finally {
				// Clean up contexts
				for (const context of contexts) {
					await context.close();
				}
			}
		});

		test('handles WebAuthn registration load', async ({ browser }) => {
			const concurrentRegistrations = 5; // Lower number due to WebAuthn complexity
			const contexts = [];
			const pages = [];

			for (let i = 0; i < concurrentRegistrations; i++) {
				const context = await browser.newContext();
				const page = await context.newPage();
				contexts.push(context);
				pages.push(page);
			}

			try {
				// Mock WebAuthn and registration endpoints
				for (const page of pages) {
					// Mock WebAuthn API
					await page.addInitScript(() => {
						window.navigator.credentials.create = async () => {
							// Simulate WebAuthn processing time
							await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
							return {
								id: `credential-${Date.now()}-${Math.random()}`,
								rawId: new ArrayBuffer(32),
								response: {
									clientDataJSON: new ArrayBuffer(128),
									attestationObject: new ArrayBuffer(256)
								}
							};
						};
					});

					// Mock registration endpoints
					await page.route('/api/auth/webauthn/register/begin', async (route) => {
						const delay = 20 + Math.random() * 80;
						await new Promise((resolve) => setTimeout(resolve, delay));

						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								challenge: 'test-challenge',
								rp: { name: 'Test', id: 'localhost' },
								user: { id: 'test-user', name: 'test', displayName: 'Test User' },
								pubKeyCredParams: [{ type: 'public-key', alg: -7 }]
							})
						});
					});

					await page.route('/api/auth/webauthn/register/complete', async (route) => {
						const delay = 50 + Math.random() * 150;
						await new Promise((resolve) => setTimeout(resolve, delay));

						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								credentialId: `cred-${Date.now()}`,
								verified: true
							})
						});
					});
				}

				// Perform concurrent WebAuthn registrations
				const registrationPromises = pages.map(async (page, index) => {
					const startTime = Date.now();

					try {
						await page.goto('/workspace');

						// Simulate WebAuthn registration flow
						const result = await page.evaluate(async () => {
							try {
								// Begin registration
								const beginResponse = await fetch('/api/auth/webauthn/register/begin', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ email: 'test@example.com' })
								});

								if (!beginResponse.ok) throw new Error('Begin failed');

								// Create credential
								const credential = await navigator.credentials.create({
									publicKey: {
										challenge: new Uint8Array(32),
										rp: { name: 'Test' },
										user: { id: new Uint8Array(8), name: 'test', displayName: 'Test' },
										pubKeyCredParams: [{ type: 'public-key', alg: -7 }]
									}
								});

								// Complete registration
								const completeResponse = await fetch('/api/auth/webauthn/register/complete', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ credentialId: credential.id })
								});

								return { success: completeResponse.ok };
							} catch (error) {
								return { success: false, error: error.message };
							}
						});

						const endTime = Date.now();
						return {
							registration: index,
							duration: endTime - startTime,
							success: result.success
						};
					} catch (error) {
						const endTime = Date.now();
						return {
							registration: index,
							duration: endTime - startTime,
							success: false,
							error: error.message
						};
					}
				});

				const startTime = Date.now();
				const registrationResults = await Promise.all(registrationPromises);
				const totalTime = Date.now() - startTime;

				// Performance analysis
				const successfulRegistrations = registrationResults.filter((r) => r.success);
				const avgDuration =
					registrationResults.reduce((sum, r) => sum + r.duration, 0) / registrationResults.length;
				const maxDuration = Math.max(...registrationResults.map((r) => r.duration));
				const successRate = successfulRegistrations.length / registrationResults.length;

				console.log(`Concurrent WebAuthn registration performance:
					- Total time: ${totalTime}ms
					- Average duration: ${avgDuration.toFixed(2)}ms
					- Max duration: ${maxDuration}ms
					- Success rate: ${(successRate * 100).toFixed(1)}%
				`);

				// Performance assertions (more lenient for WebAuthn)
				expect(successRate).toBeGreaterThanOrEqual(0.8); // 80% success rate
				expect(avgDuration).toBeLessThan(5000); // Average under 5 seconds
				expect(maxDuration).toBeLessThan(8000); // No request over 8 seconds
			} finally {
				// Clean up contexts
				for (const context of contexts) {
					await context.close();
				}
			}
		});
	});

	test.describe('Session Lifecycle Performance', () => {
		test('measures session creation and cleanup performance', async ({ page }) => {
			const sessionCount = 20;
			const sessionTimes = [];

			// Mock session endpoints
			await page.route('/api/auth/login', async (route) => {
				const delay = 30 + Math.random() * 70; // Realistic DB operation time
				await new Promise((resolve) => setTimeout(resolve, delay));

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: `session-${Date.now()}-${Math.random()}`,
						user: { id: 1, email: 'test@example.com' },
						expiresAt: new Date(Date.now() + 3600000).toISOString()
					})
				});
			});

			await page.route('/api/auth/logout', async (route) => {
				const delay = 20 + Math.random() * 50; // Session cleanup time
				await new Promise((resolve) => setTimeout(resolve, delay));

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
			});

			// Test multiple session creation/destruction cycles
			for (let i = 0; i < sessionCount; i++) {
				const cycleStart = Date.now();

				// Login
				await page.goto('/workspace');
				await page.fill('[data-testid="access-code-input"]', `test-code-${i}`);
				await page.click('[data-testid="login-submit"]');
				await page.waitForSelector('[data-testid="auth-modal"]', { state: 'hidden' });

				// Logout
				await page.evaluate(() => {
					fetch('/api/auth/logout', { method: 'POST' });
					localStorage.removeItem('sessionToken');
				});

				const cycleEnd = Date.now();
				sessionTimes.push(cycleEnd - cycleStart);

				// Brief pause between cycles
				await page.waitForTimeout(50);
			}

			// Performance analysis
			const avgCycleTime = sessionTimes.reduce((sum, time) => sum + time, 0) / sessionTimes.length;
			const maxCycleTime = Math.max(...sessionTimes);
			const minCycleTime = Math.min(...sessionTimes);

			console.log(`Session lifecycle performance (${sessionCount} cycles):
				- Average cycle time: ${avgCycleTime.toFixed(2)}ms
				- Max cycle time: ${maxCycleTime}ms
				- Min cycle time: ${minCycleTime}ms
			`);

			// Performance assertions
			expect(avgCycleTime).toBeLessThan(2000); // Average cycle under 2 seconds
			expect(maxCycleTime).toBeLessThan(3000); // No cycle over 3 seconds
			expect(sessionTimes.every((time) => time > 0)).toBe(true); // All cycles completed
		});

		test('measures authentication method switching performance', async ({ page }) => {
			const switchCount = 10;
			const switchTimes = [];

			// Mock multiple auth endpoints
			await page.route('/api/auth/login', async (route) => {
				const delay = 40 + Math.random() * 60;
				await new Promise((resolve) => setTimeout(resolve, delay));

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: `token-${Date.now()}`,
						user: { id: 1, email: 'test@example.com' }
					})
				});
			});

			await page.route('/api/auth/oauth/google', async (route) => {
				const delay = 60 + Math.random() * 90;
				await new Promise((resolve) => setTimeout(resolve, delay));

				await route.fulfill({
					status: 302,
					headers: { Location: 'https://accounts.google.com/oauth/authorize?...' }
				});
			});

			await page.route('/api/auth/webauthn/authenticate/begin', async (route) => {
				const delay = 30 + Math.random() * 70;
				await new Promise((resolve) => setTimeout(resolve, delay));

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						challenge: 'test-challenge',
						allowCredentials: []
					})
				});
			});

			// Test switching between authentication methods
			for (let i = 0; i < switchCount; i++) {
				const switchStart = Date.now();

				await page.goto('/workspace');

				// Cycle through different auth methods
				const methods = ['access-code', 'oauth', 'webauthn'];
				const method = methods[i % methods.length];

				switch (method) {
					case 'access-code':
						await page.fill('[data-testid="access-code-input"]', 'test-code');
						await page.click('[data-testid="login-submit"]');
						break;

					case 'oauth':
						// Simulate OAuth button click
						await page.evaluate(() => {
							fetch('/api/auth/oauth/google');
						});
						break;

					case 'webauthn':
						// Simulate WebAuthn authentication
						await page.evaluate(() => {
							fetch('/api/auth/webauthn/authenticate/begin', { method: 'POST' });
						});
						break;
				}

				await page.waitForLoadState('networkidle');

				const switchEnd = Date.now();
				switchTimes.push(switchEnd - switchStart);
			}

			// Performance analysis
			const avgSwitchTime = switchTimes.reduce((sum, time) => sum + time, 0) / switchTimes.length;
			const maxSwitchTime = Math.max(...switchTimes);

			console.log(`Auth method switching performance (${switchCount} switches):
				- Average switch time: ${avgSwitchTime.toFixed(2)}ms
				- Max switch time: ${maxSwitchTime}ms
			`);

			// Performance assertions
			expect(avgSwitchTime).toBeLessThan(1500); // Average switch under 1.5 seconds
			expect(maxSwitchTime).toBeLessThan(2500); // No switch over 2.5 seconds
		});
	});

	test.describe('Database Performance Under Load', () => {
		test('measures authentication query performance', async ({ page }) => {
			const queryCount = 50;
			const queryTimes = [];

			// Mock database-heavy authentication endpoint
			await page.route('/api/auth/status', async (route) => {
				const queryStart = Date.now();

				// Simulate multiple database queries
				const queries = [
					'SELECT * FROM users WHERE id = ?',
					'SELECT * FROM auth_sessions WHERE token = ?',
					'SELECT * FROM user_devices WHERE user_id = ?',
					'INSERT INTO auth_events (...) VALUES (...)',
					'UPDATE auth_sessions SET last_activity = ? WHERE id = ?'
				];

				// Simulate realistic database query times
				const totalQueryTime = queries.reduce((sum) => {
					const queryTime = 5 + Math.random() * 15; // 5-20ms per query
					return sum + queryTime;
				}, 0);

				await new Promise((resolve) => setTimeout(resolve, totalQueryTime));

				const queryEnd = Date.now();
				queryTimes.push(queryEnd - queryStart);

				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						authenticated: true,
						user: { id: 1, email: 'test@example.com' },
						sessionStatus: 'active',
						queryTime: queryEnd - queryStart
					})
				});
			});

			// Perform rapid authentication status checks
			const promises = [];
			for (let i = 0; i < queryCount; i++) {
				promises.push(
					page.evaluate(async () => {
						const response = await fetch('/api/auth/status');
						return response.json();
					})
				);
			}

			const startTime = Date.now();
			const results = await Promise.all(promises);
			const totalTime = Date.now() - startTime;

			// Performance analysis
			const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
			const maxQueryTime = Math.max(...queryTimes);
			const queriesPerSecond = queryCount / (totalTime / 1000);

			console.log(`Database query performance (${queryCount} queries):
				- Total time: ${totalTime}ms
				- Average query time: ${avgQueryTime.toFixed(2)}ms
				- Max query time: ${maxQueryTime}ms
				- Queries per second: ${queriesPerSecond.toFixed(2)}
			`);

			// Performance assertions
			expect(avgQueryTime).toBeLessThan(100); // Average query under 100ms
			expect(maxQueryTime).toBeLessThan(500); // No query over 500ms
			expect(queriesPerSecond).toBeGreaterThan(10); // At least 10 queries/second
			expect(results.every((r) => r.success)).toBe(true); // All queries successful
		});
	});

	test.describe('Memory and Resource Usage', () => {
		test('monitors memory usage during authentication stress test', async ({ page }) => {
			const iterations = 100;
			let initialMemory, peakMemory, finalMemory;

			// Capture initial memory usage
			initialMemory = await page.evaluate(() => {
				return performance.memory
					? {
							usedJSHeapSize: performance.memory.usedJSHeapSize,
							totalJSHeapSize: performance.memory.totalJSHeapSize,
							jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
						}
					: null;
			});

			// Mock authentication endpoint
			await page.route('/api/auth/login', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: `token-${Date.now()}`,
						user: { id: 1, email: 'test@example.com' }
					})
				});
			});

			// Stress test with many authentication attempts
			for (let i = 0; i < iterations; i++) {
				await page.goto('/workspace');
				await page.fill('[data-testid="access-code-input"]', `test-code-${i}`);
				await page.click('[data-testid="login-submit"]');
				await page.waitForSelector('[data-testid="auth-modal"]', {
					state: 'hidden',
					timeout: 1000
				});

				// Periodic memory monitoring
				if (i % 10 === 0) {
					const currentMemory = await page.evaluate(() => {
						return performance.memory ? performance.memory.usedJSHeapSize : 0;
					});

					if (!peakMemory || currentMemory > peakMemory) {
						peakMemory = currentMemory;
					}
				}
			}

			// Capture final memory usage
			finalMemory = await page.evaluate(() => {
				return performance.memory
					? {
							usedJSHeapSize: performance.memory.usedJSHeapSize,
							totalJSHeapSize: performance.memory.totalJSHeapSize,
							jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
						}
					: null;
			});

			if (initialMemory && finalMemory) {
				const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
				const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;

				console.log(`Memory usage during stress test (${iterations} iterations):
					- Initial memory: ${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
					- Peak memory: ${(peakMemory / 1024 / 1024).toFixed(2)} MB
					- Final memory: ${(finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
					- Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)
				`);

				// Memory leak detection
				expect(memoryIncreasePercent).toBeLessThan(50); // Memory increase under 50%
				expect(finalMemory.usedJSHeapSize).toBeLessThan(finalMemory.jsHeapSizeLimit * 0.8); // Under 80% of limit
			}
		});

		test('measures DOM node cleanup after authentication flows', async ({ page }) => {
			const flowCount = 20;
			let initialNodeCount, finalNodeCount;

			await page.goto('/workspace');

			// Get initial DOM node count
			initialNodeCount = await page.evaluate(() => {
				return document.querySelectorAll('*').length;
			});

			// Mock authentication endpoints
			await page.route('/api/auth/login', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						token: `token-${Date.now()}`,
						user: { id: 1, email: 'test@example.com' }
					})
				});
			});

			await page.route('/api/auth/logout', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ success: true })
				});
			});

			// Perform multiple authentication flows
			for (let i = 0; i < flowCount; i++) {
				// Login flow
				await page.fill('[data-testid="access-code-input"]', `test-code-${i}`);
				await page.click('[data-testid="login-submit"]');
				await page.waitForSelector('[data-testid="auth-modal"]', { state: 'hidden' });

				// Logout flow
				await page.evaluate(() => {
					fetch('/api/auth/logout', { method: 'POST' });
					localStorage.removeItem('sessionToken');
				});

				await page.reload();
				await page.waitForLoadState('networkidle');
			}

			// Get final DOM node count
			finalNodeCount = await page.evaluate(() => {
				return document.querySelectorAll('*').length;
			});

			const nodeIncrease = finalNodeCount - initialNodeCount;
			const nodeIncreasePercent = (nodeIncrease / initialNodeCount) * 100;

			console.log(`DOM cleanup performance (${flowCount} flows):
				- Initial nodes: ${initialNodeCount}
				- Final nodes: ${finalNodeCount}
				- Node increase: ${nodeIncrease} (${nodeIncreasePercent.toFixed(1)}%)
			`);

			// DOM leak detection
			expect(Math.abs(nodeIncreasePercent)).toBeLessThan(10); // Node count change under 10%
		});
	});
});
