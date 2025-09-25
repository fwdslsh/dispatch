import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

import OAuthLoginButton from '../../src/lib/client/shared/components/OAuthLoginButton.svelte';
import WebAuthnButton from '../../src/lib/client/shared/components/WebAuthnButton.svelte';

// Mock fetch for API calls
const mockFetch = vi.fn();

describe('Authentication UI Components - Simplified Tests', () => {
	beforeEach(() => {
		// Reset mocks
		vi.stubGlobal('fetch', mockFetch);

		// Mock basic WebAuthn API
		vi.stubGlobal('navigator', {
			credentials: {
				create: vi.fn(),
				get: vi.fn()
			}
		});

		vi.stubGlobal('PublicKeyCredential', {
			isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true)
		});

		// Mock window.location
		Object.defineProperty(window, 'location', {
			value: {
				href: '',
				protocol: 'https:',
				hostname: 'localhost'
			},
			writable: true
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('OAuth Login Button', () => {
		it('renders Google OAuth button correctly', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			// Should have button with correct aria-label
			const button = container.querySelector('button');
			expect(button).toBeTruthy();
			expect(button.getAttribute('aria-label')).toBe('Continue with Google');

			// Should show Google icon and text
			expect(container.textContent).toContain('Continue with Google');
			expect(container.textContent).toContain('🔍');
		});

		it('renders GitHub OAuth button correctly', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'github'
			});

			const button = container.querySelector('button');
			expect(button.getAttribute('aria-label')).toBe('Continue with GitHub');
			expect(container.textContent).toContain('Continue with GitHub');
			expect(container.textContent).toContain('🐙');
		});

		it('handles unknown provider with fallback', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'unknown'
			});

			expect(container.textContent).toContain('Continue with OAuth');
			expect(container.textContent).toContain('🌐');
		});

		it('disables button when disabled prop is true', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google',
				disabled: true
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(true);
		});

		it('has proper accessibility attributes', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			const button = container.querySelector('button');
			expect(button.getAttribute('title')).toBe('Continue with Google');
			expect(button.getAttribute('aria-label')).toBe('Continue with Google');

			// Icon should be aria-hidden
			const icon = container.querySelector('.provider-icon');
			expect(icon.getAttribute('aria-hidden')).toBe('true');
		});

		it('redirects to OAuth URL on click', async () => {
			// Mock window.location.href setter
			let redirectUrl = '';
			Object.defineProperty(window.location, 'href', {
				set: (url) => { redirectUrl = url; },
				get: () => redirectUrl
			});

			const { container } = render(OAuthLoginButton, {
				provider: 'google',
				returnTo: '/dashboard'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);
			await tick();

			expect(redirectUrl).toBe('/api/auth/google?returnTo=%2Fdashboard');
		});

		it('uses default returnTo when not provided', async () => {
			let redirectUrl = '';
			Object.defineProperty(window.location, 'href', {
				set: (url) => { redirectUrl = url; },
				get: () => redirectUrl
			});

			const { container } = render(OAuthLoginButton, {
				provider: 'github'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);
			await tick();

			expect(redirectUrl).toBe('/api/auth/github?returnTo=%2F');
		});
	});

	describe('WebAuthn Button', () => {
		it('renders authenticate mode correctly', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'authenticate'
			});

			expect(container.textContent).toContain('Sign in with Passkey');
			expect(container.textContent).toContain('🔐');
		});

		it('renders register mode correctly', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'register',
				userId: 'test-user'
			});

			expect(container.textContent).toContain('Register Passkey');
		});

		it('shows WebAuthn supported state', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'authenticate'
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(false);
		});

		it('disables button when WebAuthn is not supported', () => {
			// Mock WebAuthn as not supported
			vi.stubGlobal('PublicKeyCredential', undefined);

			const { container } = render(WebAuthnButton, {
				mode: 'authenticate'
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(true);
			expect(container.textContent).toContain('WebAuthn not supported');
		});

		it('disables button when disabled prop is true', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'authenticate',
				disabled: true
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(true);
		});

		it('shows loading state during operation', async () => {
			// Mock slow API response
			mockFetch.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					json: () => Promise.resolve({ success: false })
				}), 100))
			);

			const { container } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			const button = container.querySelector('button');
			fireEvent.click(button);

			await tick();

			// Should show loading spinner (component uses LoadingSpinner)
			const spinner = container.querySelector('svg');
			expect(spinner).toBeTruthy();
		});

		it('handles registration without userId', async () => {
			const { container } = render(WebAuthnButton, {
				mode: 'register'
				// No userId provided
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);
			await tick();

			// Should show error
			const error = container.querySelector('.error');
			expect(error).toBeTruthy();
			expect(error.textContent).toContain('User ID required for registration');
		});

		it('calls WebAuthn APIs for registration', async () => {
			const mockCredentialsCreate = vi.fn().mockResolvedValue({
				id: 'test-credential',
				rawId: new ArrayBuffer(8),
				type: 'public-key',
				response: {
					clientDataJSON: new ArrayBuffer(8),
					attestationObject: new ArrayBuffer(8)
				}
			});

			vi.stubGlobal('navigator', {
				credentials: {
					create: mockCredentialsCreate,
					get: vi.fn()
				}
			});

			// Mock API responses
			mockFetch
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						sessionId: 'test-session',
						challenge: {
							challenge: btoa('test-challenge'),
							user: {
								id: btoa('test-user'),
								name: 'test@example.com'
							}
						}
					})
				})
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						message: 'Registration successful'
					})
				});

			const { container } = render(WebAuthnButton, {
				mode: 'register',
				userId: 'test-user',
				deviceName: 'Test Device'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			// Wait for async operations
			await new Promise(resolve => setTimeout(resolve, 100));

			// Should have called credentials.create
			expect(mockCredentialsCreate).toHaveBeenCalled();

			// Should have made API calls
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('calls WebAuthn APIs for authentication', async () => {
			const mockCredentialsGet = vi.fn().mockResolvedValue({
				id: 'test-credential',
				rawId: new ArrayBuffer(8),
				type: 'public-key',
				response: {
					clientDataJSON: new ArrayBuffer(8),
					authenticatorData: new ArrayBuffer(8),
					signature: new ArrayBuffer(8)
				}
			});

			vi.stubGlobal('navigator', {
				credentials: {
					create: vi.fn(),
					get: mockCredentialsGet
				}
			});

			// Mock API responses
			mockFetch
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						sessionId: 'auth-session',
						challenge: {
							challenge: btoa('auth-challenge'),
							allowCredentials: []
						}
					})
				})
				.mockResolvedValueOnce({
					json: () => Promise.resolve({
						success: true,
						user: { id: 'test-user' }
					})
				});

			const { container } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			// Wait for async operations
			await new Promise(resolve => setTimeout(resolve, 100));

			// Should have called credentials.get
			expect(mockCredentialsGet).toHaveBeenCalled();

			// Should have made API calls
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('handles API errors gracefully', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const { container } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			const button = container.querySelector('button');
			await fireEvent.click(button);

			// Wait for error to appear
			await new Promise(resolve => setTimeout(resolve, 100));

			const error = container.querySelector('.error');
			expect(error).toBeTruthy();
			expect(error.textContent).toContain('Network error');
		});
	});

	describe('Component Integration', () => {
		it('OAuth button maintains proper CSS classes', () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			const button = container.querySelector('.oauth-button');
			expect(button).toBeTruthy();
			expect(button.classList.contains('oauth-button')).toBe(true);
		});

		it('WebAuthn button integrates with Button component', () => {
			const { container } = render(WebAuthnButton, {
				mode: 'authenticate'
			});

			// Should render Button component with proper classes
			const button = container.querySelector('button');
			expect(button.classList.contains('button')).toBe(true);
		});

		it('components handle keyboard navigation', async () => {
			const { container } = render(OAuthLoginButton, {
				provider: 'google'
			});

			const button = container.querySelector('button');

			// Should be focusable
			button.focus();
			expect(document.activeElement).toBe(button);

			// Should handle Enter key
			await fireEvent.keyDown(button, { key: 'Enter' });
			// Note: Can't easily test the redirect in unit tests

			// Should handle Space key
			await fireEvent.keyDown(button, { key: ' ' });

			// Should ignore other keys
			let redirectUrl = '';
			Object.defineProperty(window.location, 'href', {
				set: (url) => { redirectUrl = url; },
				get: () => redirectUrl
			});

			await fireEvent.keyDown(button, { key: 'Tab' });
			expect(redirectUrl).toBe('');
		});

		it('components display error states correctly', async () => {
			// Test OAuth error state
			const { container: oauthContainer } = render(OAuthLoginButton, {
				provider: 'google'
			});

			// Mock location.href to throw error
			Object.defineProperty(window.location, 'href', {
				set: () => { throw new Error('Test error'); }
			});

			const oauthButton = oauthContainer.querySelector('button');
			await fireEvent.click(oauthButton);
			await tick();

			const oauthError = oauthContainer.querySelector('.error-message');
			expect(oauthError).toBeTruthy();

			// Test WebAuthn error state
			mockFetch.mockRejectedValue(new Error('WebAuthn error'));

			const { container: webauthnContainer } = render(WebAuthnButton, {
				mode: 'authenticate',
				username: 'test@example.com'
			});

			const webauthnButton = webauthnContainer.querySelector('button');
			await fireEvent.click(webauthnButton);

			// Wait for error
			await new Promise(resolve => setTimeout(resolve, 50));

			const webauthnError = webauthnContainer.querySelector('.error');
			expect(webauthnError).toBeTruthy();
		});
	});
});