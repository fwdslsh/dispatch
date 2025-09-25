<script>
	import { onMount } from 'svelte';

	// Props
	let {
		apiClient,
		isVisible = false
	} = $props();

	// State
	let users = $state([]);
	let pagination = $state({ page: 1, limit: 10, total: 0, pages: 0 });
	let loading = $state(false);
	let searchTerm = $state('');
	let searchTimeout = null;
	let selectedUser = $state(null);
	let showUserDetails = $state(false);
	let showCreateForm = $state(false);
	let error = $state('');
	let success = $state('');

	// Form state
	let createForm = $state({
		username: '',
		displayName: '',
		email: '',
		password: '',
		isAdmin: false
	});
	let formErrors = $state({});

	// Load users when component mounts or search changes
	onMount(() => {
		if (isVisible) {
			loadUsers();
		}
	});

	// Watch for visibility changes
	$effect(() => {
		if (isVisible) {
			loadUsers();
		}
	});

	// Watch for search term changes with debouncing
	$effect(() => {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(() => {
			if (isVisible) {
				pagination.page = 1; // Reset to first page on search
				loadUsers();
			}
		}, 300);

		return () => {
			if (searchTimeout) {
				clearTimeout(searchTimeout);
			}
		};
	});

	async function loadUsers() {
		loading = true;
		error = '';

		try {
			const response = await apiClient.post('/api/admin/users/list', {
				page: pagination.page,
				limit: pagination.limit,
				search: searchTerm
			});

			if (response.ok) {
				const data = await response.json();
				users = data.users;
				pagination = data.pagination;
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to load users';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function createUser() {
		formErrors = {};
		error = '';
		success = '';

		try {
			const response = await apiClient.post('/api/admin/users/create', createForm);
			const data = await response.json();

			if (data.success) {
				success = 'User created successfully';
				showCreateForm = false;
				resetCreateForm();
				loadUsers(); // Refresh the list
			} else {
				if (data.errors) {
					formErrors = data.errors;
				} else {
					error = data.error || 'Failed to create user';
				}
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	async function deleteUser(userId, username) {
		if (!confirm(`Are you sure you want to delete user "${username}"? This will permanently delete all associated data including sessions and devices.`)) {
			return;
		}

		try {
			const response = await apiClient.post('/api/admin/users/delete', { userId });
			const data = await response.json();

			if (data.success) {
				success = 'User deleted successfully';
				loadUsers(); // Refresh the list
			} else {
				error = data.error || 'Failed to delete user';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	async function viewUserDetails(user) {
		loading = true;
		selectedUser = null;

		try {
			const response = await apiClient.post('/api/admin/users/details', { userId: user.id });
			const data = await response.json();

			if (data.success) {
				selectedUser = data.user;
				showUserDetails = true;
			} else {
				error = data.error || 'Failed to load user details';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function promoteToAdmin(userId) {
		try {
			const response = await apiClient.post('/api/admin/users/promote', { userId });
			const data = await response.json();

			if (data.success) {
				success = 'User promoted to admin';
				loadUsers();
				if (selectedUser && selectedUser.id === userId) {
					selectedUser.isAdmin = true;
				}
			} else {
				error = data.error || 'Failed to promote user';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	async function demoteFromAdmin(userId) {
		if (!confirm('Are you sure you want to remove admin privileges from this user?')) {
			return;
		}

		try {
			const response = await apiClient.post('/api/admin/users/demote', { userId });
			const data = await response.json();

			if (data.success) {
				success = 'Admin privileges removed';
				loadUsers();
				if (selectedUser && selectedUser.id === userId) {
					selectedUser.isAdmin = false;
				}
			} else {
				error = data.error || 'Failed to demote user';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		}
	}

	function changePage(newPage) {
		pagination.page = newPage;
		loadUsers();
	}

	function resetCreateForm() {
		createForm = {
			username: '',
			displayName: '',
			email: '',
			password: '',
			isAdmin: false
		};
		formErrors = {};
	}

	function closeMessages() {
		error = '';
		success = '';
	}

	function formatDate(timestamp) {
		return new Date(timestamp).toLocaleString();
	}
</script>

{#if isVisible}
	<div class="user-manager">
		<div class="user-manager-header">
			<h3>User Management</h3>
			<button class="btn btn-primary" onclick={() => { showCreateForm = true; resetCreateForm(); }}>
				Create User
			</button>
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

		<!-- Search -->
		<div class="search-bar">
			<input
				type="text"
				placeholder="Search users by username, name, or email..."
				bind:value={searchTerm}
				class="search-input"
			/>
		</div>

		<!-- Loading State -->
		{#if loading}
			<div class="loading">Loading users...</div>
		{/if}

		<!-- Users Table -->
		{#if !loading && users.length > 0}
			<div class="users-table-container">
				<table class="users-table">
					<thead>
						<tr>
							<th>Username</th>
							<th>Display Name</th>
							<th>Email</th>
							<th>Role</th>
							<th>Devices</th>
							<th>Sessions</th>
							<th>Last Login</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each users as user (user.id)}
							<tr>
								<td>
									<div class="username">
										{user.username}
										{#if user.isAdmin}
											<span class="admin-badge">Admin</span>
										{/if}
									</div>
								</td>
								<td>{user.display_name}</td>
								<td>{user.email}</td>
								<td>
									{#if user.isAdmin}
										<span class="role admin">Administrator</span>
									{:else}
										<span class="role user">User</span>
									{/if}
								</td>
								<td>{user.deviceCount}</td>
								<td>{user.activeSessionCount}</td>
								<td>
									{#if user.lastLogin}
										{formatDate(user.lastLogin)}
									{:else}
										<span class="never">Never</span>
									{/if}
								</td>
								<td>
									<div class="actions">
										<button
											class="btn btn-sm"
											onclick={() => viewUserDetails(user)}
										>
											View
										</button>

										{#if !user.isAdmin}
											<button
												class="btn btn-sm btn-secondary"
												onclick={() => promoteToAdmin(user.id)}
											>
												Make Admin
											</button>
										{:else}
											<button
												class="btn btn-sm btn-secondary"
												onclick={() => demoteFromAdmin(user.id)}
											>
												Remove Admin
											</button>
										{/if}

										<button
											class="btn btn-sm btn-danger"
											onclick={() => deleteUser(user.id, user.username)}
										>
											Delete
										</button>
									</div>
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

		{#if !loading && users.length === 0 && searchTerm}
			<div class="no-results">
				No users found matching "{searchTerm}"
			</div>
		{/if}

		{#if !loading && users.length === 0 && !searchTerm}
			<div class="no-results">
				No users found. Create the first user to get started.
			</div>
		{/if}

		<!-- Create User Modal -->
		{#if showCreateForm}
			<div class="modal-overlay">
				<div class="modal">
					<div class="modal-header">
						<h4>Create New User</h4>
						<button class="btn-close" onclick={() => { showCreateForm = false; }}>&times;</button>
					</div>

					<form onsubmit={(e) => { e.preventDefault(); createUser(); }}>
						<div class="form-group">
							<label for="username">Username *</label>
							<input
								type="text"
								id="username"
								bind:value={createForm.username}
								class:error={formErrors.username}
								required
							/>
							{#if formErrors.username}
								<div class="field-error">{formErrors.username}</div>
							{/if}
						</div>

						<div class="form-group">
							<label for="displayName">Display Name</label>
							<input
								type="text"
								id="displayName"
								bind:value={createForm.displayName}
								placeholder="Leave empty to use username"
							/>
						</div>

						<div class="form-group">
							<label for="email">Email *</label>
							<input
								type="email"
								id="email"
								bind:value={createForm.email}
								class:error={formErrors.email}
								required
							/>
							{#if formErrors.email}
								<div class="field-error">{formErrors.email}</div>
							{/if}
						</div>

						<div class="form-group">
							<label for="password">Password *</label>
							<input
								type="password"
								id="password"
								bind:value={createForm.password}
								class:error={formErrors.password}
								minlength="6"
								required
							/>
							{#if formErrors.password}
								<div class="field-error">{formErrors.password}</div>
							{/if}
						</div>

						<div class="form-group">
							<label class="checkbox-label">
								<input
									type="checkbox"
									bind:checked={createForm.isAdmin}
								/>
								Make this user an administrator
							</label>
						</div>

						<div class="modal-actions">
							<button type="button" class="btn" onclick={() => { showCreateForm = false; }}>
								Cancel
							</button>
							<button type="submit" class="btn btn-primary">
								Create User
							</button>
						</div>
					</form>
				</div>
			</div>
		{/if}

		<!-- User Details Modal -->
		{#if showUserDetails && selectedUser}
			<div class="modal-overlay">
				<div class="modal modal-large">
					<div class="modal-header">
						<h4>User Details: {selectedUser.username}</h4>
						<button class="btn-close" onclick={() => { showUserDetails = false; }}>&times;</button>
					</div>

					<div class="user-details">
						<div class="detail-section">
							<h5>Basic Information</h5>
							<div class="detail-grid">
								<div class="detail-item">
									<label>Username:</label>
									<span>{selectedUser.username}</span>
								</div>
								<div class="detail-item">
									<label>Display Name:</label>
									<span>{selectedUser.display_name}</span>
								</div>
								<div class="detail-item">
									<label>Email:</label>
									<span>{selectedUser.email}</span>
								</div>
								<div class="detail-item">
									<label>Role:</label>
									<span>{selectedUser.isAdmin ? 'Administrator' : 'User'}</span>
								</div>
								<div class="detail-item">
									<label>Created:</label>
									<span>{formatDate(selectedUser.createdAt)}</span>
								</div>
								<div class="detail-item">
									<label>Last Login:</label>
									<span>{selectedUser.lastLogin ? formatDate(selectedUser.lastLogin) : 'Never'}</span>
								</div>
							</div>
						</div>

						{#if selectedUser.devices.length > 0}
							<div class="detail-section">
								<h5>Devices ({selectedUser.devices.length})</h5>
								<div class="devices-list">
									{#each selectedUser.devices as device}
										<div class="device-item">
											<div class="device-info">
												<strong>{device.deviceName}</strong>
												{#if device.isTrusted}
													<span class="trusted-badge">Trusted</span>
												{/if}
											</div>
											<div class="device-meta">
												Active Sessions: {device.activeSessions} |
												Added: {formatDate(device.createdAt)}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if selectedUser.sessions.length > 0}
							<div class="detail-section">
								<h5>Active Sessions ({selectedUser.sessions.length})</h5>
								<div class="sessions-list">
									{#each selectedUser.sessions as session}
										<div class="session-item">
											<div class="session-info">
												<strong>{session.deviceName}</strong>
											</div>
											<div class="session-meta">
												Created: {formatDate(session.createdAt)} |
												Expires: {formatDate(session.expiresAt)}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if selectedUser.recentEvents.length > 0}
							<div class="detail-section">
								<h5>Recent Activity</h5>
								<div class="events-list">
									{#each selectedUser.recentEvents as event}
										<div class="event-item">
											<div class="event-type">{event.eventType}</div>
											<div class="event-details">
												{event.ipAddress} |
												{formatDate(event.createdAt)}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<div class="modal-actions">
						<button class="btn" onclick={() => { showUserDetails = false; }}>
							Close
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.user-manager {
		padding: 20px;
		background: #f5f5f5;
		border-radius: 8px;
		margin: 10px 0;
	}

	.user-manager-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.user-manager-header h3 {
		margin: 0;
		color: #333;
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

	.search-bar {
		margin-bottom: 20px;
	}

	.search-input {
		width: 100%;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 14px;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.users-table-container {
		background: white;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		margin-bottom: 20px;
	}

	.users-table {
		width: 100%;
		border-collapse: collapse;
	}

	.users-table th,
	.users-table td {
		padding: 12px;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.users-table th {
		background: #f8f9fa;
		font-weight: 600;
		color: #555;
	}

	.users-table tr:hover {
		background: #f8f9fa;
	}

	.username {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.admin-badge {
		background: #007bff;
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		text-transform: uppercase;
		font-weight: 500;
	}

	.role {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.role.admin {
		background: #e3f2fd;
		color: #1976d2;
	}

	.role.user {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.never {
		color: #999;
		font-style: italic;
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
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

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	.form-group input.error {
		border-color: #dc3545;
	}

	.field-error {
		color: #dc3545;
		font-size: 12px;
		margin-top: 4px;
	}

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.checkbox-label input {
		width: auto !important;
		margin: 0;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 20px;
		border-top: 1px solid #eee;
	}

	.user-details {
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

	.devices-list,
	.sessions-list,
	.events-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.device-item,
	.session-item,
	.event-item {
		background: #f8f9fa;
		padding: 12px;
		border-radius: 6px;
		border-left: 3px solid #007bff;
	}

	.device-info,
	.session-info {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.trusted-badge {
		background: #28a745;
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 10px;
		text-transform: uppercase;
		font-weight: 500;
	}

	.device-meta,
	.session-meta,
	.event-details {
		font-size: 12px;
		color: #666;
	}

	.event-type {
		font-weight: 600;
		color: #333;
		margin-bottom: 4px;
		text-transform: capitalize;
	}
</style>