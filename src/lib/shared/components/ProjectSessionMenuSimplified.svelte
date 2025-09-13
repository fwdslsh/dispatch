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
	<div class="btn-group" data-augmented-ui="tl-clip tr-clip bl-clip br-clip both">
		<Button
			variant="ghost"
			augmented="tl-clip br-clip both"
			class={sessionType === 'claude' ? 'active' : ''}
			onclick={() => changeType('claude')}
		>
			{#snippet icon()}<IconRobot size={18} />{/snippet}
			Claude
		</Button>
		<Button
			variant="ghost"
			augmented="tl-clip br-clip both"
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

	/* Create Section */
	.create-section {
		display: flex;
		gap: 1rem;
		flex-direction: column;
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
		width: 100%;
	}

	.create-btn {
		width: 100%;
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

		.sessions-header {
			padding: 1rem;
		}

		.header-icon {
			font-size: 1.1rem;
		}

		.sessions-header h2 {
			font-size: 1rem;
		}
	}
</style>
