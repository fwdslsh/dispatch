<script>
	import { onMount } from 'svelte';
	import Shell from '$lib/client/shared/components/Shell.svelte';
	import WorkspaceHeader from '$lib/client/shared/components/workspace/WorkspaceHeader.svelte';
	import StatusBar from '$lib/client/shared/components/StatusBar.svelte';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { CRON_PRESETS, formatRelativeTime, formatDuration } from '$lib/shared/cron-utils.js';
	import CronJobCard from './CronJobCard.svelte';
	import CronJobForm from './CronJobForm.svelte';
	import CronLogViewer from './CronLogViewer.svelte';

	const container = useServiceContainer();
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

<svelte:head>
	<title>Scheduled Tasks - Dispatch</title>
	<meta name="description" content="Manage recurring tasks with cron expressions in Dispatch." />
</svelte:head>

<Shell>
	{#snippet header()}
		<WorkspaceHeader
			onLogout={() => (window.location.href = '/login')}
			viewMode="window-manager"
			onViewModeChange={() => {}}
		>
			{#snippet actions()}
				<button
					class="icon-button"
					onclick={handleCreateJob}
					title="New Task"
					aria-label="Create new scheduled task"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path d="M12 5v14m-7-7h14" stroke-width="2" stroke-linecap="round" />
					</svg>
				</button>
				<button
					class="icon-button"
					onclick={() => (window.location.href = '/login')}
					title="Logout"
					aria-label="Logout"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			{/snippet}
		</WorkspaceHeader>
	{/snippet}

	<div class="cron-page main-content">
		<div class="cron-container">
			<!-- Left sidebar with filter tabs -->
			<div class="cron-nav" aria-label="Task filters" role="tablist">
				<button
					class="cron-tab"
					class:active={statusFilter === 'all'}
					onclick={() => (statusFilter = 'all')}
					role="tab"
					aria-selected={statusFilter === 'all'}
					aria-controls="cron-panel-all"
					title="View all tasks"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<rect x="3" y="3" width="7" height="7" stroke-width="2" stroke-linecap="round" />
						<rect x="14" y="3" width="7" height="7" stroke-width="2" stroke-linecap="round" />
						<rect x="3" y="14" width="7" height="7" stroke-width="2" stroke-linecap="round" />
						<rect x="14" y="14" width="7" height="7" stroke-width="2" stroke-linecap="round" />
					</svg>
					<span class="tab-label">All</span>
					<span class="tab-count">({cronService?.jobs.length || 0})</span>
				</button>
				<button
					class="cron-tab"
					class:active={statusFilter === 'active'}
					onclick={() => (statusFilter = 'active')}
					role="tab"
					aria-selected={statusFilter === 'active'}
					aria-controls="cron-panel-active"
					title="View active tasks"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round" />
					</svg>
					<span class="tab-label">Active</span>
					<span class="tab-count">({stats().active})</span>
				</button>
				<button
					class="cron-tab"
					class:active={statusFilter === 'paused'}
					onclick={() => (statusFilter = 'paused')}
					role="tab"
					aria-selected={statusFilter === 'paused'}
					aria-controls="cron-panel-paused"
					title="View paused tasks"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<rect x="6" y="4" width="4" height="16" stroke-width="2" stroke-linecap="round" />
						<rect x="14" y="4" width="4" height="16" stroke-width="2" stroke-linecap="round" />
					</svg>
					<span class="tab-label">Paused</span>
					<span class="tab-count">({stats().paused})</span>
				</button>
				<button
					class="cron-tab"
					class:active={statusFilter === 'error'}
					onclick={() => (statusFilter = 'error')}
					role="tab"
					aria-selected={statusFilter === 'error'}
					aria-controls="cron-panel-error"
					title="View tasks with errors"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
					</svg>
					<span class="tab-label">Errors</span>
					<span class="tab-count">({stats().error})</span>
				</button>
			</div>

			<!-- Right content area -->
			<main class="cron-content">
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
				{:else}
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

					<!-- Job list -->
					{#if filteredJobs().length === 0}
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
				{/if}
			</main>
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

	{#snippet footer()}
		<StatusBar />
	{/snippet}
</Shell>

<style>
	.cron-page {
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.cron-container {
		display: flex;
		height: 100%;
		overflow: hidden;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow:
			0 4px 12px color-mix(in oklab, var(--bg) 80%, black),
			inset 0 1px 0 var(--primary-glow-10);
	}

	.cron-nav {
		width: 240px;
		background: var(--bg-dark);
		border: 1px solid var(--primary);
		padding: var(--space-3) 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	.cron-tab {
		border: none;
		background: transparent;
		color: var(--text-muted);
		padding: var(--space-3) var(--space-4);
		text-align: left;
		cursor: pointer;
		transition:
			background 0.2s ease,
			color 0.2s ease;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		border-left: 3px solid transparent;
	}

	.cron-tab:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}

	.cron-tab:hover {
		background: var(--elev);
		color: var(--primary);
	}

	.cron-tab.active {
		background: var(--elev);
		color: var(--primary);
		border-left-color: var(--primary);
	}

	.tab-label {
		flex: 1;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.tab-count {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	.cron-content {
		flex: 1;
		background: var(--bg-dark);
		border: 1px solid var(--primary-bright);
		overflow: auto;
		position: relative;
		padding: var(--space-4);
	}

	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
	}

	.icon-button:hover {
		background: var(--bg-hover);
		color: var(--primary);
	}

	.icon-button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}

	.stat-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		display: flex;
		align-items: center;
		gap: var(--space-4);
		transition: all 0.2s ease;
	}

	.stat-card:hover {
		box-shadow: var(--shadow-sm);
		border-color: var(--border-hover);
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
		.cron-container {
			flex-direction: column;
			min-height: auto;
		}

		.cron-nav {
			width: 100%;
			flex-direction: row;
			overflow-x: auto;
		}

		.cron-tab {
			flex: 1 0 auto;
			justify-content: center;
			border-left: none;
			border-bottom: 3px solid transparent;
		}

		.cron-tab.active {
			border-left-color: transparent;
			border-bottom-color: var(--primary);
		}

		.cron-content {
			min-height: 400px;
		}

		.jobs-grid {
			grid-template-columns: 1fr;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
