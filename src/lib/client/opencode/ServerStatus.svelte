<script>
	/**
	 * @typedef {Object} ServerStatus
	 * @property {boolean} running - Whether OpenCode server is running
	 * @property {string} [version] - OpenCode version
	 * @property {number} [uptime] - Server uptime in milliseconds
	 * @property {Object} [config] - Server configuration
	 */

	/**
	 * @type {{
	 *   status: ServerStatus,
	 *   onRefresh: () => void
	 * }}
	 */
	let { status, onRefresh } = $props();

	let refreshing = $state(false);

	async function handleRefresh() {
		refreshing = true;
		try {
			await onRefresh();
		} finally {
			refreshing = false;
		}
	}

	function formatUptime(ms) {
		if (!ms) return 'N/A';
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}
</script>

<div class="server-status">
	<div class="status-row">
		<div class="status-indicator" class:running={status.running} class:stopped={!status.running}>
			<span class="dot"></span>
			<span class="label">{status.running ? 'Running' : 'Stopped'}</span>
		</div>
		<button class="refresh-btn" onclick={handleRefresh} disabled={refreshing}>
			{refreshing ? 'Refreshing...' : 'Refresh'}
		</button>
	</div>

	{#if status.running}
		<div class="status-details">
			{#if status.version}
				<div class="detail-row">
					<span class="detail-label">Version:</span>
					<span class="detail-value">{status.version}</span>
				</div>
			{/if}
			{#if status.uptime !== undefined}
				<div class="detail-row">
					<span class="detail-label">Uptime:</span>
					<span class="detail-value">{formatUptime(status.uptime)}</span>
				</div>
			{/if}
			{#if status.config}
				<div class="detail-row">
					<span class="detail-label">Config:</span>
					<span class="detail-value">{JSON.stringify(status.config, null, 2)}</span>
				</div>
			{/if}
		</div>
	{:else}
		<p class="stopped-message">OpenCode server is not running. Start it to create sessions.</p>
	{/if}
</div>

<style>
	.server-status {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-text-muted);
	}

	.status-indicator.running .dot {
		background: var(--color-success, #0a0);
		animation: pulse 2s ease-in-out infinite;
	}

	.status-indicator.stopped .dot {
		background: var(--color-error, #c33);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.refresh-btn {
		padding: 0.5rem 1rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: opacity 0.2s;
	}

	.refresh-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--color-background);
		border-radius: 4px;
	}

	.detail-row {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.detail-label {
		font-weight: 600;
		color: var(--color-text-muted);
		min-width: 80px;
	}

	.detail-value {
		color: var(--color-text);
		white-space: pre-wrap;
		font-family: var(--font-mono, monospace);
	}

	.stopped-message {
		color: var(--color-text-muted);
		font-style: italic;
		margin: 0;
	}
</style>
