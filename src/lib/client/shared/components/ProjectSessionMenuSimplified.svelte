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
				const sessionToResume = {
					...session,
					id: resumedSession.id || session.id,
					shouldResume: true,
					resumeSession: true,
					isActive: true
				};

				await loadAllSessions();
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
		await loadAllSessions();
		// Leave empty so DirectoryBrowser defaults to user setting or WORKSPACES_ROOT
	});

	// Public refresh method
	export function refresh() {
		return loadAllSessions();
	}
</script>

<div class="menu-root">
	<!-- Tab Content Container -->
	<div class="tab-content">
		<!-- Session Type Toggle (shown for active and browse tabs) -->
		{#if currentTab === 'active' || currentTab === 'browse'}
			<div class="type-selector">
				<Button
					variant="ghost"
					augmented="none"
					class={sessionType === 'all' ? 'active' : ''}
					onclick={() => changeType('all')}
				>
					All
				</Button>
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

				<!-- Search Filter -->
				<div class="search-container">
					<div class="search-input-wrapper">
						<IconSearch size={16} />
						<input
							type="text"
							placeholder="Search active sessions..."
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
								<div
									class="session-card active-session {selectedSession === session.id
										? 'selected'
										: ''}"
									onclick={() => selectSession(session)}
									role="button"
									tabindex="0"
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											selectSession(session);
										}
									}}
								>
									<div class="session-header">
										<div class="session-type-icon">
											{#if session.type === 'claude'}
												<IconRobot size={16} />
											{:else}
												<IconTerminal2 size={16} />
											{/if}
										</div>
										<div class="session-info">
											<div class="session-title">
												{session.title}
												<span class="active-badge">Active</span>
											</div>
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
											onclick={(e) => {
												e.stopPropagation();
												selectSession(session);
											}}
											class="action-button"
										>
											Connect
										</Button>
									</div>
								</div>
							{/each}
						{/if}
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
								<div
									class="session-card inactive-session {selectedSession === session.id
										? 'selected'
										: ''}"
									onclick={() => selectSession(session)}
									role="button"
									tabindex="0"
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											selectSession(session);
										}
									}}
								>
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
											variant="ghost"
											augmented="none"
											onclick={(e) => {
												e.stopPropagation();
												resumeSession(session);
											}}
											class="action-button"
										>
											Resume
										</Button>
									</div>
								</div>
							{/each}
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Navigation Tabs at the bottom -->
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
			onclick={() => (currentTab = 'browse')}
		>
			{#snippet icon()}<IconHistory size={16} />{/snippet}
			Browse
		</Button>
	</div>
</div>

<style>
	.menu-root {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: var(--space-5);
	
	}

	/* Tab Navigation */
	.tab-navigation {
		display: flex;
		gap: var(--space-1);
		background: var(--bg-dark);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		padding: var(--space-1);
		flex-shrink: 0; /* Prevent shrinking */
		margin-top: var(--space-4);
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
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		max-height: 100%;
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: 8px;
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
		gap: var(--space-2);
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
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--surface-border);
		background: var(--bg);
		flex-shrink: 0;
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


	/* Unified Session Cards */
	.session-card {
		background: var(--bg);
		min-height: 100px;
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		padding: var(--space-4);
		transition: all 0.2s ease;
		cursor: pointer;
		margin-bottom: var(--space-2);
		outline: none;
		width: 100%;
		position: relative;
		overflow: hidden;
	}

	.session-card:hover {
		border-color: var(--primary-dim);
		background: var(--bg-light);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.session-card:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
	}

	.session-card.selected {
		border-color: var(--primary);
		background: rgba(var(--primary-rgb), 0.05);
		box-shadow: 0 0 0 1px rgba(var(--primary-rgb), 0.2);
	}

	.session-card.active-session {
		border-color: var(--success);
		background: rgba(var(--success-rgb), 0.05);
		box-shadow: 0 0 0 1px rgba(var(--success-rgb), 0.1);
	}

	.session-card.active-session:hover {
		background: rgba(var(--success-rgb), 0.1);
		box-shadow: 0 2px 12px rgba(var(--success-rgb), 0.2);
	}

	.session-card.active-session.selected {
		border-color: var(--success);
		background: rgba(var(--success-rgb), 0.15);
		box-shadow: 0 0 0 2px rgba(var(--success-rgb), 0.3);
	}

	.session-card.inactive-session {
		border-color: var(--surface-border);
		opacity: 0.9;
	}

	.session-card.inactive-session:hover {
		opacity: 1;
	}

	.session-card.inactive-session.selected {
		border-color: var(--primary);
		background: rgba(var(--primary-rgb), 0.05);
		opacity: 1;
	}

	.session-header {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.session-type-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: var(--surface);
		border: 2px solid var(--primary-dim);
		border-radius: 8px;
		color: var(--primary);
		flex-shrink: 0;
	}

	.session-info {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.session-title {
		font-weight: 600;
		color: var(--text);
		font-size: 1rem;
		margin-bottom: var(--space-1);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 1.5rem;
		line-height: 1.5;
	}

	.session-meta {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: 0.8rem;
		min-height: 2.5rem;
	}

	.session-workspace {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		word-break: break-all;
		line-height: 1.3;
		max-width: 100%;
		display: block;
	}

	.session-date {
		color: var(--text-dim);
		font-size: 0.7rem;
		flex-shrink: 0;
	}

	.active-badge {
		display: inline-block;
		background: var(--success);
		color: white;
		font-size: 0.6rem;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		margin-left: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	

	:global(.resume-button) {
		flex-shrink: 0;
		font-size: 0.75rem;
		padding: 6px 12px;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.menu-root {
			padding: var(--space-3);
			height: 100%;
			display: flex;
			flex-direction: column;
			border: none;
		}

		.tab-navigation {
			margin-top: var(--space-3);
			margin-bottom: 0;
		}

		.tab-content {
			flex: 1;
			min-height: 0;
			overflow: hidden;
			/* Add padding to prevent content from being cut off */
			padding-bottom: var(--space-2);
		}

		.sessions-list {
			max-height: calc(100vh - 400px);
			padding: var(--space-2);
		}

		.session-header {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-2);
		}

		.session-meta {
			min-height: auto;
		}

		.action-button {
			align-self: flex-end;
			min-width: 60px;
		}
	}
</style>
