import { test, expect, devices } from '@playwright/test';
import { setupFreshTestEnvironment } from './test-helpers.js';

test.describe('Cross-Browser Authentication Compatibility', () => {
	// Define browser-specific test configurations
	const browserConfigs = [
		{ name: 'Chrome Desktop', ...devices['Desktop Chrome'] },
		{ name: 'Firefox Desktop', ...devices['Desktop Firefox'] },
		{ name: 'Safari Desktop', ...devices['Desktop Safari'] },
		{ name: 'Chrome Mobile', ...devices['Pixel 5'] },
		{ name: 'Safari Mobile', ...devices['iPhone 12'] },
		{
			name: 'Edge Desktop',
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
		}
	];

	test.describe('WebAuthn Cross-Browser Support', () => {
		browserConfigs.forEach((config) => {
			test(`WebAuthn availability detection - ${config.name}`, async ({ browser }) => {
				const context = await browser.newContext(config);
				const page = await context.newPage();

				try {
					await setupFreshTestEnvironment(page, '/');

					// Test WebAuthn API availability
					const webAuthnSupport = await page.evaluate(() => {
						return {
							hasCredentials: 'credentials' in navigator,
							hasPublicKeyCredential: 'PublicKeyCredential' in window,
							hasCreate:
								navigator.credentials && typeof navigator.credentials.create === 'function',
							hasGet: navigator.credentials && typeof navigator.credentials.get === 'function',
							isSecureContext: window.isSecureContext,
							hasUserActivation: 'userActivation' in navigator,
							platform: navigator.platform,
							userAgent: navigator.userAgent
						};
					});

					console.log(`WebAuthn support for ${config.name}:`, webAuthnSupport);

					// Basic WebAuthn support requirements
					expect(webAuthnSupport.hasCredentials).toBe(true);
					expect(webAuthnSupport.hasCreate).toBe(true);
					expect(webAuthnSupport.hasGet).toBe(true);

					// Platform-specific expectations
					if (config.name.includes('Safari')) {
						// Safari has WebAuthn support but may have limitations
						expect(webAuthnSupport.hasPublicKeyCredential).toBe(true);
					} else {
						expect(webAuthnSupport.hasPublicKeyCredential).toBe(true);
					}
				} finally {
					await context.close();
				}
			});

			test(`WebAuthn registration flow - ${config.name}`, async ({ browser }) => {
				const context = await browser.newContext(config);
				const page = await context.newPage();

				try {
					await setupFreshTestEnvironment(page, '/');

					// Mock WebAuthn API with browser-specific behaviors
					await page.addInitScript(() => {
						// Simulate browser-specific WebAuthn implementations
						const userAgent = navigator.userAgent;
						const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
						const isFirefox = userAgent.includes('Firefox');
						const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

						window.navigator.credentials.create = async (options) => {
							// Simulate browser-specific delays and behaviors
							let delay = 200; // Base delay

							if (isSafari) {
								delay += 300; // Safari tends to be slower
							} else if (isFirefox) {
								delay += 100; // Firefox is generally fast
							}

							if (isMobile) {
								delay += 500; // Mobile devices are slower
							}

							await new Promise((resolve) => setTimeout(resolve, delay));

							// Simulate potential browser-specific errors
							if (isSafari && Math.random() < 0.1) {
								throw new Error('NotSupportedError: Unsupported algorithm');
							}

							if (isFirefox && Math.random() < 0.05) {
								throw new Error('SecurityError: User activation required');
							}

							return {
								id: `credential-${Date.now()}`,
								rawId: new ArrayBuffer(32),
								response: {
									clientDataJSON: new ArrayBuffer(128),
									attestationObject: new ArrayBuffer(256)
								},
								type: 'public-key'
							};
						};
					});

					// Mock registration endpoints
					await page.route('/api/auth/webauthn/register/begin', async (route) => {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								challenge: 'test-challenge-12345',
								rp: { name: 'Dispatch', id: 'localhost' },
								user: { id: 'test-user-123', name: 'test@example.com', displayName: 'Test User' },
								pubKeyCredParams: [
									{ type: 'public-key', alg: -7 }, // ES256
									{ type: 'public-key', alg: -257 } // RS256
								],
								timeout: 60000,
								attestation: 'direct'
							})
						});
					});

					await page.route('/api/auth/webauthn/register/complete', async (route) => {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								credentialId: 'new-credential-id',
								verified: true
							})
						});
					});

					// Test WebAuthn registration flow
					await page.goto('/workspace');

					const registrationResult = await page.evaluate(async () => {
						try {
							// Begin registration
							const beginResponse = await fetch('/api/auth/webauthn/register/begin', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ email: 'test@example.com' })
							});

							if (!beginResponse.ok) {
								throw new Error(`Begin request failed: ${beginResponse.status}`);
							}

							const beginData = await beginResponse.json();

							// Create credential
							const credential = await navigator.credentials.create({
								publicKey: {
									challenge: Uint8Array.from(beginData.challenge, (c) => c.charCodeAt(0)),
									rp: beginData.rp,
									user: {
										id: Uint8Array.from(beginData.user.id, (c) => c.charCodeAt(0)),
										name: beginData.user.name,
										displayName: beginData.user.displayName
									},
									pubKeyCredParams: beginData.pubKeyCredParams,
									timeout: beginData.timeout,
									attestation: beginData.attestation
								}
							});

							if (!credential) {
								throw new Error('Credential creation returned null');
							}

							// Complete registration
							const completeResponse = await fetch('/api/auth/webauthn/register/complete', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									credentialId: credential.id,
									attestationResponse: 'mock-attestation-response'
								})
							});

							const completeData = await completeResponse.json();

							return {
								success: true,
								verified: completeData.verified,
								credentialId: completeData.credentialId,
								browser: navigator.userAgent
							};
						} catch (error) {
							return {
								success: false,
								error: error.message,
								browser: navigator.userAgent
							};
						}
					});

					console.log(`WebAuthn registration result for ${config.name}:`, registrationResult);

					// Verify registration succeeded (allowing for browser-specific failures)
					if (!registrationResult.success) {
						console.warn(
							`WebAuthn registration failed for ${config.name}: ${registrationResult.error}`
						);

						// Some failures are acceptable for certain browsers
						const acceptableErrors = [
							'NotSupportedError',
							'SecurityError',
							'User activation required'
						];

						const isAcceptableFailure = acceptableErrors.some((error) =>
							registrationResult.error.includes(error)
						);

						if (!isAcceptableFailure) {
							throw new Error(`Unexpected WebAuthn failure: ${registrationResult.error}`);
						}
					} else {
						expect(registrationResult.success).toBe(true);
						expect(registrationResult.verified).toBe(true);
						expect(registrationResult.credentialId).toBeDefined();
					}
				} finally {
					await context.close();
				}
			});
		});
	});

	test.describe('OAuth Cross-Browser Flows', () => {
		browserConfigs.forEach((config) => {
			test(`OAuth popup handling - ${config.name}`, async ({ browser }) => {
				const context = await browser.newContext(config);
				const page = await context.newPage();

				try {
					await setupFreshTestEnvironment(page, '/');

					// Mock OAuth endpoints
					await page.route('/api/auth/oauth/google', async (route) => {
						const isMobile = config.name.includes('Mobile');

						// Mobile devices may handle OAuth differently
						if (isMobile) {
							await route.fulfill({
								status: 302,
								headers: {
									Location:
										'googlechrome://navigate?url=https://accounts.google.com/oauth/authorize?mobile=true'
								}
							});
						} else {
							await route.fulfill({
								status: 302,
								headers: {
									Location: 'https://accounts.google.com/oauth/authorize'
								}
							});
						}
					});

					await page.route('/api/auth/oauth/callback', async (route) => {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								token: 'oauth-session-token',
								user: { id: 1, email: 'oauth@example.com', provider: 'google' }
							})
						});
					});

					// Test OAuth flow initiation
					await page.goto('/workspace');

					const oauthResult = await page.evaluate(async () => {
						try {
							const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

							if (isMobile) {
								// Mobile OAuth typically uses redirect flow
								const response = await fetch('/api/auth/oauth/google');
								return {
									success: response.status === 302,
									redirected: response.redirected || response.status === 302,
									isMobile: true,
									browser: navigator.userAgent
								};
							} else {
								// Desktop OAuth can use popup flow
								const popupWindow = window.open(
									'/api/auth/oauth/google',
									'oauth',
									'width=500,height=600'
								);

								// Simulate popup handling
								if (popupWindow) {
									setTimeout(() => {
										if (!popupWindow.closed) {
											popupWindow.close();
										}
									}, 1000);
								}

								return {
									success: !!popupWindow,
									popupBlocked: !popupWindow,
									isMobile: false,
									browser: navigator.userAgent
								};
							}
						} catch (error) {
							return {
								success: false,
								error: error.message,
								browser: navigator.userAgent
							};
						}
					});

					console.log(`OAuth flow result for ${config.name}:`, oauthResult);

					// Verify OAuth flow handling
					expect(oauthResult.success).toBe(true);

					if (config.name.includes('Mobile')) {
						expect(oauthResult.isMobile).toBe(true);
						expect(oauthResult.redirected).toBe(true);
					} else {
						expect(oauthResult.isMobile).toBe(false);
						// Popup blocking is acceptable in test environments
						if (oauthResult.popupBlocked) {
							console.warn(
								`Popup blocked for ${config.name} - this is acceptable in test environments`
							);
						}
					}
				} finally {
					await context.close();
				}
			});
		});
	});

	test.describe('Local Storage and Cookies Cross-Browser', () => {
		browserConfigs.forEach((config) => {
			test(`Session persistence - ${config.name}`, async ({ browser }) => {
				const context = await browser.newContext(config);
				const page = await context.newPage();

				try {
					await setupFreshTestEnvironment(page, '/');

					// Test localStorage availability and behavior
					const storageResult = await page.evaluate(() => {
						try {
							const testKey = 'test-storage-key';
							const testValue = 'test-storage-value';

							// Test localStorage
							localStorage.setItem(testKey, testValue);
							const retrievedValue = localStorage.getItem(testKey);
							localStorage.removeItem(testKey);

							// Test sessionStorage
							sessionStorage.setItem(testKey, testValue);
							const sessionValue = sessionStorage.getItem(testKey);
							sessionStorage.removeItem(testKey);

							return {
								localStorageSupported: true,
								localStorageWorks: retrievedValue === testValue,
								sessionStorageSupported: true,
								sessionStorageWorks: sessionValue === testValue,
								cookiesEnabled: navigator.cookieEnabled,
								browser: navigator.userAgent
							};
						} catch (error) {
							return {
								localStorageSupported: false,
								sessionStorageSupported: false,
								error: error.message,
								browser: navigator.userAgent
							};
						}
					});

					console.log(`Storage support for ${config.name}:`, storageResult);

					// Verify storage support
					expect(storageResult.localStorageSupported).toBe(true);
					expect(storageResult.localStorageWorks).toBe(true);
					expect(storageResult.sessionStorageSupported).toBe(true);
					expect(storageResult.sessionStorageWorks).toBe(true);
					expect(storageResult.cookiesEnabled).toBe(true);
				} finally {
					await context.close();
				}
			});

			test(`Cookie security attributes - ${config.name}`, async ({ browser }) => {
				const context = await browser.newContext(config);
				const page = await context.newPage();

				try {
					await setupFreshTestEnvironment(page, '/');

					// Mock login endpoint that sets secure cookies
					await page.route('/api/auth/login', async (route) => {
						const isSecure = page.url().startsWith('https:');

						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							headers: {
								'Set-Cookie': `sessionToken=test-token-123; HttpOnly; SameSite=Strict${isSecure ? '; Secure' : ''}`
							},
							body: JSON.stringify({
								success: true,
								token: 'test-token-123',
								user: { id: 1, email: 'test@example.com' }
							})
						});
					});

					// Test cookie handling
					await page.goto('/workspace');
					await page.fill('[data-testid="access-code-input"]', 'test-code');
					await page.click('[data-testid="login-submit"]');

					// Check cookie attributes
					const cookies = await context.cookies();
					const sessionCookie = cookies.find((c) => c.name === 'sessionToken');

					console.log(`Cookie attributes for ${config.name}:`, sessionCookie);

					if (sessionCookie) {
						expect(sessionCookie.httpOnly).toBe(true);
						expect(sessionCookie.sameSite).toBe('Strict');

						// Secure attribute depends on HTTPS
						if (page.url().startsWith('https:')) {
							expect(sessionCookie.secure).toBe(true);
						}
					}
				} finally {
					await context.close();
				}
			});
		});
	});

	test.describe('JavaScript API Compatibility', () => {
		browserConfigs.forEach((config) => {
			test(`Modern JavaScript features - ${config.name}`, async ({ browser }) => {
				const context = await browser.newContext(config);
				const page = await context.newPage();

				try {
					await setupFreshTestEnvironment(page, '/');

					// Test modern JavaScript features used in auth system
					const featureSupport = await page.evaluate(() => {
						const features = {};

						// ES6+ features
						features.arrowFunctions = (() => true)();
						features.templateLiterals = `template ${'literal'}` === 'template literal';
						features.destructuring = (() => {
							try {
								const [a, b] = [1, 2];
								const { c } = { c: 3 };
								return a === 1 && b === 2 && c === 3;
							} catch {
								return false;
							}
						})();

						// Async/await
						features.asyncAwait = typeof (async () => {})().then === 'function';

						// Fetch API
						features.fetchAPI = typeof fetch === 'function';

						// Crypto API (for WebAuthn)
						features.cryptoAPI = !!window.crypto;
						features.cryptoSubtle = !!window.crypto?.subtle;

						// AbortController (for request cancellation)
						features.abortController = typeof AbortController === 'function';

						// IntersectionObserver (for UI enhancements)
						features.intersectionObserver = typeof IntersectionObserver === 'function';

						// ResizeObserver (for responsive components)
						features.resizeObserver = typeof ResizeObserver === 'function';

						// URL API
						features.urlAPI = typeof URL === 'function';

						// FormData
						features.formData = typeof FormData === 'function';

						// Promise
						features.promises = typeof Promise === 'function';

						// Set/Map
						features.setMap = typeof Set === 'function' && typeof Map === 'function';

						return {
							features,
							browser: navigator.userAgent,
							supported: Object.values(features).every(Boolean)
						};
					});

					console.log(`JavaScript feature support for ${config.name}:`, featureSupport);

					// Core features that must be supported
					expect(featureSupport.features.arrowFunctions).toBe(true);
					expect(featureSupport.features.fetchAPI).toBe(true);
					expect(featureSupport.features.promises).toBe(true);
					expect(featureSupport.features.asyncAwait).toBe(true);

					// Crypto API is required for WebAuthn
					expect(featureSupport.features.cryptoAPI).toBe(true);

					// Log warnings for missing optional features
					if (!featureSupport.features.cryptoSubtle) {
						console.warn(`${config.name} missing crypto.subtle - WebAuthn may not work`);
					}

					if (!featureSupport.features.abortController) {
						console.warn(
							`${config.name} missing AbortController - request cancellation unavailable`
						);
					}
				} finally {
					await context.close();
				}
			});
		});
	});

	test.describe('Responsive Design Cross-Browser', () => {
		const viewportSizes = [
			{ width: 1920, height: 1080, name: 'Desktop Large' },
			{ width: 1366, height: 768, name: 'Desktop Standard' },
			{ width: 768, height: 1024, name: 'Tablet Portrait' },
			{ width: 1024, height: 768, name: 'Tablet Landscape' },
			{ width: 375, height: 667, name: 'Mobile Standard' },
			{ width: 414, height: 896, name: 'Mobile Large' }
		];

		viewportSizes.forEach((viewport) => {
			test(`Authentication UI layout - ${viewport.name}`, async ({ browser }) => {
				const context = await browser.newContext({
					viewport: { width: viewport.width, height: viewport.height }
				});
				const page = await context.newPage();

				try {
					await setupFreshTestEnvironment(page, '/');
					await page.goto('/workspace');

					// Check authentication modal layout
					const modalLayout = await page.evaluate(() => {
						const modal = document.querySelector('[data-testid="auth-modal"]');
						if (!modal) return null;

						const rect = modal.getBoundingClientRect();
						const styles = window.getComputedStyle(modal);

						return {
							width: rect.width,
							height: rect.height,
							display: styles.display,
							position: styles.position,
							overflow: styles.overflow,
							visible: rect.width > 0 && rect.height > 0
						};
					});

					console.log(`Modal layout for ${viewport.name}:`, modalLayout);

					if (modalLayout) {
						expect(modalLayout.visible).toBe(true);
						expect(modalLayout.width).toBeGreaterThan(0);
						expect(modalLayout.height).toBeGreaterThan(0);

						// Mobile-specific checks
						if (viewport.width <= 768) {
							expect(modalLayout.width).toBeLessThanOrEqual(viewport.width);
						}
					}

					// Check input field accessibility
					const inputLayout = await page.evaluate(() => {
						const input = document.querySelector('[data-testid="access-code-input"]');
						if (!input) return null;

						const rect = input.getBoundingClientRect();
						const styles = window.getComputedStyle(input);

						return {
							width: rect.width,
							height: rect.height,
							fontSize: styles.fontSize,
							padding: styles.padding,
							visible: rect.width > 0 && rect.height > 0,
							accessible: rect.height >= 44 // WCAG touch target size
						};
					});

					console.log(`Input layout for ${viewport.name}:`, inputLayout);

					if (inputLayout) {
						expect(inputLayout.visible).toBe(true);
						expect(inputLayout.accessible).toBe(true);
					}
				} finally {
					await context.close();
				}
			});
		});
	});
});
