<script>
	import { onMount } from 'svelte';
	import DirectoryBrowser from '$lib/components/DirectoryBrowser.svelte';
	import Button from './Button.svelte';
	import SessionCard from './SessionCard.svelte';
	import { IconRobot, IconTerminal2, IconFolder, IconChevronDown, IconX, IconPlus, IconActivity, IconBolt } from '@tabler/icons-svelte';

	// Props
	let {
		selectedProject = $bindable(),
		selectedSession = $bindable(),
		storagePrefix,
		onProjectSelected,
		onSessionSelected,
		onNewSession
	} = $props();

	// State
	let sessionType = $state('claude');
	let activeSessions = $state([]);
	let previousSessions = $state([]);
	let selectedWorkspace = $state('');
	let showDirectoryPicker = $state(false);
	let loading = $state(false);
	let error = $state(null);

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
					pinned: s.pinned === true || s.pinned === 1 || false
				}));
		} catch {}
	}

	// Handle directory selection
	function handleDirectorySelect(path) {
		selectedWorkspace = path;
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
		if (!selectedWorkspace) {
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
					workspacePath: selectedWorkspace,
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
		loadActiveSessions();
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
	<!-- Session Type Toggle -->
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
					bind:selected={selectedWorkspace}
					startPath={selectedWorkspace || ''}
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

	<!-- Previous Sessions (all types) -->
	<div class="sessions-panel previous">
		<div class="panel-header">
			<div class="header-content">
				<h2>Previous Sessions</h2>
			</div>
			{#if previousSessions.length > 0}
				<span class="count-badge">{previousSessions.length}</span>
			{/if}
		</div>

		<div class="previous-list">
			{#if previousSessions.length === 0}
				<div class="status">No previous sessions</div>
			{:else}
				<table class="prev-table">
					<thead>
						<tr>
							<th>Type</th>
							<th>Title</th>
							<th>Workspace</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each previousSessions as ps (ps.id)}
							<tr>
								<td>{ps.type === 'claude' ? 'Claude' : 'Terminal'}</td>
								<td>{ps.title}</td>
								<td title={ps.workspacePath}>{ps.workspacePath}</td>
								<td class="actions">
									<Button
										variant="ghost"
										augmented="none"
										onclick={() =>
											onSessionSelected?.({
												detail: {
													id: ps.id,
													type: ps.type,
													workspacePath: ps.workspacePath,
													isActive: false
												}
											})
										}
									>
										Resume
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
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
					<span class="directory-path">{formatPath(selectedWorkspace)}</span>
					<IconChevronDown size={16} />
				</Button>
			</div>
			<Button
				variant="primary"
				augmented="tl-clip br-clip both"
				onclick={createSession}
				disabled={loading || !selectedWorkspace}
				{loading}
			>
				{#snippet icon()}
					{#if loading}<IconBolt size={18} />{:else}<IconPlus size={18} />{/if}
				{/snippet}
				New {sessionType === 'claude' ? 'Claude' : 'Terminal'} Session
			</Button>
		{/if}
	</div>

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
</div>

<style>
	.menu-root {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		height: 100%;
		padding: var(--space-5);
		background: var(--bg);
		border: 2px solid var(--primary-dim);
		border-radius: 0;
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

	.directory-button {
		justify-content: space-between !important;
		text-align: left;
		background: var(--bg-dark) !important;
		border: 1px solid var(--surface-border) !important;
	}

	.directory-button:hover {
		border-color: var(--primary-dim) !important;
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
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--primary-dim);
	}

	.picker-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
		color: var(--primary);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: var(--font-mono);
	}

	.picker-actions {
		margin-top: var(--space-4);
		display: flex;
		justify-content: flex-end;
	}

	/* Sessions Panel */
	.sessions-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 2px solid var(--primary-dim);
		border-radius: 6px;
		overflow: hidden;
	}

	.sessions-panel.previous {
		margin-top: var(--space-4);
	}

	.previous-list {
		padding: var(--space-2);
		overflow: auto;
	}

	.prev-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.prev-table th,
	.prev-table td {
		padding: 8px 10px;
		border-bottom: 1px solid var(--primary-dim);
		text-align: left;
		vertical-align: middle;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	.prev-table .actions {
		text-align: right;
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
		color: var(--text);
	}

	.panel-header h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text);
	}

	.count-badge {
		background: var(--primary);
		color: var(--bg);
		padding: var(--space-1) var(--space-3);
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sessions-list {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-2);
	}

	/* Status Messages */
	.status {
		padding: var(--space-6) var(--space-4);
		text-align: center;
		color: var(--text-muted);
		font-size: 0.875rem;
		font-family: var(--font-mono);
	}

	.status.error {
		color: var(--err);
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.menu-root {
			padding: var(--space-4);
			gap: var(--space-4);
		}

		.panel-header {
			padding: var(--space-3);
		}

		.type-selector {
			flex-direction: column;
		}
	}
</style>
