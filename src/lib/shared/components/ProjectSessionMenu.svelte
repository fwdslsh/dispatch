<script>
	import { onMount } from 'svelte';

	// Accept props; mark bindable ones and capture callback functions
	let {
		selectedProject = $bindable(),
		selectedSession = $bindable(),
		storagePrefix,
		onProjectSelected,
		onSessionSelected,
		onNewSession
	} = $props();

	// Internal state
	let projects = $state([]);
	let sessions = $state([]);
	let activeSessions = $state([]);
	let sessionType = $state('claude'); // 'claude' | 'pty'
	let activeTab = $state('projects'); // 'projects' | 'sessions' | 'active'
	let loading = $state(false);
	let error = $state(null);
	let restoring = $state(true);
	let isMobileView = $state(false);

	const prefix = $derived(storagePrefix ?? 'dispatch-menu');
	const STORAGE = $derived({
		activeTab: `${prefix}-active-tab`,
		selectedProject: `${prefix}-selected-project`,
		selectedSession: `${prefix}-selected-session`,
		sessionType: `${prefix}-session-type`
	});

	function cleanProjectName(projectName) {
		if (!projectName || typeof projectName !== 'string') return '';
		if (projectName.includes('--dispatch-home-workspaces-')) {
			const match = projectName.match(/--dispatch-home-workspaces-(.+)$/);
			if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
		}
		if (projectName.includes('--claude-projects--')) {
			const match = projectName.match(/--claude-projects--(.+)$/);
			if (match) {
				const cleaned = match[1].replace(/--dispatch-home-workspaces-(.+)$/, '$1');
				return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
			}
		}
		const parts = projectName.split(/[-_]/);
		const lastPart = parts[parts.length - 1];
		if (lastPart && lastPart !== 'dispatch' && lastPart !== 'home') {
			return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
		}
		return projectName;
	}

	async function loadActiveSessions() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/sessions');
			if (response.ok) {
				const data = await response.json();
				// Filter active sessions by type
				activeSessions = (data.sessions || [])
					.filter((s) => s && s.isActive && s.type === sessionType)
					.map((session) => ({
						...session,
						displayName: session.title || `${session.type || 'Unknown'} Session`,
						statusIndicator: '🟢', // Active indicator
						workspacePath: session.workspacePath || '',
						projectName: session.projectName || ''
					}));
			} else {
				error = 'Failed to load active sessions';
			}
		} catch (err) {
			error = 'Error loading active sessions: ' + err.message;
		}
		loading = false;
	}

	async function loadProjects() {
		loading = true;
		error = null;
		try {
			if (sessionType === 'claude') {
				const response = await fetch('/api/claude/projects');
				if (response.ok) {
					const data = await response.json();
					projects = data.projects || [];
				} else {
					error = 'Failed to load projects';
				}
			} else {
				// Terminal workspaces
				const response = await fetch('/api/workspaces');
				if (response.ok) {
					const data = await response.json();
					const list = data.list || [];
					projects = list
						.filter((p) => p && typeof p === 'string')
						.map((p) => ({
							name: p.split('/').pop() || '',
							path: p,
							sessionCount: 0,
							lastModified: null
						}));
				} else {
					error = 'Failed to load workspaces';
				}
			}
		} catch (err) {
			error = 'Error loading projects: ' + err.message;
		}
		loading = false;
	}

	async function selectProject(project) {
		selectedSession = null;
		loading = true;
		error = null;
		try {
			if (!project) {
				selectedProject = null;
				sessions = [];
			} else if (sessionType === 'claude') {
				selectedProject = project?.name || null;
				const response = await fetch(
					`/api/claude/projects/${encodeURIComponent(selectedProject)}/sessions`
				);
				if (response.ok) {
					const data = await response.json();
					sessions = data.sessions || [];
					activeTab = 'sessions';
				} else {
					error = 'Failed to load sessions';
				}
			} else {
				// pty: selectedProject is the workspace path
				selectedProject = project?.path || project?.name || null;
				if (selectedProject) {
					const response = await fetch(
						`/api/sessions?workspace=${encodeURIComponent(selectedProject)}`
					);
					if (response.ok) {
						const data = await response.json();
						sessions = (data.sessions || []).filter((s) => s.type === 'pty');
						activeTab = 'sessions';
					} else {
						error = 'Failed to load sessions';
					}
				} else {
					sessions = [];
				}
			}
		} catch (err) {
			error = 'Error loading sessions: ' + err.message;
		}
		loading = false;
		onProjectSelected?.({ detail: { name: selectedProject, type: sessionType } });
	}

	function selectSession(session) {
		selectedSession = session?.id || null;
		// Include type and project context for parent
		const detail =
			sessionType === 'claude'
				? {
						id: selectedSession,
						type: 'claude',
						projectName: session?.projectName || selectedProject,
						workspacePath: session?.workspacePath,
						isActive: session?.isActive || false
					}
				: {
						id: selectedSession,
						type: 'pty',
						workspacePath: session?.workspacePath || selectedProject,
						isActive: session?.isActive || false
					};
		onSessionSelected?.({ detail });
	}

	function selectActiveSession(session) {
		selectedSession = session?.id || null;
		// For active sessions, we have all the context we need
		const detail = {
			id: selectedSession,
			type: session?.type,
			workspacePath: session?.workspacePath,
			projectName: session?.projectName,
			sessionId: session?.sessionId, // For Claude sessions
			isActive: true
		};
		onSessionSelected?.({ detail });
	}

	onMount(async () => {
		// Restore UI prefs
		try {
			const savedTab = localStorage.getItem(STORAGE.activeTab);
			if (savedTab === 'projects' || savedTab === 'sessions' || savedTab === 'active')
				activeTab = savedTab;
		} catch {}

		try {
			const savedType = localStorage.getItem(STORAGE.sessionType);
			if (savedType === 'claude' || savedType === 'pty') sessionType = savedType;
		} catch {}

		await loadProjects();
		await loadActiveSessions();

		try {
			const savedProject = localStorage.getItem(STORAGE.selectedProject);
			const savedSession = localStorage.getItem(STORAGE.selectedSession);

			if (savedProject) {
				const projObj =
					sessionType === 'claude'
						? { name: savedProject }
						: { path: savedProject, name: savedProject.split('/').pop() };
				await selectProject(projObj);
				if (savedSession && sessions.some((s) => s.id === savedSession)) {
					selectedSession = savedSession;
				}
			}
		} catch {}
		restoring = false;

		const updateMobile = () => {
			isMobileView = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
		};
		updateMobile();
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', updateMobile);
		}
	});

	// Handle resize listener cleanup with $effect
	$effect(() => {
		if (typeof window === 'undefined') return;

		const updateMobile = () => {
			isMobileView = window.innerWidth < 768;
		};

		window.addEventListener('resize', updateMobile);
		return () => window.removeEventListener('resize', updateMobile);
	});

	// Persistence effects
	$effect(() => {
		if (restoring) return;
		try {
			localStorage.setItem(STORAGE.activeTab, activeTab);
		} catch {}
	});
	$effect(() => {
		if (restoring) return;
		try {
			localStorage.setItem(STORAGE.sessionType, sessionType);
		} catch {}
	});
	$effect(() => {
		if (restoring) return;
		try {
			localStorage.setItem(STORAGE.selectedProject, selectedProject || '');
		} catch {}
	});
	$effect(() => {
		if (restoring) return;
		try {
			localStorage.setItem(STORAGE.selectedSession, selectedSession || '');
		} catch {}
	});

	// Public method to refresh projects and active sessions
	export function refresh() {
		return Promise.all([loadProjects(), loadActiveSessions()]);
	}

	function changeType(type) {
		if (type === sessionType) return;
		sessionType = type;
		// Reset selection and load appropriate projects
		selectedProject = null;
		selectedSession = null;
		sessions = [];
		activeSessions = [];
		loadProjects();
		loadActiveSessions();
	}

	function handleNewSessionClick() {
		const detail =
			sessionType === 'claude'
				? { type: 'claude', projectName: selectedProject }
				: { type: 'pty', workspacePath: selectedProject };
		onNewSession?.({ detail });
	}
