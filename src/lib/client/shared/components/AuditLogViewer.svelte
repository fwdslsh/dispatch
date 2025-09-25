<script>
	import { onMount } from 'svelte';

	// Props
	let {
		apiClient,
		isVisible = false
	} = $props();

	// State
	let auditLogs = $state([]);
	let pagination = $state({ page: 1, limit: 50, total: 0, pages: 0 });
	let filters = $state({
		eventType: '',
		userId: '',
		ipAddress: '',
		dateFrom: '',
		dateTo: ''
	});
	let loading = $state(false);
	let error = $state('');
	let success = $state('');
	let selectedEvent = $state(null);
	let showEventDetails = $state(false);
	let showExportModal = $state(false);

	// Event type options for filtering
	const eventTypes = [
		{ value: '', label: 'All Events' },
		{ value: 'login', label: 'Login' },
		{ value: 'logout', label: 'Logout' },
		{ value: 'login_failed', label: 'Login Failed' },
		{ value: 'user_created', label: 'User Created' },
		{ value: 'user_deleted', label: 'User Deleted' },
		{ value: 'admin_promoted', label: 'Admin Promoted' },
		{ value: 'admin_demoted', label: 'Admin Demoted' },
		{ value: 'oauth_linked', label: 'OAuth Linked' },
		{ value: 'oauth_unlinked', label: 'OAuth Unlinked' },
		{ value: 'device_registered', label: 'Device Registered' },
		{ value: 'device_revoked', label: 'Device Revoked' },
		{ value: 'session_revoked', label: 'Session Revoked' }
	];

	// Load logs when component becomes visible or filters change
	$effect(() => {
		if (isVisible) {
			loadAuditLogs();
		}
	});

	// Watch for filter changes with debouncing
	let filterTimeout = null;
	$effect(() => {
		if (!isVisible) return;

		if (filterTimeout) {
			clearTimeout(filterTimeout);
		}

		filterTimeout = setTimeout(() => {
			pagination.page = 1; // Reset to first page when filters change
			loadAuditLogs();
		}, 500);

		return () => {
			if (filterTimeout) {
				clearTimeout(filterTimeout);
			}
		};
	});

	async function loadAuditLogs() {
		loading = true;
		error = '';

		try {
			const params = {
				page: pagination.page,
				limit: pagination.limit,
				...filters
			};

			// Convert date strings to Date objects if provided
			if (params.dateFrom) {
				params.dateFrom = new Date(params.dateFrom);
			}
			if (params.dateTo) {
				params.dateTo = new Date(params.dateTo);
			}

			const response = await apiClient.post('/api/admin/audit/logs', params);

			if (response.ok) {
				const data = await response.json();
				auditLogs = data.events;
				pagination = data.pagination;
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to load audit logs';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function exportAuditLogs(format = 'json') {
		try {
			const params = {
				format,
				dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : null,
				dateTo: filters.dateTo ? new Date(filters.dateTo) : null
			};

			const response = await apiClient.post('/api/admin/audit/export', params);

			if (response.ok) {
				const data = await response.json();

				if (data.success) {
					// Create and download the file
					const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					success = 'Audit logs exported successfully';
					showExportModal = false;
				} else {
					error = data.error || 'Failed to export audit logs';
				}
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to export audit logs';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	function viewEventDetails(event) {
		selectedEvent = event;
		showEventDetails = true;
	}

	function clearFilters() {
		filters = {
			eventType: '',
			userId: '',
			ipAddress: '',
			dateFrom: '',
			dateTo: ''
		};
		pagination.page = 1;
		loadAuditLogs();
	}

	function changePage(newPage) {
		pagination.page = newPage;
		loadAuditLogs();
	}

	function closeMessages() {
		error = '';
		success = '';
	}

	function formatDate(timestamp) {
		return new Date(timestamp).toLocaleString();
	}

	function formatEventType(eventType) {
		return eventType.split('_').map(word =>
			word.charAt(0).toUpperCase() + word.slice(1)
		).join(' ');
	}

	function getEventTypeColor(eventType) {
		if (eventType.includes('failed') || eventType.includes('revoked') || eventType.includes('deleted')) {
			return '#dc3545'; // Red for negative events
		}
		if (eventType.includes('login') || eventType.includes('created') || eventType.includes('linked')) {
			return '#28a745'; // Green for positive events
		}
		if (eventType.includes('promoted') || eventType.includes('registered')) {
			return '#007bff'; // Blue for administrative events
		}
		return '#6c757d'; // Gray for neutral events
	}

	function formatEventDetails(details) {
		if (!details) return 'No additional details';

		try {
			const parsed = typeof details === 'string' ? JSON.parse(details) : details;
			return Object.entries(parsed).map(([key, value]) =>
				`${key}: ${value}`
			).join(', ');
		} catch (e) {
			return details.toString();
		}
	}
</script>

{#if isVisible}
	<div class="audit-log-viewer">
		<div class="viewer-header">
			<h3>Audit Log Viewer</h3>
			<div class="header-actions">
				<button class="btn btn-secondary" onclick={() => { showExportModal = true; }}>
					Export Logs
				</button>
				<button class="btn btn-secondary" onclick={loadAuditLogs}>
					Refresh
				</button>
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

		<!-- Filters -->
		<div class="filters-section">
			<div class="filters-header">
				<h4>Filters</h4>
				<button class="btn btn-sm" onclick={clearFilters}>
					Clear All
				</button>
			</div>

			<div class="filters-grid">
				<div class="filter-group">
					<label for="eventType">Event Type</label>
					<select id="eventType" bind:value={filters.eventType}>
						{#each eventTypes as eventType}
							<option value={eventType.value}>{eventType.label}</option>
						{/each}
					</select>
				</div>

				<div class="filter-group">
					<label for="userId">User ID</label>
					<input
						type="text"
						id="userId"
						bind:value={filters.userId}
						placeholder="Enter user ID"
					/>
				</div>

				<div class="filter-group">
					<label for="ipAddress">IP Address</label>
					<input
						type="text"
						id="ipAddress"
						bind:value={filters.ipAddress}
						placeholder="Enter IP address"
					/>
				</div>

				<div class="filter-group">
					<label for="dateFrom">Date From</label>
					<input
						type="date"
						id="dateFrom"
						bind:value={filters.dateFrom}
					/>
				</div>

				<div class="filter-group">
					<label for="dateTo">Date To</label>
					<input
						type="date"
						id="dateTo"
						bind:value={filters.dateTo}
					/>
				</div>
			</div>
		</div>

		<!-- Loading State -->
		{#if loading}
			<div class="loading">Loading audit logs...</div>
		{/if}

		<!-- Logs Table -->
		{#if !loading && auditLogs.length > 0}
			<div class="logs-table-container">
				<table class="logs-table">
					<thead>
						<tr>
							<th>Timestamp</th>
							<th>Event Type</th>
							<th>User</th>
							<th>IP Address</th>
							<th>User Agent</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each auditLogs as event (event.id)}
							<tr>
								<td class="timestamp">{formatDate(event.createdAt)}</td>
								<td>
									<span
										class="event-type-badge"
										style="background-color: {getEventTypeColor(event.eventType)}"
									>
										{formatEventType(event.eventType)}
									</span>
								</td>
								<td>
									{#if event.username}
										<span class="username">{event.username}</span>
										<span class="user-id">(#{event.userId})</span>
									{:else}
										<span class="no-user">System</span>
									{/if}
								</td>
								<td class="ip-address">{event.ipAddress || 'N/A'}</td>
								<td class="user-agent" title={event.userAgent}>
									{#if event.userAgent}
										{event.userAgent.length > 30 ? event.userAgent.substring(0, 30) + '...' : event.userAgent}
									{:else}
										N/A
									{/if}
								</td>
								<td>
									<button
										class="btn btn-sm"
										onclick={() => viewEventDetails(event)}
									>
										View Details
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if pagination.pages > 1}
				<div class="pagination">
					<button
						class="btn btn-sm"
						disabled={pagination.page === 1}
						onclick={() => changePage(1)}
					>
						First
					</button>
					<button
						class="btn btn-sm"
						disabled={pagination.page === 1}
						onclick={() => changePage(pagination.page - 1)}
					>
						Previous
					</button>

					<span class="pagination-info">
						Page {pagination.page} of {pagination.pages} ({pagination.total} total)
					</span>

					<button
						class="btn btn-sm"
						disabled={pagination.page === pagination.pages}
						onclick={() => changePage(pagination.page + 1)}
					>
						Next
					</button>
					<button
						class="btn btn-sm"
						disabled={pagination.page === pagination.pages}
						onclick={() => changePage(pagination.pages)}
					>
						Last
					</button>
				</div>
			{/if}
		{/if}

		{#if !loading && auditLogs.length === 0}
			<div class="no-results">
				{#if Object.values(filters).some(f => f)}
					No audit logs found matching the current filters.
				{:else}
					No audit logs found.
				{/if}
			</div>
		{/if}

		<!-- Event Details Modal -->
		{#if showEventDetails && selectedEvent}
			<div class="modal-overlay">
				<div class="modal modal-large">
					<div class="modal-header">
						<h4>Event Details</h4>
						<button class="btn-close" onclick={() => { showEventDetails = false; }}>&times;</button>
					</div>

					<div class="event-details">
						<div class="detail-section">
							<h5>Basic Information</h5>
							<div class="detail-grid">
								<div class="detail-item">
									<label>Event ID:</label>
									<span>{selectedEvent.id}</span>
								</div>
								<div class="detail-item">
									<label>Event Type:</label>
									<span
										class="event-type-badge"
										style="background-color: {getEventTypeColor(selectedEvent.eventType)}"
									>
										{formatEventType(selectedEvent.eventType)}
									</span>
								</div>
								<div class="detail-item">
									<label>Timestamp:</label>
									<span>{formatDate(selectedEvent.createdAt)}</span>
								</div>
								<div class="detail-item">
									<label>User:</label>
									<span>
										{#if selectedEvent.username}
											{selectedEvent.username} (#{selectedEvent.userId})
										{:else}
											System
										{/if}
									</span>
								</div>
								<div class="detail-item">
									<label>IP Address:</label>
									<span>{selectedEvent.ipAddress || 'N/A'}</span>
								</div>
							</div>
						</div>

						<div class="detail-section">
							<h5>User Agent</h5>
							<div class="user-agent-details">
								{selectedEvent.userAgent || 'No user agent information'}
							</div>
						</div>

						<div class="detail-section">
							<h5>Additional Details</h5>
							<div class="event-details-content">
								{formatEventDetails(selectedEvent.details)}
							</div>
						</div>

						{#if selectedEvent.details}
							<div class="detail-section">
								<h5>Raw Details (JSON)</h5>
								<div class="raw-details">
									<pre>{JSON.stringify(
										typeof selectedEvent.details === 'string'
											? JSON.parse(selectedEvent.details)
											: selectedEvent.details,
										null,
										2
									)}</pre>
								</div>
							</div>
						{/if}
					</div>

					<div class="modal-actions">
						<button class="btn" onclick={() => { showEventDetails = false; }}>
							Close
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Export Modal -->
		{#if showExportModal}
			<div class="modal-overlay">
				<div class="modal">
					<div class="modal-header">
						<h4>Export Audit Logs</h4>
						<button class="btn-close" onclick={() => { showExportModal = false; }}>&times;</button>
					</div>

					<div class="export-options">
						<p>Export audit logs within the current date range (if specified):</p>

						<div class="export-info">
							<strong>Date Range:</strong>
							{#if filters.dateFrom || filters.dateTo}
								{filters.dateFrom || 'All dates'} to {filters.dateTo || 'Now'}
							{:else}
								All available logs
							{/if}
						</div>

						<div class="format-options">
							<button class="btn btn-primary" onclick={() => exportAuditLogs('json')}>
								Export as JSON
							</button>
						</div>
					</div>

					<div class="modal-actions">
						<button class="btn" onclick={() => { showExportModal = false; }}>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.audit-log-viewer {
		padding: 20px;
		background: #f5f5f5;
		border-radius: 8px;
		margin: 10px 0;
	}

	.viewer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.viewer-header h3 {
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

	.filters-section {
		background: white;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 20px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.filters-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.filters-header h4 {
		margin: 0;
		color: #333;
	}

	.filters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.filter-group label {
		font-weight: 500;
		color: #555;
		font-size: 13px;
	}

	.filter-group input,
	.filter-group select {
		padding: 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.logs-table-container {
		background: white;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		margin-bottom: 20px;
		overflow-x: auto;
	}

	.logs-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 800px;
	}

	.logs-table th,
	.logs-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.logs-table th {
		background: #f8f9fa;
		font-weight: 600;
		color: #555;
		font-size: 13px;
	}

	.logs-table tr:hover {
		background: #f8f9fa;
	}

	.timestamp {
		white-space: nowrap;
		font-family: monospace;
		font-size: 12px;
		min-width: 150px;
	}

	.event-type-badge {
		color: white;
		padding: 3px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.username {
		font-weight: 500;
		color: #333;
	}

	.user-id {
		color: #999;
		font-size: 11px;
	}

	.no-user {
		color: #999;
		font-style: italic;
	}

	.ip-address {
		font-family: monospace;
		font-size: 12px;
	}

	.user-agent {
		max-width: 200px;
		font-size: 12px;
		color: #666;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
		padding: 20px;
	}

	.pagination-info {
		margin: 0 10px;
		color: #666;
		font-size: 14px;
	}

	.no-results {
		text-align: center;
		padding: 40px;
		color: #666;
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
		max-width: 500px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-large {
		max-width: 800px;
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

	.event-details {
		padding: 20px;
	}

	.detail-section {
		margin-bottom: 24px;
	}

	.detail-section h5 {
		margin: 0 0 12px 0;
		color: #333;
		border-bottom: 2px solid #eee;
		padding-bottom: 8px;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.detail-item label {
		font-weight: 600;
		color: #666;
		font-size: 12px;
		text-transform: uppercase;
	}

	.detail-item span {
		color: #333;
	}

	.user-agent-details,
	.event-details-content {
		background: #f8f9fa;
		padding: 12px;
		border-radius: 6px;
		font-family: monospace;
		font-size: 12px;
		color: #333;
		word-break: break-all;
	}

	.raw-details {
		background: #f8f9fa;
		border-radius: 6px;
		overflow-x: auto;
	}

	.raw-details pre {
		margin: 0;
		padding: 12px;
		color: #333;
		font-size: 12px;
	}

	.export-options {
		padding: 20px;
	}

	.export-info {
		background: #f8f9fa;
		padding: 12px;
		border-radius: 6px;
		margin: 16px 0;
		color: #666;
	}

	.format-options {
		display: flex;
		gap: 10px;
		justify-content: center;
		margin-top: 16px;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 20px;
		border-top: 1px solid #eee;
	}

	.btn {
		padding: 6px 12px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
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

	.btn-sm {
		padding: 4px 8px;
		font-size: 12px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>