<script>
	/**
	 * @typedef {Object} Session
	 * @property {string} id - Session ID
	 * @property {string} [provider] - AI provider
	 * @property {string} [model] - Model name
	 * @property {string} [status] - Session status
	 */

	/**
	 * @type {{
	 *   session: Session,
	 *   onClose?: () => void,
	 *   index?: number,
	 *   opencodeSessionId?: string
	 * }}
	 */
	let { session, onClose, index, opencodeSessionId } = $props();

	let displayName = $derived.by(() => {
		if (session.provider && session.model) {
			return `${session.provider}/${session.model}`;
		}
		return 'OpenCode Session';
	});

	let statusIndicator = $derived.by(() => {
		if (session.status === 'running') return '🟢';
		if (session.status === 'stopped') return '🔴';
		if (session.status === 'starting') return '🟡';
		return '⚪';
	});
</script>

<div class="opencode-header">
	<div class="header-left">
		<span class="status-indicator" title={session.status || 'unknown'}>{statusIndicator}</span>
		<span class="session-name">{displayName}</span>
		{#if index !== undefined}
			<span class="session-index">#{index + 1}</span>
		{/if}
	</div>

	<div class="header-right">
		{#if opencodeSessionId}
			<span class="session-id" title="OpenCode Session ID">{opencodeSessionId.slice(0, 8)}...</span>
		{/if}
		{#if onClose}
			<button class="close-btn" onclick={onClose} title="Close session">×</button>
		{/if}
	</div>
</div>

<style>
	.opencode-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text);
		font-size: 0.875rem;
		height: 36px;
		user-select: none;
	}

	.header-left,
	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-indicator {
		font-size: 0.75rem;
		line-height: 1;
	}

	.session-name {
		font-weight: 500;
		color: var(--color-text);
	}

	.session-index {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		background: var(--color-background);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	.session-id {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		font-family: var(--font-mono, monospace);
		background: var(--color-background);
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
	}

	.close-btn {
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: var(--color-error, #c33);
		border-color: var(--color-error, #c33);
		color: white;
	}
</style>