</script>

<div class="menu-root">
	<!-- Session Type Switcher -->
	<div class="type-tabs">
		<button
			type="button"
			class="type-btn"
			class:active={sessionType === 'claude'}
			onclick={() => changeType('claude')}>Claude</button
		>
		<button
			type="button"
			class="type-btn"
			class:active={sessionType === 'pty'}
			onclick={() => changeType('pty')}>Terminal</button
		>
	</div>
	<!-- Tab Navigation (preserving testing page styles) -->
	<div class="mobile-tabs" class:desktop-tabs={!isMobileView}>
		<button
			class="tab-btn"
			class:active={activeTab === 'active'}
			type="button"
			onclick={() => (activeTab = 'active')}
			title="Active running sessions"
		>
			Active {#if activeSessions.length > 0}<span class="count-badge">{activeSessions.length}</span
				>{/if}
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'projects'}
			type="button"
			onclick={() => (activeTab = 'projects')}>Projects</button
		>
		<button
			class="tab-btn"
			class:active={activeTab === 'sessions'}
			type="button"
			onclick={() => (activeTab = 'sessions')}
			disabled={!selectedProject}
			aria-disabled={!selectedProject}
			title={!selectedProject ? 'Select a project first' : 'Sessions'}>Sessions</button
		>
	</div>

	<div class="browser-layout" class:mobile-browser={isMobileView} class:tabbed-layout={true}>
		<!-- Active Sessions Panel -->
		<div class="panel" class:hidden={activeTab !== 'active'}>
			<h2>Active {sessionType === 'claude' ? 'Claude' : 'Terminal'} Sessions</h2>
			<div class="panel-content">
				{#if loading && activeSessions.length === 0}
					<div class="status">Loading active sessions...</div>
				{:else if activeSessions.length === 0}
					<div class="status">No active sessions found</div>
				{:else}
					{#each activeSessions as session}
						<button
							type="button"
							class="session-item active-session"
							class:selected={selectedSession === session.id}
							onclick={() => selectActiveSession(session)}
							title="Click to open this active session"
						>
							<div class="session-header">
								<div class="session-id">
									<span class="status-indicator">{session.statusIndicator}</span>
									{session.id.substring(0, 8)}...
								</div>
								<div class="session-type-badge">{session.type.toUpperCase()}</div>
							</div>
							<div class="session-info">
								<div class="session-title">{session.displayName}</div>
								{#if session.workspacePath}
									<div class="workspace-path">{session.workspacePath.split('/').pop()}</div>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Projects Panel -->
		<div class="panel" class:hidden={activeTab !== 'projects'}>
			<h2>{sessionType === 'claude' ? 'Claude Projects' : 'Workspaces'}</h2>
			<div class="panel-content">
				{#if loading && projects.length === 0}
					<div class="status">
						Loading {sessionType === 'claude' ? 'projects' : 'workspaces'}...
					</div>
				{:else if projects.length === 0}
					<div class="status">No {sessionType === 'claude' ? 'projects' : 'workspaces'} found</div>
				{:else}
					{#each projects as project}
						<button
							type="button"
							class="project-item"
							class:selected={sessionType === 'claude'
								? selectedProject === project.name
								: selectedProject === project.path}
							onclick={() => selectProject(project)}
						>
							<div class="project-header">
								<div class="project-name">
									{sessionType === 'claude'
										? cleanProjectName(project.name || '')
										: project.name || cleanProjectName(project.path || '')}
								</div>
								<div class="project-stats">
									<span class="session-count">{project.sessionCount} sessions</span>
									{#if project.lastModified}
										<span class="last-modified"
											>{new Date(project.lastModified).toLocaleDateString()}</span
										>
									{/if}
								</div>
							</div>
							{#if project.path}
								<div class="project-path">{project.path.split('/').slice(-2).join('/')}</div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Sessions Panel -->
		<div class="panel" class:hidden={activeTab !== 'sessions'}>
			<h2>Sessions</h2>
			<div class="new-session-row">
				<button type="button" class="new-session-btn" onclick={handleNewSessionClick}>
					New {sessionType === 'claude' ? 'Claude' : 'Terminal'} Session
				</button>
			</div>
			<div class="panel-content">
				{#if !selectedProject}
					<div class="status">
						Select a {sessionType === 'claude' ? 'project' : 'workspace'} to view sessions
					</div>
				{:else if loading && sessions.length === 0}
					<div class="status">Loading sessions...</div>
				{:else if sessions.length === 0}
					<div class="status">No sessions found</div>
				{:else}
					{#each sessions as session}
						<button
							type="button"
							class="session-item"
							class:selected={selectedSession === session.id}
							onclick={() => selectSession(session)}
						>
							<div class="session-header">
								<div class="session-id">{session.id.substring(0, 8)}...</div>
								<div class="session-size">{Math.round(session.size / 1024)}KB</div>
							</div>
							<div class="session-info">
								<span class="session-date"
									>{new Date(session.lastModified).toLocaleDateString()}</span
								>
								<span class="session-time"
									>{new Date(session.lastModified).toLocaleTimeString()}</span
								>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.menu-root {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: calc(100% - 5rem); /* leave space for mobile bottom bar */
		min-width: 0; /* allow shrinking inside sidebar on mobile */
	}

	.type-tabs {
		display: flex;
		background: var(--surface);
		border-bottom: 2px solid var(--primary-dim);
	}
	.type-btn {
		flex: 1;
		padding: 0.6rem 0.75rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.2s ease;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
	}
	.type-btn.active {
		color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, var(--surface));
	}

	/* Tabs (Mobile and Desktop) from testing page */
	.mobile-tabs {
		display: flex;
		background: var(--surface);
		border-bottom: 2px solid var(--primary-dim);
		position: sticky;
		top: 0;
		z-index: 10;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.mobile-tabs.desktop-tabs {
		background: var(--surface-hover);
		border-radius: 0.5rem 0.5rem 0 0;
		border-bottom: 2px solid var(--surface-border);
		margin-bottom: 0;
		position: relative;
		box-shadow: none;
	}

	.tab-btn {
		flex: 1;
		padding: 1rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.3s ease;
		position: relative;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
	}

	.tab-btn::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 50%;
		width: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--primary), var(--accent-cyan));
		transition: all 0.3s ease;
		transform: translateX(-50%);
	}

	.tab-btn:hover {
		color: var(--text);
		background: var(--surface-hover);
	}

	.tab-btn.active {
		color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, var(--surface));
	}

	.tab-btn.active::after {
		width: 100%;
	}

	.desktop-tabs .tab-btn {
		border-radius: 0.5rem 0.5rem 0 0;
		margin: 0 0.25rem;
	}

	.desktop-tabs .tab-btn.active {
		background: var(--surface);
		border-bottom-color: var(--surface);
		box-shadow:
			0 -2px 8px -4px rgba(0, 0, 0, 0.1),
			inset 0 -1px 0 var(--primary);
		position: relative;
		z-index: 1;
	}

	.desktop-tabs .tab-btn.active::before {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--surface);
	}

	.browser-layout {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
		gap: 1rem;
		min-height: 100%;
		min-width: 0; /* prevent overflow in sidebar */
	}

	.browser-layout.tabbed-layout {
		grid-template-rows: 1fr;
	}
	.mobile-browser {
		grid-template-columns: 1fr !important;
		grid-template-rows: 1fr !important;
	}

	/* utility to hide inactive tab panels */
	.hidden {
		display: none !important;
	}

	.panel {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 0.5rem;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
		min-width: 0; /* allow shrinking without overflow */
	}
	.panel h2 {
		background: var(--surface-hover);
		margin: 0;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--surface-border);
		font-size: 0.95rem;
		color: var(--accent);
		font-weight: 700;
	}
	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
		min-width: 0;
	}

	.new-session-row {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--surface-border);
		background: var(--surface-hover);
	}
	.new-session-btn {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--primary-dim);
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--primary) 8%, var(--surface)),
			var(--surface)
		);
		color: var(--text);
		border-radius: 0.35rem;
		font-weight: 700;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
	}

	.project-item,
	.session-item {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--surface-border);
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		font-family: inherit;
		overflow: hidden; /* avoid horizontal overflow */
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
	}
	.project-item::before,
	.session-item::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: linear-gradient(180deg, var(--primary), var(--accent-cyan));
		transform: scaleY(0);
		transition: transform 0.3s ease;
	}
	.project-item:hover,
	.session-item:hover {
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--primary) 5%, transparent),
			transparent
		);
		padding-left: calc(1rem + 4px);
	}
	.project-item:hover::before,
	.session-item:hover::before {
		transform: scaleY(0.5);
	}

	.project-item.selected,
	.session-item.selected {
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--primary) 10%, var(--surface)),
			color-mix(in oklab, var(--primary) 2%, var(--surface))
		);
		border-left: 3px solid transparent;
		padding-left: calc(1rem + 4px);
		font-weight: 600;
	}
	.project-item.selected::before,
	.session-item.selected::before {
		transform: scaleY(1);
	}

	.project-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.4rem;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.project-name {
		font-weight: 700;
		font-size: 1rem;
		color: var(--text);
		line-height: 1.2;
		min-width: 0;
		overflow-wrap: anywhere;
		word-break: break-word;
	}
	.project-stats {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.15rem;
		font-size: 0.7rem;
	}
	.session-count {
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		color: var(--bg);
		padding: 0.1rem 0.35rem;
		border-radius: 0.75rem;
		font-weight: 600;
		font-size: 0.65rem;
		box-shadow: 0 2px 6px rgba(46, 230, 107, 0.2);
	}
	.last-modified {
		opacity: 0.7;
		font-weight: 500;
	}

	.project-path {
		font-size: 0.75rem;
		opacity: 0.6;
		font-family: var(--font-mono);
		background: var(--surface-hover);
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		margin-top: 0.25rem;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.session-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.35rem;
	}
	.session-id {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent);
		overflow-wrap: anywhere;
	}
	.session-size {
		background: var(--surface-hover);
		color: var(--text);
		padding: 0.15rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.7rem;
		font-weight: 600;
	}
	.session-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.7rem;
		opacity: 0.8;
	}
	.session-date {
		font-weight: 500;
	}
	.session-time {
		font-family: var(--font-mono);
		opacity: 0.7;
	}

	/* Active sessions styling */
	.active-session {
		border-left: 3px solid var(--accent-green);
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--accent-green) 8%, var(--surface)),
			color-mix(in oklab, var(--accent-green) 2%, var(--surface))
		);
	}

	.active-session:hover {
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--accent-green) 12%, var(--surface)),
			color-mix(in oklab, var(--accent-green) 4%, var(--surface))
		);
	}

	.status-indicator {
		font-size: 0.7rem;
		margin-right: 0.3rem;
	}

	.session-type-badge {
		background: var(--primary);
		color: var(--bg);
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	.session-title {
		font-weight: 600;
		color: var(--text);
		font-size: 0.85rem;
		margin-bottom: 0.2rem;
	}

	.workspace-path {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		opacity: 0.7;
		background: var(--surface-hover);
		padding: 0.1rem 0.3rem;
		border-radius: 0.2rem;
		display: inline-block;
	}

	.count-badge {
		background: var(--accent-green);
		color: var(--bg);
		padding: 0.1rem 0.3rem;
		border-radius: 0.5rem;
		font-size: 0.65rem;
		font-weight: 700;
		margin-left: 0.3rem;
		min-width: 1rem;
		text-align: center;
		display: inline-block;
	}

	.status {
		padding: 1.25rem;
		text-align: center;
		color: var(--text-muted);
		font-style: italic;
	}

	/* Mobile-specific styles and fixes */
	@media (hover: none) and (pointer: coarse) {
		/* Remove hover effects on touch devices */
		.tab-btn:hover,
		.type-btn:hover {
			background: inherit;
		}

		.project-item:hover,
		.session-item:hover {
			background: transparent;
			padding-left: 1rem;
		}

		.project-item:hover::before,
		.session-item:hover::before {
			transform: scaleY(0);
		}

		/* Add active states for touch feedback */
		.tab-btn:active,
		.type-btn:active,
		.project-item:active,
		.session-item:active,
		.new-session-btn:active {
			opacity: 0.8;
			transform: scale(0.98);
		}
	}

	@media (max-width: 480px) {
		.menu-root {
			height: calc(100% - 12rem); /* full height on very small screens */
		}
		.panel h2 {
			font-size: 0.9rem;
		}
		.project-name {
			font-size: 0.95rem;
		}
	}
</style>
