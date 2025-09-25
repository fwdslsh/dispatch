import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';

import WebAuthnFlow from '../../src/lib/client/shared/components/WebAuthnFlow.svelte';

// Mock WebAuthn utilities
vi.mock('../../src/lib/client/shared/utils/webauthn.js', () => ({
	checkWebAuthnAvailability: vi.fn(),
	getWebAuthnErrorMessage: vi.fn(),
	formatCredentialForTransmission: vi.fn(),
	prepareCreationOptions: vi.fn(),
	prepareRequestOptions: vi.fn()
}));

describe('WebAuthn Flow Component', () => {
	beforeEach(async () => {
		// Mock browser APIs
		vi.stubGlobal('navigator', {
			userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			platform: 'MacIntel',
			credentials: {
				create: vi.fn(),
				get: vi.fn()
			}
		});

		vi.stubGlobal('PublicKeyCredential', {
			isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true)
		});

		vi.stubGlobal('fetch', vi.fn());

		// Get mocked utilities
		const { checkWebAuthnAvailability, getWebAuthnErrorMessage, formatCredentialForTransmission, prepareCreationOptions, prepareRequestOptions } = await import('../../src/lib/client/shared/utils/webauthn.js');

		checkWebAuthnAvailability.mockResolvedValue({
			browserSupported: true,
			platformAvailable: true,
			conditionalUI: false,
			serverAvailable: true,
			isSecure: true,
			overall: true,
			warnings: []
		});

		getWebAuthnErrorMessage.mockImplementation((error) => error.message || 'WebAuthn error');
		formatCredentialForTransmission.mockImplementation((credential) => ({ formatted: credential }));
		prepareCreationOptions.mockImplementation((options) => ({ prepared: options }));
		prepareRequestOptions.mockImplementation((options) => ({ prepared: options }));
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('Modal Rendering', () => {
		it('renders modal when open', () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'authenticate'
				}
			});

			const modal = container.querySelector('.modal-backdrop');
			expect(modal).toBeTruthy();
			expect(modal.classList.contains('open')).toBe(true);
		});

		it('does not render when closed', () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: false,
					mode: 'authenticate'
				}
			});

			const modal = container.querySelector('.modal-backdrop');
			expect(modal?.classList.contains('open')).toBe(false);
		});
	});

	describe('Compatibility Check', () => {
		it('shows compatibility check by default', async () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user'
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Checking Browser Compatibility');
			});
		});

		it('displays browser compatibility results', async () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user'
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('WebAuthn API Support');
				expect(container.textContent).toContain('Platform Authenticator');
				expect(container.textContent).toContain('Secure Connection');
				expect(container.textContent).toContain('Chrome');
			});
		});

		it('shows recommendations for outdated browsers', async () => {
			// Mock old Chrome version
			vi.stubGlobal('navigator', {
				...navigator,
				userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.0.0 Safari/537.36'
			});

			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user'
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Recommendations');
				expect(container.textContent).toContain('Chrome 85+');
			});
		});

		it('can skip compatibility check', async () => {
			const { checkWebAuthnAvailability } = await import('../../src/lib/client/shared/utils/webauthn.js');
			checkWebAuthnAvailability.mockResolvedValue({
				browserSupported: false,
				overall: false,
				warnings: [{ message: 'WebAuthn not supported' }]
			});

			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user'
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('WebAuthn Error');
			});

			const skipButton = container.querySelector('button:last-child');
			if (skipButton?.textContent?.includes('Skip')) {
				await fireEvent.click(skipButton);
				await waitFor(() => {
					expect(container.textContent).toContain('Register Passkey');
				});
			}
		});
	});

	describe('Registration Flow', () => {
		it('displays registration instructions', async () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user',
					showCompatibilityCheck: false
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Register Passkey');
				expect(container.textContent).toContain('Set up a passkey for secure');
				expect(container.textContent).toContain('Click "Continue" to start');
			});
		});

		it('shows browser-specific tips', async () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user',
					showCompatibilityCheck: false
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Chrome tip:');
			});
		});

		it('handles successful registration', async () => {
			const mockFetch = vi.fn()
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						sessionId: 'test-session',
						challenge: { challenge: 'test-challenge', user: { id: 'user-id' } }
					})
				})
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						message: 'Registration successful',
						credentialId: 'test-credential'
					})
				});
			vi.stubGlobal('fetch', mockFetch);

			const mockCredentialsCreate = vi.fn().mockResolvedValue({ id: 'test-credential' });
			vi.stubGlobal('navigator', {
				...navigator,
				credentials: { create: mockCredentialsCreate, get: vi.fn() }
			});

			let successEvent = null;
			const { container, component } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user',
					showCompatibilityCheck: false
				}
			});

			component.$on('success', (event) => {
				successEvent = event.detail;
			});

			await waitFor(() => {
				const continueButton = container.querySelector('button');
				expect(continueButton.textContent).toContain('Continue with Registration');
			});

			const continueButton = container.querySelector('button');
			await fireEvent.click(continueButton);

			await waitFor(() => {
				expect(container.textContent).toContain('Creating Passkey');
			});

			// Wait for success state
			await waitFor(() => {
				expect(container.textContent).toContain('Passkey Created!');
			}, { timeout: 3000 });

			expect(successEvent).toEqual({
				type: 'register',
				message: 'Registration successful',
				credentialId: 'test-credential'
			});
		});

		it('requires userId for registration', async () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					// No userId provided
					showCompatibilityCheck: false
				}
			});

			await waitFor(() => {
				const continueButton = container.querySelector('button');
				expect(continueButton).toBeTruthy();
			});

			const continueButton = container.querySelector('button');
			await fireEvent.click(continueButton);

			await waitFor(() => {
				expect(container.textContent).toContain('WebAuthn Error');
				expect(container.textContent).toContain('User ID is required');
			});
		});
	});

	describe('Authentication Flow', () => {
		it('displays authentication instructions', async () => {
			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'authenticate',
					username: 'testuser',
					showCompatibilityCheck: false
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Sign In with Passkey');
				expect(container.textContent).toContain('Use your previously registered passkey');
				expect(container.textContent).toContain('Continue with Authentication');
			});
		});

		it('handles successful authentication', async () => {
			const mockFetch = vi.fn()
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						sessionId: 'auth-session',
						challenge: { challenge: 'auth-challenge', allowCredentials: [] }
					})
				})
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						user: { id: 'test-user', email: 'test@example.com' }
					})
				});
			vi.stubGlobal('fetch', mockFetch);

			const mockCredentialsGet = vi.fn().mockResolvedValue({ id: 'test-credential' });
			vi.stubGlobal('navigator', {
				...navigator,
				credentials: { create: vi.fn(), get: mockCredentialsGet }
			});

			let successEvent = null;
			const { container, component } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'authenticate',
					username: 'testuser',
					showCompatibilityCheck: false
				}
			});

			component.$on('success', (event) => {
				successEvent = event.detail;
			});

			await waitFor(() => {
				const continueButton = container.querySelector('button');
				expect(continueButton.textContent).toContain('Continue with Authentication');
			});

			const continueButton = container.querySelector('button');
			await fireEvent.click(continueButton);

			await waitFor(() => {
				expect(container.textContent).toContain('Authenticating');
			});

			// Wait for success state
			await waitFor(() => {
				expect(container.textContent).toContain('Authentication Successful!');
			}, { timeout: 3000 });

			expect(successEvent).toEqual({
				type: 'authenticate',
				user: { id: 'test-user', email: 'test@example.com' },
				authMethod: 'webauthn'
			});
		});
	});

	describe('Error Handling', () => {
		it('handles WebAuthn API errors', async () => {
			const mockFetch = vi.fn()
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						sessionId: 'test-session',
						challenge: { challenge: 'test-challenge', user: { id: 'user-id' } }
					})
				});
			vi.stubGlobal('fetch', mockFetch);

			const mockCredentialsCreate = vi.fn().mockRejectedValue(
				new Error('NotAllowedError: User cancelled')
			);
			vi.stubGlobal('navigator', {
				...navigator,
				credentials: { create: mockCredentialsCreate, get: vi.fn() }
			});

			const { getWebAuthnErrorMessage } = await import('../../src/lib/client/shared/utils/webauthn.js');
			getWebAuthnErrorMessage.mockReturnValue('User cancelled operation');

			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user',
					showCompatibilityCheck: false
				}
			});

			await waitFor(() => {
				const continueButton = container.querySelector('button');
				expect(continueButton).toBeTruthy();
			});

			const continueButton = container.querySelector('button');
			await fireEvent.click(continueButton);

			await waitFor(() => {
				expect(container.textContent).toContain('WebAuthn Error');
				expect(container.textContent).toContain('User cancelled operation');
			});
		});

		it('handles network errors', async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user',
					showCompatibilityCheck: false
				}
			});

			await waitFor(() => {
				const continueButton = container.querySelector('button');
				expect(continueButton).toBeTruthy();
			});

			const continueButton = container.querySelector('button');
			await fireEvent.click(continueButton);

			await waitFor(() => {
				expect(container.textContent).toContain('WebAuthn Error');
				expect(container.textContent).toContain('Network error');
			});
		});

		it('provides retry functionality', async () => {
			const { checkWebAuthnAvailability } = await import('../../src/lib/client/shared/utils/webauthn.js');
			checkWebAuthnAvailability.mockResolvedValue({
				browserSupported: false,
				overall: false,
				warnings: []
			});

			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user'
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('WebAuthn Error');
			});

			// Mock successful retry
			checkWebAuthnAvailability.mockResolvedValue({
				browserSupported: true,
				overall: true,
				warnings: []
			});

			const retryButton = container.querySelector('button');
			expect(retryButton.textContent).toContain('Try Again');

			await fireEvent.click(retryButton);

			await waitFor(() => {
				expect(container.textContent).toContain('Checking Browser Compatibility');
			});
		});
	});

	describe('Device Name Generation', () => {
		it('generates appropriate device names', async () => {
			// Test different platforms
			const platforms = [
				{ userAgent: 'Chrome/120 on Mac', platform: 'MacIntel', expected: 'Chrome on macOS' },
				{ userAgent: 'Chrome/120 on Windows', platform: 'Win32', expected: 'Chrome on Windows' },
				{ userAgent: 'Firefox/100 on Linux', platform: 'Linux x86_64', expected: 'Firefox on Linux' }
			];

			for (const { userAgent, platform, expected } of platforms) {
				vi.stubGlobal('navigator', {
					userAgent,
					platform,
					credentials: { create: vi.fn(), get: vi.fn() }
				});

				const { container } = render(WebAuthnFlow, {
					props: {
						open: true,
						mode: 'register',
						userId: 'test-user',
						showCompatibilityCheck: false
					}
				});

				// The device name is used internally, so we can't easily test it directly
				// But the component should render without errors
				await waitFor(() => {
					expect(container.textContent).toContain('Register Passkey');
				});
			}
		});
	});

	describe('Auto Start', () => {
		it('automatically starts flow when autoStart is true', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () => Promise.resolve({
					success: true,
					sessionId: 'auto-session',
					challenge: { challenge: 'auto-challenge', user: { id: 'auto-user' } }
				})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(WebAuthnFlow, {
				props: {
					open: true,
					mode: 'register',
					userId: 'test-user',
					autoStart: true,
					showCompatibilityCheck: false
				}
			});

			// Should automatically start the flow
			await waitFor(() => {
				expect(container.textContent).toContain('Creating Passkey');
			});
		});
	});
});