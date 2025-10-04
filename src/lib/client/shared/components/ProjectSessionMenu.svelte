<script>
	import { onMount } from 'svelte';
	import DirectoryBrowser from '$lib/client/shared/components/DirectoryBrowser.svelte';
	import Button from './Button.svelte';
	import SessionCard from './SessionCard.svelte';
	import IconFolder from './Icons/IconFolder.svelte';
	import IconChevronDown from './Icons/IconChevronDown.svelte';
	import IconX from './Icons/IconX.svelte';
	import IconPlus from './Icons/IconPlus.svelte';
	import IconActivity from './Icons/IconActivity.svelte';
	import IconBolt from './Icons/IconBolt.svelte';
	import IconHistory from './Icons/IconHistory.svelte';
	import IconSearch from './Icons/IconSearch.svelte';
	import IconTerminal from './Icons/IconTerminal.svelte';
	import IconAsterisk from './Icons/IconAsterisk.svelte';
	import IconClaude from './Icons/IconClaude.svelte';
	import IconLayoutGrid from './Icons/IconLayoutGrid.svelte';
	import IconFolderPlus from './Icons/IconFolderPlus.svelte';
	import { SESSION_TYPE } from '$lib/shared/session-types.js';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { WorkspaceNavigationViewModel } from '$lib/client/state/WorkspaceNavigationViewModel.svelte.js';
	import { getAuthHeaders } from '$lib/shared/api-helpers.js';

	// Props
	let {
		selectedWorkspace = $bindable(),
		selectedSession = $bindable(),
		onSessionSelected,
		onNewSession
	} = $props();

	// State
	let sessionType = $state('all');
	let allSessions = $state([]);
	let selectedDirectory = $state('');
	let showDirectoryPicker = $state(false);
	let currentTab = $state('active'); // 'active', 'create', 'browse', 'workspaces'
	let loading = $state(false);
	let error = $state(null);
	let searchTerm = $state('');
	let sessionApi = $state(null);
	let workspaceNavigation = $state(null);
	let showWorkspaceCreate = $state(false);
	let newWorkspaceName = $state('');
	let newWorkspacePath = $state('');

	// Get API client and workspace navigation from service container
	$effect(() => {
		// Get the service container and initialize the services
		try {
			const container = useServiceContainer();

			// Initialize session API
			const maybePromise = container.get('sessionApi');
			if (maybePromise && typeof maybePromise.then === 'function') {
				maybePromise
					.then((api) => {
						sessionApi = api;
						// Initialize workspace navigation with API client
						if (api) {
							workspaceNavigation = new WorkspaceNavigationViewModel(api);
						}
					})
					.catch((error) => {
						console.error('Failed to get sessionApi from service container:', error);
					});
			} else {
				sessionApi = maybePromise;
				// Initialize workspace navigation with API client
				if (maybePromise) {
					workspaceNavigation = new WorkspaceNavigationViewModel(maybePromise);
				}
			}
		} catch (e) {
			console.error('Failed to access service container:', e);
		}
	});

	// Load all sessions (both active and inactive)
	async function loadAllSessions() {
		if (!sessionApi) return;
		loading = true;
		error = null;
		try {
			const data = await sessionApi.list({ includeAll: true });
			const sessions = data.sessions || [];
			allSessions = sessions
				.filter((s) => s && s.id)
				.map((session) => ({
					id: session.id,
					type: session.type,
					workspacePath: session.workspacePath,
					title: session.title || `${session.type} Session`,
					isActive: session.isActive || false,
					inLayout: session.inLayout === true || !!session.tileId,
					createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
					lastActivity: session.lastActivity ? new Date(session.lastActivity) : new Date()
				}))
				.sort((a, b) => {
					// Sort by active first, then by last activity
					if (a.isActive && !b.isActive) return -1;
					if (!a.isActive && b.isActive) return 1;
					return b.lastActivity.getTime() - a.lastActivity.getTime();
				});
		} catch (err) {
			error = 'Error loading sessions: ' + err.message;
		}
		loading = false;
	}

	// Filter sessions based on search term and session type

	const filteredSessions = $derived(
		allSessions.filter((session) => {
			// Filter by session type
			if (sessionType !== 'all' && session.type !== sessionType) {
				return false;
			}
			// Filter by search term
			if (searchTerm) {
				const term = searchTerm.toLowerCase();
				return (
					session.title.toLowerCase().includes(term) ||
					session.workspacePath.toLowerCase().includes(term) ||
					session.type.toLowerCase().includes(term)
				);
			}
			return true;
		})
	);

	// Handle directory selection
	function handleDirectorySelect(path) {
		selectedDirectory = path;
		showDirectoryPicker = false;
	}

	// Format path for display
	function formatPath(path) {
		if (!path) return 'Select directory...';
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-2).join('/');
		}
		return path;
	}

	// Create new session
	async function createSession() {
		if (!selectedDirectory) {
			error = 'Please select a workspace first';
			return;
		}

		if (!sessionApi) {
			error = 'API client not initialized';
			return;
		}

		loading = true;
		error = null;
		try {
			const session = await sessionApi.create({
				type: /** @type {'pty' | 'claude'} */ (sessionType),
				workspacePath: selectedDirectory,
				options: {}
			});
			await loadAllSessions();
			selectSession(session);
			onNewSession?.({ detail: { ...session } });
		} catch (err) {
			error = 'Error creating session: ' + err.message;
		}
		loading = false;
	}

	// Select session
	function selectSession(session) {
		selectedSession = session?.id || null;
		onSessionSelected?.({
			detail: {
				id: session?.id,
				type: session?.type,
				workspacePath: session?.workspacePath,
				isActive: session?.isActive || false
			}
		});
	}

	// Change session type
	function changeType(type) {
		if (type === sessionType) return;
		sessionType = type;
		selectedSession = null;
	}

	// Auto-set sessionType to a valid type when switching to create tab
	$effect(() => {
		if (currentTab === 'create' && sessionType === 'all') {
			sessionType = 'claude';
		}
	});

	// Format date for display
	function formatDate(date) {
		if (!date) return 'Unknown';
		const now = new Date();
		const dateObj = date instanceof Date ? date : new Date(date);
		const diff = now.getTime() - dateObj.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		return dateObj.toLocaleDateString();
	}

	// Resume a previous session
	async function resumeSession(session) {
		try {
			const sessionType = session.type || SESSION_TYPE.PTY;
			// Call the session resume endpoint with proper parameters
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					type: sessionType,
					workspacePath: session.workspacePath,
					resume: true,
					sessionId: session.id
				})
			});

			if (response.ok) {
				const resumedSession = await response.json();
				// Update our session with resume flag
				const resumedId = resumedSession.id || session.id;

				// Small delay to ensure server has finished updating session status
				await new Promise((resolve) => setTimeout(resolve, 500));
				await loadAllSessions();
				selectedSession = resumedId;
				onSessionSelected?.({
					detail: {
						id: resumedId,
						type: sessionType,
						workspacePath: session.workspacePath,
						isActive: true,
						shouldResume: true
					}
				});
				currentTab = 'active';
			} else {
				const errorData = await response.text();
				let errorMessage = 'Failed to resume session';

				try {
					const errorObj = JSON.parse(errorData);
					errorMessage = errorObj.error || errorMessage;
				} catch {
					// If not JSON, use the raw text
					errorMessage = errorData || errorMessage;
				}

				// Show user-friendly messages for common errors
				if (errorMessage.includes('temporarily unavailable')) {
					error = 'Session creation is temporarily unavailable. Please try again in a moment.';
				} else if (errorMessage.includes('development server')) {
					error = 'Development server is restarting. Please wait a moment and try again.';
				} else {
					error = errorMessage;
				}
			}
		} catch (err) {
			error = 'Error resuming session: ' + err.message;
		}
	}

	// Workspace management functions
	async function loadWorkspaces() {
		if (!workspaceNavigation) return;
		await workspaceNavigation.loadWorkspaces();
	}

	async function switchWorkspace(workspace) {
		if (!workspaceNavigation) return;
		try {
			await workspaceNavigation.switchToWorkspace(workspace);
			selectedWorkspace = workspace;
			selectedDirectory = workspace.path;
			currentTab = 'active'; // Switch to active sessions after workspace change
			await loadAllSessions();
		} catch (err) {
			error = err.message;
		}
	}

	async function createNewWorkspace(name, path) {
		if (!workspaceNavigation) return;
		try {
			const workspace = await workspaceNavigation.createNewWorkspace(name, path);
			showWorkspaceCreate = false;
			await switchWorkspace(workspace);
		} catch (err) {
			error = err.message;
		}
	}

	// Initialize
	onMount(async () => {
		// Wait for sessionApi to be initialized
		while (!sessionApi) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		await loadAllSessions();

		// Load workspaces if navigation is available
		if (workspaceNavigation) {
			await loadWorkspaces();
		}

		// DirectoryBrowser will now default to WORKSPACES_ROOT when no startPath is provided
	});

	// Public refresh method
	export async function refresh() {
		// Wait for sessionApi to be initialized
		while (!sessionApi) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		return loadAllSessions();
	}
