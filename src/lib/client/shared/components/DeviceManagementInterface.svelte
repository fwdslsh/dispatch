<script>
	import { onMount } from 'svelte';

	// Props
	export let apiEndpoint = '/api/admin/devices';
	export let userId = null; // Optional: filter by specific user

	// State
	let devices = $state([]);
	let loading = $state(false);
	let error = $state(null);
	let selectedDevice = $state(null);
	let showDeviceDetails = $state(false);
	let showRevokeConfirm = $state(false);

	// Pagination
	let currentPage = $state(1);
	let totalPages = $state(1);
	let totalDevices = $state(0);
	let limit = $state(20);

	// Device details
	let deviceDetails = $state(null);

	onMount(() => {
		loadDevices();
	});

	async function loadDevices() {
		loading = true;
		error = null;

		try {
			const params = new URLSearchParams({
				page: currentPage.toString(),
				limit: limit.toString()
			});

			if (userId) {
				params.set('userId', userId);
			}

			const response = await fetch(`${apiEndpoint}?${params}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load devices');
			}

			devices = result.devices || [];
			totalPages = result.totalPages || 1;
			totalDevices = result.total || 0;
		} catch (err) {
			error = err.message;
			console.error('Error loading devices:', err);
		} finally {
			loading = false;
		}
	}

	async function revokeDevice(device) {
		try {
			const response = await fetch(`${apiEndpoint}/${device.id}`, {
				method: 'DELETE'
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to revoke device');
			}

			showRevokeConfirm = false;
			selectedDevice = null;

			// Reload devices list
			await loadDevices();
		} catch (err) {
			error = err.message;
			console.error('Error revoking device:', err);
		}
	}

	async function renameDevice(deviceId, newName) {
		try {
			const response = await fetch(`${apiEndpoint}/${deviceId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ deviceName: newName })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to rename device');
			}

			// Reload devices list
			await loadDevices();
		} catch (err) {
			error = err.message;
			console.error('Error renaming device:', err);
		}
	}

	async function toggleDeviceTrust(device) {
		try {
			const response = await fetch(`${apiEndpoint}/${device.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isTrusted: !device.isTrusted })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to toggle device trust');
			}

			// Reload devices list
			await loadDevices();
		} catch (err) {
			error = err.message;
			console.error('Error toggling device trust:', err);
		}
	}

	async function viewDeviceDetails(device) {
		selectedDevice = device;
		deviceDetails = null;
		showDeviceDetails = true;

		try {
			const response = await fetch(`${apiEndpoint}/${device.id}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load device details');
			}

			deviceDetails = result.device;
		} catch (err) {
			error = err.message;
			console.error('Error loading device details:', err);
		}
	}

	function goToPage(page) {
		currentPage = page;
		loadDevices();
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function confirmRevoke(device) {
		selectedDevice = device;
		showRevokeConfirm = true;
	}

	function handleRename(device) {
		const newName = prompt('Enter new device name:', device.deviceName);
		if (newName && newName !== device.deviceName) {
			renameDevice(device.id, newName);
		}
	}
</script>

<div class="device-management">
	<div class="header">
		<h2>Device Management</h2>
		{#if userId}
			<span class="subtitle">Devices for user ID: {userId}</span>
		{:else}
			<span class="subtitle">All devices</span>
		{/if}
	</div>

	{#if error}
		<div class="error-banner">
			{error}
			<button onclick={() => (error = null)} class="close-btn">&times;</button>
		</div>
	{/if}

	<div class="stats">
		Total Devices: {totalDevices}
	</div>

	<!-- Devices table -->
	<div class="table-container">
		<table class="devices-table">
			<thead>
				<tr>
					<th>Device Name</th>
					{#if !userId}
						<th>User</th>
					{/if}
					<th>Trust Status</th>
					<th>Active Sessions</th>
					<th>Created</th>
					<th>Last Activity</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan={userId ? '6' : '7'} class="loading">Loading devices...</td>
					</tr>
				{:else if devices.length === 0}
					<tr>
						<td colspan={userId ? '6' : '7'} class="empty">No devices found</td>
					</tr>
				{:else}
					{#each devices as device (device.id)}
						<tr>
							<td>
								<div class="device-info">
									<div class="device-name">{device.deviceName}</div>
									<div class="device-fingerprint">{device.deviceFingerprint}</div>
								</div>
							</td>
							{#if !userId}
								<td>{device.username}</td>
							{/if}
							<td>
								<label class="trust-toggle">
									<input
										type="checkbox"
										checked={device.isTrusted}
										onchange={() => toggleDeviceTrust(device)}
									/>
									<span class="toggle-slider"></span>
									<span class="toggle-label">
										{device.isTrusted ? 'Trusted' : 'Untrusted'}
									</span>
								</label>
							</td>
							<td>
								<span class="session-count {device.activeSessions > 0 ? 'active' : 'inactive'}">
									{device.activeSessions}
								</span>
							</td>
							<td>{formatDate(device.createdAt)}</td>
							<td>
								{device.lastActivity ? formatDate(device.lastActivity) : 'Never'}
							</td>
							<td class="actions">
								<button class="btn btn-sm btn-secondary" onclick={() => viewDeviceDetails(device)}>
									Details
								</button>
								<button class="btn btn-sm btn-secondary" onclick={() => handleRename(device)}>
									Rename
								</button>
								<button class="btn btn-sm btn-danger" onclick={() => confirmRevoke(device)}>
									Revoke
								</button>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="pagination">
			<button
				class="btn btn-sm"
				onclick={() => goToPage(currentPage - 1)}
				disabled={currentPage <= 1}
			>
				Previous
			</button>

			{#each Array(totalPages).fill(0) as _, i}
				{@const pageNum = i + 1}
				<button
					class="btn btn-sm {pageNum === currentPage ? 'active' : ''}"
					onclick={() => goToPage(pageNum)}
				>
					{pageNum}
				</button>
			{/each}

			<button
				class="btn btn-sm"
				onclick={() => goToPage(currentPage + 1)}
				disabled={currentPage >= totalPages}
			>
				Next
			</button>
		</div>
	{/if}
</div>

<!-- Device Details Modal -->
{#if showDeviceDetails && selectedDevice}
	<div class="modal-backdrop" onclick={() => (showDeviceDetails = false)}>
		<div class="modal device-details-modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Device Details</h3>
				<button class="close-btn" onclick={() => (showDeviceDetails = false)}>&times;</button>
			</div>

			<div class="modal-body">
				{#if deviceDetails}
					<div class="device-info-section">
						<h4>Device Information</h4>
						<div class="info-grid">
							<div class="info-item">
								<label>Name:</label>
								<span>{deviceDetails.deviceName}</span>
							</div>
							<div class="info-item">
								<label>User:</label>
								<span>{deviceDetails.username} ({deviceDetails.userDisplayName})</span>
							</div>
							<div class="info-item">
								<label>Fingerprint:</label>
								<span class="fingerprint">{deviceDetails.deviceFingerprint}</span>
							</div>
							<div class="info-item">
								<label>Trust Status:</label>
								<span class="trust-status {deviceDetails.isTrusted ? 'trusted' : 'untrusted'}">
									{deviceDetails.isTrusted ? 'Trusted' : 'Untrusted'}
								</span>
							</div>
							<div class="info-item">
								<label>Created:</label>
								<span>{formatDate(deviceDetails.createdAt)}</span>
							</div>
						</div>
					</div>

					<div class="sessions-section">
						<h4>Active Sessions ({deviceDetails.sessions?.length || 0})</h4>
						{#if deviceDetails.sessions?.length > 0}
							<div class="sessions-list">
								{#each deviceDetails.sessions as session}
									<div class="session-item">
										<div class="session-info">
											<div class="session-time">
												Started: {formatDate(session.createdAt)}
												{#if session.lastActivity}
													| Last Activity: {formatDate(session.lastActivity)}
												{/if}
											</div>
											<div class="session-details">
												<span class="ip-address">{session.ipAddress}</span>
												<span class="user-agent">{session.userAgent}</span>
											</div>
										</div>
										<div class="session-expires">
											Expires: {formatDate(session.expiresAt)}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="no-sessions">No active sessions</p>
						{/if}
					</div>

					<div class="events-section">
						<h4>Recent Events</h4>
						{#if deviceDetails.recentEvents?.length > 0}
							<div class="events-list">
								{#each deviceDetails.recentEvents as event}
									<div class="event-item">
										<div class="event-time">{formatDate(event.createdAt)}</div>
										<div class="event-type">{event.eventType}</div>
										<div class="event-details">
											{event.ipAddress} - {event.userAgent}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="no-events">No recent events</p>
						{/if}
					</div>
				{:else}
					<div class="loading">Loading device details...</div>
				{/if}
			</div>

			<div class="modal-actions">
				<button class="btn btn-secondary" onclick={() => (showDeviceDetails = false)}>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Revoke Confirmation Modal -->
{#if showRevokeConfirm && selectedDevice}
	<div class="modal-backdrop" onclick={() => (showRevokeConfirm = false)}>
		<div class="modal confirm-modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Revoke Device</h3>
				<button class="close-btn" onclick={() => (showRevokeConfirm = false)}>&times;</button>
			</div>

			<div class="modal-body">
				<p>Are you sure you want to revoke device <strong>{selectedDevice.deviceName}</strong>?</p>
				<p class="warning">
					This will terminate all active sessions on this device. The user will need to
					re-authenticate.
				</p>
			</div>

			<div class="modal-actions">
				<button class="btn btn-secondary" onclick={() => (showRevokeConfirm = false)}>
					Cancel
				</button>
				<button class="btn btn-danger" onclick={() => revokeDevice(selectedDevice)}>
					Revoke Device
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.device-management {
		padding: 20px;
	}

	.header {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-bottom: 20px;
	}

	.header h2 {
		margin: 0;
		color: var(--text-primary, #333);
	}

	.subtitle {
		color: var(--text-secondary, #666);
		font-size: 14px;
	}

	.error-banner {
		background: #fee;
		border: 1px solid #fcc;
		color: #c33;
		padding: 10px;
		margin-bottom: 20px;
		border-radius: 4px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		width: 20px;
		height: 20px;
	}

	.stats {
		color: var(--text-secondary, #666);
		font-size: 14px;
		margin-bottom: 20px;
	}

	.table-container {
		overflow-x: auto;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.devices-table {
		width: 100%;
		border-collapse: collapse;
		background: white;
	}

	.devices-table th,
	.devices-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.devices-table th {
		background: #f8f9fa;
		font-weight: 600;
		color: var(--text-primary, #333);
	}

	.device-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.device-name {
		font-weight: 600;
	}

	.device-fingerprint {
		font-size: 12px;
		color: var(--text-secondary, #666);
		font-family: monospace;
	}

	.trust-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.trust-toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 20px;
		background-color: #ccc;
		border-radius: 20px;
		transition: 0.4s;
	}

	.toggle-slider:before {
		position: absolute;
		content: '';
		height: 16px;
		width: 16px;
		left: 2px;
		bottom: 2px;
		background-color: white;
		transition: 0.4s;
		border-radius: 50%;
	}

	input:checked + .toggle-slider {
		background-color: #4caf50;
	}

	input:checked + .toggle-slider:before {
		transform: translateX(20px);
	}

	.toggle-label {
		font-size: 12px;
		font-weight: 600;
	}

	.session-count {
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
	}

	.session-count.active {
		background: #e8f5e8;
		color: #2e7d2e;
	}

	.session-count.inactive {
		background: #f5f5f5;
		color: #666;
	}

	.loading,
	.empty {
		text-align: center;
		color: var(--text-secondary, #666);
		font-style: italic;
		padding: 40px;
	}

	.actions {
		white-space: nowrap;
		display: flex;
		gap: 5px;
	}

	.btn {
		padding: 6px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 12px;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s ease;
	}

	.btn:hover {
		background: #f8f9fa;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
		border-color: #6c757d;
	}

	.btn-secondary:hover {
		background: #545b62;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
		border-color: #dc3545;
	}

	.btn-danger:hover {
		background: #c82333;
	}

	.btn-sm {
		padding: 4px 8px;
		font-size: 11px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 5px;
		margin-top: 20px;
	}

	.pagination .btn.active {
		background: var(--primary-color, #007bff);
		color: white;
		border-color: var(--primary-color, #007bff);
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		padding: 0;
		max-width: 800px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.device-details-modal {
		max-width: 900px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #eee;
	}

	.modal-header h3 {
		margin: 0;
	}

	.modal-body {
		padding: 20px;
	}

	.device-info-section,
	.sessions-section,
	.events-section {
		margin-bottom: 30px;
	}

	.device-info-section h4,
	.sessions-section h4,
	.events-section h4 {
		margin: 0 0 15px 0;
		color: var(--text-primary, #333);
		border-bottom: 1px solid #eee;
		padding-bottom: 5px;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 15px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.info-item label {
		font-weight: 600;
		color: var(--text-secondary, #666);
		font-size: 12px;
		text-transform: uppercase;
	}

	.fingerprint {
		font-family: monospace;
		font-size: 11px;
		background: #f8f9fa;
		padding: 4px 6px;
		border-radius: 3px;
	}

	.trust-status.trusted {
		color: #2e7d2e;
		font-weight: 600;
	}

	.trust-status.untrusted {
		color: #d73527;
		font-weight: 600;
	}

	.sessions-list,
	.events-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.session-item,
	.event-item {
		padding: 10px;
		border: 1px solid #eee;
		border-radius: 4px;
		background: #f8f9fa;
	}

	.session-info {
		margin-bottom: 5px;
	}

	.session-time {
		font-size: 12px;
		color: var(--text-secondary, #666);
		margin-bottom: 3px;
	}

	.session-details {
		font-size: 11px;
		color: var(--text-secondary, #666);
	}

	.ip-address {
		font-family: monospace;
		margin-right: 10px;
	}

	.session-expires {
		font-size: 11px;
		color: #d73527;
	}

	.event-time {
		font-size: 12px;
		color: var(--text-secondary, #666);
	}

	.event-type {
		font-weight: 600;
		margin: 3px 0;
	}

	.event-details {
		font-size: 11px;
		color: var(--text-secondary, #666);
	}

	.no-sessions,
	.no-events {
		color: var(--text-secondary, #666);
		font-style: italic;
		text-align: center;
		padding: 20px;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 20px;
		border-top: 1px solid #eee;
	}

	.confirm-modal .warning {
		color: #856404;
		background: #fff3cd;
		padding: 10px;
		border-radius: 4px;
		font-size: 14px;
		margin-top: 10px;
	}
</style>
