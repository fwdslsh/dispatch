<script>
	import { onMount } from 'svelte';
	import DirectoryBrowser from '$lib/client/shared/components/DirectoryBrowser.svelte';
	import Button from './Button.svelte';
	import SessionCard from './SessionCard.svelte';
	import {
		IconFolder,
		IconChevronDown,
		IconX,
		IconPlus,
		IconActivity,
		IconBolt,
		IconHistory,
		IconSearch,
		IconTerminal,
		IconAsterisk
	} from '@tabler/icons-svelte';
	import IconClaude from './Icons/IconClaude.svelte';

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
	let currentTab = $state('active'); // 'active', 'create', 'browse'
	let loading = $state(false);
	let error = $state(null);
	let searchTerm = $state('');

	// Load all sessions (both active and inactive)
	async function loadAllSessions() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/sessions?include=all');
			if (response.ok) {
				const data = await response.json();
				const sessions = data.sessions || [];
				allSessions = sessions
					.filter((s) => s && s.id)
					.map((session) => ({
						id: session.id,
						type: session.type,
						workspacePath: session.workspacePath,
						title: session.title || `${session.type} Session`,
						isActive: session.isActive || false,
						pinned: session.pinned === true || session.pinned === 1 || false,
						createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
						lastActivity: session.lastActivity ? new Date(session.lastActivity) : new Date()
					}))
					.sort((a, b) => {
						// Sort by active first, then by last activity
						if (a.isActive && !b.isActive) return -1;
						if (!a.isActive && b.isActive) return 1;
						return b.lastActivity - a.lastActivity;
					});
			} else {
				error = 'Failed to load sessions';
			}
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
				await loadAllSessions();
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
				const resumedId = resumedSession.id || session.id;
				await loadAllSessions();
				selectedSession = resumedId;
				onSessionSelected?.({
					detail: {
						id: resumedId,
						type: session.type,
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

	// Initialize
	onMount(async () => {
		await loadAllSessions();
		// DirectoryBrowser will now default to WORKSPACES_ROOT when no startPath is provided
	});

	// Public refresh method
	export function refresh() {
		return loadAllSessions();
	}
</script>

<div class="menu-root">
	<!-- Tab Content Container -->
	<div class="tab-content">
		<!-- Tab Content -->
		{#if currentTab === 'active'}
			<!-- Active Sessions with Search and Filters -->
			<div class="sessions-panel">
				<div class="panel-header">
					<div class="header-content">
						<IconActivity size={20} />
						<h2>Active Sessions</h2>
					</div>
					{#if filteredSessions.filter((s) => s.isActive).length > 0}
						<span class="count-badge">{filteredSessions.filter((s) => s.isActive).length}</span>
					{/if}
				</div>

				<div class="sessions-list">
					{#if loading}
						<div class="status">Loading sessions...</div>
					{:else if error}
						<div class="status error">{error}</div>
					{:else}
						{@const activeSessions = filteredSessions.filter((s) => s.isActive)}
						{#if activeSessions.length === 0}
							<div class="status">
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
			<div class="create-section">
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
							<Button
								variant="ghost"
								augmented="none"
								onclick={() => (showDirectoryPicker = false)}
							>
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
			<!-- Browse Historical Sessions -->
			<div class="sessions-panel">
				<div class="panel-header">
					<div class="header-content">
						<IconHistory size={20} />
						<h2>Browse Sessions</h2>
					</div>
					{#if filteredSessions.filter((s) => !s.isActive).length > 0}
						<span class="count-badge">{filteredSessions.filter((s) => !s.isActive).length}</span>
					{/if}
				</div>

				<div class="sessions-list">
					{#if loading}
						<div class="status">Loading sessions...</div>
					{:else if error}
						<div class="status error">{error}</div>
					{:else}
						{@const historicalSessions = filteredSessions.filter((s) => !s.isActive)}
						{#if historicalSessions.length === 0}
							<div class="status">
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
		<div class="tab-buttons">
			<Button
				variant="ghost"
				augmented="none"
				class={currentTab === 'browse' ? 'active' : ''}
				onclick={() => (currentTab = 'browse')}
			>
				{#snippet icon()}<IconHistory size={16} />{/snippet}
				<span class="button-text">Browse</span>
			</Button>
			<Button
				variant="ghost"
				augmented="none"
				class={currentTab === 'active' ? 'active' : ''}
				onclick={() => (currentTab = 'active')}
			>
				{#snippet icon()}<IconActivity size={16} />{/snippet}
				<span class="button-text">Active</span>
			</Button>
			<!-- <Button
				variant="ghost"
				augmented="none"
				class={currentTab === 'create' ? 'active' : ''}
				onclick={() => (currentTab = 'create')}
			>
				{#snippet icon()}<IconPlus size={16} />{/snippet}
				<span class="button-text">Create</span>
			</Button> -->
		</div>
	</div>

	<!-- Search Bar for Active and Browse tabs (moved to bottom) -->
	{#if currentTab === 'active' || currentTab === 'browse'}
		<div class="search-container bottom-search">
			<div class="search-input-wrapper">
				<IconSearch size={16} />
				<input
					type="text"
					placeholder={currentTab === 'active' ? 'Search active sessions...' : 'Search sessions...'}
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
		border-radius: 6px;
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

	/* Tab Content Container */
	.tab-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-height: 0;
		overflow: hidden;
	}

	.session-type-buttons :global(.btn),
	.tab-buttons :global(.btn) {
		padding: var(--space-2) var(--space-3);
		font-size: 0.8rem;
		min-width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
	}

	.session-type-buttons :global(.btn.active),
	.tab-buttons :global(.btn.active) {
		background: var(--surface);
		border-color: var(--primary-dim);
		color: var(--primary);
	}

	/* Hide button text on small screens */
	@media (max-width: 768px) {
		.button-text {
			display: none;
		}

		.session-type-buttons :global(.btn),
		.tab-buttons :global(.btn) {
			min-width: 2.5rem;
			padding: var(--space-2);
		}
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
		overflow-y: auto;
	}

	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-2);
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
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4);
		border-bottom: 1px solid var(--surface-border);
		background: var(--bg-dark);
		flex-shrink: 0;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.header-content h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
	}

	.count-badge {
		background: var(--primary);
		color: white;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 12px;
		min-width: 20px;
		text-align: center;
	}

	.sessions-list {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		min-height: 200px;
		max-height: calc(100vh - 300px);
		scrollbar-width: thin;
		scrollbar-color: var(--surface-border) transparent;
	}

	.sessions-list::-webkit-scrollbar {
		width: 6px;
	}

	.sessions-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.sessions-list::-webkit-scrollbar-thumb {
		background: var(--surface-border);
		border-radius: 3px;
	}

	.sessions-list::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
	}

	.status {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-6);
		color: var(--text-muted);
		font-size: 0.9rem;
		text-align: center;
		min-height: 120px;
		border: 2px dashed var(--surface-border);
		border-radius: 8px;
		margin: var(--space-4);
	}

	.status.error {
		color: var(--error);
	}

	/* Search Container */
	.search-container {
		background: var(--bg);
		flex-shrink: 0;

		border-bottom: none;
		padding: var(--space-3) 0;
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
</style>
