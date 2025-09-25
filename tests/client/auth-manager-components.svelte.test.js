import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

import WebAuthnManager from '../../src/lib/client/shared/components/WebAuthnManager.svelte';
import OAuthAccountManager from '../../src/lib/client/shared/components/OAuthAccountManager.svelte';

// Mock WebAuthn availability check
const mockCheckWebAuthnAvailability = vi.fn();
vi.mock('../../src/lib/client/shared/utils/webauthn.js', () => ({
	checkWebAuthnAvailability: mockCheckWebAuthnAvailability
}));

// Mock fetch for API calls
const mockFetch = vi.fn();

describe('WebAuthn Manager Component', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', mockFetch);
		mockFetch.mockClear();

		// Mock successful availability check by default
		mockCheckWebAuthnAvailability.mockResolvedValue({
			overall: true,
			warnings: []
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('Component Initialization', () => {
		it('loads credentials and availability on mount', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					credentials: [
						{
							id: 'cred-1',
							deviceName: 'iPhone Touch ID',
							createdAt: '2024-01-01T00:00:00Z',
							lastUsedAt: '2024-01-02T00:00:00Z'
						}
					]
				})
			});

			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			// Should show loading initially
			expect(container.textContent).toContain('Loading WebAuthn credentials...');

			await waitFor(() => {
				expect(container.textContent).toContain('Your Passkeys (1)');
			});

			// Verify credentials API call
			expect(mockFetch).toHaveBeenCalledWith('/api/webauthn/credentials?userId=test-user');

			// Verify credentials are displayed
			expect(container.textContent).toContain('iPhone Touch ID');
			expect(container.textContent).toContain('Created: 1/1/2024');
			expect(container.textContent).toContain('Last used: 1/2/2024');
		});

		it('displays availability status correctly', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({ success: true, credentials: [] })
			});

			const { checkWebAuthnAvailability } = require('../../src/lib/client/shared/utils/webauthn.js');
			checkWebAuthnAvailability.mockResolvedValue({
				overall: true,
				warnings: []
			});

			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('✅ WebAuthn Available');
			});
		});

		it('displays warnings when WebAuthn has issues', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({ success: true, credentials: [] })
			});

			mockCheckWebAuthnAvailability.mockResolvedValue({
				overall: true,
				warnings: [
					{
						severity: 'warning',
						message: 'HTTPS required for WebAuthn'
					}
				]
			});

			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('HTTPS required for WebAuthn');
			});
		});

		it('handles unavailable WebAuthn gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({ success: true, credentials: [] })
			});

			mockCheckWebAuthnAvailability.mockResolvedValue({
				overall: false,
				warnings: [
					{
						severity: 'error',
						message: 'WebAuthn not supported'
					}
				]
			});

			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('❌ WebAuthn Unavailable');
				expect(container.textContent).toContain('WebAuthn not supported');
			});

			// Should not show Add Passkey button
			const addButton = container.querySelector('button');
			expect(addButton?.textContent).not.toContain('Add Passkey');
		});
	});

	describe('Credential Loading', () => {
		it('handles credential loading errors', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: false,
					error: 'Unauthorized',
					details: 'Invalid user ID'
				})
			});

			const { container } = render(WebAuthnManager, {
				userId: 'invalid-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Error: Invalid user ID');
			});

			// Should show retry button
			const retryButton = screen.getByText('Retry');
			expect(retryButton).toBeTruthy();
		});

		it('handles network errors during credential loading', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Error: Network error');
			});
		});

		it('retries credential loading on retry button click', async () => {
			// First call fails
			mockFetch.mockRejectedValueOnce(new Error('Network error'));
			// Second call succeeds
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					credentials: []
				})
			});

			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Error: Network error');
			});

			const retryButton = screen.getByText('Retry');
			await fireEvent.click(retryButton);

			await waitFor(() => {
				expect(container.textContent).toContain('Your Passkeys (0)');
			});

			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});

	describe('Credential Registration', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({ success: true, credentials: [] })
			});
		});

		it('shows registration form when Add Passkey is clicked', async () => {
			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				const addButton = screen.getByText('Add Passkey');
				expect(addButton).toBeTruthy();
			});

			const addButton = screen.getByText('Add Passkey');
			await fireEvent.click(addButton);

			await tick();

			expect(container.textContent).toContain('Register New Passkey');
			expect(container.textContent).toContain('Device Name:');
			expect(screen.getByText('Cancel')).toBeTruthy();
		});

		it('handles successful credential registration', async () => {
			let successEvent = null;
			const { container, component } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			component.$on('success', (event) => {
				successEvent = event.detail;
			});

			await waitFor(() => {
				const addButton = screen.getByText('Add Passkey');
				fireEvent.click(addButton);
			});

			await tick();

			// Fill in device name
			const deviceNameInput = container.querySelector('input[type="text"]');
			await fireEvent.input(deviceNameInput, { target: { value: 'Test Device' } });

			// Mock successful registration reload
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					credentials: [
						{
							id: 'new-cred',
							deviceName: 'Test Device',
							createdAt: '2024-01-01T00:00:00Z'
						}
					]
				})
			});

			// Simulate successful registration from WebAuthnButton
			const mockRegistrationEvent = {
				detail: {
					message: 'Passkey registered successfully',
					credentialId: 'new-cred'
				}
			};

			// Get the WebAuthnButton and trigger success event
			const webauthnButton = container.querySelector('.webauthn-button');
			expect(webauthnButton).toBeTruthy();

			// Manually trigger the success handler
			const webauthnComponent = component.$$?.ctx?.[0]; // Access internal component context
			component.handleRegistrationSuccess?.(mockRegistrationEvent);

			await tick();

			expect(successEvent).toEqual({
				message: 'Passkey registered successfully'
			});

			// Should reload credentials and hide form
			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith('/api/webauthn/credentials?userId=test-user');
			});
		});

		it('handles registration errors', async () => {
			let errorEvent = null;
			const { container, component } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			component.$on('error', (event) => {
				errorEvent = event.detail;
			});

			await waitFor(() => {
				const addButton = screen.getByText('Add Passkey');
				fireEvent.click(addButton);
			});

			await tick();

			// Simulate registration error from WebAuthnButton
			const mockErrorEvent = {
				detail: {
					error: 'Registration failed'
				}
			};

			// Manually trigger the error handler
			component.handleRegistrationError?.(mockErrorEvent);

			await tick();

			expect(errorEvent).toEqual({
				error: 'Registration failed'
			});
		});
	});

	describe('Credential Deletion', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					credentials: [
						{
							id: 'cred-1',
							deviceName: 'iPhone Touch ID',
							createdAt: '2024-01-01T00:00:00Z'
						},
						{
							id: 'cred-2',
							deviceName: 'YubiKey 5',
							createdAt: '2024-01-02T00:00:00Z'
						}
					]
				})
			});
		});

		it('shows confirmation dialog when remove button is clicked', async () => {
			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Your Passkeys (2)');
			});

			const removeButtons = screen.getAllByText('Remove');
			await fireEvent.click(removeButtons[0]);

			await tick();

			expect(container.textContent).toContain('Remove Passkey');
			expect(container.textContent).toContain("remove the passkey 'iPhone Touch ID'");
		});

		it('handles successful credential deletion', async () => {
			let successEvent = null;
			const { container, component } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			component.$on('success', (event) => {
				successEvent = event.detail;
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Your Passkeys (2)');
			});

			const removeButtons = screen.getAllByText('Remove');
			await fireEvent.click(removeButtons[0]);

			await tick();

			// Mock successful deletion
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					message: 'Credential deleted successfully'
				})
			});

			// Mock reloading credentials after deletion
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					credentials: [
						{
							id: 'cred-2',
							deviceName: 'YubiKey 5',
							createdAt: '2024-01-02T00:00:00Z'
						}
					]
				})
			});

			const confirmButton = screen.getByText('Remove');
			await fireEvent.click(confirmButton);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith('/api/webauthn/credentials', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						credentialId: 'cred-1',
						userId: 'test-user'
					})
				});
			});

			expect(successEvent).toEqual({
				message: 'Credential removed successfully'
			});
		});

		it('handles credential deletion errors', async () => {
			let errorEvent = null;
			const { container, component } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			component.$on('error', (event) => {
				errorEvent = event.detail;
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Your Passkeys (2)');
			});

			const removeButtons = screen.getAllByText('Remove');
			await fireEvent.click(removeButtons[0]);

			await tick();

			// Mock deletion failure
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: false,
					error: 'Unauthorized',
					details: 'Cannot delete credential'
				})
			});

			const confirmButton = screen.getByText('Remove');
			await fireEvent.click(confirmButton);

			await waitFor(() => {
				expect(errorEvent).toEqual({
					error: 'Cannot delete credential'
				});
			});
		});

		it('cancels deletion when cancel button is clicked', async () => {
			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Your Passkeys (2)');
			});

			const removeButtons = screen.getAllByText('Remove');
			await fireEvent.click(removeButtons[0]);

			await tick();

			expect(container.textContent).toContain('Remove Passkey');

			const cancelButton = screen.getByText('Cancel');
			await fireEvent.click(cancelButton);

			await tick();

			// Confirmation dialog should be gone
			expect(container.textContent).not.toContain('Remove Passkey');
		});
	});

	describe('Device Icon Detection', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					credentials: [
						{
							id: 'cred-1',
							deviceName: 'iPhone Touch ID',
							createdAt: '2024-01-01T00:00:00Z'
						},
						{
							id: 'cred-2',
							deviceName: 'Windows Hello',
							createdAt: '2024-01-02T00:00:00Z'
						},
						{
							id: 'cred-3',
							deviceName: 'YubiKey Security Key',
							createdAt: '2024-01-03T00:00:00Z'
						},
						{
							id: 'cred-4',
							deviceName: 'Generic Device',
							createdAt: '2024-01-04T00:00:00Z'
						}
					]
				})
			});
		});

		it('displays correct icons for different device types', async () => {
			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				const deviceIcons = container.querySelectorAll('.device-icon');

				// iPhone Touch ID should get mobile icon
				expect(deviceIcons[0].textContent).toBe('📱');

				// Windows Hello should get laptop icon
				expect(deviceIcons[1].textContent).toBe('💻');

				// YubiKey should get key icon
				expect(deviceIcons[2].textContent).toBe('🔑');

				// Generic device should get default lock icon
				expect(deviceIcons[3].textContent).toBe('🔐');
			});
		});
	});

	describe('Empty State', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					credentials: []
				})
			});
		});

		it('shows appropriate message when no credentials exist and WebAuthn is available', async () => {
			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('No passkeys registered');
				expect(container.textContent).toContain('Click "Add Passkey" to register');
			});
		});

		it('shows appropriate message when WebAuthn is unavailable', async () => {
			mockCheckWebAuthnAvailability.mockResolvedValue({
				overall: false,
				warnings: []
			});

			const { container } = render(WebAuthnManager, {
				userId: 'test-user',
				username: 'test@example.com'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('No passkeys registered');
				expect(container.textContent).toContain('WebAuthn must be available to register passkeys');
			});
		});
	});
});

