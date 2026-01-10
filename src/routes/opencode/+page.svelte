<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import Shell from '$lib/client/shared/components/Shell.svelte';
	import WorkspaceHeader from '$lib/client/shared/components/workspace/WorkspaceHeader.svelte';
	import StatusBar from '$lib/client/shared/components/StatusBar.svelte';
	import OpenCodePane from '$lib/client/opencode/OpenCodePane.svelte';
	import ServerSelector from '$lib/client/opencode/ServerSelector.svelte';
	import IconPlus from '$lib/client/shared/components/Icons/IconPlus.svelte';
	import IconTrash from '$lib/client/shared/components/Icons/IconTrash.svelte';
	import IconBolt from '$lib/client/shared/components/Icons/IconBolt.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import IconButton from '$lib/client/shared/components/IconButton.svelte';
	import Modal from '$lib/client/shared/components/Modal.svelte';

	// Logout handler
	async function handleLogout() {
		window.location.href = '/login';
	}

	let runSessionClient;
	let sessions = $state([]);
	let selectedSession = $state(null);
	let loading = $state(true);
	let creating = $state(false);
	let deleting = $state(null);
	let error = $state(null);
	let showCreateDialog = $state(false);
	let showDeleteDialog = $state(false);
	let sessionToDelete = $state(null);

	// Server selection state
	let serverUrl = $state('http://localhost:4096');

	// Form state
	let provider = $state('anthropic');
	let model = $state('claude-sonnet-4-5');

	function handleServerChange(url) {
		serverUrl = url;
	}

	async function loadSessions() {
		try {
			loading = true;
			error = null;

			// Include all sessions (active and inactive) with include=all
			const response = await fetch('/api/sessions?include=all');
			if (!response.ok) {
				throw new Error(`Failed to load sessions: ${response.statusText}`);
			}
			const data = await response.json();

			// Filter for AI sessions (both 'ai' and 'opencode' use the same AIAdapter)
			// Accept both types since they're functionally identical
			sessions = (data.sessions || []).filter(
				(s) => s.kind === 'opencode' || s.type === 'opencode' || s.kind === 'ai' || s.type === 'ai'
			);
		} catch (err) {
			error = err.message;
			console.error('[OpenCode Portal] Failed to load sessions:', err);
		} finally {
			loading = false;
		}
	}

	async function createSession() {
		try {
			creating = true;
			error = null;

			const options = { provider, model };
			// Include server URL
			if (serverUrl) {
				options.serverUrl = serverUrl;
			}

			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'opencode',
					workspacePath: '/workspace',
					options
				})
			});
			if (!response.ok) {
				throw new Error(`Failed to create session: ${response.statusText}`);
			}
			const newSession = await response.json();
			sessions = [...sessions, newSession];
			selectedSession = newSession;
			showCreateDialog = false;

			// Reset form
			provider = 'anthropic';
			model = 'claude-sonnet-4-5';
		} catch (err) {
			error = err.message;
			console.error('[OpenCode Portal] Failed to create session:', err);
		} finally {
			creating = false;
		}
	}

	function deleteSession(sessionId) {
		// Find the session to show its name in the confirmation dialog
		sessionToDelete = sessions.find((s) => s.id === sessionId);
		showDeleteDialog = true;
	}

	async function confirmDelete() {
		if (!sessionToDelete) return;

		const sessionId = sessionToDelete.id;
		try {
			deleting = sessionId;
			error = null;

			const response = await fetch(`/api/sessions?runId=${encodeURIComponent(sessionId)}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				throw new Error(`Failed to delete session: ${response.statusText}`);
			}
			sessions = sessions.filter((s) => s.id !== sessionId);
			if (selectedSession?.id === sessionId) {
				selectedSession = null;
			}
			showDeleteDialog = false;
			sessionToDelete = null;
		} catch (err) {
			error = err.message;
			console.error('[OpenCode Portal] Failed to delete session:', err);
		} finally {
			deleting = null;
		}
	}

	function cancelDelete() {
		showDeleteDialog = false;
		sessionToDelete = null;
	}

	function selectSession(session) {
		selectedSession = session;
	}

	onMount(async () => {
		// Import runSessionClient only in browser to avoid SSR issues
		if (browser) {
			const module = await import('$lib/client/shared/services/RunSessionClient.js');
			runSessionClient = module.runSessionClient;
		}
		await loadSessions();
	});

	onDestroy(() => {
		// Cleanup handled by OpenCodePane component
	});
</script>

<svelte:head>
	<title>OpenCode - Dispatch</title>
	<meta name="description" content="AI-powered development sessions with OpenCode in Dispatch." />
</svelte:head>

<Shell>
	{#snippet header()}
		<WorkspaceHeader
			onLogout={handleLogout}
			viewMode="window-manager"
			onViewModeChange={() => {}}
		>
			</WorkspaceHeader>
	{/snippet}

	<div class="opencode-page main-content">
		<div class="opencode-container">
			<!-- Session Sidebar -->
			<div class="opencode-nav" aria-label="Session list" role="navigation">
				<!-- Server Connection -->
				<div class="server-section">
					<div class="section-label">Server</div>
					<ServerSelector onServerChange={handleServerChange} />
				</div>

				<div class="nav-header">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<span class="nav-title">Sessions</span>
					<span class="tab-count">({sessions.length})</span>
				</div>

				{#if loading}
					<div class="loading-state">
						<div class="spinner"></div>
						<p>Loading sessions...</p>
					</div>
				{:else if sessions.length === 0}
					<div class="nav-empty">
						<p>No sessions yet</p>
						<button class="btn-create" onclick={() => (showCreateDialog = true)}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<path d="M12 5v14m-7-7h14" stroke-width="2" stroke-linecap="round" />
							</svg>
							New Session
						</button>
					</div>
				{:else}
					<div class="sessions-list">
						{#each sessions as session (session.id)}
							<div
								class="session-tab"
								class:active={selectedSession?.id === session.id}
								class:inactive={!session.isActive}
								onclick={() => selectSession(session)}
								onkeydown={(e) => e.key === 'Enter' && selectSession(session)}
								role="button"
								tabindex="0"
								title={session.name || session.id}
							>
								<div class="session-icon-wrapper">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
										<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
									<span class="status-dot" class:status-active={session.isActive} class:status-inactive={!session.isActive} title={session.isActive ? 'Active' : 'Inactive'}></span>
								</div>
								<div class="session-info">
									<span class="session-name">{session.name || session.id.slice(0, 8)}</span>
									<span class="session-meta">
										{session.metadata?.model || 'AI'}
										{#if !session.isActive}
											<span class="status-label">• Inactive</span>
										{/if}
									</span>
								</div>
								<button
									class="delete-btn"
									onclick={(e) => {
										e.stopPropagation();
										deleteSession(session.id);
									}}
									disabled={deleting === session.id}
									aria-label="Delete session"
									title="Delete session"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
										<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
					<div class="nav-footer">
						<button class="btn-create-small" onclick={() => (showCreateDialog = true)}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<path d="M12 5v14m-7-7h14" stroke-width="2" stroke-linecap="round" />
							</svg>
							New Session
						</button>
					</div>
				{/if}
			</div>

			<!-- Chat Interface -->
			<main class="opencode-content">
				{#if error}
					<div class="error-state">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<circle cx="12" cy="12" r="10" stroke-width="2" />
							<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
						</svg>
						<p>{error}</p>
						<button class="btn-secondary" onclick={loadSessions}>Retry</button>
					</div>
				{:else if selectedSession}
					{#key selectedSession.id}
						<OpenCodePane
							sessionId={selectedSession.runId || selectedSession.id}
							opencodeSessionId={selectedSession.id}
							workspacePath={selectedSession.workspacePath || '/workspace'}
							provider={selectedSession.metadata?.provider || 'anthropic'}
							model={selectedSession.metadata?.model || 'claude-sonnet-4-5'}
							serverUrl={selectedSession.metadata?.serverUrl || serverUrl}
						/>
					{/key}
				{:else}
					<div class="empty-state">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<h3>OpenCode Portal</h3>
						<p>AI-powered development sessions</p>
						<button class="btn-primary" onclick={() => (showCreateDialog = true)}>Create Session</button>
					</div>
				{/if}
			</main>
		</div>

<!-- Create Session Dialog -->
<Modal
	bind:open={showCreateDialog}
	title="Create New Session"
	size="medium"
	closeOnBackdrop={true}
	closeOnEscape={true}
	augmented="tl-clip tr-clip bl-clip br-clip both"
>
	{#snippet children()}
		<form
			id="create-session-form"
			class="modal-form"
			onsubmit={(e) => {
				e.preventDefault();
				createSession();
			}}
		>
			<div class="form-field">
				<label for="provider">Provider</label>
				<select id="provider" bind:value={provider} required>
					<option value="anthropic">Anthropic</option>
					<option value="openai">OpenAI</option>
				</select>
			</div>

			<div class="form-field">
				<label for="model">Model</label>
				<select id="model" bind:value={model} required>
					{#if provider === 'anthropic'}
						<option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
						<option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
						<option value="claude-opus-4-5">Claude Opus 4.5</option>
					{:else}
						<option value="gpt-4o">GPT-4o</option>
						<option value="gpt-4-turbo">GPT-4 Turbo</option>
					{/if}
				</select>
			</div>
		</form>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" augmented="none" onclick={() => (showCreateDialog = false)}>
			Cancel
		</Button>
		<Button
			variant="primary"
			augmented="tl-clip br-clip both"
			type="submit"
			form="create-session-form"
			disabled={creating}
		>
			{creating ? 'Creating...' : 'Create Session'}
		</Button>
	{/snippet}
</Modal>

<!-- Delete Session Confirmation Dialog -->
<Modal
	bind:open={showDeleteDialog}
	title="Delete Session"
	size="small"
	closeOnBackdrop={true}
	closeOnEscape={true}
	augmented="tl-clip tr-clip bl-clip br-clip both"
>
	{#snippet children()}
		<div class="delete-confirmation">
			<svg class="delete-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			<p class="delete-message">
				Are you sure you want to delete this session?
			</p>
			{#if sessionToDelete}
				<p class="delete-session-name">
					{sessionToDelete.name || sessionToDelete.id.slice(0, 8)}
				</p>
			{/if}
			<p class="delete-warning">This action cannot be undone.</p>
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" augmented="none" onclick={cancelDelete}>
			Cancel
		</Button>
		<Button
			variant="danger"
			augmented="tl-clip br-clip both"
			onclick={confirmDelete}
			disabled={deleting === sessionToDelete?.id}
		>
			{deleting === sessionToDelete?.id ? 'Deleting...' : 'Delete Session'}
		</Button>
	{/snippet}
</Modal>

	</div>

	{#snippet footer()}
		<StatusBar />
	{/snippet}
</Shell>

<style>
	.opencode-page {
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.opencode-container {
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

	/* Left sidebar navigation - matching cron/webhooks */
	.opencode-nav {
		width: 280px;
		background: var(--bg-dark);
		border: 1px solid var(--primary);
		padding: var(--space-3) 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex-shrink: 0;
		overflow: hidden;
	}

	/* Server connection section */
	.server-section {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--primary-dim);
		margin-bottom: var(--space-2);
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: var(--space-2);
		font-family: var(--font-mono);
	}

	.nav-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--primary-dim);
		margin-bottom: var(--space-2);
		color: var(--primary);
	}

	.nav-title {
		flex: 1;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.tab-count {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	.sessions-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.session-tab {
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

	.session-tab:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}

	.session-tab:hover {
		background: var(--elev);
		color: var(--primary);
	}

	.session-tab.active {
		background: var(--elev);
		color: var(--primary);
		border-left-color: var(--primary);
	}

	.session-tab.inactive {
		opacity: 0.7;
	}

	.session-tab.inactive:hover {
		opacity: 1;
	}

	.session-icon-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 2px solid var(--bg-dark);
	}

	.status-dot.status-active {
		background: var(--color-success, #22c55e);
		box-shadow: 0 0 4px var(--color-success, #22c55e);
	}

	.status-dot.status-inactive {
		background: var(--text-tertiary);
	}

	.status-label {
		color: var(--text-tertiary);
		font-size: 0.7rem;
	}

	.session-tab .session-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.session-tab .session-name {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-tab .session-meta {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.session-tab .delete-btn {
		opacity: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--space-1);
		border-radius: var(--radius-sm);
		transition: all 0.2s ease;
	}

	.session-tab:hover .delete-btn {
		opacity: 1;
	}

	.session-tab .delete-btn:hover {
		color: var(--color-error);
		background: var(--bg-hover);
	}

	.nav-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-6) var(--space-4);
		text-align: center;
		color: var(--text-muted);
		gap: var(--space-4);
	}

	.nav-empty p {
		margin: 0;
		font-size: 0.85rem;
	}

	.btn-create {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--primary);
		color: var(--bg);
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-create:hover {
		box-shadow: var(--shadow-md);
	}

	.nav-footer {
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--primary-dim);
		margin-top: auto;
	}

	.btn-create-small {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: transparent;
		color: var(--text-muted);
		border: 1px dashed var(--primary-dim);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-create-small:hover {
		background: var(--elev);
		color: var(--primary);
		border-color: var(--primary);
	}

	/* Main content area */
	.opencode-content {
		flex: 1;
		background: var(--bg-dark);
		border: 1px solid var(--primary-bright);
		overflow: auto;
		position: relative;
		display: flex;
		flex-direction: column;
	}

	/* Header icon button */
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

	.icon-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Loading and empty states - matching cron/webhooks */
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
		flex: 1;
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

	/* Modal form styling */
	.modal-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-field label {
		font-weight: 500;
		font-size: var(--font-size-1);
		color: var(--text);
		font-family: var(--font-mono);
	}

	.form-field select {
		width: 100%;
		padding: var(--space-3);
		background: var(--bg);
		color: var(--text);
		border: 1px solid var(--primary-glow-15);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		transition: all var(--transition-fast, 150ms);
	}

	.form-field select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-glow-25);
	}

	.form-field select:hover {
		border-color: var(--primary);
	}

	/* Delete confirmation dialog */
	.delete-confirmation {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-4) 0;
	}

	.delete-icon {
		color: var(--color-error, #c33);
		opacity: 0.8;
	}

	.delete-message {
		margin: 0;
		font-size: var(--font-size-2);
		color: var(--text);
	}

	.delete-session-name {
		margin: 0;
		padding: var(--space-2) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--primary-dim);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--primary);
	}

	.delete-warning {
		margin: 0;
		font-size: var(--font-size-1);
		color: var(--text-muted);
	}

	/* Mobile Responsive - matching cron/webhooks */
	@media (max-width: 768px) {
		.opencode-container {
			flex-direction: column;
			min-height: auto;
		}

		.opencode-nav {
			width: 100%;
			flex-direction: row;
			overflow-x: auto;
			padding: 0;
		}

		.nav-header {
			display: none;
		}

		.sessions-list {
			flex-direction: row;
			overflow-x: auto;
			overflow-y: hidden;
		}

		.session-tab {
			flex: 1 0 auto;
			justify-content: center;
			border-left: none;
			border-bottom: 3px solid transparent;
			padding: var(--space-3);
		}

		.session-tab.active {
			border-left-color: transparent;
			border-bottom-color: var(--primary);
		}

		.session-tab .session-info {
			display: none;
		}

		.session-tab .delete-btn {
			display: none;
		}

		.opencode-content {
			min-height: 400px;
		}
	}
</style>
