<script>
	import {
		formatRelativeTime,
		HTTP_METHOD_STYLES,
		getWebhookUrl
	} from '$lib/shared/webhook-utils.js';

	let { webhook, onEdit, onEnable, onDisable, onDelete, onViewLogs } = $props();

	const statusColors = {
		active: 'status-active',
		disabled: 'status-disabled'
	};

	const statusLabels = {
		active: 'Active',
		disabled: 'Disabled'
	};

	function getMethodStyle(method) {
		return HTTP_METHOD_STYLES[method] || HTTP_METHOD_STYLES.GET;
	}

	function copyUrl() {
		const url = getWebhookUrl(window.location.origin, webhook.uriPath);
		navigator.clipboard.writeText(url);
	}
</script>

<div class="webhook-card {statusColors[webhook.status]}">
	<div class="webhook-header">
		<div class="webhook-title">
			<h3>{webhook.name}</h3>
			<span class="status-badge {statusColors[webhook.status]}">{statusLabels[webhook.status]}</span
			>
		</div>
		<div class="webhook-actions">
			<button class="action-btn" title="Edit" onclick={onEdit}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path
						d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>

			{#if webhook.status === 'active'}
				<button class="action-btn" title="Disable" onclick={onDisable}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path d="M4.93 4.93l14.14 14.14" stroke-width="2" stroke-linecap="round" />
					</svg>
				</button>
			{:else}
				<button class="action-btn" title="Enable" onclick={onEnable}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" />
						<path
							d="M22 4L12 14.01l-3-3"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			{/if}

			<button class="action-btn danger" title="Delete" onclick={onDelete}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path
						d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>

	{#if webhook.description}
		<p class="webhook-description">{webhook.description}</p>
	{/if}

	<div class="webhook-endpoint">
		<span
			class="http-method"
			style="background: {getMethodStyle(webhook.httpMethod).bg}; color: {getMethodStyle(
				webhook.httpMethod
			).color};"
		>
			{webhook.httpMethod}
		</span>
		<code class="uri-path">{webhook.uriPath}</code>
		<button class="copy-btn" title="Copy URL" onclick={copyUrl}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2" />
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2" />
			</svg>
		</button>
	</div>

	<div class="webhook-command">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<polyline points="4 17 10 11 4 5" stroke-width="2" stroke-linecap="round" />
			<line x1="12" y1="19" x2="20" y2="19" stroke-width="2" stroke-linecap="round" />
		</svg>
		<code class="command-text">{webhook.command}</code>
	</div>

	<div class="webhook-stats">
		<div class="stat-item">
			<span class="stat-label">Last triggered:</span>
			<span class="stat-value">
				{webhook.lastTriggered ? formatRelativeTime(webhook.lastTriggered) : 'Never'}
			</span>
		</div>
		<div class="stat-item">
			<span class="stat-label">Triggers:</span>
			<span class="stat-value">{webhook.triggerCount || 0}</span>
		</div>
	</div>

	{#if webhook.lastStatus}
		<div class="last-status {webhook.lastStatus === 'success' ? 'success' : 'failed'}">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				{#if webhook.lastStatus === 'success'}
					<path d="M20 6L9 17l-5-5" stroke-width="2" stroke-linecap="round" />
				{:else}
					<circle cx="12" cy="12" r="10" stroke-width="2" />
					<path d="M15 9l-6 6m0-6l6 6" stroke-width="2" stroke-linecap="round" />
				{/if}
			</svg>
			<span>Last execution: {webhook.lastStatus}</span>
		</div>
	{/if}

	{#if webhook.lastError}
		<div class="error-message">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<circle cx="12" cy="12" r="10" stroke-width="2" />
				<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
			</svg>
			<span>{webhook.lastError}</span>
		</div>
	{/if}

	<button class="view-logs-btn" onclick={onViewLogs}>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<path
				d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<polyline points="14 2 14 8 20 8" stroke-width="2" stroke-linecap="round" />
			<line x1="16" y1="13" x2="8" y2="13" stroke-width="2" stroke-linecap="round" />
			<line x1="16" y1="17" x2="8" y2="17" stroke-width="2" stroke-linecap="round" />
		</svg>
		View Execution History
	</button>
</div>

<style>
	.webhook-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-lg);
		padding: var(--space-6);
		transition: all 0.2s ease;
		border-left: 4px solid transparent;
	}

	.webhook-card:hover {
		box-shadow: var(--shadow-md);
	}

	.webhook-card.status-active {
		border-left-color: var(--color-success);
	}

	.webhook-card.status-disabled {
		border-left-color: var(--color-info);
	}

	.webhook-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-4);
		gap: var(--space-4);
	}

	.webhook-title {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.webhook-title h3 {
		font-size: var(--font-size-lg);
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.status-badge {
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-badge.status-active {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.status-badge.status-disabled {
		background: var(--color-info-light);
		color: var(--color-info-dark);
	}

	.webhook-actions {
		display: flex;
		gap: var(--space-2);
	}

	.action-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-hover);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--text-secondary);
	}

	.action-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.action-btn.danger:hover {
		background: var(--color-error-light);
		color: var(--color-error-dark);
		border-color: var(--color-error);
	}

	.webhook-description {
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		margin: 0 0 var(--space-4) 0;
		line-height: 1.5;
	}

	.webhook-endpoint {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: var(--bg-hover);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.http-method {
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		font-weight: 700;
		text-transform: uppercase;
	}

	.uri-path {
		flex: 1;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--text-primary);
		word-break: break-all;
	}

	.copy-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: var(--space-1);
		border-radius: var(--radius-sm);
		transition: all 0.2s ease;
	}

	.copy-btn:hover {
		color: var(--primary);
		background: var(--bg-secondary);
	}

	.webhook-command {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		background: var(--bg-terminal);
		color: var(--text-terminal);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
	}

	.webhook-command svg {
		flex-shrink: 0;
		margin-top: var(--space-1);
	}

	.command-text {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		word-break: break-all;
	}

	.webhook-stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-4);
		margin-bottom: var(--space-4);
		padding: var(--space-4) 0;
		border-top: 1px solid var(--border-primary);
		border-bottom: 1px solid var(--border-primary);
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.stat-label {
		font-size: var(--font-size-xs);
		color: var(--text-secondary);
	}

	.stat-value {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--text-primary);
	}

	.last-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 500;
		margin-bottom: var(--space-2);
	}

	.last-status.success {
		background: var(--color-success-light);
		color: var(--color-success-dark);
	}

	.last-status.failed {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.error-message {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		background: var(--color-warning-light);
		color: var(--color-warning-dark);
		margin-bottom: var(--space-4);
	}

	.error-message svg {
		flex-shrink: 0;
		margin-top: var(--space-1);
	}

	.view-logs-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--bg-hover);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.view-logs-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--border-secondary);
	}

	@media (max-width: 640px) {
		.webhook-card {
			padding: var(--space-4);
		}

		.webhook-stats {
			grid-template-columns: 1fr;
			gap: var(--space-3);
		}
	}
</style>