</script>

<div class="menu-root" role="navigation" aria-label="Session and workspace management">
	<!-- Tab Content Container -->
	<div class="tab-content">
		<!-- Tab Content -->
		{#if currentTab === 'active'}
			<!-- Active Sessions with Search and Filters -->
			<div class="panel">
				<div class="panel-header">
					<div class="header-content">
						<h2 class="panel-title">
							<IconActivity size={20} />
							Active Sessions
						</h2>
						{#if filteredSessions.filter((s) => s.isActive).length > 0}
							<span class="count-badge">{filteredSessions.filter((s) => s.isActive).length}</span>
						{/if}
					</div>
				</div>

				<div class="panel-list">
					{#if loading}
						<div class="status-message">Loading sessions...</div>
					{:else if error}
						<div class="status-message error">{error}</div>
					{:else}
						{@const activeSessions = filteredSessions.filter((s) => s.isActive)}
						{#if activeSessions.length === 0}
							<div class="status-message">
								{searchTerm
									? `No active sessions match "${searchTerm}"`
									: sessionType === 'all'
										? 'No active sessions found'
										: `No active ${sessionType} sessions found`}
							</div>
						{:else}
							{#each activeSessions as session (session.id)}
								<SessionCard
									{session}
									{selectedSession}
									onSelect={selectSession}
									onAction={selectSession}
									actionLabel="Connect"
									{formatDate}
									isActive={true}
								/>
							{/each}
						{/if}
					{/if}
				</div>
			</div>
		{:else if currentTab === 'create'}
			<!-- Create Session Section -->
			<div class="panel">
				{#if showDirectoryPicker}
					<div class="panel-header">
						<div class="header-content">
							<h2 class="panel-title">
								<IconFolder size={18} />
								Select Directory
							</h2>
						</div>
					</div>
					<div class="panel-list">
						<DirectoryBrowser
							bind:selected={selectedDirectory}
							startPath={selectedDirectory || ''}
							onSelect={handleDirectorySelect}
						/>
					</div>
					<div class="panel-header">
						<Button variant="ghost" augmented="none" onclick={() => (showDirectoryPicker = false)}>
							Cancel
						</Button>
					</div>
				{:else}
					<div class="panel-header">
						<div class="header-content">
							<h2 class="panel-title">
								<IconPlus size={18} />
								Create Session
							</h2>
						</div>
					</div>
					<div class="panel-list">
						<div class="form-group">
							<label class="form-label">
								<IconFolder size={16} />
								Workspace Directory
							</label>
							<button
								class="directory-button"
								onclick={() => (showDirectoryPicker = true)}
								disabled={loading}
							>
								<span class="directory-path">{formatPath(selectedDirectory)}</span>
								<IconChevronDown size={16} />
							</button>
						</div>
						<Button
							variant="primary"
							augmented="tl-clip br-clip both"
							onclick={createSession}
							disabled={loading || !selectedDirectory}
							{loading}
						>
							{#snippet icon()}
								{#if loading}<IconBolt size={18} />{:else}<IconPlus size={18} />{/if}
							{/snippet}
							New {sessionType === 'claude' ? 'Claude' : 'Terminal'} Session
						</Button>
					</div>
				{/if}
			</div>
		{:else if currentTab === 'browse'}
			<!-- Browse Historical Sessions -->
			<div class="panel">
				<div class="panel-header">
					<div class="header-content">
						<h2 class="panel-title">
							<IconHistory size={20} />
							Browse Sessions
						</h2>
						{#if filteredSessions.filter((s) => !s.isActive).length > 0}
							<span class="count-badge">{filteredSessions.filter((s) => !s.isActive).length}</span>
						{/if}
					</div>
				</div>

				<div class="panel-list">
					{#if loading}
						<div class="status-message">Loading sessions...</div>
					{:else if error}
						<div class="status-message error">{error}</div>
					{:else}
						{@const historicalSessions = filteredSessions.filter((s) => !s.isActive)}
						{#if historicalSessions.length === 0}
							<div class="status-message">
								{searchTerm
									? `No historical sessions match "${searchTerm}"`
									: sessionType === 'all'
										? 'No historical sessions found'
										: `No historical ${sessionType} sessions found`}
							</div>
						{:else}
							{#each historicalSessions as session (session.id)}
								<SessionCard
									{session}
									{selectedSession}
									onSelect={selectSession}
									onAction={resumeSession}
									actionLabel="Resume"
									{formatDate}
									isActive={false}
								/>
							{/each}
						{/if}
					{/if}
				</div>
			</div>
		{:else if currentTab === 'workspaces'}
			<!-- Workspace Management -->
			<div class="panel">
				<div class="panel-header">
					<div class="header-content">
						<h2 class="panel-title">
							<IconLayoutGrid size={20} />
							Workspaces
						</h2>
						{#if workspaceNavigation?.activeWorkspaces?.length > 0}
							<span class="count-badge">{workspaceNavigation.activeWorkspaces.length}</span>
						{/if}
					</div>
					<Button
						variant="ghost"
						augmented="none"
						onclick={() => (showWorkspaceCreate = true)}
						disabled={loading}
					>
						{#snippet icon()}<IconFolderPlus size={16} />{/snippet}
						New
					</Button>
				</div>

				<div class="panel-list">
					{#if workspaceNavigation?.isLoading}
						<div class="status-message">Loading workspaces...</div>
					{:else if workspaceNavigation?.error}
						<div class="status-message error">{workspaceNavigation.error}</div>
					{:else if workspaceNavigation?.filteredWorkspaces?.length === 0}
						<div class="status-message">
							{workspaceNavigation.searchTerm
								? `No workspaces match "${workspaceNavigation.searchTerm}"`
								: 'No workspaces found. Create your first workspace to get started.'}
						</div>
					{:else if workspaceNavigation?.filteredWorkspaces}
						{#each workspaceNavigation.filteredWorkspaces as workspace (workspace.path)}
							<div
								class="workspace-item"
								class:selected={selectedWorkspace?.path === workspace.path}
							>
								<div class="workspace-info">
									<div class="workspace-name">{workspace.name}</div>
									<div class="workspace-path">{workspace.path}</div>
									{#if workspace.lastActive}
										<div class="workspace-meta">
											Last active: {formatDate(new Date(workspace.lastActive))}
										</div>
									{/if}
								</div>
								<div class="workspace-actions">
									<Button
										variant="ghost"
										augmented="none"
										onclick={() => switchWorkspace(workspace)}
										disabled={loading}
									>
										Switch
									</Button>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				{#if showWorkspaceCreate}
					<div class="workspace-create-form">
						<h3>Create New Workspace</h3>
						<div class="form-group">
							<label for="workspace-name">Workspace Name</label>
							<input
								id="workspace-name"
								type="text"
								placeholder="My Project"
								bind:value={newWorkspaceName}
								disabled={loading}
							/>
						</div>
						<div class="form-group">
							<label for="workspace-path">Workspace Path</label>
							<input
								id="workspace-path"
								type="text"
								placeholder="/workspace/my-project"
								bind:value={newWorkspacePath}
								disabled={loading}
							/>
						</div>
						<div class="form-actions">
							<Button
								variant="primary"
								augmented="none"
								onclick={() => createNewWorkspace(newWorkspaceName, newWorkspacePath)}
								disabled={loading || !newWorkspaceName || !newWorkspacePath}
							>
								Create
							</Button>
							<Button
								variant="ghost"
								augmented="none"
								onclick={() => (showWorkspaceCreate = false)}
								disabled={loading}
							>
								Cancel
							</Button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Bottom Navigation Row -->
	<div class="bottom-navigation">
		<!-- Left: Session Type Filters -->
		<div class="session-type-buttons">
			{#if currentTab === 'active' || currentTab === 'browse'}
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'all' ? 'active' : ''}
					onclick={() => changeType('all')}
				>
					{#snippet icon()}<IconAsterisk size={16} />{/snippet}
					<span class="button-text">All</span>
				</Button>
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'claude' ? 'active' : ''}
					onclick={() => changeType('claude')}
				>
					{#snippet icon()}<IconClaude size={16} />{/snippet}
					<span class="button-text">Claude</span>
				</Button>
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'pty' ? 'active' : ''}
					onclick={() => changeType('pty')}
				>
					{#snippet icon()}<IconTerminal size={16} />{/snippet}
					<span class="button-text">Terminal</span>
				</Button>
			{:else if currentTab === 'create'}
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'claude' ? 'active' : ''}
					onclick={() => changeType('claude')}
				>
					{#snippet icon()}<IconClaude size={16} />{/snippet}
					<span class="button-text">Claude</span>
				</Button>
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'pty' ? 'active' : ''}
					onclick={() => changeType('pty')}
				>
					{#snippet icon()}<IconTerminal size={16} />{/snippet}
					<span class="button-text">Terminal</span>
				</Button>
			{/if}
		</div>

		<!-- Right: Tab Navigation -->
		<div class="tab-buttons" role="tablist" aria-label="Navigation tabs">
			<Button
				variant="ghost"
				augmented="none"
				class={currentTab === 'workspaces' ? 'active' : ''}
				onclick={() => (currentTab = 'workspaces')}
				role="tab"
				aria-selected={currentTab === 'workspaces'}
				aria-controls="workspaces-panel"
			>
				{#snippet icon()}<IconLayoutGrid size={16} />{/snippet}
				<span class="button-text">Workspaces</span>
			</Button>
			<Button
				variant="ghost"
				augmented="none"
				class={currentTab === 'browse' ? 'active' : ''}
				onclick={() => (currentTab = 'browse')}
				role="tab"
				aria-selected={currentTab === 'browse'}
				aria-controls="browse-panel"
			>
				{#snippet icon()}<IconHistory size={16} />{/snippet}
				<span class="button-text">Browse</span>
			</Button>
			<Button
				variant="ghost"
				augmented="none"
				class={currentTab === 'active' ? 'active' : ''}
				onclick={() => (currentTab = 'active')}
				role="tab"
				aria-selected={currentTab === 'active'}
				aria-controls="active-panel"
			>
				{#snippet icon()}<IconActivity size={16} />{/snippet}
				<span class="button-text">Active</span>
			</Button>
		</div>
	</div>

	<!-- Search Bar for Active, Browse, and Workspaces tabs (moved to bottom) -->
	{#if currentTab === 'active' || currentTab === 'browse' || currentTab === 'workspaces'}
		<div class="search-container bottom-search">
			<div class="search-input-wrapper">
				<IconSearch size={16} />
				<input
					type="text"
					placeholder={currentTab === 'active'
						? 'Search active sessions...'
						: currentTab === 'browse'
							? 'Search sessions...'
							: 'Search workspaces...'}
					value={currentTab === 'workspaces' ? workspaceNavigation?.searchTerm || '' : searchTerm}
					oninput={(e) => {
						if (currentTab === 'workspaces' && workspaceNavigation) {
							workspaceNavigation.searchWorkspaces(e.target.value);
						} else {
							searchTerm = e.target.value;
						}
					}}
					class="search-input"
					aria-label={currentTab === 'active'
						? 'Search active sessions'
						: currentTab === 'browse'
							? 'Search sessions'
							: 'Search workspaces'}
					role="searchbox"
				/>
				{#if currentTab === 'workspaces' ? workspaceNavigation?.searchTerm : searchTerm}
					<button
						class="clear-search"
						onclick={() => {
							if (currentTab === 'workspaces' && workspaceNavigation) {
								workspaceNavigation.clearSearch();
							} else {
								searchTerm = '';
							}
						}}
						aria-label="Clear search"
					>
						<IconX size={14} />
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.menu-root {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding-inline: var(--space-2);
	}

	/* Bottom Navigation */
	.bottom-navigation {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
		background: var(--bg-dark);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-sm);
		padding: var(--space-1);
		flex-shrink: 0;
		margin-top: var(--space-4);
	}

	.session-type-buttons {
		display: flex;
		gap: var(--space-1);
	}

	.tab-buttons {
		display: flex;
		gap: var(--space-1);
	}

	.tab-buttons {
		display: flex;
		gap: var(--space-1);
	}

	/* Directory button specific styling */
	.directory-button {
		text-align: left;
	}

	/* Active button states */
	.session-type-buttons :global(.button.active),
	.tab-buttons :global(.button.active) {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--bg);
	}

	.session-type-buttons :global(.button.active:hover),
	.tab-buttons :global(.button.active:hover) {
		background: var(--primary-bright);
		border-color: var(--primary-bright);
		color: var(--bg);
	}

	/* Workspace-specific styles */
	.workspace-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--surface-border);
		background: var(--bg-dark);
		margin-bottom: var(--space-2);
		transition: all 0.2s ease;
	}

	.workspace-item:hover {
		background: var(--bg-darker);
		border-color: var(--primary);
	}

	.workspace-item.selected {
		background: var(--primary-bg);
		border-color: var(--primary);
	}

	.workspace-info {
		flex: 1;
		min-width: 0;
	}

	.workspace-name {
		font-weight: 500;
		color: var(--text);
		margin-bottom: var(--space-1);
	}

	.workspace-path {
		font-size: 0.875rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		word-break: break-all;
	}

	.workspace-meta {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: var(--space-1);
	}

	.workspace-actions {
		flex-shrink: 0;
		margin-left: var(--space-2);
	}

	.workspace-create-form {
		border-top: 1px solid var(--surface-border);
		padding-top: var(--space-3);
		margin-top: var(--space-3);
	}

	.workspace-create-form h3 {
		margin: 0 0 var(--space-3) 0;
		font-size: 1rem;
		color: var(--text);
	}

	.workspace-create-form .form-group {
		margin-bottom: var(--space-3);
	}

	.workspace-create-form label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		margin-bottom: var(--space-1);
	}

	.workspace-create-form input {
		width: 100%;
		padding: var(--space-2);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-xs);
		background: var(--bg);
		color: var(--text);
		font-size: 0.875rem;
	}

	.workspace-create-form input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.workspace-create-form .form-actions {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.menu-root {
			padding-inline: var(--space-1);
		}

		.bottom-navigation {
			flex-wrap: wrap;
			gap: var(--space-1);
		}

		.session-type-buttons,
		.tab-buttons {
			gap: 2px;
		}

		.button-text {
			display: none;
		}

		.workspace-item {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-2);
		}

		.workspace-actions {
			margin-left: 0;
			align-self: flex-end;
		}

		.workspace-create-form .form-actions {
			flex-direction: column;
		}
	}
</style>
