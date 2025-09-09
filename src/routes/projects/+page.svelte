<script>
	import { onMount } from 'svelte';
	import { io } from 'socket.io-client';
	import TerminalPane from '$lib/components/TerminalPane.svelte';
	import ClaudePane from '$lib/components/ClaudePane.svelte';
	import TerminalSessionModal from '$lib/components/TerminalSessionModal.svelte';
	import ClaudeSessionModal from '$lib/components/ClaudeSessionModal.svelte';
	import { Button } from '$lib/shared/components';

	let sessions = $state([]);
	let workspaces = $state([]);

	// Modal states
	let terminalModalOpen = $state(false);
	let claudeModalOpen = $state(false);

	// Session grid state - responsive layout
	let layoutPreset = $state('2up'); // '1up' | '2up' | '4up'
	let pinned = $state([]); // array of session IDs to display in grid order
	let currentMobileSession = $state(0); // current session index for mobile
	
	// Responsive layout logic
	let isMobile = $state(false);
	let cols = $derived(isMobile ? 1 : (layoutPreset === '1up' ? 1 : layoutPreset === '2up' ? 2 : 2));
	let visible = $derived.by(() => {
		console.log('DEBUG visible derivation:', {
			sessionsCount: sessions.length,
			pinnedCount: pinned.length,
			sessions: sessions.map(s => ({ id: s?.id, type: s?.type })),
			pinned: pinned
		});
		
		// Simple approach: just get all pinned sessions that exist
		const pinnedSessions = pinned
			.map((id) => {
				const found = sessions.find((s) => s && s.id === id);
				console.log('Looking for session ID:', id, 'found:', !!found, found?.type);
				return found;
			})
			.filter(Boolean);
		
		console.log('Pinned sessions found:', pinnedSessions.length);
		
		if (isMobile) {
			// Mobile: show only current session
			const result = pinnedSessions.slice(currentMobileSession, currentMobileSession + 1);
			console.log('Mobile result:', result.length);
			return result;
		} else {
			// Desktop: show based on layout preset
			const maxSessions = layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1;
			const result = pinnedSessions.slice(0, maxSessions);
			console.log('Desktop result:', result.length, 'maxSessions:', maxSessions);
			return result;
		}
	});

	async function listWorkspaces() {
		const r = await fetch('/api/workspaces');
		const j = await r.json();
		return j.list;
	}

	async function loadSessions() {
		const r = await fetch('/api/sessions');
		const j = await r.json();
		return j.sessions;
	}

	async function createTerminalSession(workspacePath) {
		// Ensure workspace exists
		await fetch('/api/workspaces', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'open', path: workspacePath })
		});

		// Create terminal via Socket.IO
		const socket = io();
		const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';

		return new Promise((resolve, reject) => {
			socket.emit('terminal.start', { key, workspacePath }, (response) => {
				if (response.success) {
					const s = { id: response.id, type: 'pty', workspacePath };
					sessions = [...sessions, s];
					// auto-pin newest into grid if there's room
					const maxVisible = isMobile ? 1 : (layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1);
					if (pinned.length < maxVisible) {
						pinned = [...pinned, response.id];
					}
					resolve();
				} else {
					console.error('Failed to create terminal:', response.error);
					reject(new Error(response.error));
				}
				socket.disconnect();
			});
		});
	}

	async function createClaudeSession({ workspacePath, sessionId, projectName, resumeSession }) {
		// Ensure workspace exists
		await fetch('/api/workspaces', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'open', path: workspacePath })
		});

		// Create Claude session via API
		const r = await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				type: 'claude',
				workspacePath,
				options: {
					sessionId,
					projectName,
					resumeSession
				}
			})
		});

		if (!r.ok) {
			throw new Error(`Failed to create Claude session: ${r.statusText}`);
		}

		const { id } = await r.json();
		const s = { id, type: 'claude', workspacePath };
		sessions = [...sessions, s];
		// auto-pin newest into grid if there's room
		const maxVisible = isMobile ? 1 : (layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1);
		if (pinned.length < maxVisible) {
			pinned = [...pinned, id];
		}
	}

	function togglePin(id) {
		pinned = pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id];
	}

	// Mobile session navigation
	function nextMobileSession() {
		const maxSessions = pinned.filter(id => sessions.find(s => s.id === id)).length;
		if (currentMobileSession < maxSessions - 1) {
			currentMobileSession++;
		}
	}

	function prevMobileSession() {
		if (currentMobileSession > 0) {
			currentMobileSession--;
		}
	}

	// Responsive detection
	function updateMobileState() {
		isMobile = window.innerWidth <= 768;
		if (isMobile) {
			// Reset to first session when switching to mobile
			currentMobileSession = 0;
		}
	}

	onMount(async () => {
		try {
			workspaces = await listWorkspaces();
			sessions = await loadSessions();
		} catch (error) {
			console.error('Failed to load initial data:', error);
			// Continue with empty arrays if API fails
			workspaces = [];
			sessions = [];
		}
		
		// Initialize responsive state
		updateMobileState();
		window.addEventListener('resize', updateMobileState);
		
		return () => {
			window.removeEventListener('resize', updateMobileState);
		};
	});
