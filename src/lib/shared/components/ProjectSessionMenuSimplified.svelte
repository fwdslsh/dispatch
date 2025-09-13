<script>
	import { onMount } from 'svelte';
	import DirectoryBrowser from '$lib/components/DirectoryBrowser.svelte';
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
	let selectedWorkspace = $state('/workspace');
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
		// Set default workspace to /workspace
		if (!selectedWorkspace) {
			selectedWorkspace = '/workspace';
		}
	});

	// Public refresh method
	export function refresh() {
		return loadActiveSessions();
	}
</script>

<div class="menu-root" data-augmented-ui="tl-clip tr-clip bl-clip br-clip both">
	<!-- Session Type Toggle -->
	<div class="type-tabs">
		<button
			type="button"
			class="type-btn"
			class:active={sessionType === 'claude'}
			onclick={() => changeType('claude')}
			data-augmented-ui="tl-clip br-clip both"
			><span class="type-icon"><IconRobot size={18} /></span><span>Claude</span></button
		>
		<button
			type="button"
			class="type-btn"
			class:active={sessionType === 'pty'}
			onclick={() => changeType('pty')}
			data-augmented-ui="tl-clip br-clip both"
			><span class="type-icon"><IconTerminal2 size={18} /></span><span>Terminal</span></button
		>
	</div>

	<!-- Create Session Section -->
	<div class="create-section">
		{#if showDirectoryPicker}
			<div class="directory-picker-container" data-augmented-ui="tl-clip br-clip both">
				<div class="picker-header">
					<span class="picker-title"><IconFolder size={18} /> Select Directory</span>
				</div>
				<DirectoryBrowser
					bind:selected={selectedWorkspace}
					startPath={selectedWorkspace || '/workspace'}
					onSelect={handleDirectorySelect}
				/>
				<button
					type="button"
					class="cancel-picker-btn"
					onclick={() => (showDirectoryPicker = false)}
					data-augmented-ui="tl-clip br-clip both"
				>
					<span><IconX size={16} /></span>
					<span>Cancel</span>
				</button>
			</div>
		{:else}
			<div class="workspace-section">
				<label class="workspace-label">
					<span class="label-icon"><IconFolder size={16} /></span>
					<span>Workspace</span>
				</label>
				<button
					type="button"
					class="workspace-btn"
					onclick={() => (showDirectoryPicker = true)}
					disabled={loading}
					data-augmented-ui="tl-clip br-clip both"
				>
					<span class="workspace-icon"><IconFolder size={20} /></span>
					<span class="workspace-path">{formatPath(selectedWorkspace)}</span>
					<span class="workspace-arrow"><IconChevronDown size={16} /></span>
				</button>
			</div>
			<button
				type="button"
				class="create-btn"
				onclick={createSession}
				disabled={loading || !selectedWorkspace}
				data-augmented-ui="tl-clip br-clip both"
			>
				<span class="create-icon">{#if loading}<IconBolt size={18} />{:else}<IconPlus size={18} />{/if}</span>
				<span>New {sessionType === 'claude' ? 'Claude' : 'Terminal'} Session</span>
			</button>
		{/if}
	</div>

	<!-- Active Sessions -->
	<div class="sessions-panel" data-augmented-ui="tl-clip br-clip both">
		<div class="sessions-header">
			<div class="header-content">
				<span class="header-icon"><IconActivity size={20} /></span>
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
					<button
						type="button"
						class="session-item"
						class:selected={selectedSession === session.id}
						onclick={() => selectSession(session)}
						data-augmented-ui="tl-clip br-clip both"
					>
						<div class="session-header">
							<div class="session-type-badge">
								<span class="type-icon">{#if session.type === 'claude'}<IconRobot size={16} />{:else}<IconTerminal2 size={16} />{/if}</span>
								<span class="type-text">{session.type.toUpperCase()}</span>
							</div>
							<div class="session-status">
								<span class="status-dot"></span>
								<span class="status-text">ACTIVE</span>
							</div>
						</div>
						<div class="session-content">
							<div class="session-title">{session.title}</div>
							<div class="session-workspace">
								<span class="workspace-icon-small"><IconFolder size={14} /></span>
								<span>{session.workspacePath.split('/').pop() || 'root'}</span>
							</div>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.menu-root {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		height: 100%;
		padding: 1.5rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 95%, var(--accent) 5%), 
			color-mix(in oklab, var(--surface) 98%, var(--accent-cyan) 2%));
		border: 2px solid var(--primary-dim);
		box-shadow: 
			0 10px 30px color-mix(in oklab, var(--bg) 20%, black),
			0 0 40px var(--glow),
			inset 0 1px 0 color-mix(in oklab, var(--text) 10%, transparent);
		position: relative;
	}

	/* Type Toggle */
	.type-tabs {
		display: flex;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 90%, var(--accent) 10%), 
			color-mix(in oklab, var(--surface) 95%, var(--accent-cyan) 5%));
		border: 2px solid var(--line);
		border-radius: 0;
		padding: 0.5rem;
		gap: 0.5rem;
		box-shadow: inset 0 2px 4px color-mix(in oklab, var(--bg) 10%, black);
	}

	.type-btn {
		flex: 1;
		padding: 1rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 80%, var(--accent) 20%), 
			color-mix(in oklab, var(--surface) 90%, var(--accent) 10%));
		border: 2px solid var(--line);
		border-radius: 0;
		color: var(--muted);
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
		position: relative;
		overflow: hidden;
	}

	.type-btn::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, var(--glow), transparent);
		transition: left 0.5s ease;
	}

	.type-icon {
		font-size: 1.1em;
		filter: drop-shadow(0 0 6px var(--glow));
	}

	.type-btn.active {
		background: linear-gradient(135deg, var(--accent), var(--accent-cyan));
		color: var(--bg);
		border-color: var(--accent);
		box-shadow: 
			0 0 20px var(--glow),
			0 0 40px var(--glow),
			inset 0 1px 0 color-mix(in oklab, var(--text) 20%, transparent);
		transform: translateY(-1px);
		text-shadow: 0 0 8px color-mix(in oklab, var(--bg) 30%, black);
	}

	.type-btn.active .type-icon {
		filter: drop-shadow(0 0 10px color-mix(in oklab, var(--text) 50%, transparent));
		transform: scale(1.1);
	}

	.type-btn:not(.active):hover {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--accent) 15%, var(--surface)), 
			color-mix(in oklab, var(--accent) 8%, var(--surface)));
		color: var(--text);
		border-color: var(--primary-dim);
		box-shadow: 0 0 15px var(--glow);
		transform: translateY(-1px);
	}

	.type-btn:not(.active):hover::before {
		left: 100%;
	}

	.type-btn:not(.active):hover .type-icon {
		filter: drop-shadow(0 0 8px var(--glow));
		transform: scale(1.05);
	}

	/* Create Section */
	.create-section {
		display: flex;
		gap: 1rem;
		flex-direction: column;
	}

	.workspace-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.workspace-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		color: var(--primary);
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.9rem;
		text-shadow: 0 0 6px rgba(46, 230, 107, 0.3);
	}

	.label-icon {
		filter: drop-shadow(0 0 6px rgba(46, 230, 107, 0.4));
	}

	.workspace-btn {
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 90%, var(--primary) 10%), 
			color-mix(in oklab, var(--surface) 95%, var(--accent-cyan) 5%));
		border: 2px solid var(--surface-border);
		border-radius: 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		position: relative;
		overflow: hidden;
	}

	.workspace-icon {
		font-size: 1.2em;
		color: var(--primary);
		filter: drop-shadow(0 0 6px rgba(46, 230, 107, 0.3));
	}

	.workspace-path {
		flex: 1;
	}

	.workspace-arrow {
		color: var(--text-muted);
		transition: transform 0.3s ease;
	}

	.workspace-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--primary) 15%, var(--surface)), 
			color-mix(in oklab, var(--primary) 8%, var(--surface)));
		border-color: var(--primary);
		box-shadow: 
			0 0 20px rgba(46, 230, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}

	.workspace-btn:hover:not(:disabled) .workspace-arrow {
		transform: translateY(2px);
		color: var(--primary);
	}

	.workspace-btn:hover:not(:disabled) .workspace-icon {
		filter: drop-shadow(0 0 10px rgba(46, 230, 107, 0.5));
		transform: scale(1.1);
	}

	.workspace-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.directory-picker-container {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%), 
			color-mix(in oklab, var(--surface) 98%, var(--accent-cyan) 2%));
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		padding: 1.5rem;
		max-height: 400px;
		overflow-y: auto;
		box-shadow: 
			0 10px 25px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.picker-header {
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--primary-dim);
	}

	.picker-title {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-shadow: 0 0 8px rgba(46, 230, 107, 0.3);
		font-size: 1.1rem;
	}

	.cancel-picker-btn {
		margin-top: 1rem;
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 80%, var(--secondary) 20%), 
			color-mix(in oklab, var(--surface) 90%, var(--secondary) 10%));
		border: 2px solid var(--secondary);
		border-radius: 0;
		color: var(--secondary);
		font-size: 0.9rem;
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.cancel-picker-btn:hover {
		background: linear-gradient(135deg, var(--secondary), #ff7b7b);
		color: var(--bg);
		box-shadow: 0 0 20px rgba(255, 107, 107, 0.4);
		transform: translateY(-1px);
	}

	.create-btn {
		padding: 1rem 1.5rem;
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		border: 2px solid var(--primary);
		border-radius: 0;
		color: var(--bg);
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		box-shadow: 
			0 0 20px rgba(46, 230, 107, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		position: relative;
		overflow: hidden;
	}

	.create-icon {
		font-size: 1.1em;
		filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
	}

	.create-btn:hover:not(:disabled) {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 
			0 0 30px rgba(46, 230, 107, 0.5),
			0 0 60px rgba(46, 230, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--primary) 110%, white 10%), 
			color-mix(in oklab, var(--accent-cyan) 110%, white 10%));
	}

	.create-btn:hover:not(:disabled) .create-icon {
		filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
		transform: scale(1.1);
	}

	.create-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Sessions Panel */
	.sessions-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%), 
			color-mix(in oklab, var(--surface) 98%, var(--accent-cyan) 2%));
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		overflow: hidden;
		box-shadow: 
			0 10px 25px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.sessions-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface-hover) 90%, var(--primary) 10%), 
			color-mix(in oklab, var(--surface-hover) 95%, var(--accent-cyan) 5%));
		border-bottom: 2px solid var(--primary-dim);
		position: relative;
	}

	.sessions-header::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--primary), transparent);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-icon {
		font-size: 1.3rem;
		color: var(--primary);
		filter: drop-shadow(0 0 8px rgba(46, 230, 107, 0.4));
	}

	.sessions-header h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text);
		text-shadow: 0 0 8px rgba(46, 230, 107, 0.2);
	}

	.count-badge {
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		color: var(--bg);
		padding: 0.3rem 0.75rem;
		border: 1px solid var(--primary);
		border-radius: 0;
		font-size: 0.8rem;
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		box-shadow: 
			0 0 15px rgba(46, 230, 107, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		text-shadow: 0 0 6px rgba(0, 0, 0, 0.3);
	}

	.sessions-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	/* Session Items */
	.session-item {
		width: 100%;
		padding: 1rem;
		margin-bottom: 0.75rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface-hover) 90%, var(--primary) 10%), 
			color-mix(in oklab, var(--surface-hover) 95%, var(--accent-cyan) 5%));
		border: 2px solid var(--surface-border);
		border-radius: 0;
		text-align: left;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		position: relative;
		overflow: hidden;
	}

	.session-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(46, 230, 107, 0.1), transparent);
		transition: left 0.5s ease;
	}

	.session-item:hover {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--primary) 20%, var(--surface-hover)), 
			color-mix(in oklab, var(--primary) 10%, var(--surface-hover)));
		border-color: var(--primary);
		box-shadow: 
			0 0 20px rgba(46, 230, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}

	.session-item:hover::before {
		left: 100%;
	}

	.session-item.selected {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--primary) 25%, var(--surface)), 
			color-mix(in oklab, var(--primary) 15%, var(--surface)));
		border-color: var(--primary);
		box-shadow: 
			0 0 0 2px var(--primary) inset,
			0 0 30px rgba(46, 230, 107, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-2px) scale(1.02);
	}

	.session-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		position: relative;
		z-index: 1;
	}

	.session-type-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		color: var(--bg);
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--primary);
		border-radius: 0;
		box-shadow: 
			0 0 10px rgba(46, 230, 107, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.session-type-badge .type-icon {
		font-size: 0.9em;
		filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
	}

	.session-type-badge .type-text {
		font-size: 0.7rem;
		font-weight: 700;
		font-family: var(--font-mono);
		letter-spacing: 0.05em;
		text-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
	}

	.session-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		background: var(--primary);
		border-radius: 50%;
		box-shadow: 0 0 8px rgba(46, 230, 107, 0.6);
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% {
			box-shadow: 0 0 8px rgba(46, 230, 107, 0.6);
		}
		50% {
			box-shadow: 0 0 15px rgba(46, 230, 107, 0.9);
		}
	}

	.session-content {
		position: relative;
		z-index: 1;
	}

	.session-title {
		font-weight: 700;
		color: var(--text);
		margin-bottom: 0.5rem;
		font-family: var(--font-mono);
		font-size: 1rem;
		text-shadow: 0 0 6px rgba(46, 230, 107, 0.2);
	}

	.session-workspace {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-muted);
		opacity: 0.9;
		font-weight: 600;
	}

	.workspace-icon-small {
		font-size: 0.9em;
		color: var(--primary);
		filter: drop-shadow(0 0 4px rgba(46, 230, 107, 0.3));
	}

	/* Status Messages */
	.status {
		padding: 2rem;
		text-align: center;
		color: var(--text-muted);
		font-style: italic;
	}

	.status.error {
		color: var(--error, #ff4444);
		font-style: normal;
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.menu-root {
			padding: 1rem;
			gap: 1rem;
		}

		.type-tabs {
			padding: 0.3rem;
		}

		.type-btn {
			padding: 0.8rem;
			font-size: 0.85rem;
			gap: 0.4rem;
		}

		.type-icon {
			font-size: 1em;
		}

		.sessions-header {
			padding: 1rem;
		}

		.header-icon {
			font-size: 1.1rem;
		}

		.sessions-header h2 {
			font-size: 1rem;
		}

		.session-item {
			padding: 0.85rem;
			margin-bottom: 0.6rem;
		}

		.session-type-badge {
			padding: 0.3rem 0.6rem;
			gap: 0.4rem;
		}

		.create-btn {
			padding: 0.9rem 1.25rem;
			gap: 0.6rem;
		}
	}
</style>
