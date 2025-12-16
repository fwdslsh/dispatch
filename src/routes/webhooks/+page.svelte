<script>
	import { onMount } from 'svelte';
	import Shell from '$lib/client/shared/components/Shell.svelte';
	import WorkspaceHeader from '$lib/client/shared/components/workspace/WorkspaceHeader.svelte';
	import StatusBar from '$lib/client/shared/components/StatusBar.svelte';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { formatRelativeTime } from '$lib/shared/webhook-utils.js';
	import WebhookCard from './WebhookCard.svelte';
	import WebhookForm from './WebhookForm.svelte';
	import WebhookLogViewer from './WebhookLogViewer.svelte';

	const container = useServiceContainer();
	let webhookService = $state(null);

	let showCreateModal = $state(false);
	let editingWebhook = $state(null);
	let selectedWebhookForLogs = $state(null);
	let statusFilter = $state('all');

	// Load service on mount
	onMount(async () => {
		webhookService = await container.get('webhookService');
		await webhookService.loadWebhooks();
	});

	// Filtered webhooks based on status
	const filteredWebhooks = $derived(() => {
		if (!webhookService) return [];
		if (statusFilter === 'all') return webhookService.webhooks;
		return webhookService.webhooks.filter((webhook) => webhook.status === statusFilter);
	});

	// Statistics
	const stats = $derived(() => {
		if (!webhookService) return { total: 0, active: 0, disabled: 0 };

		return {
			total: webhookService.webhooks.length,
			active: webhookService.webhooks.filter((w) => w.status === 'active').length,
			disabled: webhookService.webhooks.filter((w) => w.status === 'disabled').length
		};
	});

	function handleCreateWebhook() {
		editingWebhook = null;
		showCreateModal = true;
	}

	function handleEditWebhook(webhook) {
		editingWebhook = webhook;
		showCreateModal = true;
	}

	async function handleSaveWebhook(webhookData) {
		try {
			if (editingWebhook) {
				await webhookService.updateWebhook(editingWebhook.id, webhookData);
			} else {
				await webhookService.createWebhook(webhookData);
			}
			showCreateModal = false;
			editingWebhook = null;
		} catch (err) {
			console.error('Failed to save webhook:', err);
		}
	}

	function handleCloseModal() {
		showCreateModal = false;
		editingWebhook = null;
	}

	async function handleEnableWebhook(webhook) {
		try {
			await webhookService.enableWebhook(webhook.id);
		} catch (err) {
			console.error('Failed to enable webhook:', err);
		}
	}

	async function handleDisableWebhook(webhook) {
		try {
			await webhookService.disableWebhook(webhook.id);
		} catch (err) {
			console.error('Failed to disable webhook:', err);
		}
	}

	async function handleDeleteWebhook(webhook) {
		if (!confirm(`Delete "${webhook.name}"? This action cannot be undone.`)) {
			return;
		}

		try {
			await webhookService.deleteWebhook(webhook.id);
		} catch (err) {
			console.error('Failed to delete webhook:', err);
		}
	}

	function handleViewLogs(webhook) {
		selectedWebhookForLogs = webhook;
		webhookService.loadWebhookLogs(webhook.id);
	}

	function handleCloseLogs() {
		selectedWebhookForLogs = null;
	}
</script>

