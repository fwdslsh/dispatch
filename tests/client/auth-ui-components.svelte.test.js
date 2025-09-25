import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

import OAuthLoginButton from '../../src/lib/client/shared/components/OAuthLoginButton.svelte';
import WebAuthnButton from '../../src/lib/client/shared/components/WebAuthnButton.svelte';

// Mock window.location for OAuth tests
const mockLocation = {
	href: '',
	assign: vi.fn(),
	replace: vi.fn(),
	reload: vi.fn()
};

// Mock fetch for API calls
const mockFetch = vi.fn();

// Mock WebAuthn API for WebAuthn tests
const mockCredentials = {
	create: vi.fn(),
	get: vi.fn()
};

const mockPublicKeyCredential = {
	isUserVerifyingPlatformAuthenticatorAvailable: vi.fn()
};

describe('OAuth Login Button Component', () => {
	beforeEach(() => {
		// Reset mocks
		mockLocation.href = '';
		vi.stubGlobal('fetch', mockFetch);
		vi.stubGlobal('location', mockLocation);
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('Rendering and Props', () => {
		it('renders Google OAuth button with correct styling', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			const button = container.querySelector('.oauth-button');
			expect(button).toBeTruthy();
			expect(button.getAttribute('title')).toBe('Continue with Google');
			expect(button.getAttribute('aria-label')).toBe('Continue with Google');

			const icon = container.querySelector('.provider-icon');
			expect(icon.textContent).toBe('🔍');

			const text = container.querySelector('.provider-text');
			expect(text.textContent).toBe('Continue with Google');
		});

		it('renders GitHub OAuth button with correct styling', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'github'
			});

			const button = container.querySelector('.oauth-button');
			expect(button).toBeTruthy();
			expect(button.getAttribute('title')).toBe('Continue with GitHub');

			const icon = container.querySelector('.provider-icon');
			expect(icon.textContent).toBe('🐙');

			const text = container.querySelector('.provider-text');
			expect(text.textContent).toBe('Continue with GitHub');
		});

		it('renders unknown provider with default fallback', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'unknown'
			});

			const icon = container.querySelector('.provider-icon');
			expect(icon.textContent).toBe('🌐');

			const text = container.querySelector('.provider-text');
			expect(text.textContent).toBe('Continue with OAuth');
		});

		it('disables button when disabled prop is true', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google',
				disabled: true
			});

			const button = container.querySelector('.oauth-button');
			expect(button.disabled).toBe(true);
			expect(button.classList.contains('disabled')).toBe(true);
		});
	});

	describe('OAuth Authentication Flow', () => {
		it('redirects to OAuth URL on button click', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google',
				returnTo: '/dashboard'
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.click(button);

			await tick();

			expect(mockLocation.href).toBe(
				'/api/auth/google?returnTo=%2Fdashboard'
			);
		});

		it('uses default returnTo when not provided', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'github'
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.click(button);

			await tick();

			expect(mockLocation.href).toBe('/api/auth/github?returnTo=%2F');
		});

		it('does not redirect when button is disabled', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google',
				disabled: true
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.click(button);

			await tick();

			expect(mockLocation.href).toBe('');
		});

		it('shows loading state during authentication', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			const button = container.querySelector('.oauth-button');

			// Start authentication
			fireEvent.click(button);
			await tick();

			// Should show loading spinner
			const spinner = container.querySelector('svg'); // LoadingSpinner renders as SVG
			expect(spinner).toBeTruthy();
			expect(button.classList.contains('loading')).toBe(true);
		});
	});

	describe('Keyboard Accessibility', () => {
		it('triggers authentication on Enter key', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.keyDown(button, { key: 'Enter' });

			await tick();

			expect(mockLocation.href).toBe('/api/auth/google?returnTo=%2F');
		});

		it('triggers authentication on Space key', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'github'
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.keyDown(button, { key: ' ' });

			await tick();

			expect(mockLocation.href).toBe('/api/auth/github?returnTo=%2F');
		});

		it('does not trigger on other keys', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.keyDown(button, { key: 'Tab' });

			await tick();

			expect(mockLocation.href).toBe('');
		});
	});

	describe('Error Handling', () => {
		it('displays error when authentication fails', async () => {
			// Mock a failed authentication attempt by simulating an exception
			const originalLocation = global.location;
			Object.defineProperty(global, 'location', {
				value: {
					get href() {
						throw new Error('Network error');
					},
					set href(value) {
						throw new Error('Network error');
					}
				},
				writable: true
			});

			let errorEvent = null;
			const { container, component } = render(OAuthLoginButton, {
				provider: 'google'
			});

			component.$on('error', (event) => {
				errorEvent = event.detail;
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.click(button);

			await tick();

			// Restore original location
			Object.defineProperty(global, 'location', {
				value: originalLocation,
				writable: true
			});

			expect(errorEvent).toBeTruthy();
			expect(errorEvent.error).toBe('Network error');
			expect(errorEvent.provider).toBe('google');

			// Should show error message
			const errorMessage = container.querySelector('.error-message');
			expect(errorMessage).toBeTruthy();
			expect(errorMessage.textContent).toContain('Network error');
		});
	});

	describe('Event Dispatching', () => {
		it('dispatches error event with correct data', async () => {
			let errorEvent = null;
			const { container, component } = render(OAuthLoginButton, {
				provider: 'github'
			});

			component.$on('error', (event) => {
				errorEvent = event.detail;
			});

			// Simulate error by mocking location.href setter to throw
			Object.defineProperty(mockLocation, 'href', {
				set() {
					throw new Error('Test error');
				}
			});

			const button = container.querySelector('.oauth-button');
			await fireEvent.click(button);

			await tick();

			expect(errorEvent).toEqual({
				error: 'Test error',
				provider: 'github'
			});
		});
	});
});