describe('OAuth Account Manager Component', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', mockFetch);
		mockFetch.mockClear();
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('OAuth Account Loading', () => {
		it('loads and displays OAuth accounts on mount', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					accounts: [
						{
							id: 'oauth-1',
							provider: 'google',
							email: 'test@gmail.com',
							name: 'Test User',
							linkedAt: '2024-01-01T00:00:00Z'
						},
						{
							id: 'oauth-2',
							provider: 'github',
							username: 'testuser',
							email: 'test@users.noreply.github.com',
							linkedAt: '2024-01-02T00:00:00Z'
						}
					]
				})
			});

			const { container } = render(OAuthAccountManager, {
				userId: 'test-user'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Linked Accounts (2)');
				expect(container.textContent).toContain('test@gmail.com');
				expect(container.textContent).toContain('testuser');
			});

			expect(mockFetch).toHaveBeenCalledWith('/api/oauth/accounts?userId=test-user');
		});

		it('handles loading errors gracefully', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Failed to load accounts'));

			const { container } = render(OAuthAccountManager, {
				userId: 'test-user'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Error: Failed to load accounts');
			});
		});

		it('shows empty state when no accounts are linked', async () => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					accounts: []
				})
			});

			const { container } = render(OAuthAccountManager, {
				userId: 'test-user'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('No OAuth accounts linked');
			});
		});
	});

	describe('Account Unlinking', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					accounts: [
						{
							id: 'oauth-1',
							provider: 'google',
							email: 'test@gmail.com',
							linkedAt: '2024-01-01T00:00:00Z'
						}
					]
				})
			});
		});

		it('shows confirmation dialog when unlink button is clicked', async () => {
			const { container } = render(OAuthAccountManager, {
				userId: 'test-user'
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Linked Accounts (1)');
			});

			const unlinkButton = screen.getByText('Unlink');
			await fireEvent.click(unlinkButton);

			await tick();

			expect(container.textContent).toContain('Unlink Account');
			expect(container.textContent).toContain('test@gmail.com');
		});

		it('handles successful account unlinking', async () => {
			let successEvent = null;
			const { container, component } = render(OAuthAccountManager, {
				userId: 'test-user'
			});

			component.$on('success', (event) => {
				successEvent = event.detail;
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Linked Accounts (1)');
			});

			const unlinkButton = screen.getByText('Unlink');
			await fireEvent.click(unlinkButton);

			await tick();

			// Mock successful unlinking
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					message: 'Account unlinked successfully'
				})
			});

			// Mock reloading accounts after unlinking
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					accounts: []
				})
			});

			const confirmButton = screen.getByText('Unlink');
			await fireEvent.click(confirmButton);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith('/api/oauth/accounts', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						accountId: 'oauth-1',
						userId: 'test-user'
					})
				});
			});

			expect(successEvent).toEqual({
				message: 'Account unlinked successfully'
			});
		});

		it('handles unlinking errors', async () => {
			let errorEvent = null;
			const { container, component } = render(OAuthAccountManager, {
				userId: 'test-user'
			});

			component.$on('error', (event) => {
				errorEvent = event.detail;
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Linked Accounts (1)');
			});

			const unlinkButton = screen.getByText('Unlink');
			await fireEvent.click(unlinkButton);

			await tick();

			// Mock unlinking failure
			mockFetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: false,
					error: 'Cannot unlink account',
					details: 'At least one authentication method must remain'
				})
			});

			const confirmButton = screen.getByText('Unlink');
			await fireEvent.click(confirmButton);

			await waitFor(() => {
				expect(errorEvent).toEqual({
					error: 'At least one authentication method must remain'
				});
			});
		});
	});
});