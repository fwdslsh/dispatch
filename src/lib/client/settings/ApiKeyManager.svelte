<!--
	ApiKeyManager Component
	Manages API keys for authentication with CRUD operations
	Follows Dispatch retro-terminal aesthetic with MVVM pattern
-->

<script>
	import { onMount } from 'svelte';
	import { ApiKeyState } from '$lib/client/shared/state/ApiKeyState.svelte.js';
	import Button from '../shared/components/Button.svelte';
	import InfoBox from '../shared/components/InfoBox.svelte';

	// Initialize ApiKeyState ViewModel
	const apiKeyState = new ApiKeyState();

	// Local UI state
	let showCreateModal = $state(false);
	let newKeyLabel = $state('');
	let generatedKey = $state(null);
	let keyCopied = $state(false);
	let deleteConfirm = $state(null); // ID of key to delete

	// Load API keys on mount
	onMount(async () => {
		await apiKeyState.initialize();
	});

	// =================================================================
	// CREATE KEY HANDLERS
	// =================================================================

	function openCreateModal() {
		showCreateModal = true;
		newKeyLabel = '';
		generatedKey = null;
		keyCopied = false;
	}

	function closeCreateModal() {
		showCreateModal = false;
		newKeyLabel = '';
		generatedKey = null;
		keyCopied = false;
	}

	async function handleCreateKey() {
		if (!newKeyLabel.trim()) {
			return;
		}

		const result = await apiKeyState.createKey(newKeyLabel.trim());

		if (result) {
			// Show the generated key (only shown ONCE)
			generatedKey = result;
			newKeyLabel = '';
		}
	}

	async function copyToClipboard() {
		if (!generatedKey?.key) return;

		try {
			await navigator.clipboard.writeText(generatedKey.key);
			keyCopied = true;

			// Reset copied state after 2 seconds
			setTimeout(() => {
				keyCopied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy to clipboard:', err);
		}
	}

	function handleKeyEnter(event) {
		if (event.key === 'Enter' && newKeyLabel.trim() && !generatedKey) {
			handleCreateKey();
		}
	}

	// =================================================================
	// DELETE KEY HANDLERS
	// =================================================================

	function confirmDelete(keyId) {
		deleteConfirm = keyId;
	}

	function cancelDelete() {
		deleteConfirm = null;
	}

	async function handleDeleteKey(keyId) {
		const success = await apiKeyState.deleteKey(keyId);
		if (success) {
			deleteConfirm = null;
		}
	}

	// =================================================================
	// TOGGLE KEY HANDLERS
	// =================================================================

	async function handleToggleKey(keyId, currentlyDisabled) {
		await apiKeyState.toggleKey(keyId, !currentlyDisabled);
	}

	// =================================================================
	// FORMATTING HELPERS
	// =================================================================

	function formatDate(timestamp) {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getStatusText(disabled) {
		return disabled ? 'Disabled' : 'Active';
	}

	function getStatusClass(disabled) {
		return disabled ? 'status-disabled' : 'status-active';
	}
</script>

<div class="api-key-manager" data-testid="api-key-manager">
	<div class="manager-header">
		<div>
			<h4>API Key Management</h4>
			<p class="manager-description">
				Create and manage API keys for authentication. Each key can be used to log in and access
				your Dispatch instance.
			</p>
		</div>
		<Button variant="primary" onclick={openCreateModal} disabled={apiKeyState.loading}>
			Create New API Key
		</Button>
	</div>

	<!-- Error Display -->
	{#if apiKeyState.error}
		<InfoBox variant="error">
			<strong>Error:</strong>
			{apiKeyState.error}
			<button
				class="message-close"
				onclick={() => apiKeyState.clearError()}
				aria-label="Dismiss error"
			>
				×
			</button>
		</InfoBox>
	{/if}

	<!-- API Keys Table -->
	{#if apiKeyState.loading && apiKeyState.keys.length === 0}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading API keys...</p>
		</div>
	{:else if apiKeyState.keys.length === 0}
		<div class="empty-state">
			<svg
				class="empty-icon"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
				<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
			</svg>
			<p class="empty-text">No API keys created yet</p>
			<p class="empty-hint">Create your first API key to get started</p>
		</div>
	{:else}
		<div class="table-container">
			<table class="keys-table">
				<thead>
					<tr>
						<th>Label</th>
						<th>Created</th>
						<th>Last Used</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each apiKeyState.keys as key (key.id)}
						<tr class:disabled-row={key.disabled}>
							<td class="label-cell">{key.label}</td>
							<td>{formatDate(key.created_at)}</td>
							<td>{formatDate(key.last_used_at)}</td>
							<td>
								<span class="status-badge {getStatusClass(key.disabled)}">
									{getStatusText(key.disabled)}
								</span>
							</td>
							<td class="actions-cell">
								<div class="action-buttons">
									<button
										class="action-button toggle-button"
										onclick={() => handleToggleKey(key.id, key.disabled)}
										disabled={apiKeyState.loading}
										aria-label={key.disabled ? 'Enable key' : 'Disable key'}
									>
										{key.disabled ? 'Enable' : 'Disable'}
									</button>
									<button
										class="action-button delete-button"
										onclick={() => confirmDelete(key.id)}
										disabled={apiKeyState.loading}
										aria-label="Delete key"
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

		<div class="table-footer">
			<p class="footer-text">
				{apiKeyState.activeCount} active key{apiKeyState.activeCount !== 1 ? 's' : ''}
				• {apiKeyState.keys.length} total
			</p>
		</div>
	{/if}

	<!-- Create Key Modal -->
	{#if showCreateModal}
		<div class="modal-overlay" onclick={closeCreateModal} role="dialog" aria-modal="true">
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				{#if !generatedKey}
					<!-- Step 1: Enter Label -->
					<h3>Create New API Key</h3>
					<p class="modal-description">
						Enter a descriptive label for this API key to help identify its purpose.
					</p>

					<div class="form-group">
						<label for="key-label" class="form-label">Label</label>
						<input
							id="key-label"
							type="text"
							class="form-input"
							placeholder="e.g., My Laptop, CI/CD Pipeline"
							bind:value={newKeyLabel}
							onkeydown={handleKeyEnter}
							disabled={apiKeyState.loading}
							autofocus
						/>
					</div>

					<div class="modal-actions">
						<Button
							variant="primary"
							onclick={handleCreateKey}
							disabled={!newKeyLabel.trim() || apiKeyState.loading}
							loading={apiKeyState.loading}
						>
							Generate Key
						</Button>
						<Button variant="secondary" onclick={closeCreateModal} disabled={apiKeyState.loading}>
							Cancel
						</Button>
					</div>
				{:else}
					<!-- Step 2: Display Generated Key -->
					<h3>API Key Created Successfully</h3>

					<InfoBox variant="warning">
						<strong>Important:</strong>
						Save this key now - it will not be shown again!
					</InfoBox>

					<div class="generated-key-container">
						<div class="key-display">
							<code class="key-code">{generatedKey.key}</code>
						</div>
						<Button variant="secondary" onclick={copyToClipboard} fullWidth={true}>
							{keyCopied ? '✓ Copied!' : 'Copy to Clipboard'}
						</Button>
					</div>

					<div class="key-info">
						<p><strong>Label:</strong> {generatedKey.label}</p>
						<p><strong>Key ID:</strong> {generatedKey.id}</p>
					</div>

					<div class="modal-actions">
						<Button variant="primary" onclick={closeCreateModal}>Done</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if deleteConfirm}
		<div class="modal-overlay" onclick={cancelDelete} role="dialog" aria-modal="true">
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				<h3>Delete API Key</h3>
				<p>Are you sure you want to delete this API key? This action cannot be undone.</p>

				<InfoBox variant="warning">
					Any applications or services using this key will lose access immediately.
				</InfoBox>

				<div class="modal-actions">
					<Button
						variant="danger"
						onclick={() => handleDeleteKey(deleteConfirm)}
						disabled={apiKeyState.loading}
						loading={apiKeyState.loading}
					>
						Delete Key
					</Button>
					<Button variant="secondary" onclick={cancelDelete} disabled={apiKeyState.loading}>
						Cancel
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.api-key-manager {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.manager-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-4);
	}

	.manager-header h4 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 600;
	}

	.manager-description {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	/* Table Styles */
	.table-container {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}

	.keys-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.keys-table thead {
		background: var(--surface-primary-98);
		border-bottom: 1px solid var(--line);
	}

	.keys-table th {
		padding: var(--space-3);
		text-align: left;
		color: var(--muted);
		font-weight: 600;
		font-size: var(--font-size-0);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.keys-table td {
		padding: var(--space-3);
		color: var(--text);
		border-bottom: 1px solid var(--line);
	}

	.keys-table tbody tr:last-child td {
		border-bottom: none;
	}

	.keys-table tbody tr:hover {
		background: color-mix(in oklab, var(--primary) 3%, transparent);
	}

	.disabled-row {
		opacity: 0.6;
	}

	.label-cell {
		font-weight: 500;
	}

	.status-badge {
		display: inline-block;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-xs);
		font-size: var(--font-size-0);
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-active {
		background: color-mix(in oklab, var(--ok) 20%, transparent);
		color: var(--ok);
	}

	.status-disabled {
		background: color-mix(in oklab, var(--muted) 20%, transparent);
		color: var(--muted);
	}

	.actions-cell {
		width: 200px;
	}

	.action-buttons {
		display: flex;
		gap: var(--space-2);
	}

	.action-button {
		padding: var(--space-2) var(--space-3);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-xs);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-button:hover:not(:disabled) {
		background: color-mix(in oklab, var(--primary) 10%, var(--surface));
		border-color: var(--primary);
	}

	.action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.delete-button:hover:not(:disabled) {
		background: color-mix(in oklab, var(--error) 10%, var(--surface));
		border-color: var(--error);
		color: var(--error);
	}

	.table-footer {
		padding: var(--space-3);
		border-top: 1px solid var(--line);
		background: var(--surface-primary-98);
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
	}

	.footer-text {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	/* Empty & Loading States */
	.empty-state,
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-8);
		text-align: center;
	}

	.empty-icon {
		color: var(--muted);
		opacity: 0.5;
		margin-bottom: var(--space-3);
	}

	.empty-text {
		margin: 0 0 var(--space-1) 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 500;
	}

	.empty-hint {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--line);
		border-top-color: var(--primary);
		border-radius: var(--radius-full);
		animation: spin 0.8s linear infinite;
		margin-bottom: var(--space-3);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: var(--surface);
		padding: var(--space-6);
		border-radius: var(--radius-md);
		border: 1px solid var(--line);
		max-width: 500px;
		width: 90%;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.5),
			0 0 0 1px var(--primary-glow-15);
	}

	.modal-content h3 {
		margin: 0 0 var(--space-3) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-3);
		font-weight: 600;
	}

	.modal-description {
		margin: 0 0 var(--space-4) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	.form-group {
		margin-bottom: var(--space-4);
	}

	.form-label {
		display: block;
		margin-bottom: var(--space-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 500;
	}

	.form-input {
		width: 100%;
		padding: var(--space-3);
		background: var(--surface-primary-98);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		transition: all 0.2s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-glow-15);
	}

	.generated-key-container {
		margin: var(--space-4) 0;
	}

	.key-display {
		margin-bottom: var(--space-3);
		padding: var(--space-4);
		background: var(--surface-primary-98);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}

	.key-code {
		display: block;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		word-break: break-all;
		user-select: all;
	}

	.key-info {
		margin: var(--space-4) 0;
		padding: var(--space-3);
		background: var(--surface-primary-98);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.key-info p {
		margin: var(--space-2) 0;
		color: var(--text);
	}

	.modal-actions {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
		margin-top: var(--space-4);
	}

	.message-close {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		background: transparent;
		border: none;
		color: inherit;
		font-size: var(--space-5);
		line-height: 1;
		cursor: pointer;
		padding: var(--space-1);
		opacity: 0.7;
		transition: opacity 0.2s ease;
	}

	.message-close:hover {
		opacity: 1;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.manager-header {
			flex-direction: column;
		}

		.table-container {
			overflow-x: scroll;
		}

		.modal-content {
			padding: var(--space-4);
		}

		.modal-actions {
			flex-direction: column;
		}
	}
</style>