describe('WebAuthn Button Component', () => {
	beforeEach(() => {
		// Mock WebAuthn APIs
		vi.stubGlobal('navigator', {
			credentials: mockCredentials
		});
		vi.stubGlobal('PublicKeyCredential', mockPublicKeyCredential);
		mockFetch.mockClear();
		mockCredentials.create.mockClear();
		mockCredentials.get.mockClear();
		mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable.mockResolvedValue(true);
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('Browser Support Detection', () => {
		it('detects WebAuthn support correctly', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'authenticate'
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(false);

			const warning = container.querySelector('.warning');
			expect(warning).toBeFalsy();
		});

		it('shows warning when WebAuthn is not supported', () => {
			vi.stubGlobal('PublicKeyCredential', undefined);

			const { container } = render(WebAuthnButton, {
				mode: 'authenticate'
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(true);

			const warning = container.querySelector('.warning');
			expect(warning).toBeTruthy();
			expect(warning.textContent).toContain('WebAuthn not supported');
		});
	});

	describe('Authentication Mode', () => {
		it('renders authenticate button correctly', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'authenticate'
			});

			const buttonText = container.textContent;
			expect(buttonText).toContain('Sign in with Passkey');
		});

		it('renders register button correctly', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'register',
				userId: 'test-user'
			});

			const buttonText = container.textContent;
			expect(buttonText).toContain('Register Passkey');
		});

		it('disables button when disabled prop is true', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'authenticate',
				disabled: true
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(true);
		});
	});

	describe('WebAuthn Registration Flow', () => {
		beforeEach(() => {
			// Mock successful registration API responses
			mockFetch
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						sessionId: 'test-session',
						challenge: {
							challenge: btoa('test-challenge'),
							user: {
								id: btoa('test-user'),
								name: 'test@example.com',
								displayName: 'Test User'
							},
							excludeCredentials: []
						}
					})
				})
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						message: 'Registration successful',
						credentialId: 'test-credential-id'
					})
				});

			// Mock successful credential creation
			mockCredentials.create.mockResolvedValue({
				id: 'test-credential-id',
				rawId: new ArrayBuffer(8),
				type: 'public-key',
				response: {
					clientDataJSON: new ArrayBuffer(8),
					attestationObject: new ArrayBuffer(8)
				}
			});
		});

		it('handles successful WebAuthn registration', async () => {
			let successEvent = null;
			const { container, component } = render(WebAuthnButton, {
				mode: 'register',
				userId: 'test-user',
				deviceName: 'Test Device'
			});

			component.$on('success', (event) => {
				successEvent = event.detail;
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledTimes(2);
			});

			// Verify registration begin call
			expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/webauthn/register/begin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: 'test-user',
					deviceName: 'Test Device'
				})
			});

			// Verify credentials.create was called
			expect(mockCredentials.create).toHaveBeenCalledWith({
				publicKey: expect.objectContaining({
					challenge: expect.any(Uint8Array),
					user: expect.objectContaining({
						id: expect.any(Uint8Array)
					})
				})
			});

			// Verify registration complete call
			expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/webauthn/register/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: expect.stringContaining('sessionId')
			});

			// Verify success event
			await waitFor(() => {
				expect(successEvent).toEqual({
					type: 'register',
					message: 'Registration successful',
					credentialId: 'test-credential-id'
				});
			});
		});

		it('requires userId for registration', async () => {
			const { container } = render(WebAuthnButton, {
				mode: 'register'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			await tick();

			const error = container.querySelector('.error');
			expect(error).toBeTruthy();
			expect(error.textContent).toContain('User ID required for registration');
		});

		it('handles registration API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: false,
					error: 'Registration failed',
					details: 'Invalid user ID'
				})
			});

			const { container } = render(WebAuthnButton, {
				mode: 'register',
				userId: 'invalid-user'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			await waitFor(() => {
				const error = container.querySelector('.error');
				expect(error).toBeTruthy();
				expect(error.textContent).toContain('Invalid user ID');
			});
		});
	});

	describe('WebAuthn Authentication Flow', () => {
		beforeEach(() => {
			// Mock successful authentication API responses
			mockFetch
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						sessionId: 'auth-session',
						challenge: {
							challenge: btoa('auth-challenge'),
							allowCredentials: [{
								id: btoa('test-credential'),
								type: 'public-key'
							}]
						}
					})
				})
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						user: {
							id: 'test-user',
							email: 'test@example.com'
						}
					})
				});

			// Mock successful credential get
			mockCredentials.get.mockResolvedValue({
				id: 'test-credential',
				rawId: new ArrayBuffer(8),
				type: 'public-key',
				response: {
					clientDataJSON: new ArrayBuffer(8),
					authenticatorData: new ArrayBuffer(8),
					signature: new ArrayBuffer(8),
					userHandle: new ArrayBuffer(8)
				}
			});
		});

		it('handles successful WebAuthn authentication', async () => {
			let successEvent = null;
			const { container, component } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			component.$on('success', (event) => {
				successEvent = event.detail;
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledTimes(2);
			});

			// Verify authentication begin call
			expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/webauthn/authenticate/begin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: 'test@example.com' })
			});

			// Verify credentials.get was called
			expect(mockCredentials.get).toHaveBeenCalledWith({
				publicKey: expect.objectContaining({
					challenge: expect.any(Uint8Array),
					allowCredentials: expect.arrayContaining([
						expect.objectContaining({
							id: expect.any(Uint8Array)
						})
					])
				})
			});

			// Verify success event
			await waitFor(() => {
				expect(successEvent).toEqual({
					type: 'authenticate',
					user: {
						id: 'test-user',
						email: 'test@example.com'
					},
					authMethod: 'webauthn'
				});
			});
		});

		it('handles authentication failures', async () => {
			mockCredentials.get.mockResolvedValue(null);

			const { container } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			await waitFor(() => {
				const error = container.querySelector('.error');
				expect(error).toBeTruthy();
				expect(error.textContent).toContain('Failed to get credential');
			});
		});
	});

	describe('Loading States', () => {
		it('shows loading spinner during WebAuthn operation', async () => {
			// Mock slow API response
			mockFetch.mockImplementation(() => new Promise(resolve => {
				setTimeout(() => resolve({
					json: () => Promise.resolve({ success: false, error: 'timeout' })
				}), 100);
			}));

			const { container } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			const button = container.querySelector('button');
			fireEvent.click(button);

			await tick();

			// Should show loading spinner
			const spinner = container.querySelector('svg');
			expect(spinner).toBeTruthy();
			expect(button.disabled).toBe(true);

			// Wait for operation to complete
			await waitFor(() => {
				const error = container.querySelector('.error');
				expect(error).toBeTruthy();
			});
		});
	});

	describe('Error Handling', () => {
		it('dispatches error events correctly', async () => {
			let errorEvent = null;
			const { container, component } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			component.$on('error', (event) => {
				errorEvent = event.detail;
			});

			mockFetch.mockRejectedValue(new Error('Network error'));

			const button = container.querySelector('button');
			await fireEvent.click(button);

			await waitFor(() => {
				expect(errorEvent).toEqual({
					error: 'Network error'
				});
			});
		});

		it('handles credential creation failures', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					sessionId: 'test-session',
					challenge: {
						challenge: btoa('test-challenge'),
						user: { id: btoa('test-user') }
					}
				})
			});

			mockCredentials.create.mockResolvedValue(null);

			const { container } = render(WebAuthnButton, {
				mode: 'register',
				userId: 'test-user'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			await waitFor(() => {
				const error = container.querySelector('.error');
				expect(error).toBeTruthy();
				expect(error.textContent).toContain('Failed to create credential');
			});
		});
	});
});