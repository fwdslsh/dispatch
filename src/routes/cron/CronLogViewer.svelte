<script>
	import { formatRelativeTime, formatDuration } from '$lib/shared/cron-utils.js';

	let { job, logs, onClose } = $props();

	function handleKeyDown(event) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function handleOverlayClick(event) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleOverlayClick} onkeydown={handleKeyDown}>
	<div class="modal-content">
		<div class="modal-header">
			<div>
				<h2>Execution History</h2>
				<p class="job-name">{job.name}</p>
			</div>
			<button class="close-btn" onclick={onClose}>×</button>
		</div>

		<div class="logs-container">
			{#if logs.length === 0}
				<div class="empty-state">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
							stroke-width="2"
						/>
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
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: var(--card-bg, white);
		border-radius: 12px;
		max-width: 800px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color, #e5e7eb);
	}

	.modal-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: var(--text-primary, #1f2937);
	}

	.job-name {
		font-size: 0.9375rem;
		color: var(--text-secondary, #6b7280);
		margin: 0;
	}

	.close-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		font-size: 2rem;
		color: var(--text-secondary, #6b7280);
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: var(--hover-bg, #f9fafb);
		color: var(--text-primary, #1f2937);
	}

	.logs-container {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 2rem;
		text-align: center;
		color: var(--text-secondary, #6b7280);
	}

	.empty-state svg {
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.log-entry {
		background: var(--hover-bg, #f9fafb);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
		border-left: 4px solid;
	}

	.log-entry.success {
		border-left-color: #10b981;
	}

	.log-entry.failed {
		border-left-color: #ef4444;
	}

	.log-entry.running {
		border-left-color: #3b82f6;
	}

	.log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.log-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.log-entry.success .log-status {
		color: #065f46;
	}

	.log-entry.failed .log-status {
		color: #991b1b;
	}

	.log-entry.running .log-status {
		color: #1e40af;
	}

	.log-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.875rem;
		color: var(--text-secondary, #6b7280);
	}

	.exit-code {
		font-family: 'Monaco', 'Menlo', monospace;
	}

	.log-output {
		margin-top: 0.75rem;
	}

	.log-output summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--text-primary, #1f2937);
		user-select: none;
		padding: 0.5rem;
		background: var(--card-bg, white);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 6px;
		transition: all 0.2s;
	}

	.log-output summary:hover {
		background: var(--hover-bg, #f9fafb);
	}

	.log-output pre,
	.log-error pre {
		margin: 0.75rem 0 0 0;
		padding: 0.75rem;
		background: #1f2937;
		color: #d1d5db;
		border-radius: 6px;
		overflow-x: auto;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.log-error {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: #fef3c7;
		border: 1px solid #f59e0b;
		border-radius: 6px;
		color: #78350f;
	}

	.log-error strong {
		display: block;
		margin-bottom: 0.5rem;
	}

	.log-error pre {
		background: #451a03;
		color: #fef3c7;
	}
</style>
