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
			{:else if job.status === 'paused'}
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
		background: var(--card-bg, white);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 12px;
		padding: 1.5rem;
		transition: all 0.2s ease;
		border-left: 4px solid transparent;
	}

	.job-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.job-card.status-active {
		border-left-color: #10b981;
	}

	.job-card.status-paused {
		border-left-color: #3b82f6;
	}

	.job-card.status-error {
		border-left-color: #ef4444;
	}

	.job-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.job-title {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.job-title h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-primary, #1f2937);
		margin: 0;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-badge.status-active {
		background: #d1fae5;
		color: #065f46;
	}

	.status-badge.status-paused {
		background: #dbeafe;
		color: #1e40af;
	}

	.status-badge.status-error {
		background: #fee2e2;
		color: #991b1b;
	}

	.job-actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--hover-bg, #f9fafb);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--text-secondary, #6b7280);
	}

	.action-btn:hover {
		background: var(--border-color, #e5e7eb);
		color: var(--text-primary, #1f2937);
	}

	.action-btn.danger:hover {
		background: #fee2e2;
		color: #dc2626;
		border-color: #fecaca;
	}

	.job-description {
		font-size: 0.9375rem;
		color: var(--text-secondary, #6b7280);
		margin: 0 0 1rem 0;
		line-height: 1.5;
	}

	.job-schedule {
		background: var(--hover-bg, #f9fafb);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.schedule-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary, #1f2937);
		font-weight: 500;
	}

	.schedule-text {
		font-size: 0.9375rem;
	}

	.cron-expression {
		display: block;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		color: var(--text-secondary, #6b7280);
		background: var(--card-bg, white);
		padding: 0.5rem;
		border-radius: 4px;
		border: 1px solid var(--border-color, #e5e7eb);
	}

	.job-command {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		background: #1f2937;
		color: #d1d5db;
		padding: 0.75rem;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.job-command svg {
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.command-text {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		word-break: break-all;
	}

	.job-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 1rem 0;
		border-top: 1px solid var(--border-color, #e5e7eb);
		border-bottom: 1px solid var(--border-color, #e5e7eb);
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-label {
		font-size: 0.8125rem;
		color: var(--text-secondary, #6b7280);
	}

	.stat-value {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary, #1f2937);
	}

	.last-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.last-status.success {
		background: #d1fae5;
		color: #065f46;
	}

	.last-status.failed {
		background: #fee2e2;
		color: #991b1b;
	}

	.error-message {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.625rem;
		border-radius: 6px;
		font-size: 0.875rem;
		background: #fef3c7;
		color: #78350f;
		margin-bottom: 1rem;
	}

	.error-message svg {
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.view-logs-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--hover-bg, #f9fafb);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text-primary, #1f2937);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.view-logs-btn:hover {
		background: var(--border-color, #e5e7eb);
		border-color: var(--text-secondary, #9ca3af);
	}

	@media (max-width: 640px) {
		.job-card {
			padding: 1rem;
		}

		.job-stats {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
	}
</style>
