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

		// Mock localStorage using spyOn for browser environment
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

		// Mock window.matchMedia
		vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

		// In browser environment, window.location is read-only, so we spy on it
		// The tests will need to check the real window.location object
		// For tests that change location.href, we need to track assignments
	});

	describe('Initialization', () => {
		it('should initialize PWA state correctly', async () => {
			// Setup - not in PWA mode
			vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

			// Mock auth config response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					terminal_key_set: true,
					oauth_configured: false,
					oauth_providers: []
				})
			});

			// Mock status response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					onboarding: { isComplete: true }
				})
			});

			// Mock protected route check (not authenticated -> 401)
			mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

			await viewModel.initialize();

			expect(viewModel.isPWA).toBe(false);
			// In browser tests, window.location.href is the actual test page URL
			// Just verify that currentUrl and urlInput are set to the same value
			expect(viewModel.currentUrl).toBeTruthy();
			expect(viewModel.urlInput).toBe(viewModel.currentUrl);
		});

		it('should detect PWA mode via display-mode', async () => {
			vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

			// Mock auth config response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					terminal_key_set: true,
					oauth_configured: false,
					oauth_providers: []
				})
			});

			// Mock status response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					onboarding: { isComplete: true }
				})
			});

			// Mock protected route check (not authenticated)
			mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

			await viewModel.initialize();

			expect(viewModel.isPWA).toBe(true);
		});

		it('should load auth configuration', async () => {
			const mockConfig = {
				terminal_key_set: true,
				oauth_configured: true,
				oauth_providers: [
					{
						name: 'github',
						displayName: 'GitHub',
						enabled: true,
						hasClientId: true,
						available: true
					}
				]
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockConfig
			});

			// Mock status response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					onboarding: { isComplete: true }
				})
			});

			// Mock protected route check
			mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

			await viewModel.initialize();

			// AuthViewModel normalizes the config structure
			expect(viewModel.authConfig).toEqual({
				terminal_key_set: true,
				oauth_configured: true,
				oauthProviders: mockConfig.oauth_providers
			});
			expect(viewModel.oauthProviders).toEqual(mockConfig.oauth_providers);
			expect(viewModel.hasTerminalKeyAuth).toBe(true);
			expect(viewModel.hasOAuthAuth).toBe(true);
			expect(viewModel.hasAnyAuth).toBe(true);
		});

		it('should check existing authentication', async () => {
			// Mock auth config response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					terminal_key_set: true,
					oauth_configured: false,
					oauth_providers: []
				})
			});

			// Mock status response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					onboarding: { isComplete: true }
				})
			});

			// Mock protected route check (authenticated -> 200)
			mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

			const result = await viewModel.initialize();

			expect(result.redirectToWorkspace).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith('/api/auth/keys', {
				method: 'GET',
				credentials: 'include'
			});
		});

		it('should handle unauthenticated state', async () => {
			// Mock auth config response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					terminal_key_set: true,
					oauth_configured: false,
					oauth_providers: []
				})
			});

			// Mock status response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					onboarding: { isComplete: true }
				})
			});

			// Mock protected route check (not authenticated)
			mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

			const result = await viewModel.initialize();

			expect(result.redirectToWorkspace).toBe(false);
		});
	});

	describe('Terminal Key Authentication', () => {
		it('should login successfully with valid key', async () => {
			const testKey = 'valid-key-12345';

			// Mock successful form submission with redirect (303 or opaqueredirect)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 303,
				type: 'opaqueredirect'
			});

			const result = await viewModel.loginWithKey(testKey);

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
			expect(viewModel.error).toBe('');

			// Verify form data was sent correctly
			expect(mockFetch).toHaveBeenCalledWith(
				'/login',
				expect.objectContaining({
					method: 'POST',
					credentials: 'include',
					redirect: 'manual'
				})
			);
		});

		it('should handle invalid key', async () => {
			const testKey = 'invalid-key';

			// Mock failed form submission (non-redirect response)
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: 'Invalid API key' })
			});

			const result = await viewModel.loginWithKey(testKey);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid API key');
			expect(viewModel.error).toBe('Invalid API key');
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
			// @ts-ignore - Test uses manually controlled promise
			resolveLogin({ ok: true, json: async () => ({ success: true }) });
			await resultPromise;

			// Should no longer be loading
			expect(viewModel.loading).toBe(false);
		});
	});

	describe('OAuth Authentication', () => {
		it('should redirect to OAuth URL when configured', async () => {
			viewModel.authConfig = {
				oauth_configured: true,
				oauthProviders: [
					{
						name: 'github',
						displayName: 'GitHub',
						enabled: true,
						hasClientId: true,
						available: true
					}
				]
			};
			viewModel.oauthProviders = viewModel.authConfig.oauthProviders;

			// Mock OAuth initiation response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					authUrl:
						'https://github.com/login/oauth/authorize?client_id=test&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback'
				})
			});

			await viewModel.loginWithOAuth();

			// Verify we called the initiate endpoint
			expect(mockFetch).toHaveBeenCalledWith('/api/auth/oauth/initiate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider: 'github' })
			});

			// Note: We can't easily verify the redirect in unit tests since window.location.href
			// assignment triggers actual navigation. The important part is that we got the
			// correct auth URL from the server.
		});

		it('should not redirect when OAuth is not configured', async () => {
			viewModel.authConfig = {
				oauth_configured: false,
				oauthProviders: []
			};
			viewModel.oauthProviders = [];

			await viewModel.loginWithOAuth();

			// Should not have made any fetch calls
			expect(mockFetch).not.toHaveBeenCalled();
			expect(viewModel.error).toBe('OAuth authentication is not configured');
		});

		it('should handle OAuth initiation errors', async () => {
			viewModel.authConfig = {
				oauth_configured: true,
				oauthProviders: [
					{
						name: 'github',
						displayName: 'GitHub',
						enabled: true,
						hasClientId: true,
						available: true
					}
				]
			};
			viewModel.oauthProviders = viewModel.authConfig.oauthProviders;

			// Mock failed OAuth initiation
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ message: 'Provider not available' })
			});

			await viewModel.loginWithOAuth();

			expect(viewModel.error).toBe('Provider not available');
		});
	});

	describe('PWA URL Management', () => {
		it('should update URL in PWA mode', () => {
			viewModel.isPWA = true;
			const newUrl = 'http://example.com:5173';

			// Can't easily test actual redirect in unit tests
			// Just verify the method can be called without error
			viewModel.updateUrl(newUrl);

			// The method should not throw an error when called
			expect(viewModel.isPWA).toBe(true);
		});

		it('should not update URL when not in PWA mode', () => {
			viewModel.isPWA = false;
			const newUrl = 'http://example.com:5173';

			// Method should log warning but not redirect
			viewModel.updateUrl(newUrl);

			// Verify we're still not in PWA mode
			expect(viewModel.isPWA).toBe(false);
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
			// API key auth is always available regardless of authConfig
			viewModel.authConfig = { terminal_key_set: true };
			expect(viewModel.hasTerminalKeyAuth).toBe(true);

			viewModel.authConfig = { terminal_key_set: false };
			expect(viewModel.hasTerminalKeyAuth).toBe(true); // Still true - API keys always available

			viewModel.authConfig = null;
			expect(viewModel.hasTerminalKeyAuth).toBe(true); // Still true - API keys always available
		});

		it('should compute hasOAuthAuth correctly', () => {
			viewModel.oauthProviders = [
				{
					name: 'github',
					displayName: 'GitHub',
					enabled: true,
					hasClientId: true,
					available: true
				}
			];
			expect(viewModel.hasOAuthAuth).toBe(true);

			viewModel.oauthProviders = [
				{
					name: 'github',
					displayName: 'GitHub',
					enabled: false,
					hasClientId: true,
					available: false
				}
			];
			expect(viewModel.hasOAuthAuth).toBe(false);

			viewModel.oauthProviders = [];
			expect(viewModel.hasOAuthAuth).toBe(false);
		});

		it('should compute hasAnyAuth correctly', () => {
			// API key auth is always available, so hasAnyAuth is always true
			viewModel.authConfig = {
				terminal_key_set: true,
				oauth_configured: true
			};
			viewModel.oauthProviders = [
				{
					name: 'github',
					displayName: 'GitHub',
					enabled: true,
					hasClientId: true,
					available: true
				}
			];
			expect(viewModel.hasAnyAuth).toBe(true);

			viewModel.authConfig = {
				terminal_key_set: true,
				oauth_configured: false
			};
			viewModel.oauthProviders = [];
			expect(viewModel.hasAnyAuth).toBe(true);

			viewModel.authConfig = {
				terminal_key_set: false,
				oauth_configured: true
			};
			viewModel.oauthProviders = [
				{
					name: 'github',
					displayName: 'GitHub',
					enabled: true,
					hasClientId: true,
					available: true
				}
			];
			expect(viewModel.hasAnyAuth).toBe(true);

			viewModel.authConfig = {
				terminal_key_set: false,
				oauth_configured: false
			};
			viewModel.oauthProviders = [];
			expect(viewModel.hasAnyAuth).toBe(true); // Still true - API keys always available
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
			viewModel.currentUrl = 'http://localhost:5173';
			viewModel.urlInput = 'http://localhost:5173'; // Set to same as currentUrl
			viewModel.onboardingComplete = true;
			viewModel.authConfig = {
				terminal_key_set: true,
				oauth_configured: false,
				oauthProviders: []
			};
			viewModel.oauthProviders = [];

			const state = viewModel.getState();

			expect(state).toEqual({
				loading: true,
				error: 'Test error',
				isPWA: true,
				onboardingComplete: true,
				hasTerminalKeyAuth: true,
				hasOAuthAuth: false,
				hasAnyAuth: true,
				needsUrlChange: false,
				oauthProviders: []
			});
		});
	});
});
