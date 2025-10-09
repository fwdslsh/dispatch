/**
 * AuthViewModel Unit Tests
 *
 * Tests authentication business logic without UI concerns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthViewModel } from '$lib/client/shared/state/AuthViewModel.svelte.js';

describe('AuthViewModel', () => {
	let viewModel;
	let mockFetch;

	beforeEach(() => {
		// Create fresh ViewModel instance
		viewModel = new AuthViewModel();

		// Mock fetch globally
		mockFetch = vi.fn();
		global.fetch = mockFetch;

		// Mock localStorage
		global.localStorage = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn()
		};

		// Mock window properties
		global.window = {
			location: {
				href: 'http://localhost:5173'
			},
			matchMedia: vi.fn().mockReturnValue({ matches: false }),
			navigator: {}
		};
		global.document = {
			referrer: ''
		};
	});

	describe('Initialization', () => {
		it('should initialize PWA state correctly', async () => {
			// Setup - not in PWA mode
			global.window.matchMedia = vi.fn().mockReturnValue({ matches: false });
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					terminal_key_set: true,
					oauth_configured: false
				})
			});

			await viewModel.initialize();

			expect(viewModel.isPWA).toBe(false);
			expect(viewModel.currentUrl).toBe('http://localhost:5173');
			expect(viewModel.urlInput).toBe('http://localhost:5173');
		});

		it('should detect PWA mode via display-mode', async () => {
			global.window.matchMedia = vi.fn().mockReturnValue({ matches: true });
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					terminal_key_set: true,
					oauth_configured: false
				})
			});

			await viewModel.initialize();

			expect(viewModel.isPWA).toBe(true);
		});

		it('should load auth configuration', async () => {
			const mockConfig = {
				terminal_key_set: true,
				oauth_configured: true,
				oauth_client_id: 'test-client-id',
				oauth_redirect_uri: 'http://localhost:5173/auth/callback'
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockConfig
			});

			await viewModel.initialize();

			expect(viewModel.authConfig).toEqual(mockConfig);
			expect(viewModel.hasTerminalKeyAuth).toBe(true);
			expect(viewModel.hasOAuthAuth).toBe(true);
			expect(viewModel.hasAnyAuth).toBe(true);
		});

		it('should check existing authentication', async () => {
			const storedKey = 'test-key-12345';
			global.localStorage.getItem.mockReturnValue(storedKey);

			// Mock auth config response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ terminal_key_set: true })
			});

			// Mock auth check response (authenticated)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const result = await viewModel.initialize();

			expect(result.redirectToWorkspace).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith('/api/auth/check', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${storedKey}`
				},
				body: JSON.stringify({ key: storedKey })
			});
		});

		it('should remove invalid stored key', async () => {
			const invalidKey = 'invalid-key';
			global.localStorage.getItem.mockReturnValue(invalidKey);

			// Mock auth config response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ terminal_key_set: true })
			});

			// Mock auth check response (invalid)
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ error: 'Invalid key' })
			});

			const result = await viewModel.initialize();

			expect(result.redirectToWorkspace).toBe(false);
			expect(global.localStorage.removeItem).toHaveBeenCalledWith('dispatch-auth-token');
		});
	});

	describe('Terminal Key Authentication', () => {
		it('should login successfully with valid key', async () => {
			const testKey = 'valid-key-12345';

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const result = await viewModel.loginWithKey(testKey);

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
			expect(viewModel.error).toBe('');
			expect(global.localStorage.setItem).toHaveBeenCalledWith('dispatch-auth-token', testKey);
		});

		it('should handle invalid key', async () => {
			const testKey = 'invalid-key';

			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ error: 'Invalid key' })
			});

			const result = await viewModel.loginWithKey(testKey);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid key');
			expect(viewModel.error).toBe('Invalid key');
			expect(global.localStorage.setItem).not.toHaveBeenCalled();
		});

		it('should handle network errors', async () => {
			const testKey = 'test-key';

			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await viewModel.loginWithKey(testKey);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Unable to reach server');
			expect(viewModel.error).toBe('Unable to reach server');
		});

		it('should set loading state during login', async () => {
			const testKey = 'test-key';

			// Create promise we can control
			let resolveLogin;
			const loginPromise = new Promise((resolve) => {
				resolveLogin = resolve;
			});

			mockFetch.mockReturnValueOnce(loginPromise);

			const resultPromise = viewModel.loginWithKey(testKey);

			// Should be loading
			expect(viewModel.loading).toBe(true);

			// Resolve the login
			resolveLogin({ ok: true, json: async () => ({ success: true }) });
			await resultPromise;

			// Should no longer be loading
			expect(viewModel.loading).toBe(false);
		});
	});

	describe('OAuth Authentication', () => {
		it('should redirect to OAuth URL when configured', () => {
			viewModel.authConfig = {
				oauth_configured: true,
				oauth_client_id: 'test-client-id',
				oauth_redirect_uri: 'http://localhost:5173/auth/callback'
			};

			// Mock window.location.href setter
			delete global.window.location;
			global.window.location = { href: '' };

			viewModel.loginWithOAuth();

			const expectedUrl =
				'https://github.com/login/oauth/authorize?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback&scope=user:email';
			expect(global.window.location.href).toBe(expectedUrl);
		});

		it('should not redirect when OAuth is not configured', () => {
			viewModel.authConfig = {
				oauth_configured: false
			};

			// Mock window.location.href setter
			delete global.window.location;
			global.window.location = { href: '' };

			viewModel.loginWithOAuth();

			expect(global.window.location.href).toBe('');
		});
	});

	describe('PWA URL Management', () => {
		it('should update URL in PWA mode', () => {
			viewModel.isPWA = true;
			const newUrl = 'http://example.com:5173';

			// Mock window.location.href setter
			delete global.window.location;
			global.window.location = { href: '' };

			viewModel.updateUrl(newUrl);

			expect(global.window.location.href).toBe(newUrl);
		});

		it('should not update URL when not in PWA mode', () => {
			viewModel.isPWA = false;
			const newUrl = 'http://example.com:5173';

			// Mock window.location.href setter
			delete global.window.location;
			global.window.location = { href: 'http://localhost:5173' };

			viewModel.updateUrl(newUrl);

			// Should not have changed
			expect(global.window.location.href).toBe('http://localhost:5173');
		});

		it('should compute needsUrlChange correctly', () => {
			viewModel.isPWA = true;
			viewModel.currentUrl = 'http://localhost:5173';
			viewModel.urlInput = 'http://example.com:5173';

			expect(viewModel.needsUrlChange).toBe(true);

			viewModel.urlInput = 'http://localhost:5173';
			expect(viewModel.needsUrlChange).toBe(false);
		});
	});

	describe('Derived State', () => {
		it('should compute hasTerminalKeyAuth correctly', () => {
			viewModel.authConfig = { terminal_key_set: true };
			expect(viewModel.hasTerminalKeyAuth).toBe(true);

			viewModel.authConfig = { terminal_key_set: false };
			expect(viewModel.hasTerminalKeyAuth).toBe(false);

			viewModel.authConfig = null;
			expect(viewModel.hasTerminalKeyAuth).toBe(false);
		});

		it('should compute hasOAuthAuth correctly', () => {
			viewModel.authConfig = { oauth_configured: true };
			expect(viewModel.hasOAuthAuth).toBe(true);

			viewModel.authConfig = { oauth_configured: false };
			expect(viewModel.hasOAuthAuth).toBe(false);

			viewModel.authConfig = null;
			expect(viewModel.hasOAuthAuth).toBe(false);
		});

		it('should compute hasAnyAuth correctly', () => {
			viewModel.authConfig = {
				terminal_key_set: true,
				oauth_configured: true
			};
			expect(viewModel.hasAnyAuth).toBe(true);

			viewModel.authConfig = {
				terminal_key_set: true,
				oauth_configured: false
			};
			expect(viewModel.hasAnyAuth).toBe(true);

			viewModel.authConfig = {
				terminal_key_set: false,
				oauth_configured: true
			};
			expect(viewModel.hasAnyAuth).toBe(true);

			viewModel.authConfig = {
				terminal_key_set: false,
				oauth_configured: false
			};
			expect(viewModel.hasAnyAuth).toBe(false);
		});
	});

	describe('Error Handling', () => {
		it('should clear error state', async () => {
			viewModel.error = 'Test error';
			viewModel.clearError();
			expect(viewModel.error).toBe('');
		});

		it('should preserve error state until cleared', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ error: 'Invalid credentials' })
			});

			await viewModel.loginWithKey('bad-key');
			expect(viewModel.error).toBe('Invalid credentials');

			// Error should persist
			expect(viewModel.error).toBe('Invalid credentials');

			// Until explicitly cleared
			viewModel.clearError();
			expect(viewModel.error).toBe('');
		});
	});

	describe('State Summary', () => {
		it('should return state summary for debugging', () => {
			viewModel.loading = true;
			viewModel.error = 'Test error';
			viewModel.isPWA = true;
			viewModel.authConfig = {
				terminal_key_set: true,
				oauth_configured: false
			};

			const state = viewModel.getState();

			expect(state).toEqual({
				loading: true,
				error: 'Test error',
				isPWA: true,
				hasTerminalKeyAuth: true,
				hasOAuthAuth: false,
				hasAnyAuth: true,
				needsUrlChange: false
			});
		});
	});
});
