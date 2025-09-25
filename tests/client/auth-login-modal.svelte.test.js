import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';

import AuthLoginModal from '../../src/lib/client/shared/components/AuthLoginModal.svelte';

describe('Authentication Login Modal', () => {
	beforeEach(() => {
		// Mock fetch for auth config and authentication requests
		vi.stubGlobal('fetch', vi.fn());

		// Mock browser APIs
		vi.stubGlobal('navigator', {
			credentials: {
				create: vi.fn(),
				get: vi.fn()
			}
		});

		vi.stubGlobal('PublicKeyCredential', {
			isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true)
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('Modal Rendering', () => {
		it('renders modal when open is true', () => {
			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			// Should render the modal backdrop
			const backdrop = container.querySelector('.modal-backdrop');
			expect(backdrop).toBeTruthy();
			expect(backdrop.classList.contains('open')).toBe(true);
		});

		it('does not render modal when open is false', () => {
			const { container } = render(AuthLoginModal, {
				props: { open: false }
			});

			const backdrop = container.querySelector('.modal-backdrop');
			expect(backdrop?.classList.contains('open')).toBe(false);
		});

		it('shows loading state initially', async () => {
			// Mock slow API response
			const mockFetch = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									json: () =>
										Promise.resolve({
											success: true,
											methods: { local: { available: true } },
											hasAvailableMethods: true
										})
								}),
							100
						)
					)
			);
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			// Should show loading spinner initially
			const loadingSpinner = container.querySelector('svg'); // LoadingSpinner renders as SVG
			expect(loadingSpinner).toBeTruthy();
			expect(container.textContent).toContain('Loading authentication options...');
		});
	});

	describe('Authentication Method Adaptation', () => {
		it('displays local authentication when available', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: true, name: 'Access Code' },
							webauthn: { available: false },
							oauth: { available: false, providers: {} }
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Access Code');
				expect(container.textContent).toContain('Enter your local access code');
			});

			// Should have access code input
			const input = container.querySelector('input[type="password"]');
			expect(input).toBeTruthy();
			expect(input.getAttribute('data-testid')).toBe('access-code-input');
		});

		it('displays WebAuthn authentication when available', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: false },
							webauthn: { available: true, name: 'Passkey' },
							oauth: { available: false, providers: {} }
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Passkey');
				expect(container.textContent).toContain('biometric authentication');
			});

			// Should have WebAuthn button
			const webauthnSection = container.querySelector('[data-testid="auth-webauthn"]');
			expect(webauthnSection).toBeTruthy();
		});

		it('displays OAuth providers when available', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: false },
							webauthn: { available: false },
							oauth: {
								available: true,
								providers: {
									google: { enabled: true, name: 'Google' },
									github: { enabled: true, name: 'GitHub' }
								}
							}
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Social Sign In');
				expect(container.textContent).toContain('Continue with Google');
				expect(container.textContent).toContain('Continue with GitHub');
			});
		});

		it('displays multiple authentication methods when available', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: true, name: 'Access Code' },
							webauthn: { available: true, name: 'Passkey' },
							oauth: {
								available: true,
								providers: {
									google: { enabled: true, name: 'Google' }
								}
							}
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Access Code');
				expect(container.textContent).toContain('Passkey');
				expect(container.textContent).toContain('Continue with Google');
			});

			// Should have multiple auth method sections
			expect(container.querySelector('[data-testid="auth-local"]')).toBeTruthy();
			expect(container.querySelector('[data-testid="auth-webauthn"]')).toBeTruthy();
			expect(container.querySelector('[data-testid="auth-oauth-google"]')).toBeTruthy();
		});

		it('shows no methods available message when no auth methods', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: false },
							webauthn: { available: false },
							oauth: { available: false, providers: {} }
						},
						hasAvailableMethods: false
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Access Restricted');
				expect(container.textContent).toContain(
					'No authentication methods are currently available'
				);
			});
		});
	});

	describe('Local Authentication Form', () => {
		beforeEach(async () => {
			// Mock auth config response
			const mockFetch = vi.fn().mockResolvedValueOnce({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: true, name: 'Access Code' },
							webauthn: { available: false },
							oauth: { available: false, providers: {} }
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);
		});

		it('validates empty access code', async () => {
			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.querySelector('input[type="password"]')).toBeTruthy();
			});

			// Try to submit without entering access code
			const submitButton = container.querySelector('[data-testid="auth-local-submit"]');
			expect(submitButton.disabled).toBe(true);
		});

		it('enables submit button when access code is entered', async () => {
			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.querySelector('input[type="password"]')).toBeTruthy();
			});

			const input = container.querySelector('input[type="password"]');
			const submitButton = container.querySelector('[data-testid="auth-local-submit"]');

			// Initially disabled
			expect(submitButton.disabled).toBe(true);

			// Enter access code
			await fireEvent.input(input, { target: { value: 'test-code' } });

			// Should be enabled now
			expect(submitButton.disabled).toBe(false);
		});

		it('handles successful local authentication', async () => {
			let authEvent = null;

			// Mock successful auth config and login responses
			const mockFetch = vi
				.fn()
				.mockResolvedValueOnce({
					json: () =>
						Promise.resolve({
							success: true,
							methods: {
								local: { available: true, name: 'Access Code' }
							},
							hasAvailableMethods: true
						})
				})
				.mockResolvedValueOnce({
					json: () =>
						Promise.resolve({
							success: true,
							user: { id: 'user-1', email: 'test@example.com' },
							token: 'auth-token-123'
						})
				});
			vi.stubGlobal('fetch', mockFetch);

			const { container, component } = render(AuthLoginModal, {
				props: { open: true }
			});

			// Listen for authenticated event
			component.$on('authenticated', (event) => {
				authEvent = event.detail;
			});

			await waitFor(() => {
				expect(container.querySelector('input[type="password"]')).toBeTruthy();
			});

			// Enter access code and submit
			const input = container.querySelector('input[type="password"]');
			const form = container.querySelector('form');

			await fireEvent.input(input, { target: { value: 'valid-code' } });
			await fireEvent.submit(form);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledTimes(2);
			});

			// Should have made auth request
			expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/auth/local', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					accessCode: 'valid-code',
					returnTo: '/'
				})
			});

			// Should dispatch authenticated event
			expect(authEvent).toEqual({
				method: 'local',
				user: { id: 'user-1', email: 'test@example.com' },
				returnTo: '/'
			});
		});

		it('handles authentication errors', async () => {
			// Mock failed authentication
			const mockFetch = vi
				.fn()
				.mockResolvedValueOnce({
					json: () =>
						Promise.resolve({
							success: true,
							methods: {
								local: { available: true, name: 'Access Code' }
							},
							hasAvailableMethods: true
						})
				})
				.mockResolvedValueOnce({
					json: () =>
						Promise.resolve({
							success: false,
							error: 'Invalid access code'
						})
				});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.querySelector('input[type="password"]')).toBeTruthy();
			});

			// Enter invalid access code and submit
			const input = container.querySelector('input[type="password"]');
			const form = container.querySelector('form');

			await fireEvent.input(input, { target: { value: 'invalid-code' } });
			await fireEvent.submit(form);

			await waitFor(() => {
				const errorMessage = container.querySelector('[data-testid="auth-error"]');
				expect(errorMessage).toBeTruthy();
				expect(errorMessage.textContent).toContain('Invalid access code');
			});
		});
	});

	describe('Security Context Warnings', () => {
		it('shows tunnel warning for tunnel URLs', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: true }
						},
						security: {
							isTunnel: true
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Using tunnel URL');
				expect(container.textContent).toContain('some authentication methods may have limitations');
			});
		});

		it('shows security notice for non-HTTPS', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: true }
						},
						security: {
							isSecure: false
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('For enhanced security');
				expect(container.textContent).toContain('use HTTPS in production');
			});
		});
	});

	describe('Error Handling', () => {
		it('handles auth config fetch errors', async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Authentication Error');
				expect(container.textContent).toContain(
					'Network error loading authentication configuration'
				);
			});

			// Should have retry button
			const retryButton = container.querySelector('button');
			expect(retryButton.textContent.trim()).toBe('Retry');
		});

		it('handles auth config API errors', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: false,
						error: 'Configuration not available'
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Authentication Error');
				expect(container.textContent).toContain('Configuration not available');
			});
		});
	});

	describe('Accessibility', () => {
		it('has proper ARIA attributes', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				json: () =>
					Promise.resolve({
						success: true,
						methods: {
							local: { available: true }
						},
						hasAvailableMethods: true
					})
			});
			vi.stubGlobal('fetch', mockFetch);

			const { container } = render(AuthLoginModal, {
				props: { open: true }
			});

			await waitFor(() => {
				const input = container.querySelector('input[type="password"]');
				expect(input.getAttribute('aria-label')).toBe('Access code');

				const errorAlert = container.querySelector('[role="alert"]');
				// Error might not be present, but if it is, it should have proper role
				if (errorAlert) {
					expect(errorAlert.getAttribute('role')).toBe('alert');
				}
			});
		});
	});
});
