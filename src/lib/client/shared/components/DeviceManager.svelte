<script>
	import { onMount } from 'svelte';

	// Props
	let { apiClient, isVisible = false, selectedUserId = null } = $props();

	// State
	let devices = $state([]);
	let activeSessions = $state([]);
	let loading = $state(false);
	let error = $state('');
	let success = $state('');
	let selectedDevice = $state(null);
	let showDeviceDetails = $state(false);
	let showRenameModal = $state(false);
	let renameForm = $state({ deviceId: null, newName: '' });

	// Load data when component becomes visible
	$effect(() => {
		if (isVisible) {
			loadDevices();
			loadActiveSessions();
		}
	});

	// Load devices when selected user changes
	$effect(() => {
		if (isVisible && selectedUserId) {
			loadUserDevices();
		}
	});

	async function loadDevices() {
		if (selectedUserId) {
			await loadUserDevices();
		} else {
			await loadAllDevices();
		}
	}

	async function loadUserDevices() {
		loading = true;
		error = '';

		try {
			const response = await apiClient.post('/api/admin/devices/user', {
				userId: selectedUserId
			});

			if (response.ok) {
				const data = await response.json();
				devices = data.devices || [];
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to load user devices';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function loadAllDevices() {
		loading = true;
		error = '';

		try {
			const response = await apiClient.post('/api/admin/devices/list');

			if (response.ok) {
				const data = await response.json();
				devices = data.devices || [];
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to load devices';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function loadActiveSessions() {
		try {
			const response = await apiClient.post('/api/admin/sessions/list');

			if (response.ok) {
				const data = await response.json();
				activeSessions = data.sessions || [];
			} else {
				console.warn('Failed to load active sessions');
			}
		} catch (err) {
			console.warn('Network error loading sessions:', err.message);
		}
	}

	async function revokeDevice(deviceId, deviceName) {
		if (
			!confirm(
				`Are you sure you want to revoke device "${deviceName}"? This will end all active sessions for this device.`
			)
		) {
			return;
		}

		try {
			const response = await apiClient.post('/api/admin/devices/revoke', {
				deviceId
			});

			const data = await response.json();

			if (data.success) {
				success = 'Device revoked successfully';
				loadDevices();
				loadActiveSessions(); // Refresh sessions list
			} else {
				error = data.error || 'Failed to revoke device';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	async function toggleDeviceTrust(deviceId, currentTrust) {
		const action = currentTrust ? 'untrust' : 'trust';

		try {
			const response = await apiClient.post('/api/admin/devices/toggle-trust', {
				deviceId
			});

			const data = await response.json();

			if (data.success) {
				success = `Device ${action}ed successfully`;
				loadDevices(); // Refresh devices list
			} else {
				error = data.error || `Failed to ${action} device`;
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	async function renameDevice() {
		if (!renameForm.newName.trim()) {
			error = 'Device name cannot be empty';
			return;
		}

		try {
			const response = await apiClient.post('/api/admin/devices/rename', {
				deviceId: renameForm.deviceId,
				newName: renameForm.newName.trim()
			});

			const data = await response.json();

			if (data.success) {
				success = 'Device renamed successfully';
				showRenameModal = false;
				loadDevices(); // Refresh devices list
			} else {
				error = data.error || 'Failed to rename device';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	async function revokeSession(sessionToken, deviceName) {
		if (!confirm(`Are you sure you want to revoke this session for "${deviceName}"?`)) {
			return;
		}

		try {
			const response = await apiClient.post('/api/admin/sessions/revoke', {
				sessionToken
			});

			const data = await response.json();

			if (data.success) {
				success = 'Session revoked successfully';
				loadActiveSessions(); // Refresh sessions list
			} else {
				error = data.error || 'Failed to revoke session';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	function openRenameModal(device) {
		renameForm = {
			deviceId: device.id,
			newName: device.deviceName
		};
		showRenameModal = true;
	}

	function closeMessages() {
		error = '';
		success = '';
	}

	function formatDate(timestamp) {
		return new Date(timestamp).toLocaleString();
	}

	function getDeviceSessionCount(deviceId) {
		return activeSessions.filter((session) => session.deviceId === deviceId).length;
	}
</script>

{#if isVisible}
	<div class="device-manager">
		<div class="device-manager-header">
			<h3>
				{#if selectedUserId}
					User Device Management
				{:else}
					System Device Management
				{/if}
			</h3>
			<div class="header-actions">
				<button class="btn btn-secondary" onclick={loadDevices}> Refresh </button>
			</div>
		</div>

		<!-- Messages -->
		{#if error}
			<div class="alert alert-error">
				{error}
				<button class="btn-close" onclick={closeMessages}>&times;</button>
			</div>
		{/if}

		{#if success}
			<div class="alert alert-success">
				{success}
				<button class="btn-close" onclick={closeMessages}>&times;</button>
			</div>
		{/if}

		<!-- Loading State -->
		{#if loading}
			<div class="loading">Loading devices...</div>
		{/if}

		<!-- Devices Section -->
		{#if !loading}
			<div class="section">
				<h4>Devices ({devices.length})</h4>

				{#if devices.length > 0}
					<div class="devices-grid">
						{#each devices as device (device.id)}
							<div class="device-card">
								<div class="device-header">
									<div class="device-name">
										<strong>{device.deviceName}</strong>
										{#if device.isTrusted}
											<span class="trusted-badge">Trusted</span>
										{:else}
											<span class="untrusted-badge">Untrusted</span>
										{/if}
									</div>
									<div class="device-actions">
										<button
											class="btn btn-sm"
											onclick={() => openRenameModal(device)}
											title="Rename device"
										>
											Rename
										</button>

										<button
											class="btn btn-sm {device.isTrusted ? 'btn-warning' : 'btn-secondary'}"
											onclick={() => toggleDeviceTrust(device.id, device.isTrusted)}
											title={device.isTrusted ? 'Remove trust' : 'Mark as trusted'}
										>
											{device.isTrusted ? 'Untrust' : 'Trust'}
										</button>

										<button
											class="btn btn-sm btn-danger"
											onclick={() => revokeDevice(device.id, device.deviceName)}
											title="Revoke device and all sessions"
										>
											Revoke
										</button>
									</div>
								</div>

								<div class="device-info">
									<div class="info-item">
										<label>Fingerprint:</label>
										<span class="fingerprint">{device.deviceFingerprint}</span>
									</div>

									<div class="info-item">
										<label>Created:</label>
										<span>{formatDate(device.createdAt)}</span>
									</div>

									{#if device.username}
										<div class="info-item">
											<label>User:</label>
											<span>{device.username}</span>
										</div>
									{/if}

									<div class="info-item">
										<label>Active Sessions:</label>
										<span class="session-count">{device.activeSessions}</span>
									</div>
								</div>

								<!-- Device Sessions -->
								{#if device.sessions && device.sessions.length > 0}
									<div class="device-sessions">
										<h6>Active Sessions:</h6>
										<div class="sessions-list">
											{#each device.sessions as session}
												<div class="session-item">
													<div class="session-info">
														<span class="session-id">Session {session.id}</span>
														<span class="session-expires">
															Expires: {formatDate(session.expiresAt)}
														</span>
													</div>
													<button
														class="btn btn-xs btn-danger"
														onclick={() => revokeSession(session.sessionToken, device.deviceName)}
													>
														End
													</button>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="no-results">
						{#if selectedUserId}
							No devices found for this user.
						{:else}
							No devices found in the system.
						{/if}
					</div>
				{/if}
			</div>

			<!-- Active Sessions Section -->
			{#if !selectedUserId && activeSessions.length > 0}
				<div class="section">
					<h4>All Active Sessions ({activeSessions.length})</h4>

					<div class="sessions-table-container">
						<table class="sessions-table">
							<thead>
								<tr>
									<th>User</th>
									<th>Device</th>
									<th>Created</th>
									<th>Last Activity</th>
									<th>Expires</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each activeSessions as session (session.sessionToken)}
									<tr>
										<td>{session.username}</td>
										<td>{session.deviceName}</td>
										<td>{formatDate(session.createdAt)}</td>
										<td>
											{#if session.lastActivity}
												{formatDate(session.lastActivity)}
											{:else}
												<span class="no-activity">No activity</span>
											{/if}
										</td>
										<td>{formatDate(session.expiresAt)}</td>
										<td>
											<button
												class="btn btn-sm btn-danger"
												onclick={() => revokeSession(session.sessionToken, session.deviceName)}
											>
												Revoke
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/if}

		<!-- Rename Device Modal -->
		{#if showRenameModal}
			<div class="modal-overlay">
				<div class="modal">
					<div class="modal-header">
						<h4>Rename Device</h4>
						<button
							class="btn-close"
							onclick={() => {
								showRenameModal = false;
							}}>&times;</button
						>
					</div>

					<form
						onsubmit={(e) => {
							e.preventDefault();
							renameDevice();
						}}
					>
						<div class="form-group">
							<label for="deviceName">Device Name</label>
							<input
								type="text"
								id="deviceName"
								bind:value={renameForm.newName}
								placeholder="Enter new device name"
								required
							/>
						</div>

						<div class="modal-actions">
							<button
								type="button"
								class="btn"
								onclick={() => {
									showRenameModal = false;
								}}
							>
								Cancel
							</button>
							<button type="submit" class="btn btn-primary"> Rename </button>
						</div>
					</form>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.device-manager {
		padding: 20px;
		background: #f5f5f5;
		border-radius: 8px;
		margin: 10px 0;
	}

	.device-manager-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.device-manager-header h3 {
		margin: 0;
		color: #333;
	}

	.header-actions {
		display: flex;
		gap: 10px;
	}

	.alert {
		padding: 12px 16px;
		border-radius: 6px;
		margin-bottom: 16px;
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.alert-error {
		background: #fee;
		border: 1px solid #fcc;
		color: #c33;
	}

	.alert-success {
		background: #efe;
		border: 1px solid #cfc;
		color: #383;
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 18px;
		cursor: pointer;
		color: inherit;
		opacity: 0.7;
	}

	.btn-close:hover {
		opacity: 1;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.section {
		margin-bottom: 30px;
	}

	.section h4 {
		margin: 0 0 15px 0;
		color: #333;
		border-bottom: 2px solid #eee;
		padding-bottom: 8px;
	}

	.devices-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 20px;
	}

	.device-card {
		background: white;
		border-radius: 8px;
		padding: 16px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		border: 1px solid #ddd;
	}

	.device-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.device-name {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.device-name strong {
		font-size: 16px;
		color: #333;
	}

	.trusted-badge {
		background: #28a745;
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 10px;
		text-transform: uppercase;
		font-weight: 500;
		width: fit-content;
	}

	.untrusted-badge {
		background: #ffc107;
		color: #212529;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 10px;
		text-transform: uppercase;
		font-weight: 500;
		width: fit-content;
	}

	.device-actions {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.device-info {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 12px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-item label {
		font-size: 11px;
		text-transform: uppercase;
		font-weight: 600;
		color: #666;
	}

	.info-item span {
		color: #333;
		font-size: 13px;
	}

	.fingerprint {
		font-family: monospace;
		font-size: 11px !important;
		color: #666 !important;
		word-break: break-all;
	}

	.session-count {
		font-weight: 600;
		color: #007bff !important;
	}

	.device-sessions {
		border-top: 1px solid #eee;
		padding-top: 12px;
	}

	.device-sessions h6 {
		margin: 0 0 8px 0;
		color: #555;
		font-size: 12px;
		text-transform: uppercase;
		font-weight: 600;
	}

	.sessions-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.session-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: #f8f9fa;
		border-radius: 4px;
		border-left: 3px solid #007bff;
	}

	.session-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.session-id {
		font-weight: 600;
		font-size: 12px;
		color: #333;
	}

	.session-expires {
		font-size: 11px;
		color: #666;
	}

	.no-results {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.sessions-table-container {
		background: white;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.sessions-table {
		width: 100%;
		border-collapse: collapse;
	}

	.sessions-table th,
	.sessions-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.sessions-table th {
		background: #f8f9fa;
		font-weight: 600;
		color: #555;
		font-size: 13px;
	}

	.sessions-table tr:hover {
		background: #f8f9fa;
	}

	.no-activity {
		color: #999;
		font-style: italic;
	}

	.btn {
		padding: 6px 12px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
		text-decoration: none;
		display: inline-block;
	}

	.btn:hover {
		background: #f5f5f5;
	}

	.btn-primary {
		background: #007bff;
		color: white;
		border-color: #007bff;
	}

	.btn-primary:hover {
		background: #0056b3;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
		border-color: #6c757d;
	}

	.btn-secondary:hover {
		background: #545b62;
	}

	.btn-warning {
		background: #ffc107;
		color: #212529;
		border-color: #ffc107;
	}

	.btn-warning:hover {
		background: #e0a800;
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
		font-size: 12px;
	}

	.btn-xs {
		padding: 2px 6px;
		font-size: 11px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		padding: 0;
		width: 90%;
		max-width: 400px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #eee;
	}

	.modal-header h4 {
		margin: 0;
	}

	.form-group {
		margin-bottom: 16px;
		padding: 0 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 4px;
		font-weight: 500;
		color: #555;
	}

	.form-group input {
		width: 100%;
		padding: 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 20px;
		border-top: 1px solid #eee;
	}
</style>
