<script>
	/**
	 * @typedef {Object} OpenCodeSession
	 * @property {string} id - Session ID
	 * @property {string} [name] - Session name
	 * @property {string} provider - AI provider (e.g., 'anthropic', 'openai')
	 * @property {string} model - Model name
	 * @property {string} status - Session status
	 * @property {number} createdAt - Creation timestamp
	 */

	/**
	 * @type {{
	 *   sessions: OpenCodeSession[],
	 *   selectedSession: OpenCodeSession | null,
	 *   onSelect: (session: OpenCodeSession) => void,
	 *   onCreate: (provider: string, model: string) => Promise<void>,
	 *   onDelete: (sessionId: string) => Promise<void>
	 * }}
	 */
	let { sessions, selectedSession, onSelect, onCreate, onDelete } = $props();

	let showCreateDialog = $state(false);
	let creating = $state(false);
	let providers = $state(['anthropic', 'openai']);
	let selectedProvider = $state('anthropic');
	let selectedModel = $state('claude-sonnet-4');
	let deleting = $state(new Set());

	const modelsByProvider = {
		anthropic: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-4'],
		openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
	};

	async function handleCreate() {
		creating = true;
		try {
			await onCreate(selectedProvider, selectedModel);
			showCreateDialog = false;
		} finally {
			creating = false;
		}
	}

	async function handleDelete(sessionId) {
		deleting.add(sessionId);
		deleting = new Set(deleting);
		try {
			await onDelete(sessionId);
		} finally {
			deleting.delete(sessionId);
			deleting = new Set(deleting);
		}
	}

	function formatTimestamp(ts) {
		return new Date(ts).toLocaleString();
	}
</script>

<div class="session-manager">
	<div class="manager-header">
		<button class="create-btn" onclick={() => (showCreateDialog = true)}>
			<span class="icon">+</span>
			New Session
		</button>
	</div>

	{#if sessions.length === 0}
		<p class="empty-message">No sessions yet. Create one to get started.</p>
	{:else}
		<div class="sessions-list">
			{#each sessions as session (session.id)}
				<div
					class="session-card"
					class:selected={selectedSession?.id === session.id}
					onclick={() => onSelect(session)}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && onSelect(session)}
				>
					<div class="session-info">
						<div class="session-name">{session.name || session.id}</div>
						<div class="session-meta">
							<span class="provider">{session.provider}</span>
							<span class="model">{session.model}</span>
						</div>
						<div class="session-timestamp">{formatTimestamp(session.createdAt)}</div>
					</div>
					<button
						class="delete-btn"
						onclick={(e) => {
							e.stopPropagation();
							handleDelete(session.id);
						}}
						disabled={deleting.has(session.id)}
						title="Delete session"
					>
						{deleting.has(session.id) ? '...' : '×'}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showCreateDialog}
	<div class="dialog-overlay" onclick={() => (showCreateDialog = false)}>
		<div class="dialog" onclick={(e) => e.stopPropagation()}>
			<h3>Create New Session</h3>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleCreate();
				}}
			>
				<div class="form-group">
					<label for="provider">Provider</label>
					<select id="provider" bind:value={selectedProvider} disabled={creating}>
						{#each providers as provider}
							<option value={provider}>{provider}</option>
						{/each}
					</select>
				</div>
				<div class="form-group">
					<label for="model">Model</label>
					<select id="model" bind:value={selectedModel} disabled={creating}>
						{#each modelsByProvider[selectedProvider] || [] as model}
							<option value={model}>{model}</option>
						{/each}
					</select>
				</div>
				<div class="dialog-actions">
					<button
						type="button"
						class="cancel-btn"
						onclick={() => (showCreateDialog = false)}
						disabled={creating}
					>
						Cancel
					</button>
					<button type="submit" class="submit-btn" disabled={creating}>
						{creating ? 'Creating...' : 'Create'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.session-manager {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.manager-header {
		display: flex;
		justify-content: flex-end;
	}

	.create-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: opacity 0.2s;
	}

	.create-btn:hover {
		opacity: 0.9;
	}

	.icon {
		font-size: 1.25rem;
		font-weight: bold;
	}

	.empty-message {
		color: var(--color-text-muted);
		font-style: italic;
		text-align: center;
		margin: 2rem 0;
	}

	.sessions-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.session-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.session-card:hover {
		border-color: var(--color-primary);
		background: var(--color-surface-hover, var(--color-surface));
	}

	.session-card.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
	}

	.session-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.session-name {
		font-weight: 600;
		color: var(--color-text);
	}

	.session-meta {
		display: flex;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	.provider,
	.model {
		padding: 0.125rem 0.5rem;
		background: var(--color-surface);
		border-radius: 3px;
		color: var(--color-text-muted);
	}

	.session-timestamp {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.delete-btn {
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 1.25rem;
		transition: all 0.2s;
	}

	.delete-btn:hover:not(:disabled) {
		background: var(--color-error, #c33);
		border-color: var(--color-error, #c33);
		color: white;
	}

	.delete-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Dialog styles */
	.dialog-overlay {
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

	.dialog {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		min-width: 400px;
		max-width: 90vw;
	}

	.dialog h3 {
		margin: 0 0 1rem 0;
		color: var(--color-text);
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.form-group select {
		width: 100%;
		padding: 0.5rem;
		background: var(--color-background);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.cancel-btn,
	.submit-btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.cancel-btn {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.submit-btn {
		background: var(--color-primary);
		color: white;
	}

	.cancel-btn:hover:not(:disabled),
	.submit-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.cancel-btn:disabled,
	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
