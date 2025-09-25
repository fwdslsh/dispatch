<!--
  UserDeviceManager.svelte

  User-facing device management interface for end users to view, rename, and revoke their own devices.
  Focuses on simplicity and user-friendly experience rather than admin functionality.
-->

<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import Modal from './Modal.svelte';
	import ConfirmationDialog from './ConfirmationDialog.svelte';

	const dispatch = createEventDispatcher();

	// Props
	let {
		autoLoad = true,
		showTitle = true,
		compact = false
	} = $props();

	// State
	let devices = $state([]);
	let loading = $state(false);
	let error = $state(null);
	let success = $state(null);
	let currentDevice = $state(null);

	// Modal states
	let showRenameModal = $state(false);
	let showDeviceDetails = $state(false);
	let showRevokeConfirm = $state(false);
	let selectedDevice = $state(null);

	// Form states
	let renameForm = $state({
		deviceId: null,
		newName: '',
		error: null,
		loading: false
	});

	/**
	 * Load user's devices from the server
	 */
	async function loadDevices() {
		if (!browser) return;

		loading = true;
		error = null;

		try {
			const response = await fetch('/api/user/devices', {
				method: 'GET',
				credentials: 'include'
			});

			const data = await response.json();

			if (data.success) {
				devices = data.devices || [];
				currentDevice = data.currentDevice || null;
			} else {
				error = data.error || 'Failed to load your devices';
			}
		} catch (err) {
			error = err.message || 'Network error loading devices';
			console.error('Error loading user devices:', err);
		} finally {
			loading = false;
		}
	}

	/**
	 * Rename a device
	 */
	async function renameDevice() {
		if (!renameForm.newName?.trim()) {
			renameForm.error = 'Device name cannot be empty';
			return;
		}

		renameForm.loading = true;
		renameForm.error = null;

		try {
			const response = await fetch('/api/user/devices/rename', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					deviceId: renameForm.deviceId,
					newName: renameForm.newName.trim()
				})
			});

			const data = await response.json();

			if (data.success) {
				success = 'Device renamed successfully';
				showRenameModal = false;
				renameForm = { deviceId: null, newName: '', error: null, loading: false };
				await loadDevices();

				dispatch('deviceRenamed', {
					deviceId: renameForm.deviceId,
					newName: renameForm.newName
				});
			} else {
				renameForm.error = data.error || 'Failed to rename device';
			}
		} catch (err) {
			renameForm.error = err.message || 'Network error renaming device';
		} finally {
			renameForm.loading = false;
		}
	}

	/**
	 * Revoke a device (end all sessions)
	 */
	async function revokeDevice() {
		if (!selectedDevice) return;

		try {
			const response = await fetch('/api/user/devices/revoke', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					deviceId: selectedDevice.id
				})
			});

			const data = await response.json();

			if (data.success) {
				success = `Device "${selectedDevice.deviceName}" has been revoked`;
				showRevokeConfirm = false;
				selectedDevice = null;
				await loadDevices();

				dispatch('deviceRevoked', {
					deviceId: selectedDevice.id,
					deviceName: selectedDevice.deviceName
				});
			} else {
				error = data.error || 'Failed to revoke device';
			}
		} catch (err) {
			error = err.message || 'Network error revoking device';
		}
	}

	/**
	 * Open rename modal for a device
	 */
	function openRenameModal(device) {
		selectedDevice = device;
		renameForm = {
			deviceId: device.id,
			newName: device.deviceName,
			error: null,
			loading: false
		};
		showRenameModal = true;
	}

	/**
	 * Open device details modal
	 */
	function openDeviceDetails(device) {
		selectedDevice = device;
		showDeviceDetails = true;
	}

	/**
	 * Open revoke confirmation dialog
	 */
	function confirmRevokeDevice(device) {
		selectedDevice = device;
		showRevokeConfirm = true;
	}

	/**
	 * Clear messages
	 */
	function clearMessages() {
		error = null;
		success = null;
	}

	/**
	 * Format date for display
	 */
	function formatDate(dateString) {
		if (!dateString) return 'Never';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Get device type icon
	 */
	function getDeviceIcon(userAgent) {
		if (!userAgent) return '💻';

		const ua = userAgent.toLowerCase();
		if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
			return '📱';
		} else if (ua.includes('tablet') || ua.includes('ipad')) {
			return '📱';
		} else if (ua.includes('mac')) {
			return '🖥️';
		} else if (ua.includes('windows')) {
			return '🖥️';
		} else if (ua.includes('linux')) {
			return '🖥️';
		}
		return '💻';
	}

	/**
	 * Get device status display
	 */
	function getDeviceStatus(device) {
		const isCurrentDevice = device.id === currentDevice?.id;
		const hasActiveSessions = (device.activeSessions || 0) > 0;

		if (isCurrentDevice) {
			return {
				text: 'This Device',
				class: 'current-device',
				icon: '📍'
			};
		} else if (hasActiveSessions) {
			return {
				text: 'Active',
				class: 'active-device',
				icon: '🟢'
			};
		} else {
			return {
				text: 'Inactive',
				class: 'inactive-device',
				icon: '⚪'
			};
		}
	}

	// Load devices on mount
	$effect(() => {
		if (autoLoad && browser) {
			loadDevices();
		}
	});

	onMount(() => {
		if (autoLoad && browser) {
			loadDevices();
		}
	});
