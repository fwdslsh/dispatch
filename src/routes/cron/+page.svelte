<script>
	import { onMount } from 'svelte';
	import { getServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { CRON_PRESETS, formatRelativeTime, formatDuration } from '$lib/shared/cron-utils.js';
	import CronJobCard from './CronJobCard.svelte';
	import CronJobForm from './CronJobForm.svelte';
	import CronLogViewer from './CronLogViewer.svelte';

	const container = getServiceContainer();
	let cronService = $state(null);

	let showCreateModal = $state(false);
	let editingJob = $state(null);
	let selectedJobForLogs = $state(null);
	let statusFilter = $state('all');

	// Load service on mount
	onMount(async () => {
		cronService = await container.get('cronService');
		await cronService.loadJobs();
	});

	// Filtered jobs based on status
	const filteredJobs = $derived(() => {
		if (!cronService) return [];
		if (statusFilter === 'all') return cronService.jobs;
		return cronService.jobs.filter((job) => job.status === statusFilter);
	});

	// Statistics
	const stats = $derived(() => {
		if (!cronService) return { total: 0, active: 0, paused: 0, error: 0 };

		return {
			total: cronService.jobs.length,
			active: cronService.jobs.filter((j) => j.status === 'active').length,
			paused: cronService.jobs.filter((j) => j.status === 'paused').length,
			error: cronService.jobs.filter((j) => j.status === 'error').length
		};
	});

	function handleCreateJob() {
		editingJob = null;
		showCreateModal = true;
	}

	function handleEditJob(job) {
		editingJob = job;
		showCreateModal = true;
	}

	async function handleSaveJob(jobData) {
		try {
			if (editingJob) {
				await cronService.updateJob(editingJob.id, jobData);
			} else {
				await cronService.createJob(jobData);
			}
			showCreateModal = false;
			editingJob = null;
		} catch (err) {
			console.error('Failed to save job:', err);
		}
	}

	function handleCloseModal() {
		showCreateModal = false;
		editingJob = null;
	}

	async function handlePauseJob(job) {
		try {
			await cronService.pauseJob(job.id);
		} catch (err) {
			console.error('Failed to pause job:', err);
		}
	}

	async function handleResumeJob(job) {
		try {
			await cronService.resumeJob(job.id);
		} catch (err) {
			console.error('Failed to resume job:', err);
		}
	}

	async function handleDeleteJob(job) {
		if (!confirm(`Delete "${job.name}"? This action cannot be undone.`)) {
			return;
		}

		try {
			await cronService.deleteJob(job.id);
		} catch (err) {
			console.error('Failed to delete job:', err);
		}
	}

	function handleViewLogs(job) {
		selectedJobForLogs = job;
		cronService.loadJobLogs(job.id);
	}

	function handleCloseLogs() {
		selectedJobForLogs = null;
	}
</script>

<div class="cron-page">
	<div class="page-header">
		<div class="header-content">
			<h1>Scheduled Tasks</h1>
			<p class="subtitle">Manage recurring tasks with cron expressions</p>
		</div>
		<button class="btn-primary" onclick={handleCreateJob}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<path d="M12 5v14m-7-7h14" stroke-width="2" stroke-linecap="round" />
			</svg>
			New Task
		</button>
	</div>

	<!-- Statistics -->
	{#if cronService}
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon total">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<rect x="3" y="3" width="7" height="7" stroke-width="2" stroke-linecap="round" />
						<rect x="14" y="3" width="7" height="7" stroke-width="2" stroke-linecap="round" />
						<rect x="3" y="14" width="7" height="7" stroke-width="2" stroke-linecap="round" />
						<rect x="14" y="14" width="7" height="7" stroke-width="2" stroke-linecap="round" />
					</svg>
				</div>
				<div class="stat-content">
					<div class="stat-label">Total Tasks</div>
					<div class="stat-value">{stats().total}</div>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon active">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round" />
					</svg>
				</div>
				<div class="stat-content">
					<div class="stat-label">Active</div>
					<div class="stat-value">{stats().active}</div>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon paused">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<rect x="6" y="4" width="4" height="16" stroke-width="2" stroke-linecap="round" />
						<rect x="14" y="4" width="4" height="16" stroke-width="2" stroke-linecap="round" />
					</svg>
				</div>
				<div class="stat-content">
					<div class="stat-label">Paused</div>
					<div class="stat-value">{stats().paused}</div>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon error">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
					</svg>
				</div>
				<div class="stat-content">
					<div class="stat-label">Errors</div>
					<div class="stat-value">{stats().error}</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Filter tabs -->
	<div class="filter-tabs">
		<button
			class="tab"
			class:active={statusFilter === 'all'}
			onclick={() => (statusFilter = 'all')}
		>
			All ({cronService?.jobs.length || 0})
		</button>
		<button
			class="tab"
			class:active={statusFilter === 'active'}
			onclick={() => (statusFilter = 'active')}
		>
			Active ({stats().active})
		</button>
		<button
			class="tab"
			class:active={statusFilter === 'paused'}
			onclick={() => (statusFilter = 'paused')}
		>
			Paused ({stats().paused})
		</button>
		<button
			class="tab"
			class:active={statusFilter === 'error'}
			onclick={() => (statusFilter = 'error')}
		>
			Errors ({stats().error})
		</button>
	</div>

	<!-- Job list -->
	<div class="jobs-container">
		{#if cronService?.loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading tasks...</p>
			</div>
		{:else if cronService?.error}
			<div class="error-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<circle cx="12" cy="12" r="10" stroke-width="2" />
					<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
				</svg>
				<p>{cronService.error}</p>
				<button class="btn-secondary" onclick={() => cronService.loadJobs()}>Retry</button>
			</div>
		{:else if filteredJobs().length === 0}
			<div class="empty-state">
				<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<circle cx="12" cy="12" r="10" stroke-width="2" />
					<path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round" />
				</svg>
				<h3>No tasks found</h3>
				<p>Create your first scheduled task to automate recurring operations</p>
				<button class="btn-primary" onclick={handleCreateJob}>Create Task</button>
			</div>
		{:else}
			<div class="jobs-grid">
				{#each filteredJobs() as job (job.id)}
					<CronJobCard
						{job}
						onEdit={() => handleEditJob(job)}
						onPause={() => handlePauseJob(job)}
						onResume={() => handleResumeJob(job)}
						onDelete={() => handleDeleteJob(job)}
						onViewLogs={() => handleViewLogs(job)}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Create/Edit Modal -->
	{#if showCreateModal}
		<CronJobForm
			job={editingJob}
			onSave={handleSaveJob}
			onCancel={handleCloseModal}
			cronService={cronService}
		/>
	{/if}

	<!-- Log Viewer -->
	{#if selectedJobForLogs}
		<CronLogViewer
			job={selectedJobForLogs}
			logs={cronService?.logs || []}
			onClose={handleCloseLogs}
		/>
	{/if}
</div>

<style>
	.cron-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: var(--space-8);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-8);
		flex-wrap: wrap;
		gap: var(--space-4);
	}

	.header-content h1 {
		font-size: var(--font-size-3xl);
		font-weight: 600;
		margin: 0 0 var(--space-2) 0;
		color: var(--text-primary);
	}

	.subtitle {
		font-size: var(--font-size-base);
		color: var(--text-secondary);
		margin: 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-8);
	}

	.stat-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-lg);
		padding: var(--space-6);
		display: flex;
		align-items: center;
		gap: var(--space-4);
		transition: all 0.2s ease;
	}

	.stat-card:hover {
		box-shadow: var(--shadow-md);
	}

	.stat-icon {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.stat-icon.total {
		background: var(--bg-accent);
		color: var(--text-on-accent);
	}

	.stat-icon.active {
		background: var(--color-success);
		color: var(--text-on-accent);
	}

	.stat-icon.paused {
		background: var(--color-info);
		color: var(--text-on-accent);
	}

	.stat-icon.error {
		background: var(--color-error);
		color: var(--text-on-accent);
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		margin-bottom: var(--space-1);
	}

	.stat-value {
		font-size: var(--font-size-3xl);
		font-weight: 700;
		color: var(--text-primary);
	}

	.filter-tabs {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-6);
		border-bottom: 1px solid var(--border-primary);
		padding-bottom: 0;
	}

	.tab {
		padding: var(--space-3) var(--space-5);
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: var(--font-size-sm);
		font-weight: 500;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
		position: relative;
		bottom: -1px;
	}

	.tab:hover {
		color: var(--text-primary);
		background: var(--bg-hover);
	}

	.tab.active {
		color: var(--text-accent);
		border-bottom-color: var(--text-accent);
	}

	.jobs-container {
		min-height: 400px;
	}

	.jobs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		gap: var(--space-6);
	}

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-16) var(--space-8);
		text-align: center;
		color: var(--text-secondary);
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--border-primary);
		border-top-color: var(--text-accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: var(--space-4);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-state svg,
	.empty-state svg {
		margin-bottom: var(--space-4);
		opacity: 0.5;
	}

	.empty-state h3 {
		font-size: var(--font-size-xl);
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 var(--space-2) 0;
	}

	.empty-state p {
		margin: 0 0 var(--space-6) 0;
		max-width: 400px;
	}

	.btn-primary,
	.btn-secondary {
		padding: var(--space-3) var(--space-6);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		border: none;
	}

	.btn-primary {
		background: var(--bg-accent);
		color: var(--text-on-accent);
	}

	.btn-primary:hover {
		box-shadow: var(--shadow-md);
	}

	.btn-secondary {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-primary);
	}

	.btn-secondary:hover {
		background: var(--bg-hover);
	}

	@media (max-width: 768px) {
		.cron-page {
			padding: var(--space-4);
		}

		.page-header {
			flex-direction: column;
			align-items: stretch;
		}

		.jobs-grid {
			grid-template-columns: 1fr;
		}

		.filter-tabs {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.tab {
			white-space: nowrap;
		}
	}
</style>
