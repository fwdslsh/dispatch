<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	// Props
	export let apiEndpoint = '/api/admin/users';

	// State
	let users = $state([]);
	let loading = $state(false);
	let error = $state(null);
	let showCreateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let selectedUser = $state(null);

	// Pagination
	let currentPage = $state(1);
	let totalPages = $state(1);
	let totalUsers = $state(0);
	let limit = $state(20);

	// Filtering and sorting
	let searchQuery = $state('');
	let sortBy = $state('created_at');
	let sortOrder = $state('desc');

	// New user form
	let newUser = $state({
		username: '',
		email: '',
		displayName: '',
		isAdmin: false,
		accessCode: ''
	});

	// Form validation
	let formErrors = $state({});

	onMount(() => {
		loadUsers();
	});

	async function loadUsers() {
		loading = true;
		error = null;

		try {
			const params = new URLSearchParams({
				page: currentPage.toString(),
				limit: limit.toString(),
				search: searchQuery,
				sortBy,
				sortOrder
			});

			const response = await fetch(`${apiEndpoint}?${params}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load users');
			}

			users = result.users || [];
			totalPages = result.totalPages || 1;
			totalUsers = result.total || 0;
		} catch (err) {
			error = err.message;
			console.error('Error loading users:', err);
		} finally {
			loading = false;
		}
	}

	async function createUser() {
		formErrors = {};

		// Validate form
		if (!newUser.username?.trim()) {
			formErrors.username = 'Username is required';
		}
		if (!newUser.email?.trim()) {
			formErrors.email = 'Email is required';
		}
		if (!newUser.displayName?.trim()) {
			formErrors.displayName = 'Display name is required';
		}
		if (!newUser.accessCode?.trim()) {
			formErrors.accessCode = 'Access code is required';
		}

		if (Object.keys(formErrors).length > 0) {
			return;
		}

		try {
			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newUser)
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to create user');
			}

			// Reset form and close modal
			newUser = {
				username: '',
				email: '',
				displayName: '',
				isAdmin: false,
				accessCode: ''
			};
			showCreateModal = false;

			// Reload users list
			await loadUsers();
		} catch (err) {
			error = err.message;
			console.error('Error creating user:', err);
		}
	}

	async function deleteUser(user) {
		try {
			const response = await fetch(`${apiEndpoint}/${user.id}`, {
				method: 'DELETE'
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to delete user');
			}

			showDeleteConfirm = false;
			selectedUser = null;

			// Reload users list
			await loadUsers();
		} catch (err) {
			error = err.message;
			console.error('Error deleting user:', err);
		}
	}

	async function toggleAdminStatus(user) {
		try {
			const response = await fetch(`${apiEndpoint}/${user.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isAdmin: !user.is_admin })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to update user');
			}

			// Reload users list
			await loadUsers();
		} catch (err) {
			error = err.message;
			console.error('Error updating user:', err);
		}
	}

	function handleSearch() {
		currentPage = 1;
		loadUsers();
	}

	function handleSort(column) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'asc';
		}
		currentPage = 1;
		loadUsers();
	}

	function goToPage(page) {
		currentPage = page;
		loadUsers();
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

	function confirmDelete(user) {
		selectedUser = user;
		showDeleteConfirm = true;
	}
</script>

<div class="user-management">
	<div class="header">
		<h2>User Management</h2>
		<button
			class="btn btn-primary"
			onclick={() => showCreateModal = true}
		>
			Create New User
		</button>
	</div>

	{#if error}
		<div class="error-banner">
			{error}
			<button onclick={() => error = null} class="close-btn">&times;</button>
		</div>
	{/if}

	<!-- Search and filters -->
	<div class="filters">
		<div class="search-box">
			<input
				type="text"
				placeholder="Search users..."
				bind:value={searchQuery}
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button onclick={handleSearch} class="search-btn">Search</button>
		</div>

		<div class="stats">
			Total Users: {totalUsers}
		</div>
	</div>

	<!-- Users table -->
	<div class="table-container">
		<table class="users-table">
			<thead>
				<tr>
					<th onclick={() => handleSort('username')} class="sortable">
						Username
						{#if sortBy === 'username'}
							<span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</th>
					<th onclick={() => handleSort('email')} class="sortable">
						Email
						{#if sortBy === 'email'}
							<span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</th>
					<th onclick={() => handleSort('display_name')} class="sortable">
						Display Name
						{#if sortBy === 'display_name'}
							<span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</th>
					<th>Admin</th>
					<th onclick={() => handleSort('created_at')} class="sortable">
						Created
						{#if sortBy === 'created_at'}
							<span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</th>
					<th onclick={() => handleSort('last_active')} class="sortable">
						Last Active
						{#if sortBy === 'last_active'}
							<span class="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan="7" class="loading">Loading users...</td>
					</tr>
				{:else if users.length === 0}
					<tr>
						<td colspan="7" class="empty">No users found</td>
					</tr>
				{:else}
					{#each users as user (user.id)}
						<tr>
							<td>{user.username}</td>
							<td>{user.email}</td>
							<td>{user.display_name}</td>
							<td>
								<label class="admin-toggle">
									<input
										type="checkbox"
										checked={user.is_admin}
										onchange={() => toggleAdminStatus(user)}
										disabled={user.id === $page.data.user?.id}
									/>
									<span class="toggle-slider"></span>
								</label>
							</td>
							<td>{formatDate(user.created_at)}</td>
							<td>{user.last_active ? formatDate(user.last_active) : 'Never'}</td>
							<td class="actions">
								<button
									class="btn btn-danger btn-sm"
									onclick={() => confirmDelete(user)}
									disabled={user.id === $page.data.user?.id}
								>
									Delete
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

<!-- Create User Modal -->
{#if showCreateModal}
	<div class="modal-backdrop" onclick={() => showCreateModal = false}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Create New User</h3>
				<button class="close-btn" onclick={() => showCreateModal = false}>&times;</button>
			</div>

			<form onsubmit|preventDefault={createUser}>
				<div class="form-group">
					<label for="username">Username</label>
					<input
						type="text"
						id="username"
						bind:value={newUser.username}
						class={formErrors.username ? 'error' : ''}
						required
					/>
					{#if formErrors.username}
						<span class="error-text">{formErrors.username}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="email">Email</label>
					<input
						type="email"
						id="email"
						bind:value={newUser.email}
						class={formErrors.email ? 'error' : ''}
						required
					/>
					{#if formErrors.email}
						<span class="error-text">{formErrors.email}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="displayName">Display Name</label>
					<input
						type="text"
						id="displayName"
						bind:value={newUser.displayName}
						class={formErrors.displayName ? 'error' : ''}
						required
					/>
					{#if formErrors.displayName}
						<span class="error-text">{formErrors.displayName}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="accessCode">Access Code</label>
					<input
						type="password"
						id="accessCode"
						bind:value={newUser.accessCode}
						class={formErrors.accessCode ? 'error' : ''}
						placeholder="Initial access code for the user"
						required
					/>
					{#if formErrors.accessCode}
						<span class="error-text">{formErrors.accessCode}</span>
					{/if}
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={newUser.isAdmin}
						/>
						Administrator privileges
					</label>
				</div>

				<div class="modal-actions">
					<button type="button" class="btn btn-secondary" onclick={() => showCreateModal = false}>
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

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && selectedUser}
	<div class="modal-backdrop" onclick={() => showDeleteConfirm = false}>
		<div class="modal confirm-modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Confirm Delete</h3>
				<button class="close-btn" onclick={() => showDeleteConfirm = false}>&times;</button>
			</div>

			<div class="modal-body">
				<p>Are you sure you want to delete user <strong>{selectedUser.username}</strong>?</p>
				<p class="warning">This action cannot be undone. All associated sessions and data will be removed.</p>
			</div>

			<div class="modal-actions">
				<button class="btn btn-secondary" onclick={() => showDeleteConfirm = false}>
					Cancel
				</button>
				<button class="btn btn-danger" onclick={() => deleteUser(selectedUser)}>
					Delete User
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.user-management {
		padding: 20px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.header h2 {
		margin: 0;
		color: var(--text-primary, #333);
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

	.filters {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		gap: 20px;
	}

	.search-box {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.search-box input {
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		min-width: 300px;
	}

	.stats {
		color: var(--text-secondary, #666);
		font-size: 14px;
	}

	.table-container {
		overflow-x: auto;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.users-table {
		width: 100%;
		border-collapse: collapse;
		background: white;
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
		color: var(--text-primary, #333);
	}

	.sortable {
		cursor: pointer;
		user-select: none;
		position: relative;
	}

	.sortable:hover {
		background: #e9ecef;
	}

	.sort-indicator {
		margin-left: 8px;
		font-size: 12px;
	}

	.admin-toggle {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 20px;
	}

	.admin-toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ccc;
		transition: .4s;
		border-radius: 20px;
	}

	.toggle-slider:before {
		position: absolute;
		content: "";
		height: 16px;
		width: 16px;
		left: 2px;
		bottom: 2px;
		background-color: white;
		transition: .4s;
		border-radius: 50%;
	}

	input:checked + .toggle-slider {
		background-color: var(--primary-color, #007bff);
	}

	input:checked + .toggle-slider:before {
		transform: translateX(20px);
	}

	input:disabled + .toggle-slider {
		opacity: 0.5;
		cursor: not-allowed;
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
	}

	.btn {
		padding: 8px 16px;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 14px;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s ease;
	}

	.btn:hover {
		background: #f8f9fa;
	}

	.btn-primary {
		background: var(--primary-color, #007bff);
		color: white;
		border-color: var(--primary-color, #007bff);
	}

	.btn-primary:hover {
		background: var(--primary-color-dark, #0056b3);
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
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
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

	.modal form {
		padding: 20px;
	}

	.modal-body {
		padding: 20px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 5px;
		font-weight: 600;
		color: var(--text-primary, #333);
	}

	.form-group input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.form-group input.error {
		border-color: #dc3545;
	}

	.error-text {
		color: #dc3545;
		font-size: 12px;
		margin-top: 5px;
		display: block;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.checkbox-label input {
		width: auto;
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