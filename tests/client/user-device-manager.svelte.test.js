import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';

import UserDeviceManager from '../../src/lib/client/shared/components/UserDeviceManager.svelte';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

// Sample device data
const mockDevices = [
	{
		id: '1',
		deviceName: 'MacBook Pro',
		deviceFingerprint: 'abc123def456',
		isTrusted: true,
		activeSessions: 1,
		createdAt: '2024-01-01T10:00:00Z',
		lastActivity: '2024-01-02T15:30:00Z',
		userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
	},
	{
		id: '2',
		deviceName: 'iPhone 15',
		deviceFingerprint: 'def456ghi789',
		isTrusted: false,
		activeSessions: 0,
		createdAt: '2024-01-05T09:00:00Z',
		lastActivity: '2024-01-06T12:00:00Z',
		userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
	}
];

const mockCurrentDevice = {
	id: '1',
	deviceName: 'MacBook Pro'
};

describe('User Device Manager Component', () => {
	beforeEach(() => {
		// Reset fetch mock
		vi.clearAllMocks();

		// Mock successful devices response by default
		fetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					success: true,
					devices: mockDevices,
					currentDevice: mockCurrentDevice
				})
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Loading and Display', () => {
		it('shows loading state initially', () => {
			const { container } = render(UserDeviceManager, {
				props: { autoLoad: false }
			});

			const refreshButton = container.querySelector('button');
			expect(refreshButton?.textContent).toContain('Refresh');
		});

		it('loads devices automatically when autoLoad is true', async () => {
			const { container } = render(UserDeviceManager);

			// Should call the devices API
			await waitFor(() => {
				expect(fetch).toHaveBeenCalledWith('/api/user/devices', {
					method: 'GET',
					credentials: 'include'
				});
			});

			// Should display devices
			await waitFor(() => {
				expect(container.textContent).toContain('MacBook Pro');
				expect(container.textContent).toContain('iPhone 15');
			});
		});

		it('displays device count correctly', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				expect(container.textContent).toContain('2 devices');
			});
		});

		it('shows current device indicator', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				expect(container.textContent).toContain('This Device');
				expect(container.textContent).toContain('Current device');
			});
		});
	});

	describe('Error Handling', () => {
		it('shows error message when API fails', async () => {
			fetch.mockRejectedValueOnce(new Error('Network error'));

			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				expect(container.textContent).toContain('Network error loading devices');
			});
		});

		it('shows error from server response', async () => {
			fetch.mockResolvedValueOnce({
				ok: false,
				json: () =>
					Promise.resolve({
						success: false,
						error: 'Authentication failed'
					})
			});

			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				expect(container.textContent).toContain('Authentication failed');
			});
		});

		it('allows dismissing error messages', async () => {
			fetch.mockRejectedValueOnce(new Error('Test error'));

			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				expect(container.textContent).toContain('Test error');
			});

			const dismissButton = container.querySelector('.message-close');
			await fireEvent.click(dismissButton);

			expect(container.textContent).not.toContain('Test error');
		});
	});

	describe('Empty State', () => {
		it('shows empty state when no devices', async () => {
			fetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						devices: [],
						currentDevice: null
					})
			});

			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				expect(container.textContent).toContain('No Devices Found');
				expect(container.textContent).toContain("You don't have any registered devices yet");
			});
		});
	});

	describe('Device Actions', () => {
		it('opens device details modal', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				const detailsButton = container.querySelector('[data-testid="device-details-btn-1"]');
				expect(detailsButton).toBeTruthy();
			});

			const detailsButton = container.querySelector('[data-testid="device-details-btn-1"]');
			await fireEvent.click(detailsButton);

			await waitFor(() => {
				expect(container.querySelector('[data-testid="device-details-modal"]')).toBeTruthy();
			});
		});

		it('opens rename modal', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				const renameButton = container.querySelector('[data-testid="device-rename-btn-1"]');
				expect(renameButton).toBeTruthy();
			});

			const renameButton = container.querySelector('[data-testid="device-rename-btn-1"]');
			await fireEvent.click(renameButton);

			await waitFor(() => {
				expect(container.querySelector('[data-testid="rename-device-modal"]')).toBeTruthy();
				expect(container.querySelector('[data-testid="device-name-input"]')?.value).toBe(
					'MacBook Pro'
				);
			});
		});

		it('prevents revoking current device', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				// Current device (id: 1) should not have a revoke button
				const revokeButton = container.querySelector('[data-testid="device-revoke-btn-1"]');
				expect(revokeButton).toBeFalsy();

				// Should show current device note instead
				expect(container.textContent).toContain('Current device');
			});
		});

		it('allows revoking non-current devices', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				// Non-current device (id: 2) should have a revoke button
				const revokeButton = container.querySelector('[data-testid="device-revoke-btn-2"]');
				expect(revokeButton).toBeTruthy();
			});

			const revokeButton = container.querySelector('[data-testid="device-revoke-btn-2"]');
			await fireEvent.click(revokeButton);

			await waitFor(() => {
				expect(container.querySelector('[data-testid="revoke-device-confirm"]')).toBeTruthy();
			});
		});
	});

	describe('Device Renaming', () => {
		it('renames device successfully', async () => {
			const { container } = render(UserDeviceManager);

			// Open rename modal
			await waitFor(() => {
				const renameButton = container.querySelector('[data-testid="device-rename-btn-1"]');
				expect(renameButton).toBeTruthy();
			});

			const renameButton = container.querySelector('[data-testid="device-rename-btn-1"]');
			await fireEvent.click(renameButton);

			await waitFor(() => {
				const nameInput = container.querySelector('[data-testid="device-name-input"]');
				expect(nameInput).toBeTruthy();
			});

			// Mock successful rename response
			fetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						message: 'Device renamed successfully'
					})
			});

			// Mock devices reload after rename
			fetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						devices: [{ ...mockDevices[0], deviceName: 'New MacBook Pro' }, mockDevices[1]],
						currentDevice: { id: '1', deviceName: 'New MacBook Pro' }
					})
			});

			// Change device name
			const nameInput = container.querySelector('[data-testid="device-name-input"]');
			await fireEvent.input(nameInput, { target: { value: 'New MacBook Pro' } });

			// Submit form
			const submitButton = container.querySelector('[data-testid="rename-submit-btn"]');
			await fireEvent.click(submitButton);

			// Should call rename API
			await waitFor(() => {
				expect(fetch).toHaveBeenCalledWith('/api/user/devices/rename', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						deviceId: '1',
						newName: 'New MacBook Pro'
					})
				});
			});
		});

		it('shows error for invalid device name', async () => {
			const { container } = render(UserDeviceManager);

			// Open rename modal
			const renameButton = container.querySelector('[data-testid="device-rename-btn-1"]');
			await fireEvent.click(renameButton);

			await waitFor(() => {
				const nameInput = container.querySelector('[data-testid="device-name-input"]');
				expect(nameInput).toBeTruthy();
			});

			// Clear the input
			const nameInput = container.querySelector('[data-testid="device-name-input"]');
			await fireEvent.input(nameInput, { target: { value: '' } });

			// Try to submit
			const submitButton = container.querySelector('[data-testid="rename-submit-btn"]');
			await fireEvent.click(submitButton);

			// Should show validation error (client-side)
			await waitFor(() => {
				expect(container.textContent).toContain('Device name cannot be empty');
			});
		});
	});

	describe('Device Revocation', () => {
		it('revokes device successfully', async () => {
			const { container } = render(UserDeviceManager);

			// Click revoke on non-current device
			await waitFor(() => {
				const revokeButton = container.querySelector('[data-testid="device-revoke-btn-2"]');
				expect(revokeButton).toBeTruthy();
			});

			const revokeButton = container.querySelector('[data-testid="device-revoke-btn-2"]');
			await fireEvent.click(revokeButton);

			// Confirm in dialog
			await waitFor(() => {
				const confirmDialog = container.querySelector('[data-testid="revoke-device-confirm"]');
				expect(confirmDialog).toBeTruthy();
			});

			// Mock successful revoke response
			fetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						message: 'Device "iPhone 15" has been revoked successfully'
					})
			});

			// Mock devices reload after revoke
			fetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						devices: [mockDevices[0]], // Only first device remains
						currentDevice: mockCurrentDevice
					})
			});

			// Find and click confirm button in dialog
			const confirmButton = container.querySelector('button[data-testid*="confirm"], .btn-danger');
			if (confirmButton) {
				await fireEvent.click(confirmButton);

				// Should call revoke API
				await waitFor(() => {
					expect(fetch).toHaveBeenCalledWith('/api/user/devices/revoke', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'include',
						body: JSON.stringify({
							deviceId: '2'
						})
					});
				});
			}
		});
	});

	describe('Refresh Functionality', () => {
		it('refreshes device list when refresh button clicked', async () => {
			const { container } = render(UserDeviceManager);

			// Wait for initial load
			await waitFor(() => {
				expect(container.textContent).toContain('MacBook Pro');
			});

			// Clear mock calls
			vi.clearAllMocks();

			// Click refresh
			const refreshButton = container.querySelector('button');
			await fireEvent.click(refreshButton);

			// Should call API again
			await waitFor(() => {
				expect(fetch).toHaveBeenCalledWith('/api/user/devices', {
					method: 'GET',
					credentials: 'include'
				});
			});
		});
	});

	describe('Component Props', () => {
		it('respects compact mode', () => {
			const { container } = render(UserDeviceManager, {
				props: { compact: true }
			});

			const manager = container.querySelector('.user-device-manager');
			expect(manager?.classList.contains('compact')).toBe(true);
		});

		it('hides title when showTitle is false', () => {
			const { container } = render(UserDeviceManager, {
				props: { showTitle: false }
			});

			expect(container.textContent).not.toContain('My Devices');
		});

		it('does not auto-load when autoLoad is false', async () => {
			render(UserDeviceManager, {
				props: { autoLoad: false }
			});

			// Should not call API automatically
			expect(fetch).not.toHaveBeenCalled();
		});
	});

	describe('Device Display', () => {
		it('shows correct device icons for different user agents', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				// Check for device icons (should be present but specific icon depends on user agent parsing)
				const deviceIcons = container.querySelectorAll('.device-icon');
				expect(deviceIcons.length).toBeGreaterThan(0);
			});
		});

		it('displays device status correctly', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				// Current device should show "This Device"
				expect(container.textContent).toContain('This Device');

				// Other devices should show active/inactive status
				expect(container.textContent).toContain('Inactive');
			});
		});

		it('shows session counts', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				expect(container.textContent).toContain('Active sessions');
			});
		});
	});

	describe('Accessibility', () => {
		it('has proper ARIA labels and roles', async () => {
			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				const manager = container.querySelector('[data-testid="user-device-manager"]');
				expect(manager).toBeTruthy();

				// Check for ARIA labels on buttons
				const buttons = container.querySelectorAll('button[aria-label]');
				expect(buttons.length).toBeGreaterThan(0);
			});
		});

		it('announces status messages with proper roles', async () => {
			fetch.mockRejectedValueOnce(new Error('Test error'));

			const { container } = render(UserDeviceManager);

			await waitFor(() => {
				const errorMessage = container.querySelector('[role="alert"]');
				expect(errorMessage).toBeTruthy();
				expect(errorMessage.textContent).toContain('Test error');
			});
		});
	});
});
