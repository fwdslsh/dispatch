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
		padding: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.header-content h1 {
		font-size: 2rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text-primary, #1f2937);
	}

	.subtitle {
		font-size: 1rem;
		color: var(--text-secondary, #6b7280);
		margin: 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: var(--card-bg, white);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: all 0.2s ease;
	}

	.stat-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		transform: translateY(-2px);
	}

	.stat-icon {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.stat-icon.total {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.stat-icon.active {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		color: white;
	}

	.stat-icon.paused {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
		color: white;
	}

	.stat-icon.error {
		background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
		color: white;
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--text-secondary, #6b7280);
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-size: 1.875rem;
		font-weight: 700;
		color: var(--text-primary, #1f2937);
	}

	.filter-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-color, #e5e7eb);
		padding-bottom: 0;
	}

	.tab {
		padding: 0.75rem 1.25rem;
		background: none;
		border: none;
		color: var(--text-secondary, #6b7280);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
		position: relative;
		bottom: -1px;
	}

	.tab:hover {
		color: var(--text-primary, #1f2937);
		background: var(--hover-bg, #f9fafb);
	}

	.tab.active {
		color: var(--primary-color, #3b82f6);
		border-bottom-color: var(--primary-color, #3b82f6);
	}

	.jobs-container {
		min-height: 400px;
	}

	.jobs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		gap: 1.5rem;
	}

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		color: var(--text-secondary, #6b7280);
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--border-color, #e5e7eb);
		border-top-color: var(--primary-color, #3b82f6);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-state svg,
	.empty-state svg {
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.empty-state h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary, #1f2937);
		margin: 0 0 0.5rem 0;
	}

	.empty-state p {
		margin: 0 0 1.5rem 0;
		max-width: 400px;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		border: none;
	}

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.btn-secondary {
		background: var(--card-bg, white);
		color: var(--text-primary, #1f2937);
		border: 1px solid var(--border-color, #e5e7eb);
	}

	.btn-secondary:hover {
		background: var(--hover-bg, #f9fafb);
	}

	@media (max-width: 768px) {
		.cron-page {
			padding: 1rem;
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
