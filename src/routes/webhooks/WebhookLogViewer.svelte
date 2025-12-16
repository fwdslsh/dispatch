<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import { formatDateTime, formatDuration, HTTP_METHOD_STYLES } from '$lib/shared/webhook-utils.js';

	let { webhook, logs, onClose, open = $bindable(true) } = $props();

	let selectedLog = $state(null);

	function getMethodStyle(method) {
		return HTTP_METHOD_STYLES[method] || HTTP_METHOD_STYLES.GET;
	}

	function handleClose() {
		onClose();
		open = false;
	}

	function selectLog(log) {
		selectedLog = selectedLog?.id === log.id ? null : log;
	}
</script>

<Modal
	bind:open
	title="Execution History: {webhook.name}"
	size="large"
	onclose={handleClose}
>
	<div class="log-viewer">
		{#if logs.length === 0}
			<div class="empty-logs">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2" />
					<polyline points="14 2 14 8 20 8" stroke-width="2" />
				</svg>
				<p>No execution history yet</p>
			</div>
		{:else}
			<div class="log-list">
				{#each logs as log (log.id)}
					<button
						class="log-item"
						class:selected={selectedLog?.id === log.id}
						class:success={log.status === 'success'}
						class:failed={log.status === 'failed'}
						class:running={log.status === 'running'}
						onclick={() => selectLog(log)}
					>
						<div class="log-header">
							<span
								class="log-method"
								style="background: {getMethodStyle(log.requestMethod).bg}; color: {getMethodStyle(log.requestMethod).color};"
							>
								{log.requestMethod}
							</span>
							<span class="log-path">{log.requestPath}</span>
							<span class="log-status {log.status}">{log.status}</span>
						</div>
						<div class="log-meta">
							<span class="log-time">{formatDateTime(log.triggeredAt)}</span>
							{#if log.durationMs}
								<span class="log-duration">{formatDuration(log.durationMs)}</span>
							{/if}
							{#if log.exitCode !== null && log.exitCode !== undefined}
								<span class="log-exit-code">Exit: {log.exitCode}</span>
							{/if}
							{#if log.clientIp}
								<span class="log-ip">{log.clientIp}</span>
							{/if}
						</div>
					</button>

					{#if selectedLog?.id === log.id}
						<div class="log-details">
							{#if log.requestBody}
								<div class="detail-section">
									<h4>Request Body</h4>
									<pre class="detail-content">{log.requestBody}</pre>
								</div>
							{/if}

							{#if log.output}
								<div class="detail-section">
									<h4>Output</h4>
									<pre class="detail-content output">{log.output}</pre>
								</div>
							{/if}

							{#if log.error}
								<div class="detail-section">
									<h4>Error</h4>
									<pre class="detail-content error">{log.error}</pre>
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class="modal-actions">
			<Button variant="secondary" onclick={handleClose}>Close</Button>
		</div>
	{/snippet}
</Modal>

<style>
	.log-viewer {
		min-height: 300px;
		max-height: 60vh;
		overflow: auto;
	}

	.empty-logs {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-8);
		color: var(--text-secondary);
		text-align: center;
	}

	.empty-logs svg {
		margin-bottom: var(--space-4);
		opacity: 0.5;
	}

	.log-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.log-item {
		width: 100%;
		text-align: left;
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		cursor: pointer;
		transition: all 0.2s ease;
		border-left: 3px solid transparent;
	}

	.log-item:hover {
		background: var(--bg-hover);
	}

	.log-item.selected {
		border-color: var(--primary);
		background: var(--bg-hover);
	}

	.log-item.success {
		border-left-color: var(--color-success);
	}

	.log-item.failed {
		border-left-color: var(--color-error);
	}

	.log-item.running {
		border-left-color: var(--color-warning);
	}

	.log-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.log-method {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		font-weight: 700;
	}

	.log-path {
		flex: 1;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--text-primary);
	}

	.log-status {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
	}

	.log-status.success {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.log-status.failed {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.log-status.running {
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
	}

	.log-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		font-size: var(--font-size-xs);
		color: var(--text-secondary);
	}

	.log-time {
		font-family: var(--font-mono);
	}

	.log-duration,
	.log-exit-code,
	.log-ip {
		font-family: var(--font-mono);
	}

	.log-details {
		background: var(--bg-dark);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		margin-top: var(--space-2);
		overflow: hidden;
	}

	.detail-section {
		border-bottom: 1px solid var(--border-primary);
	}

	.detail-section:last-child {
		border-bottom: none;
	}

	.detail-section h4 {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--text-secondary);
		background: var(--bg-hover);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-content {
		margin: 0;
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 200px;
		overflow: auto;
		background: var(--bg-terminal);
		color: var(--text-terminal);
	}

	.detail-content.error {
		color: var(--color-error);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
	}
</style>