<svelte:head>
	<title>Webhooks - Dispatch</title>
	<meta name="description" content="Manage HTTP webhook endpoints that execute commands in Dispatch." />
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
					onclick={handleCreateWebhook}
					title="New Webhook"
					aria-label="Create new webhook"
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

	<div class="webhook-page main-content">
		<div class="webhook-container">
			<!-- Left sidebar with filter tabs -->
			<div class="webhook-nav" aria-label="Webhook filters" role="tablist">
				<button
					class="webhook-tab"
					class:active={statusFilter === 'all'}
					onclick={() => (statusFilter = 'all')}
					role="tab"
					aria-selected={statusFilter === 'all'}
					title="View all webhooks"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-width="2" stroke-linecap="round" />
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-width="2" stroke-linecap="round" />
					</svg>
					<span class="tab-label">All</span>
					<span class="tab-count">({webhookService?.webhooks.length || 0})</span>
				</button>
				<button
					class="webhook-tab"
					class:active={statusFilter === 'active'}
					onclick={() => (statusFilter = 'active')}
					role="tab"
					aria-selected={statusFilter === 'active'}
					title="View active webhooks"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" />
						<path d="M22 4L12 14.01l-3-3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<span class="tab-label">Active</span>
					<span class="tab-count">({stats().active})</span>
				</button>
				<button
					class="webhook-tab"
					class:active={statusFilter === 'disabled'}
					onclick={() => (statusFilter = 'disabled')}
					role="tab"
					aria-selected={statusFilter === 'disabled'}
					title="View disabled webhooks"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path d="M4.93 4.93l14.14 14.14" stroke-width="2" stroke-linecap="round" />
					</svg>
					<span class="tab-label">Disabled</span>
					<span class="tab-count">({stats().disabled})</span>
				</button>
			</div>

			<!-- Right content area -->
			<main class="webhook-content">
				{#if webhookService?.loading}
					<div class="loading-state">
						<div class="spinner"></div>
						<p>Loading webhooks...</p>
					</div>
				{:else if webhookService?.error}
					<div class="error-state">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<circle cx="12" cy="12" r="10" stroke-width="2" />
							<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
						</svg>
						<p>{webhookService.error}</p>
						<button class="btn-secondary" onclick={() => webhookService.loadWebhooks()}>Retry</button>
					</div>
				{:else}
					<!-- Statistics -->
					{#if webhookService}
						<div class="stats-grid">
							<div class="stat-card">
								<div class="stat-icon total">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
										<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-width="2" stroke-linecap="round" />
										<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-width="2" stroke-linecap="round" />
									</svg>
								</div>
								<div class="stat-content">
									<div class="stat-label">Total Webhooks</div>
									<div class="stat-value">{stats().total}</div>
								</div>
							</div>

							<div class="stat-card">
								<div class="stat-icon active">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
										<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" />
										<path d="M22 4L12 14.01l-3-3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</div>
								<div class="stat-content">
									<div class="stat-label">Active</div>
									<div class="stat-value">{stats().active}</div>
								</div>
							</div>

							<div class="stat-card">
								<div class="stat-icon disabled">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
										<circle cx="12" cy="12" r="10" stroke-width="2" />
										<path d="M4.93 4.93l14.14 14.14" stroke-width="2" stroke-linecap="round" />
									</svg>
								</div>
								<div class="stat-content">
									<div class="stat-label">Disabled</div>
									<div class="stat-value">{stats().disabled}</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Webhook list -->
					{#if filteredWebhooks().length === 0}
						<div class="empty-state">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-width="2" stroke-linecap="round" />
								<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-width="2" stroke-linecap="round" />
							</svg>
							<h3>No webhooks found</h3>
							<p>Create your first webhook to execute commands via HTTP requests</p>
							<button class="btn-primary" onclick={handleCreateWebhook}>Create Webhook</button>
						</div>
					{:else}
						<div class="webhooks-grid">
							{#each filteredWebhooks() as webhook (webhook.id)}
								<WebhookCard
									{webhook}
									onEdit={() => handleEditWebhook(webhook)}
									onEnable={() => handleEnableWebhook(webhook)}
									onDisable={() => handleDisableWebhook(webhook)}
									onDelete={() => handleDeleteWebhook(webhook)}
									onViewLogs={() => handleViewLogs(webhook)}
								/>
							{/each}
						</div>
					{/if}
				{/if}
			</main>
		</div>

		<!-- Create/Edit Modal -->
		{#if showCreateModal}
			<WebhookForm
				webhook={editingWebhook}
				onSave={handleSaveWebhook}
				onCancel={handleCloseModal}
				{webhookService}
			/>
		{/if}

		<!-- Log Viewer -->
		{#if selectedWebhookForLogs}
			<WebhookLogViewer
				webhook={selectedWebhookForLogs}
				logs={webhookService?.logs || []}
				onClose={handleCloseLogs}
			/>
		{/if}
	</div>

	{#snippet footer()}
		<StatusBar />
	{/snippet}
</Shell>

<style>
	.webhook-page {
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.webhook-container {
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

	.webhook-nav {
		width: 240px;
		background: var(--bg-dark);
		border: 1px solid var(--primary);
		padding: var(--space-3) 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	.webhook-tab {
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

	.webhook-tab:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}

	.webhook-tab:hover {
		background: var(--elev);
		color: var(--primary);
	}

	.webhook-tab.active {
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

	.webhook-content {
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

	.stat-icon.disabled {
		background: var(--color-info);
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

	.webhooks-grid {
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
		.webhook-container {
			flex-direction: column;
			min-height: auto;
		}

		.webhook-nav {
			width: 100%;
			flex-direction: row;
			overflow-x: auto;
		}

		.webhook-tab {
			flex: 1 0 auto;
			justify-content: center;
			border-left: none;
			border-bottom: 3px solid transparent;
		}

		.webhook-tab.active {
			border-left-color: transparent;
			border-bottom-color: var(--primary);
		}

		.webhook-content {
			min-height: 400px;
		}

		.webhooks-grid {
			grid-template-columns: 1fr;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
