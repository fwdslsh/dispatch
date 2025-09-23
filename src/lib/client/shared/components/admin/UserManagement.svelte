<script>
	import { onMount } from 'svelte';
	import Button from '../Button.svelte';
	import Input from '../Input.svelte';
	import Modal from '../Modal.svelte';
	import ConfirmationDialog from '../ConfirmationDialog.svelte';
	import ErrorDisplay from '../ErrorDisplay.svelte';

	let users = $state([]);
	let loading = $state(false);
	let error = $state('');
	let showCreateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let selectedUser = $state(null);
	let editingUser = $state(null);

	let newUser = $state({
		username: '',
		email: '',
		isAdmin: false
	});

	let newSSHKey = $state({
		name: '',
		publicKey: ''
	});

	let showSSHKeyModal = $state(false);
	let userSSHKeys = $state([]);
	let managingSSHKeysFor = $state(null);

	onMount(() => {
		loadUsers();
	});

	function getAuthHeaders() {
		const token = typeof sessionStorage !== 'undefined'
			? sessionStorage.getItem('dispatch-auth-token')
			: null;
		return token ? { Authorization: `Bearer ${token}` } : {};
	}

	async function loadUsers() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/admin/users', {
				headers: getAuthHeaders()
			});

			if (response.ok) {
				const data = await response.json();
				users = data.users || [];
			} else {
				const data = await response.json();
				error = data.error || 'Failed to load users';
			}
		} catch (err) {
			error = 'Failed to load users';
		} finally {
			loading = false;
		}
	}

	async function createUser() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/admin/users', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify(newUser)
			});

			if (response.ok) {
				const data = await response.json();
				users = [...users, data.user];
				showCreateModal = false;
				newUser = { username: '', email: '', isAdmin: false };
			} else {
				const data = await response.json();
				error = data.error || 'Failed to create user';
			}
		} catch (err) {
			error = 'Failed to create user';
		} finally {
			loading = false;
		}
	}

	async function updateUser(userId, updates) {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify(updates)
			});

			if (response.ok) {
				const data = await response.json();
				users = users.map(u => u.id === userId ? data.user : u);
				editingUser = null;
			} else {
				const data = await response.json();
				error = data.error || 'Failed to update user';
			}
		} catch (err) {
			error = 'Failed to update user';
		} finally {
			loading = false;
		}
	}

	async function deleteUser(userId) {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (response.ok) {
				users = users.filter(u => u.id !== userId);
				showDeleteConfirm = false;
				selectedUser = null;
			} else {
				const data = await response.json();
				error = data.error || 'Failed to delete user';
			}
		} catch (err) {
			error = 'Failed to delete user';
		} finally {
			loading = false;
		}
	}

	async function loadUserSSHKeys(userId) {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/admin/users/${userId}/ssh-keys`, {
				headers: getAuthHeaders()
			});

			if (response.ok) {
				const data = await response.json();
				userSSHKeys = data.sshKeys || [];
				managingSSHKeysFor = userId;
				showSSHKeyModal = true;
			} else {
				const data = await response.json();
				error = data.error || 'Failed to load SSH keys';
			}
		} catch (err) {
			error = 'Failed to load SSH keys';
		} finally {
			loading = false;
		}
	}

	async function addSSHKey() {
		if (!managingSSHKeysFor || !newSSHKey.name || !newSSHKey.publicKey) return;

		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/admin/users/${managingSSHKeysFor}/ssh-keys`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify(newSSHKey)
			});

			if (response.ok) {
				const data = await response.json();
				userSSHKeys = [...userSSHKeys, data.sshKey];
				newSSHKey = { name: '', publicKey: '' };
			} else {
				const data = await response.json();
				error = data.error || 'Failed to add SSH key';
			}
		} catch (err) {
			error = 'Failed to add SSH key';
		} finally {
			loading = false;
		}
	}

	async function deleteSSHKey(keyId) {
		if (!managingSSHKeysFor) return;

		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/admin/users/${managingSSHKeysFor}/ssh-keys/${keyId}`, {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (response.ok) {
				userSSHKeys = userSSHKeys.filter(k => k.id !== keyId);
			} else {
				const data = await response.json();
				error = data.error || 'Failed to delete SSH key';
			}
		} catch (err) {
			error = 'Failed to delete SSH key';
		} finally {
			loading = false;
		}
	}

	function startEdit(user) {
		editingUser = { ...user };
	}

	function cancelEdit() {
		editingUser = null;
	}

	function saveEdit() {
		if (editingUser) {
			updateUser(editingUser.id, {
				username: editingUser.username,
				email: editingUser.email,
				isAdmin: editingUser.isAdmin
			});
		}
	}

	function confirmDelete(user) {
		selectedUser = user;
		showDeleteConfirm = true;
	}

	function isValidEmail(email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	function isValidSSHKey(key) {
		return /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-|ssh-dss)\s+[A-Za-z0-9+\/=]+/.test(key.trim());
	}

	const canCreateUser = $derived(
		newUser.username.trim() &&
		newUser.email.trim() &&
		isValidEmail(newUser.email)
	);

	const canAddSSHKey = $derived(
		newSSHKey.name.trim() &&
		newSSHKey.publicKey.trim() &&
		isValidSSHKey(newSSHKey.publicKey)
	);
</script>

<div class="user-management">
	<div class="section-header">
		<h3>User Management</h3>
		<Button onclick={() => showCreateModal = true} variant="primary" size="small">
			Add User
		</Button>
	</div>

	{#if error}
		<ErrorDisplay {error} />
	{/if}

	{#if loading}
		<div class="loading-state">Loading...</div>
	{:else if users.length === 0}
		<div class="empty-state card aug" data-augmented-ui="tl-clip br-clip both">
			<p>No users found</p>
		</div>
	{:else}
		<div class="users-grid">
			{#each users as user}
				<div class="card aug user-card" data-augmented-ui="tl-clip br-clip both">
					{#if editingUser && editingUser.id === user.id}
						<div class="user-edit">
							<div class="form-group">
								<label>Username</label>
								<Input bind:value={editingUser.username} />
							</div>
							<div class="form-group">
								<label>Email</label>
								<Input bind:value={editingUser.email} type="email" />
							</div>
							<div class="form-group">
								<label class="checkbox-label">
									<input type="checkbox" bind:checked={editingUser.isAdmin} />
									Admin User
								</label>
							</div>
							<div class="edit-actions">
								<Button onclick={saveEdit} size="small" variant="primary">Save</Button>
								<Button onclick={cancelEdit} size="small" variant="ghost">Cancel</Button>
							</div>
						</div>
					{:else}
						<div class="user-header">
							<div class="user-info">
								<h4>{user.username}</h4>
								<p class="user-email">{user.email}</p>
								{#if user.isAdmin}
									<span class="badge admin">Admin</span>
								{/if}
							</div>
						</div>

						<div class="user-details">
							<div class="detail-row">
								<span class="label muted">Created:</span>
								<span class="value">{new Date(user.createdAt).toLocaleDateString()}</span>
							</div>
							<div class="detail-row">
								<span class="label muted">Last Login:</span>
								<span class="value">
									{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
								</span>
							</div>
						</div>

						<div class="user-actions">
							<Button onclick={() => startEdit(user)} size="small" variant="ghost">
								Edit
							</Button>
							<Button onclick={() => loadUserSSHKeys(user.id)} size="small" variant="ghost">
								SSH Keys
							</Button>
							<Button onclick={() => confirmDelete(user)} size="small" variant="danger">
								Delete
							</Button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create User Modal -->
{#if showCreateModal}
	<Modal title="Create New User" onClose={() => showCreateModal = false}>
		<div class="modal-content">
			<div class="form-group">
				<label>Username</label>
				<Input bind:value={newUser.username} placeholder="username" />
			</div>

			<div class="form-group">
				<label>Email</label>
				<Input bind:value={newUser.email} type="email" placeholder="user@example.com" />
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={newUser.isAdmin} />
					Admin User
				</label>
			</div>

			<div class="modal-actions">
				<Button onclick={() => showCreateModal = false} variant="ghost">Cancel</Button>
				<Button onclick={createUser} disabled={!canCreateUser || loading} {loading}>
					Create User
				</Button>
			</div>
		</div>
	</Modal>
{/if}

<!-- SSH Keys Modal -->
{#if showSSHKeyModal && managingSSHKeysFor}
	<Modal title="Manage SSH Keys" onClose={() => showSSHKeyModal = false}>
		<div class="modal-content">
			<div class="ssh-keys-section">
				<h4>Add New SSH Key</h4>
				<div class="form-group">
					<label>Key Name</label>
					<Input bind:value={newSSHKey.name} placeholder="My SSH Key" />
				</div>
				<div class="form-group">
					<label>Public Key</label>
					<textarea
						bind:value={newSSHKey.publicKey}
						placeholder="ssh-rsa AAAAB3NzaC1yc2E... or ssh-ed25519 AAAAC3N..."
						rows="3"
					></textarea>
				</div>
				<Button onclick={addSSHKey} disabled={!canAddSSHKey || loading} size="small">
					Add SSH Key
				</Button>
			</div>

			{#if userSSHKeys.length > 0}
				<div class="ssh-keys-list">
					<h4>Existing SSH Keys</h4>
					{#each userSSHKeys as key}
						<div class="ssh-key-item">
							<div class="key-info">
								<strong>{key.name}</strong>
								<code>{key.publicKey.substring(0, 60)}...</code>
								<span class="key-fingerprint">{key.fingerprint}</span>
							</div>
							<Button onclick={() => deleteSSHKey(key.id)} size="small" variant="danger">
								Delete
							</Button>
						</div>
					{/each}
				</div>
			{/if}

			<div class="modal-actions">
				<Button onclick={() => showSSHKeyModal = false}>Close</Button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Delete Confirmation -->
{#if showDeleteConfirm && selectedUser}
	<ConfirmationDialog
		title="Delete User"
		message="Are you sure you want to delete {selectedUser.username}? This action cannot be undone."
		onConfirm={() => deleteUser(selectedUser.id)}
		onCancel={() => { showDeleteConfirm = false; selectedUser = null; }}
	/>
{/if}

<style>
	.user-management {
		margin-bottom: var(--space-6);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-5);
	}

	.section-header h3 {
		margin: 0;
		color: var(--text);
	}

	.loading-state,
	.empty-state {
		text-align: center;
		padding: var(--space-6);
		color: var(--muted);
	}

	.users-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: var(--space-4);
	}

	.user-card {
		padding: var(--space-5);
	}

	.user-header {
		margin-bottom: var(--space-4);
	}

	.user-info h4 {
		margin: 0 0 var(--space-1) 0;
		color: var(--text);
	}

	.user-email {
		margin: 0 0 var(--space-2) 0;
		color: var(--muted);
		font-size: var(--font-size-0);
	}

	.badge.admin {
		background: var(--accent);
		color: var(--bg);
		padding: var(--space-1) var(--space-2);
		border-radius: 4px;
		font-size: var(--font-size--1);
		font-weight: 600;
	}

	.user-details {
		margin-bottom: var(--space-4);
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		margin-bottom: var(--space-2);
	}

	.label {
		font-weight: 600;
	}

	.user-actions {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.user-edit {
		display: grid;
		gap: var(--space-3);
	}

	.form-group {
		margin-bottom: var(--space-3);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--space-2);
		font-weight: 600;
		color: var(--text);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}

	.edit-actions {
		display: flex;
		gap: var(--space-2);
	}

	.modal-content {
		display: grid;
		gap: var(--space-4);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
	}

	.ssh-keys-section {
		padding: var(--space-4);
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--surface);
	}

	.ssh-keys-section h4 {
		margin-bottom: var(--space-3);
		color: var(--text);
	}

	textarea {
		width: 100%;
		min-height: 80px;
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		resize: vertical;
	}

	.ssh-keys-list {
		margin-top: var(--space-5);
		padding-top: var(--space-5);
		border-top: 1px solid var(--line);
	}

	.ssh-keys-list h4 {
		margin-bottom: var(--space-3);
		color: var(--text);
	}

	.ssh-key-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-radius: 6px;
		margin-bottom: var(--space-3);
		background: var(--surface);
	}

	.key-info {
		flex: 1;
		margin-right: var(--space-3);
	}

	.key-info strong {
		display: block;
		margin-bottom: var(--space-1);
		color: var(--text);
	}

	.key-info code {
		display: block;
		font-size: var(--font-size--1);
		color: var(--muted);
		margin-bottom: var(--space-1);
		word-break: break-all;
	}

	.key-fingerprint {
		font-size: var(--font-size--1);
		color: var(--muted);
		font-family: var(--font-mono);
	}

	@media (max-width: 768px) {
		.users-grid {
			grid-template-columns: 1fr;
		}

		.user-actions {
			flex-direction: column;
		}

		.detail-row {
			flex-direction: column;
			gap: var(--space-1);
		}

		.ssh-key-item {
			flex-direction: column;
			gap: var(--space-3);
		}

		.key-info {
			margin-right: 0;
		}
	}
</style>