</script>

<div class="dispatch-workspace">
	<!-- Compact Header -->
	<header class="header">
		<div class="header-brand">
			<span class="brand-icon">⚡</span>
			<span class="brand-text">Dispatch</span>
		</div>
		
		<div class="header-actions">
			<Button 
				onclick={() => (terminalModalOpen = true)} 
				text="Terminal" 
				variant="primary"
				size="small"
				augmented="tl-clip br-clip both"
			>
				{#snippet icon()}⚡{/snippet}
				{#snippet children()}{/snippet}
			</Button>
			<Button 
				onclick={() => (claudeModalOpen = true)} 
				text="Claude" 
				variant="secondary"
				size="small"
				augmented="tr-clip bl-clip both"
			>
				{#snippet icon()}🤖{/snippet}
				{#snippet children()}{/snippet}
			</Button>
		</div>

		<!-- Layout controls for desktop only -->
		{#if !isMobile}
			<div class="header-layout">
				<span class="layout-label">Layout:</span>
				{#each ['1up', '2up', '4up'] as preset}
					<Button
						onclick={() => (layoutPreset = preset)}
						text={preset}
						variant={layoutPreset === preset ? 'primary' : 'ghost'}
						size="small"
						augmented="tl-clip br-clip both"
					>
						{#snippet icon()}{/snippet}
						{#snippet children()}{/snippet}
					</Button>
				{/each}
			</div>
		{/if}
		
		<!-- Mobile session navigation -->
		{#if isMobile && visible.length > 0}
			<div class="mobile-session-nav">
				<Button
					onclick={prevMobileSession}
					text="←"
					variant="ghost"
					size="small"
					augmented="tl-clip both"
					disabled={currentMobileSession === 0}
				>
					{#snippet icon()}{/snippet}
					{#snippet children()}{/snippet}
				</Button>
				<span class="session-counter">
					{currentMobileSession + 1} / {pinned.filter(id => sessions.find(s => s.id === id)).length}
				</span>
				<Button
					onclick={nextMobileSession}
					text="→"
					variant="ghost"
					size="small"
					augmented="br-clip both"
					disabled={currentMobileSession >= pinned.filter(id => sessions.find(s => s.id === id)).length - 1}
				>
					{#snippet icon()}{/snippet}
					{#snippet children()}{/snippet}
				</Button>
			</div>
		{/if}
	</header>

	<!-- Session Management Sidebar -->
	{#if sessions.length > 0}
		<aside class="sidebar">
			<h3 class="sidebar-title">Sessions ({sessions.length})</h3>
			<div class="session-list">
				{#each sessions as s}
					{#if s && typeof s === 'object' && 'id' in s && 'type' in s}
						<button
							class="session-item {pinned.includes(s.id) ? 'pinned' : ''}"
							onclick={() => togglePin(s.id)}
						>
							<span class="session-type">{s.type === 'claude' ? '🤖' : '⚡'}</span>
							<span class="session-id">{s.id.slice(0, 8)}</span>
							<span class="session-status">{pinned.includes(s.id) ? '📌' : '○'}</span>
						</button>
					{/if}
				{/each}
			</div>
		</aside>
	{/if}

	<!-- Main Workspace -->
	<main class="main-content" style={`--cols: ${cols};`}>
		{#if visible.length === 0}
			<div class="empty-workspace">
				<div class="empty-content">
					<div class="empty-icon">🚀</div>
					<h2>Ready to Code</h2>
					<p>Create a terminal or Claude session to get started</p>
				</div>
			</div>
		{:else}
			<div class="session-grid">
				{#each visible as s}
					{#if s && typeof s === 'object' && 'id' in s && 'type' in s}
						<div class="terminal-container">
							<div class="terminal-header">
								<div class="terminal-status">
									<span class="status-dot"></span>
									<span class="terminal-type">{s.type === 'claude' ? 'Claude' : 'Terminal'}</span>
								</div>
								<div class="terminal-info">Session {s.id.slice(0, 6)}</div>
							</div>
							<div class="terminal-viewport">
								{#if s.type === 'pty'}
									<TerminalPane ptyId={s.id} />
								{:else}
									<ClaudePane sessionId={s.id} />
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Modals -->
<TerminalSessionModal
	bind:open={terminalModalOpen}
	{workspaces}
	onSessionCreate={createTerminalSession}
/>

<ClaudeSessionModal bind:open={claudeModalOpen} onSessionCreate={createClaudeSession} />

<style>
	/* Maximum Screen Space Utilization for Developers */
	
	.dispatch-workspace {
		height: 100vh;
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto 1fr;
		grid-template-areas: 
			"header header"
			"sidebar main";
		background: var(--bg-dark);
		color: var(--text-primary);
		overflow: hidden;
	}

	/* ========================================
	   COMPACT HEADER - MINIMAL HEIGHT
	   ======================================== */
	.header {
		grid-area: header;
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		background: var(--bg-panel);
		border-bottom: 1px solid var(--primary-dim);
		min-height: 50px; /* Minimal header height */
		flex-shrink: 0;
	}

	.header-brand {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-accent);
		font-weight: 700;
	}

	.brand-icon {
		font-size: 1.25rem;
		color: var(--primary);
		filter: drop-shadow(0 0 5px var(--primary-glow));
	}

	.brand-text {
		color: var(--primary);
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.header-actions {
		display: flex;
		gap: var(--space-2);
	}

	.header-layout {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.layout-label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mobile-session-nav {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}

	.session-counter {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		min-width: 40px;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* ========================================
	   COMPACT SIDEBAR - ONLY WHEN NEEDED
	   ======================================== */
	.sidebar {
		grid-area: sidebar;
		width: 200px;
		background: var(--bg-panel);
		border-right: 1px solid var(--primary-dim);
		padding: var(--space-3);
		overflow-y: auto;
		flex-shrink: 0;
	}

	.sidebar-title {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin: 0 0 var(--space-3) 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.session-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.session-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: 100%;
	}

	.session-item:hover {
		background: rgba(46, 230, 107, 0.1);
		border-color: var(--primary-dim);
		color: var(--text-primary);
	}

	.session-item.pinned {
		background: rgba(46, 230, 107, 0.15);
		border-color: var(--primary);
		color: var(--primary);
	}

	.session-type {
		font-size: 1rem;
		min-width: 1.25rem;
	}

	.session-id {
		flex: 1;
		font-weight: 600;
	}

	.session-status {
		min-width: 1.25rem;
		text-align: center;
	}

	/* ========================================
	   MAXIMUM WORKSPACE AREA
	   ======================================== */
	.main-content {
		grid-area: main;
		overflow: hidden;
		position: relative;
	}

	.empty-workspace {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.empty-content {
		text-align: center;
		color: var(--text-muted);
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: var(--space-3);
	}

	.empty-content h2 {
		font-family: var(--font-mono);
		color: var(--text-secondary);
		margin: 0 0 var(--space-2) 0;
		font-size: 1.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.empty-content p {
		margin: 0;
		font-size: 0.875rem;
	}

	.session-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: 2px; /* Minimal gaps for maximum space */
		height: 100%;
		overflow: hidden;
	}

	/* ========================================
	   TERMINAL CONTAINERS - MAXIMUM SPACE
	   ======================================== */
	.terminal-container {
		display: flex;
		flex-direction: column;
		background: var(--bg-panel);
		border: 1px solid var(--primary-dim);
		overflow: hidden;
	}

	.terminal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-3);
		background: linear-gradient(135deg, var(--bg-dark), var(--bg-panel));
		border-bottom: 1px solid var(--primary-dim);
		min-height: 32px; /* Minimal header height */
		flex-shrink: 0;
	}

	.terminal-status {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 4px var(--primary-glow);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	.terminal-type {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.terminal-info {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.terminal-viewport {
		flex: 1;
		overflow: hidden;
		background: var(--bg-dark);
		min-height: 0; /* Important for flex child */
	}

	/* ========================================
	   RESPONSIVE - MOBILE STILL FUNCTIONAL
	   ======================================== */
	@media (max-width: 768px) {
		.dispatch-workspace {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto 1fr;
			grid-template-areas: 
				"header"
				"sidebar"
				"main";
		}

		.header {
			flex-wrap: wrap;
			min-height: auto;
			gap: var(--space-2);
		}

		.header-layout {
			margin-left: 0;
			order: 3;
			flex-basis: 100%;
			justify-content: center;
		}

		.sidebar {
			width: auto;
			max-height: 150px;
			padding: var(--space-2);
		}

		.session-list {
			flex-direction: row;
			flex-wrap: wrap;
			gap: var(--space-1);
		}

		.session-item {
			flex: 0 0 auto;
			min-width: 80px;
		}

		.session-grid {
			grid-template-columns: 1fr !important;
		}

		.terminal-header {
			padding: var(--space-2);
		}

		.brand-text {
			display: none; /* Save space on mobile */
		}
	}

	/* Very small screens - hide sidebar by default */
	@media (max-width: 480px) {
		.dispatch-workspace {
			grid-template-rows: auto 1fr;
			grid-template-areas: 
				"header"
				"main";
		}

		.sidebar {
			display: none;
		}
	}

	/* ========================================
	   ACCESSIBILITY & PERFORMANCE
	   ======================================== */
	@media (prefers-reduced-motion: reduce) {
		.status-dot {
			animation: none;
		}

		.session-item {
			transition: none;
		}
	}

	/* Focus management */
	.session-item:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* High DPI displays - optimize for developer monitors */
	@media (min-resolution: 144dpi) {
		.terminal-header {
			min-height: 28px;
		}
		
		.header {
			min-height: 45px;
		}
	}
</style>