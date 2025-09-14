<script>
	import { onMount } from 'svelte';
	import DirectoryBrowser from '$lib/client/shared/components/DirectoryBrowser.svelte';
	import Button from './Button.svelte';
	import SessionCard from './SessionCard.svelte';
	import {
		IconRobot,
		IconTerminal2,
		IconFolder,
		IconChevronDown,
		IconX,
		IconPlus,
		IconActivity,
		IconBolt,
		IconHistory,
		IconSearch
	} from '@tabler/icons-svelte';

	// Props
	let {
		selectedWorkspace = $bindable(),
		selectedSession = $bindable(),
		onSessionSelected,
		onNewSession
	} = $props();

	// State
	let sessionType = $state('claude');
	let activeSessions = $state([]);
	let previousSessions = $state([]);
	let selectedDirectory = $state('');
	let showDirectoryPicker = $state(false);
	let currentTab = $state('active'); // 'active', 'create', 'browse'
	let loading = $state(false);
	let error = $state(null);
	let searchTerm = $state('');

	// Load active sessions
	async function loadActiveSessions() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/sessions');
			if (response.ok) {
				const data = await response.json();
				activeSessions = (data.sessions || [])
					.filter((s) => s && s.isActive && s.type === sessionType)
					.map((session) => ({
						id: session.id,
						type: session.type,
						workspacePath: session.workspacePath,
						title: session.title || `${session.type} Session`,
						isActive: true
					}));
			} else {
				error = 'Failed to load sessions';
			}
		} catch (err) {
			error = 'Error loading sessions: ' + err.message;
		}
		loading = false;
	}

	// Load previous (persisted) sessions across all types, not currently active
	async function loadPreviousSessions() {
		try {
			const response = await fetch('/api/sessions?include=all');
			if (!response.ok) return;
			const data = await response.json();
			const all = Array.isArray(data.sessions) ? data.sessions : [];
			previousSessions = all
				.filter((s) => s && !s.isActive)
				.map((s) => ({
					id: s.id,
					type: s.type,
					workspacePath: s.workspacePath,
					title: s.title || `${s.type} Session`,
					pinned: s.pinned === true || s.pinned === 1 || false,
					createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
					lastActivity: s.lastActivity ? new Date(s.lastActivity) : new Date()
				}))
				.sort((a, b) => b.lastActivity - a.lastActivity); // Sort by most recent activity
		} catch {}
	}

	// Filter previous sessions based on search term and session type
	const filteredPreviousSessions = $derived(previousSessions.filter((session) => {
		// Filter by session type
		if (currentTab === 'browse' && sessionType !== 'all' && session.type !== sessionType) {
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
	}));

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

		loading = true;
		error = null;
		try {
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: sessionType,
					workspacePath: selectedDirectory,
					options: {}
				})
			});

			if (response.ok) {
				const session = await response.json();
				await loadActiveSessions();
				selectSession(session);
				onNewSession?.({ detail: { ...session } });
			} else {
				const errorData = await response.text();
				error = `Failed to create session: ${errorData}`;
			}
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
		if (currentTab === 'active') {
			loadActiveSessions();
		}
	}

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
			// Call the session resume endpoint with proper parameters
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: session.type,
					workspacePath: session.workspacePath,
					resume: true,
					sessionId: session.id
				})
			});

			if (response.ok) {
				const resumedSession = await response.json();
				// Update our session with resume flag
				const sessionToResume = {
					...session,
					id: resumedSession.id || session.id,
					shouldResume: true,
					resumeSession: true,
					isActive: true
				};
				
				await loadActiveSessions();
				selectSession(sessionToResume);
				onSessionSelected?.({
					detail: {
						...sessionToResume,
						shouldResume: true
					}
				});
				
				// Switch to active sessions tab
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

	// Initialize
	onMount(async () => {
		await loadActiveSessions();
		await loadPreviousSessions();
		// Leave empty so DirectoryBrowser defaults to user setting or WORKSPACES_ROOT
	});

	// Public refresh method
	export function refresh() {
		return Promise.all([loadActiveSessions(), loadPreviousSessions()]);
	}
</script>

<div class="menu-root">
	<!-- Navigation Tabs -->
	<div class="tab-navigation">
		<Button
			variant="ghost"
			augmented="none"
			class={currentTab === 'active' ? 'active' : ''}
			onclick={() => (currentTab = 'active')}
		>
			{#snippet icon()}<IconActivity size={16} />{/snippet}
			Active
		</Button>
		<Button
			variant="ghost"
			augmented="none"
			class={currentTab === 'create' ? 'active' : ''}
			onclick={() => (currentTab = 'create')}
		>
			{#snippet icon()}<IconPlus size={16} />{/snippet}
			Create
		</Button>
		<Button
			variant="ghost"
			augmented="none"
			class={currentTab === 'browse' ? 'active' : ''}
			onclick={() => {
				currentTab = 'browse';
				loadPreviousSessions();
			}}
		>
			{#snippet icon()}<IconHistory size={16} />{/snippet}
			Browse
		</Button>
	</div>

	<!-- Session Type Toggle (shown for active and browse tabs) -->
	{#if currentTab === 'active' || currentTab === 'browse'}
		<div class="type-selector">
			{#if currentTab === 'browse'}
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'all' ? 'active' : ''}
					onclick={() => changeType('all')}
				>
					All
				</Button>
			{/if}
			<Button
				variant="ghost"
				augmented="none"
				class={sessionType === 'claude' ? 'active' : ''}
				onclick={() => changeType('claude')}
			>
				{#snippet icon()}<IconRobot size={18} />{/snippet}
				Claude
			</Button>
			<Button
				variant="ghost"
				augmented="none"
				class={sessionType === 'pty' ? 'active' : ''}
				onclick={() => changeType('pty')}
			>
				{#snippet icon()}<IconTerminal2 size={18} />{/snippet}
				Terminal
			</Button>
		</div>
	{/if}

	<!-- Tab Content -->
	{#if currentTab === 'active'}
		<!-- Active Sessions -->
		<div class="sessions-panel">
			<div class="panel-header">
				<div class="header-content">
					<IconActivity size={20} />
					<h2>Active Sessions</h2>
				</div>
				{#if activeSessions.length > 0}
					<span class="count-badge">{activeSessions.length}</span>
				{/if}
			</div>

			<div class="sessions-list">
				{#if loading && activeSessions.length === 0}
					<div class="status">Loading sessions...</div>
				{:else if error}
					<div class="status error">{error}</div>
				{:else if activeSessions.length === 0}
					<div class="status">No active {sessionType} sessions</div>
				{:else}
					{#each activeSessions as session}
						<SessionCard
							{session}
							selected={selectedSession === session.id}
							onclick={() => selectSession(session)}
						/>
					{/each}
				{/if}
			</div>
		</div>
	{:else if currentTab === 'create'}
		<!-- Create Session Section -->
		<div class="create-section">
			<!-- Session Type Toggle for create tab -->
			<div class="type-selector">
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'claude' ? 'active' : ''}
					onclick={() => changeType('claude')}
				>
					{#snippet icon()}<IconRobot size={18} />{/snippet}
					Claude
				</Button>
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'pty' ? 'active' : ''}
					onclick={() => changeType('pty')}
				>
					{#snippet icon()}<IconTerminal2 size={18} />{/snippet}
					Terminal
				</Button>
			</div>

			{#if showDirectoryPicker}
				<div class="directory-picker-panel">
					<div class="picker-header">
						<label class="picker-label">
							<IconFolder size={18} />
							Select Directory
						</label>
					</div>
					<DirectoryBrowser
						bind:selected={selectedDirectory}
						startPath={selectedDirectory || ''}
						onSelect={handleDirectorySelect}
					/>
					<div class="picker-actions">
						<Button variant="ghost" augmented="none" onclick={() => (showDirectoryPicker = false)}>
							Cancel
						</Button>
					</div>
				</div>
			{:else}
				<div class="form-group">
					<label class="form-label">
						<IconFolder size={16} />
						Workspace Directory
					</label>
					<Button
						variant="ghost"
						augmented="none"
						onclick={() => (showDirectoryPicker = true)}
						disabled={loading}
						class="directory-button"
					>
						<span class="directory-path">{formatPath(selectedDirectory)}</span>
						<IconChevronDown size={16} />
					</Button>
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
			{/if}
		</div>
	{:else if currentTab === 'browse'}
		<!-- Browse Previous Sessions -->
		<div class="sessions-panel">
			<div class="panel-header">
				<div class="header-content">
					<IconHistory size={20} />
					<h2>Previous Sessions</h2>
				</div>
				{#if filteredPreviousSessions.length > 0}
					<span class="count-badge">{filteredPreviousSessions.length}</span>
				{/if}
			</div>

			<!-- Search Filter -->
			<div class="search-container">
				<div class="search-input-wrapper">
					<IconSearch size={16} />
					<input
						type="text"
						placeholder="Search sessions..."
						bind:value={searchTerm}
						class="search-input"
					/>
					{#if searchTerm}
						<button class="clear-search" onclick={() => (searchTerm = '')}>
							<IconX size={14} />
						</button>
					{/if}
				</div>
			</div>

			<div class="previous-sessions-list">
				{#if loading}
					<div class="status">Loading previous sessions...</div>
				{:else if filteredPreviousSessions.length === 0}
					<div class="status">
						{searchTerm
							? `No sessions match "${searchTerm}"`
							: sessionType === 'all'
								? 'No previous sessions'
								: `No previous ${sessionType} sessions`}
					</div>
				{:else}
					{#each filteredPreviousSessions as session (session.id)}
						<div class="previous-session-card">
							<div class="session-header">
								<div class="session-type-icon">
									{#if session.type === 'claude'}
										<IconRobot size={16} />
									{:else}
										<IconTerminal2 size={16} />
									{/if}
								</div>
								<div class="session-info">
									<div class="session-title">{session.title}</div>
									<div class="session-meta">
										<span class="session-workspace" title={session.workspacePath}>
											{session.workspacePath}
										</span>
										<span class="session-date">{formatDate(session.lastActivity)}</span>
									</div>
								</div>
								<Button
									variant="primary"
									augmented="none"
									onclick={() => resumeSession(session)}
									class="resume-button"
								>
									Resume
								</Button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.menu-root {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		height: 100%;
		padding: var(--space-5);
		background: var(--bg);
		border: 2px solid var(--primary-dim);
		border-radius: 0;
	}

	/* Tab Navigation */
	.tab-navigation {
		display: flex;
		gap: var(--space-1);
		background: var(--bg-dark);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		padding: var(--space-1);
	}

	.tab-navigation :global(.btn) {
		flex: 1;
		justify-content: center;
		font-size: 0.875rem;
	}

	.tab-navigation :global(.btn.active) {
		background: var(--surface);
		border-color: var(--primary-dim);
		color: var(--primary);
	}

	/* Session Type Selector */
	.type-selector {
		display: flex;
		gap: var(--space-2);
		background: var(--bg-dark);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		padding: var(--space-1);
	}

	.type-selector :global(.btn.active) {
		background: var(--surface);
		border-color: var(--primary-dim);
		color: var(--primary);
	}

	/* Create Session Section */
	.create-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.form-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		color: var(--text);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: var(--font-mono);
	}

	.directory-path {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	/* Directory Picker Panel */
	.directory-picker-panel {
		background: var(--surface);
		border: 2px solid var(--primary-dim);
		border-radius: 6px;
		padding: var(--space-4);
		max-height: 400px;
		overflow-y: auto;
	}

	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-4);
	}

	.picker-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		color: var(--text);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: var(--font-mono);
	}

	.picker-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--surface-border);
	}

	/* Sessions Panel */
	.sessions-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 2px solid var(--primary-dim);
		border-radius: 6px;
		min-height: 0;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-4);
		background: var(--bg-dark);
		border-bottom: 1px solid var(--primary-dim);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.header-content h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: var(--font-mono);
	}

	.count-badge {
		background: var(--primary);
		color: var(--bg);
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: var(--font-mono);
	}

	.sessions-list {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.status {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-5);
		color: var(--text-muted);
		font-size: 0.875rem;
		text-align: center;
	}

	.status.error {
		color: var(--error);
	}

	/* Search Container */
	.search-container {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--surface-border);
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		padding: var(--space-2) var(--space-3);
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 0.875rem;
		font-family: var(--font-mono);
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.clear-search {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.clear-search:hover {
		background: var(--surface);
		color: var(--text);
	}

	/* Previous Sessions List */
	.previous-sessions-list {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.previous-session-card {
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		padding: var(--space-3);
		transition: all 0.2s ease;
	}

	.previous-session-card:hover {
		border-color: var(--primary-dim);
		background: var(--bg-light);
	}

	.session-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.session-type-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--surface);
		border: 1px solid var(--primary-dim);
		border-radius: 6px;
		color: var(--primary);
	}

	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-title {
		font-weight: 600;
		color: var(--text);
		font-size: 0.875rem;
		margin-bottom: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.75rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	.session-workspace {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-date {
		color: var(--text-dim);
	}

	:global(.resume-button) {
		flex-shrink: 0;
		font-size: 0.75rem;
		padding: 6px 12px;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.session-meta {
			flex-direction: column;
		}
		
		.session-header {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-2);
		}

		:global(.resume-button) {
			align-self: flex-end;
		}
	}
</style>
