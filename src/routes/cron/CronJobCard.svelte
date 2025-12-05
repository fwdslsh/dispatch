<script>
	import { formatRelativeTime } from '$lib/shared/cron-utils.js';
	import { cronToHuman } from '$lib/shared/cron-utils.js';

	let { job, onEdit, onPause, onResume, onDelete, onViewLogs } = $props();

	const statusColors = {
		active: 'status-active',
		paused: 'status-paused',
		error: 'status-error'
	};

	const statusLabels = {
		active: 'Active',
		paused: 'Paused',
		error: 'Error'
	};
</script>

<div class="job-card {statusColors[job.status]}">
	<div class="job-header">
		<div class="job-title">
			<h3>{job.name}</h3>
			<span class="status-badge {statusColors[job.status]}">{statusLabels[job.status]}</span>
		</div>
		<div class="job-actions">
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

			{#if job.status === 'active'}
				<button class="action-btn" title="Pause" onclick={onPause}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<rect
							x="6"
							y="4"
							width="4"
							height="16"
							stroke-width="2"
							stroke-linecap="round"
						/>
						<rect
							x="14"
							y="4"
							width="4"
							height="16"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			{:else if job.status === 'paused' || job.status === 'error'}
				<button class="action-btn" title="Resume" onclick={onResume}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<polygon
							points="5 3 19 12 5 21 5 3"
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

	{#if job.description}
		<p class="job-description">{job.description}</p>
	{/if}

	<div class="job-schedule">
		<div class="schedule-item">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<circle cx="12" cy="12" r="10" stroke-width="2" />
				<path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round" />
			</svg>
			<span class="schedule-text">{cronToHuman(job.cronExpression)}</span>
		</div>
		<code class="cron-expression">{job.cronExpression}</code>
	</div>

	<div class="job-command">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<polyline points="4 17 10 11 4 5" stroke-width="2" stroke-linecap="round" />
			<line x1="12" y1="19" x2="20" y2="19" stroke-width="2" stroke-linecap="round" />
		</svg>
		<code class="command-text">{job.command}</code>
	</div>

	<div class="job-stats">
		<div class="stat-item">
			<span class="stat-label">Next run:</span>
			<span class="stat-value">
				{job.nextRun ? formatRelativeTime(job.nextRun) : 'Not scheduled'}
			</span>
		</div>
		<div class="stat-item">
			<span class="stat-label">Last run:</span>
			<span class="stat-value">
				{job.lastRun ? formatRelativeTime(job.lastRun) : 'Never'}
			</span>
		</div>
		<div class="stat-item">
			<span class="stat-label">Executions:</span>
			<span class="stat-value">{job.runCount || 0}</span>
		</div>
	</div>

	{#if job.lastStatus}
		<div class="last-status {job.lastStatus === 'success' ? 'success' : 'failed'}">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				{#if job.lastStatus === 'success'}
					<path d="M20 6L9 17l-5-5" stroke-width="2" stroke-linecap="round" />
				{:else}
					<circle cx="12" cy="12" r="10" stroke-width="2" />
					<path d="M15 9l-6 6m0-6l6 6" stroke-width="2" stroke-linecap="round" />
				{/if}
			</svg>
			<span>Last execution: {job.lastStatus}</span>
		</div>
	{/if}

	{#if job.lastError}
		<div class="error-message">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<circle cx="12" cy="12" r="10" stroke-width="2" />
				<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
			</svg>
			<span>{job.lastError}</span>
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
	.job-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-lg);
		padding: var(--space-6);
		transition: all 0.2s ease;
		border-left: 4px solid transparent;
	}

	.job-card:hover {
		box-shadow: var(--shadow-md);
	}

	.job-card.status-active {
		border-left-color: var(--color-success);
	}

	.job-card.status-paused {
		border-left-color: var(--color-info);
	}

	.job-card.status-error {
		border-left-color: var(--color-error);
	}

	.job-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-4);
		gap: var(--space-4);
	}

	.job-title {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.job-title h3 {
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

	.status-badge.status-paused {
		background: var(--color-info-light);
		color: var(--color-info-dark);
	}

	.status-badge.status-error {
		background: var(--color-error-light);
		color: var(--color-error-dark);
	}

	.job-actions {
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

	.job-description {
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		margin: 0 0 var(--space-4) 0;
		line-height: 1.5;
	}

	.job-schedule {
		background: var(--bg-hover);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.schedule-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
		color: var(--text-primary);
		font-weight: 500;
	}

	.schedule-text {
		font-size: var(--font-size-sm);
	}

	.cron-expression {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		background: var(--bg-primary);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-primary);
	}

	.job-command {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		background: var(--bg-terminal);
		color: var(--text-terminal);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-4);
	}

	.job-command svg {
		flex-shrink: 0;
		margin-top: var(--space-1);
	}

	.command-text {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		word-break: break-all;
	}

	.job-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
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
		.job-card {
			padding: var(--space-4);
		}

		.job-stats {
			grid-template-columns: 1fr;
			gap: var(--space-3);
		}
	}
</style>