</script>

<div class="user-device-manager" class:compact data-testid="user-device-manager">
	{#if showTitle && !compact}
		<div class="manager-header">
			<h3>My Devices</h3>
			<p class="subtitle">Manage the devices that can access your account</p>
		</div>
	{/if}

	<!-- Action bar -->
	<div class="action-bar">
		<Button
			variant="secondary"
			size="sm"
			onclick={loadDevices}
			disabled={loading}
			aria-label="Refresh devices list"
		>
			{#if loading}
				<LoadingSpinner size="xs" />
				<span>Loading...</span>
			{:else}
				🔄 Refresh
			{/if}
		</Button>

		<div class="device-count">
			{devices.length} {devices.length === 1 ? 'device' : 'devices'}
		</div>
	</div>

	<!-- Status Messages -->
	{#if error}
		<div class="status-message error" role="alert">
			<span class="message-icon">⚠️</span>
			<span class="message-text">{error}</span>
			<button class="message-close" onclick={clearMessages} aria-label="Dismiss error">
				×
			</button>
		</div>
	{/if}

	{#if success}
		<div class="status-message success" role="alert">
			<span class="message-icon">✅</span>
			<span class="message-text">{success}</span>
			<button class="message-close" onclick={clearMessages} aria-label="Dismiss success message">
				×
			</button>
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading && devices.length === 0}
		<div class="loading-state">
			<LoadingSpinner size="lg" />
			<p>Loading your devices...</p>
		</div>
	{:else if devices.length === 0 && !loading}
		<div class="empty-state">
			<div class="empty-icon">📱</div>
			<h4>No Devices Found</h4>
			<p>You don't have any registered devices yet. Devices are automatically registered when you sign in.</p>
		</div>
	{:else}
		<!-- Devices List -->
		<div class="devices-list" class:compact>
			{#each devices as device (device.id)}
				{@const status = getDeviceStatus(device)}
				<div class="device-card" class:current={device.id === currentDevice?.id}>
					<div class="device-main">
						<div class="device-info">
							<div class="device-header">
								<span class="device-icon" aria-hidden="true">
									{getDeviceIcon(device.userAgent)}
								</span>
								<div class="device-title">
									<h4 class="device-name">{device.deviceName}</h4>
									<div class="device-status">
										<span class="status-icon" aria-hidden="true">{status.icon}</span>
										<span class="status-text {status.class}">{status.text}</span>
									</div>
								</div>
							</div>

							{#if !compact}
								<div class="device-details">
									<div class="detail-item">
										<span class="detail-label">Added:</span>
										<span class="detail-value">{formatDate(device.createdAt)}</span>
									</div>
									{#if device.lastActivity}
										<div class="detail-item">
											<span class="detail-label">Last used:</span>
											<span class="detail-value">{formatDate(device.lastActivity)}</span>
										</div>
									{/if}
									<div class="detail-item">
										<span class="detail-label">Active sessions:</span>
										<span class="detail-value sessions-count">
											{device.activeSessions || 0}
										</span>
									</div>
								</div>
							{/if}
						</div>

						<div class="device-actions">
							<Button
								variant="secondary"
								size="sm"
								onclick={() => openDeviceDetails(device)}
								aria-label="View device details"
								data-testid="device-details-btn-{device.id}"
							>
								Details
							</Button>

							<Button
								variant="secondary"
								size="sm"
								onclick={() => openRenameModal(device)}
								aria-label="Rename device"
								data-testid="device-rename-btn-{device.id}"
							>
								Rename
							</Button>

							{#if device.id !== currentDevice?.id}
								<Button
									variant="danger"
									size="sm"
									onclick={() => confirmRevokeDevice(device)}
									aria-label="Revoke device access"
									data-testid="device-revoke-btn-{device.id}"
								>
									Revoke
								</Button>
							{:else}
								<span class="current-device-note">Current device</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if !compact}
			<div class="security-notice">
				<span class="notice-icon">🔒</span>
				<div class="notice-text">
					<strong>Device Security:</strong>
					Revoking a device will immediately end all active sessions and require re-authentication.
					Only revoke devices you no longer recognize or control.
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Rename Device Modal -->
{#if showRenameModal && selectedDevice}
	<Modal
		open={showRenameModal}
		title="Rename Device"
		size="small"
		onclose={() => showRenameModal = false}
		data-testid="rename-device-modal"
	>
		{#snippet children()}
			<form onsubmit={(e) => { e.preventDefault(); renameDevice(); }}>
				<div class="form-section">
					<label for="device-name-input" class="form-label">Device Name</label>
					<input
						id="device-name-input"
						type="text"
						class="form-input"
						bind:value={renameForm.newName}
						placeholder="Enter a name for this device"
						required
						disabled={renameForm.loading}
						data-testid="device-name-input"
						aria-describedby={renameForm.error ? 'rename-error' : undefined}
					/>
					{#if renameForm.error}
						<div id="rename-error" class="form-error" role="alert">
							{renameForm.error}
						</div>
					{/if}
				</div>

				<div class="form-actions">
					<Button
						variant="secondary"
						onclick={() => showRenameModal = false}
						disabled={renameForm.loading}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="primary"
						disabled={renameForm.loading || !renameForm.newName?.trim()}
						data-testid="rename-submit-btn"
					>
						{#if renameForm.loading}
							<LoadingSpinner size="xs" />
							<span>Renaming...</span>
						{:else}
							Save
						{/if}
					</Button>
				</div>
			</form>
		{/snippet}
	</Modal>
{/if}

<!-- Device Details Modal -->
{#if showDeviceDetails && selectedDevice}
	<Modal
		open={showDeviceDetails}
		title="Device Details"
		size="medium"
		onclose={() => showDeviceDetails = false}
		data-testid="device-details-modal"
	>
		{#snippet children()}
			<div class="device-details-content">
				<div class="detail-section">
					<h4>Device Information</h4>
					<div class="detail-grid">
						<div class="detail-row">
							<span class="detail-label">Name:</span>
							<span class="detail-value">{selectedDevice.deviceName}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Added:</span>
							<span class="detail-value">{formatDate(selectedDevice.createdAt)}</span>
						</div>
						{#if selectedDevice.lastActivity}
							<div class="detail-row">
								<span class="detail-label">Last Activity:</span>
								<span class="detail-value">{formatDate(selectedDevice.lastActivity)}</span>
							</div>
						{/if}
						<div class="detail-row">
							<span class="detail-label">Active Sessions:</span>
							<span class="detail-value">{selectedDevice.activeSessions || 0}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Trusted:</span>
							<span class="detail-value">
								{selectedDevice.isTrusted ? 'Yes' : 'No'}
							</span>
						</div>
					</div>
				</div>

				{#if selectedDevice.userAgent}
					<div class="detail-section">
						<h4>Browser Information</h4>
						<div class="browser-info">
							{selectedDevice.userAgent}
						</div>
					</div>
				{/if}

				<div class="detail-section">
					<h4>Security</h4>
					<div class="security-info">
						<div class="fingerprint-display">
							<span class="detail-label">Device Fingerprint:</span>
							<code class="fingerprint">{selectedDevice.deviceFingerprint}</code>
						</div>
						<p class="fingerprint-help">
							The device fingerprint is a unique identifier based on your browser and system characteristics.
						</p>
					</div>
				</div>
			</div>

			<div class="modal-actions">
				<Button
					variant="secondary"
					onclick={() => showDeviceDetails = false}
				>
					Close
				</Button>
			</div>
		{/snippet}
	</Modal>
{/if}

<!-- Revoke Confirmation Dialog -->
{#if showRevokeConfirm && selectedDevice}
	<ConfirmationDialog
		title="Revoke Device Access"
		message={`Are you sure you want to revoke access for "${selectedDevice.deviceName}"? This will immediately end all active sessions on this device.`}
		confirmText="Revoke Access"
		confirmVariant="danger"
		onconfirm={revokeDevice}
		oncancel={() => {
			showRevokeConfirm = false;
			selectedDevice = null;
		}}
		data-testid="revoke-device-confirm"
	/>
{/if}

<style>
	.user-device-manager {
		width: 100%;
	}

	.user-device-manager.compact {
		--spacing-sm: 0.5rem;
		--spacing-md: 0.75rem;
	}

	/* Header */
	.manager-header {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.manager-header h3 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
		font-size: 1.5rem;
		font-weight: 600;
	}

	.subtitle {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* Action Bar */
	.action-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: 6px;
		border: 1px solid var(--color-border);
	}

	.device-count {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	/* Status Messages */
	.status-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		margin-bottom: 1rem;
		border-radius: 6px;
		border: 1px solid;
		font-size: 0.875rem;
	}

	.status-message.error {
		background: var(--color-error-bg);
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.status-message.success {
		background: var(--color-success-bg);
		border-color: var(--color-success);
		color: var(--color-success);
	}

	.message-icon {
		flex-shrink: 0;
		font-size: 1rem;
	}

	.message-text {
		flex: 1;
	}

	.message-close {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0;
		color: inherit;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.message-close:hover {
		opacity: 1;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem;
		text-align: center;
	}

	.loading-state p {
		margin: 0;
		color: var(--color-text-secondary);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.empty-state h4 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
		font-size: 1.25rem;
	}

	.empty-state p {
		margin: 0;
		color: var(--color-text-secondary);
	}

	/* Devices List */
	.devices-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.devices-list.compact {
		gap: 0.75rem;
	}

	/* Device Card */
	.device-card {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		transition: border-color 0.2s ease;
	}

	.device-card.current {
		border-color: var(--color-primary);
		background: var(--color-primary-alpha);
	}

	.device-card:hover {
		border-color: var(--color-primary-light);
	}

	.device-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1rem;
		gap: 1rem;
	}

	/* Device Info */
	.device-info {
		flex: 1;
		min-width: 0;
	}

	.device-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.device-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.device-title {
		flex: 1;
		min-width: 0;
	}

	.device-name {
		margin: 0 0 0.25rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		word-break: break-word;
	}

	.device-status {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
	}

	.status-icon {
		font-size: 0.7rem;
	}

	.status-text {
		font-weight: 500;
	}

	.status-text.current-device {
		color: var(--color-primary);
	}

	.status-text.active-device {
		color: var(--color-success);
	}

	.status-text.inactive-device {
		color: var(--color-text-secondary);
	}

	/* Device Details */
	.device-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.5rem;
		margin-left: 2.25rem; /* Align with device title */
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.detail-label {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.detail-value {
		font-size: 0.8rem;
		color: var(--color-text);
		word-break: break-word;
	}

	.sessions-count {
		font-weight: 600;
		color: var(--color-primary);
	}

	/* Device Actions */
	.device-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
		align-items: flex-start;
	}

	.current-device-note {
		padding: 0.375rem 0.75rem;
		background: var(--color-primary-alpha);
		color: var(--color-primary);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
	}

	/* Security Notice */
	.security-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		margin-top: 1.5rem;
		background: var(--color-info-bg);
		border: 1px solid var(--color-info);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-info);
	}

	.notice-icon {
		flex-shrink: 0;
		font-size: 1rem;
	}

	.notice-text {
		line-height: 1.4;
	}

	/* Modal Content */
	.form-section {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.form-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 0.875rem;
		transition: border-color 0.2s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
	}

	.form-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.form-error {
		margin-top: 0.5rem;
		color: var(--color-error);
		font-size: 0.8rem;
		font-weight: 500;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	/* Device Details Content */
	.device-details-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.detail-section h4 {
		margin: 0 0 0.75rem 0;
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0.5rem;
	}

	.detail-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border-light);
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-row .detail-label {
		font-weight: 500;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.detail-row .detail-value {
		font-weight: 400;
		color: var(--color-text);
		font-size: 0.875rem;
		text-align: right;
	}

	.browser-info {
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		word-break: break-all;
	}

	.security-info {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.fingerprint-display {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.fingerprint {
		font-family: monospace;
		font-size: 0.75rem;
		padding: 0.5rem;
		background: var(--color-bg-secondary);
		border-radius: 4px;
		word-break: break-all;
		color: var(--color-text-secondary);
	}

	.fingerprint-help {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		line-height: 1.4;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.device-main {
			flex-direction: column;
			gap: 1rem;
		}

		.device-actions {
			align-self: stretch;
			justify-content: center;
		}

		.device-details {
			margin-left: 0;
			grid-template-columns: 1fr;
		}

		.detail-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.detail-row .detail-value {
			text-align: left;
		}

		.action-bar {
			flex-direction: column;
			gap: 0.75rem;
		}
	}

	@media (max-width: 480px) {
		.device-card {
			border-radius: 6px;
		}

		.device-main {
			padding: 0.75rem;
		}

		.device-actions {
			flex-wrap: wrap;
		}

		.security-notice {
			padding: 0.75rem;
			font-size: 0.8rem;
		}
	}
</style>