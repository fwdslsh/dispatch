<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import { formatRelativeTime, formatDuration } from '$lib/shared/cron-utils.js';

	let { job, logs, onClose, open = $bindable(true) } = $props();

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Modal bind:open title="Execution History" size="large" onclose={handleClose}>
	<div class="modal-subtitle">
		<span class="job-name">{job.name}</span>
	</div>

	<div class="logs-container">
		{#if logs.length === 0}
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2" />
					<polyline points="14 2 14 8 20 8" stroke-width="2" />
				</svg>
				<p>No execution history yet</p>
			</div>
		{:else}
			{#each logs as log (log.id)}
				<div class="log-entry {log.status}">
					<div class="log-header">
						<div class="log-status">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								{#if log.status === 'success'}
									<path d="M20 6L9 17l-5-5" stroke-width="2" stroke-linecap="round" />
								{:else if log.status === 'failed'}
									<circle cx="12" cy="12" r="10" stroke-width="2" />
									<path d="M15 9l-6 6m0-6l6 6" stroke-width="2" stroke-linecap="round" />
								{:else}
									<circle cx="12" cy="12" r="10" stroke-width="2" />
									<path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round" />
								{/if}
							</svg>
							<span class="status-label">{log.status}</span>
						</div>
						<div class="log-meta">
							<span class="log-time">{formatRelativeTime(log.startedAt)}</span>
							{#if log.duration}
								<span class="log-duration">{formatDuration(log.duration)}</span>
							{/if}
							{#if log.exitCode !== null && log.exitCode !== undefined}
								<span class="exit-code">Exit: {log.exitCode}</span>
							{/if}
						</div>
					</div>

					{#if log.output}
						<details class="log-output">
							<summary>Output</summary>
							<pre>{log.output}</pre>
						</details>
					{/if}

					{#if log.error}
						<div class="log-error">
							<strong>Error:</strong>
							<pre>{log.error}</pre>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</Modal>

<style>
	.modal-subtitle {
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--border-primary);
	}

	.job-name {
		font-size: var(--font-size-base);
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}

	.logs-container {
		max-height: 60vh;
		overflow-y: auto;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-16) var(--space-8);
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-state svg {
		margin-bottom: var(--space-4);
		opacity: 0.5;
		color: var(--text-tertiary);
	}

	.empty-state p {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--font-size-base);
	}

	.log-entry {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		margin-bottom: var(--space-3);
		border-left: 4px solid;
		transition: all 0.2s ease;
	}

	.log-entry:hover {
		border-color: var(--border-hover);
		box-shadow: var(--shadow-sm);
	}

	.log-entry.success {
		border-left-color: var(--color-success);
	}

	.log-entry.failed {
		border-left-color: var(--color-error);
	}

	.log-entry.running {
		border-left-color: var(--color-info);
	}

	.log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-3);
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.log-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		text-transform: capitalize;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	.log-entry.success .log-status {
		color: var(--color-success);
	}

	.log-entry.failed .log-status {
		color: var(--color-error);
	}

	.log-entry.running .log-status {
		color: var(--color-info);
	}

	.log-meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}

	.log-time,
	.log-duration,
	.exit-code {
		font-family: var(--font-mono);
	}

	.log-output {
		margin-top: var(--space-3);
	}

	.log-output summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--text-primary);
		user-select: none;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		transition: all 0.2s ease;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	.log-output summary:hover {
		background: var(--bg-hover);
		border-color: var(--border-hover);
	}

	.log-output pre,
	.log-error pre {
		margin: var(--space-3) 0 0 0;
		padding: var(--space-3);
		background: var(--bg-dark);
		color: var(--text-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		line-height: 1.5;
	}

	.log-error {
		margin-top: var(--space-3);
		padding: var(--space-3);
		background: color-mix(in oklab, var(--color-warning) 10%, transparent);
		border: 1px solid var(--color-warning);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
	}

	.log-error strong {
		display: block;
		margin-bottom: var(--space-2);
		color: var(--color-error);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	.log-error pre {
		background: var(--bg-dark);
		color: var(--color-error);
		border-color: var(--color-error);
	}
</style>
