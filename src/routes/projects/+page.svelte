<script>
	import { onDestroy, onMount } from 'svelte';
	import { io } from 'socket.io-client';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import TerminalPane from '$lib/components/TerminalPane.svelte';
	import ClaudePane from '$lib/components/ClaudePane.svelte';
	import TerminalSessionModal from '$lib/components/TerminalSessionModal.svelte';
	import ClaudeSessionModal from '$lib/components/ClaudeSessionModal.svelte';
	import { Button } from '$lib/shared/components';
	import ClaudeIcon from '$lib/shared/components/Icons/ClaudeIcon.svelte';
	import TerminalIcon from '$lib/shared/components/Icons/TerminalIcon.svelte';
	import ProjectSessionMenu from '$lib/shared/components/ProjectSessionMenu.svelte';

	let sessions = $state([]);
	let workspaces = $state([]);
	let selectedProject = $state(null);

	// Modal states
	let terminalModalOpen = $state(false);
	let claudeModalOpen = $state(false);

	// Session grid state - responsive layout
	let layoutPreset = $state('2up'); // '1up' | '2up' | '4up'
	let pinned = $state([]); // array of session IDs to display in grid order
	let currentMobileSession = $state(0); // current session index for mobile

	// Persistence keys
	const STORAGE = {
		layout: 'dispatch-projects-layout',
		pinned: 'dispatch-projects-pinned',
		mobileIndex: 'dispatch-projects-current-mobile',
		sidebar: 'dispatch-sidebar-collapsed'
	};

	// Prevent persistence effects from overwriting saved state during initial restore
	let restoring = $state(true);

	// Sidebar state
	let sidebarCollapsed = $state(false);

	// Responsive layout logic
	let isMobile = $state(false);
	let cols = $derived(isMobile ? 1 : layoutPreset === '1up' ? 1 : layoutPreset === '2up' ? 2 : 2);
	
	// Layout tracking for responsive behavior
	let previousCols = $state(cols);
	let previousMobileSession = $state(currentMobileSession);
	let mobileDirection = $state(0); // -1 for left, 1 for right
	let visible = $derived.by(() => {
		console.log('DEBUG visible derivation:', {
			sessionsCount: sessions.length,
			pinnedCount: pinned.length,
			sessions: sessions.map((s) => ({ id: s?.id, type: s?.type })),
			pinned: pinned,
			isMobile: isMobile,
			currentMobileSession: currentMobileSession
		});

		if (isMobile) {
			// Mobile: show current session from ALL sessions (not just pinned)
			const allSessions = sessions.filter(
				(s) => s && typeof s === 'object' && 'id' in s && 'type' in s
			);
			console.log('Mobile - all sessions:', allSessions.length);

			if (allSessions.length === 0) return [];

			// Ensure currentMobileSession is within bounds
			const validIndex = Math.min(currentMobileSession, allSessions.length - 1);
			const result = allSessions.slice(validIndex, validIndex + 1);
			console.log('Mobile result:', result.length, 'index:', validIndex);
			return result;
		} else {
			// Desktop: show based on layout preset and pinned sessions
			const pinnedSessions = pinned
				.map((id) => {
					const found = sessions.find((s) => s && s.id === id);
					console.log('Looking for session ID:', id, 'found:', !!found, found?.type);
					return found;
				})
				.filter(Boolean);

			console.log('Pinned sessions found:', pinnedSessions.length);

			const maxSessions = layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1;
			const result = pinnedSessions.slice(0, maxSessions);
			console.log('Desktop result:', result.length, 'maxSessions:', maxSessions);
			return result;
		}
	});
	
	// Track layout and mobile session changes
	$effect(() => {
		previousCols = cols;
		
		// Track mobile session direction for animations
		if (isMobile && currentMobileSession !== previousMobileSession) {
			mobileDirection = currentMobileSession > previousMobileSession ? 1 : -1;
			previousMobileSession = currentMobileSession;
		}
	});

	async function listWorkspaces() {
		try {
			const r = await fetch('/api/workspaces');
			if (!r.ok) {
				console.error('Failed to load workspaces:', r.status, r.statusText);
				return [];
			}
			const j = await r.json();
			return j.list || [];
		} catch (error) {
			console.error('Error loading workspaces:', error);
			return [];
		}
	}

	async function loadSessions() {
		try {
			const r = await fetch('/api/sessions');
			if (!r.ok) {
				console.error('Failed to load sessions:', r.status, r.statusText);
				return [];
			}
			const j = await r.json();
			return j.sessions || [];
		} catch (error) {
			console.error('Error loading sessions:', error);
			return [];
		}
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
					const maxVisible = isMobile
						? 1
						: layoutPreset === '4up'
							? 4
							: layoutPreset === '2up'
								? 2
								: 1;
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

	async function createClaudeSession({ workspacePath, sessionId, projectName, resumeSession, createWorkspace = false }) {
		// For new workspaces, construct the proper path using WORKSPACES_ROOT
		let actualWorkspacePath = workspacePath;
		if (createWorkspace) {
			// The backend will construct the full path using WORKSPACES_ROOT
			actualWorkspacePath = workspacePath; // Just the project name for new workspaces
		}
		
		// Ensure workspace exists
		const workspaceResponse = await fetch('/api/workspaces', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ 
				action: createWorkspace ? 'create' : 'open', 
				path: actualWorkspacePath,
				isNewProject: createWorkspace 
			})
		});
		
		const workspaceData = await workspaceResponse.json();
		const finalWorkspacePath = workspaceData.path;

		// Create Claude session via API
		const r = await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				type: 'claude',
				workspacePath: finalWorkspacePath,
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

		const { id, sessionId: claudeSessionId } = await r.json();
		const s = { 
			id, 
			type: 'claude', 
			workspacePath, 
			projectName,
			claudeSessionId,
			shouldResume: true
		};
		sessions = [...sessions, s];
		// auto-pin newest into grid if there's room
		const maxVisible = isMobile ? 1 : layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1;
		if (pinned.length < maxVisible) {
			pinned = [...pinned, id];
		}
	}

	function togglePin(id) {
		pinned = pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id];
	}

	// Mobile session navigation
	function nextMobileSession() {
		const allSessions = sessions.filter(
			(s) => s && typeof s === 'object' && 'id' in s && 'type' in s
		);
		if (currentMobileSession < allSessions.length - 1) {
			mobileDirection = 1; // Set direction before changing session
			currentMobileSession++;
		}
	}

	function prevMobileSession() {
		if (currentMobileSession > 0) {
			mobileDirection = -1; // Set direction before changing session
			currentMobileSession--;
		}
	}

	// Jump to specific session (for mobile session list)
	function jumpToSession(sessionIndex) {
		const allSessions = sessions.filter(
			(s) => s && typeof s === 'object' && 'id' in s && 'type' in s
		);
		if (sessionIndex >= 0 && sessionIndex < allSessions.length) {
			mobileDirection = sessionIndex > currentMobileSession ? 1 : -1;
			currentMobileSession = sessionIndex;
		}
	}

	// Responsive detection
	function updateMobileState() {
		isMobile = window.innerWidth <= 768;
		if (isMobile) {
			// Reset to first session when switching to mobile
			currentMobileSession = 0;
		}

		// On very small screens, collapse sidebar by default
		if (window.innerWidth <= 480) {
			sidebarCollapsed = true;
		}
	}

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
		// Persist sidebar state
		localStorage.setItem(STORAGE.sidebar, sidebarCollapsed.toString());
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

		// Load saved sidebar state
		const savedSidebarState = localStorage.getItem(STORAGE.sidebar);
		if (savedSidebarState) {
			sidebarCollapsed = savedSidebarState === 'true';
		}

		// Restore layout preset
		const savedLayout = localStorage.getItem(STORAGE.layout);
		if (savedLayout && ['1up', '2up', '4up'].includes(savedLayout)) {
			layoutPreset = savedLayout;
		}

		// Restore pinned order exactly as saved (do not filter — avoid wiping on load)
		try {
			const rawPinned = localStorage.getItem(STORAGE.pinned);
			if (rawPinned) {
				const savedPinned = JSON.parse(rawPinned);
				if (Array.isArray(savedPinned)) {
					pinned = savedPinned;
				}
			}
		} catch (e) {
			console.warn('Failed to restore pinned sessions:', e);
		}

		// Restore mobile session index
		const savedMobileIndex = Number.parseInt(localStorage.getItem(STORAGE.mobileIndex) || '0', 10);
		if (!Number.isNaN(savedMobileIndex)) {
			const maxIdx = Math.max(
				0,
				sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length - 1
			);
			currentMobileSession = Math.min(savedMobileIndex, maxIdx);
		}

		// Finished restoring; allow persistence effects to run
		restoring = false;
	});

onDestroy(() => {
		// Clean up any resources if needed
		window.removeEventListener('resize', updateMobileState);
	});

	// Persist key UI state
	$effect(() => {
		if (restoring) return;
		try {
			if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.layout, layoutPreset);
		} catch {}
	});

	$effect(() => {
		if (restoring) return;
		try {
			if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.pinned, JSON.stringify(pinned));
		} catch {}
	});

	$effect(() => {
		if (restoring) return;
		try {
			if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.mobileIndex, String(currentMobileSession));
		} catch {}
	});
</script>

<div class="dispatch-workspace" class:sidebar-collapsed={sidebarCollapsed}>
	<!-- Compact Header -->
	<header class="header">
		<div class="header-brand">
			<span class="brand-icon">
				<img src="/favicon.png" alt="Dispatch" height="32" />
			</span>
			<span class="brand-text">Dispatch</span>
		</div>

		<!-- Sidebar toggle -->
		<Button
			onclick={toggleSidebar}
			text=""
			variant="ghost"
			size="small"
			augmented="tl-clip br-clip both"
			ariaLabel={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			class="sidebar-toggle"
		>
			{#snippet icon()}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					{#if sidebarCollapsed}
						<path d="M9 18l6-6-6-6"/>
					{:else}
						<path d="M15 18l-6-6 6-6"/>
					{/if}
				</svg>
			{/snippet}
		</Button>

		<div class="header-actions">
			<Button
				onclick={() => (terminalModalOpen = true)}
				text=""
				variant="ghost"
				size="small"
				augmented="tl-clip br-clip both"
				ariaLabel="Create terminal session"
			>
				{#snippet icon()}
					<TerminalIcon />
				{/snippet}
			</Button>
			<Button
				onclick={() => (claudeModalOpen = true)}
				text=""
				variant="ghost"
				size="small"
				augmented="tl-clip br-clip both"
				ariaLabel="Create claude session"
			>
				{#snippet icon()}
					<ClaudeIcon />
				{/snippet}
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
						class={layoutPreset === preset ? 'active' : ''}
						size="small"
						augmented="tl-clip br-clip both"
					>
						{preset}
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
					{#snippet children()}&lt;{/snippet}
				</Button>
				<span class="session-counter">
					{currentMobileSession + 1} / {sessions.filter(
						(s) => s && typeof s === 'object' && 'id' in s && 'type' in s
					).length}
				</span>
				<Button
					onclick={nextMobileSession}
					text="→"
					variant="ghost"
					size="small"
					augmented="br-clip both"
					disabled={currentMobileSession >=
						sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length -
							1}
				>
					{#snippet icon()}{/snippet}
				</Button>
			</div>
		{/if}
	</header>

	<!-- Session Management Sidebar -->
	<aside class="sidebar" class:collapsed={sidebarCollapsed}>
		<ProjectSessionMenu 
			storagePrefix="dispatch-projects" 
			bind:selectedProject
			on:sessionSelected={(e) => {
				const sessionId = e.detail?.id;
				if (!sessionId) return;
				const projectName = selectedProject || 'project';
				createClaudeSession({
					workspacePath: projectName,
					sessionId,
					projectName,
					resumeSession: true,
					createWorkspace: true
				});
			}}
		/>
	</aside>

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
				{#each visible as s, index (s.id)}
					{#if s && typeof s === 'object' && 'id' in s && 'type' in s}
						<div 
							class="terminal-container" 
							style="--animation-index: {index};"
							in:fly|global={isMobile 
								? { x: mobileDirection * 60, duration: 350, easing: cubicOut }
								: { y: 20, duration: 400, delay: index * 60, easing: cubicOut }
							}
							out:fly|global={isMobile 
								? { x: mobileDirection * -60, duration: 300, easing: cubicOut }
								: { y: -20, duration: 300, delay: index * 40, easing: cubicOut }
							}
						>
							<div class="terminal-header">
								<div class="terminal-status">
									<span class="status-dot"></span>
									<span class="terminal-type">{s.type === 'claude' ? 'Claude' : 'Terminal'}</span>
								</div>
								<div class="terminal-info">Session {s.id.slice(0, 6)}</div>
							</div>
							<div class="terminal-viewport">
								{#if s.type === 'pty'}
									<TerminalPane 
										ptyId={s.id} 
										shouldResume={s.resumeSession || false}
										workspacePath={s.workspacePath}
									/>
								{:else}
									<ClaudePane 
										sessionId={s.claudeSessionId || s.sessionId || s.id} 
										claudeSessionId={s.claudeSessionId || s.sessionId}
										shouldResume={s.resumeSession || false}
									/>
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
		position: relative;
		height: 100vh;
		display: grid;
		grid-template-columns: 30svw 1fr;
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'header header'
			'sidebar main';
		background: var(--bg-dark);
		color: var(--text-primary);
		overflow: hidden;
		transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Collapsed sidebar layout */
	.dispatch-workspace.sidebar-collapsed {
		grid-template-columns: 0px 1fr;
	}

	/* ========================================
	   COMPACT HEADER - MINIMAL HEIGHT
	   ======================================== */
	.header {
		grid-area: header;
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3);
		background: var(--bg-panel);
		border-bottom: 1px solid var(--primary-dim);
		min-height: 50px; /* Minimal header height */
		flex-shrink: 0;
	}

	.header-brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-family: var(--font-accent);
		font-weight: 700;
	}

	.brand-icon {
		font-size: 1.25rem;
		color: var(--primary);
		filter: drop-shadow(0 0 5px var(--primary-glow));
		justify-content: center;
		display: flex;
	}

	.brand-text {
		color: var(--primary);
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.header-actions {
		display: flex;
		gap: var(--space-3);
	}

	.header-layout {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-3);
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
		gap: var(--space-3);
		margin-left: auto;
	}

	/* Sidebar toggle button */
	:global(.sidebar-toggle) {
		font-family: var(--font-mono) !important;
		font-size: 0.875rem !important;
		min-width: 2rem !important;
		padding: var(--space-2) !important;
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
		width: 100%;
		background: var(--bg-panel);
		border-right: 1px solid var(--primary-dim);
		padding: var(--space-3);
		overflow: hidden;
		flex-shrink: 0;
		height: 100%;
		opacity: 1;
		transform: translateX(0);
		transition:
			opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.sidebar.collapsed {
		opacity: 0;
		transform: translateX(-100%);
		pointer-events: none;
	}



	/* ========================================
	   MAXIMUM WORKSPACE AREA
	   ======================================== */
	.main-content {
		grid-area: main;
		overflow: hidden;
		position: relative;
	}

	/* Mobile main content - smooth grid-based sliding */
	@media (max-width: 768px) {
		.main-content {
			min-height: 0; /* Important for grid fr units */
			overflow: hidden; /* Hide content during slide animation */
		}
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
		gap: var(--space-2); /* Consistent minimal gaps */
		height: 100%;
		overflow: hidden;
		padding: var(--space-2);
		
		/* NO grid transition - instant layout change to prevent snapping */
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
		
		/* Simple transitions for hover states */
		transition: border-color 0.2s ease;
	}
	
	.terminal-container:hover {
		border-color: var(--primary);
	}
	
	/* Mobile session switching with modern CSS */
	@media (max-width: 768px) {
		.terminal-container {
			transition: 
				transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94),
				opacity 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94),
				box-shadow 0.2s ease,
				border-color 0.2s ease;
			transition-behavior: allow-discrete;
		}
		
		/* Mobile starting style - slide from right */
		@starting-style {
			.terminal-container {
				opacity: 0;
				transform: translateX(24px) scale(0.97);
			}
		}
	}
	
	/* Desktop layout change transitions */
	@media (min-width: 769px) {
		.session-grid {
			/* Instant grid layout - no transition to prevent snapping */
		}
		
		.terminal-container {
			/* Only animate the containers themselves, not the grid */
			transition: 
				transform 0.5s cubic-bezier(0.23, 1, 0.32, 1),
				opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1),
				box-shadow 0.2s ease,
				border-color 0.2s ease;
		}
	}
	
	/* Accessibility: reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.terminal-container {
			transition: opacity 0.2s ease;
		}
		
		.terminal-container:hover {
			transform: none !important;
			box-shadow: none !important;
		}
		
		.session-grid {
			transition: none;
		}
		
		@starting-style {
			.terminal-container {
				opacity: 0;
				transform: none;
			}
		}
	}

	.terminal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: linear-gradient(135deg, var(--bg-dark), var(--bg-panel));
		border-bottom: 1px solid var(--primary-dim);
		min-height: 32px; /* Minimal header height */
		flex-shrink: 0;
	}

	.terminal-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
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
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
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
			grid-template-columns: 1fr !important;
			grid-template-rows: auto 1fr 1fr;
			grid-template-areas:
				'header'
				'sidebar'
				'main';
			/* Smooth grid transitions on mobile */
			transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
			height: 100vh;
			overflow: hidden;
		}

		/* On mobile, sidebar collapse means hiding sidebar, main takes full space */
		.dispatch-workspace.sidebar-collapsed {
			grid-template-rows: auto 0fr 1fr;
			grid-template-areas:
				'header'
				'sidebar'
				'main';
		}

		/* When sidebar is open, main content slides down */
		.dispatch-workspace:not(.sidebar-collapsed) {
			grid-template-rows: auto 1fr 0fr;
			grid-template-areas:
				'header'
				'sidebar'
				'main';
		}

		.header {
			flex-wrap: wrap;
			min-height: auto;
			gap: var(--space-3);
			padding: var(--space-2);
		}

		.header-layout {
			margin-left: 0;
			order: 3;
			flex-basis: 100%;
			justify-content: center;
		}

		.sidebar {
			width: 100%;
			min-height: 0; /* Important for grid fr units */
			padding: var(--space-4);
			border-bottom: 1px solid var(--primary-dim);
			overflow: hidden; /* Hide content that would overflow during animation */
			display: flex;
			flex-direction: column;
		}

		.sidebar.collapsed {
			/* When collapsed, sidebar shrinks to 0 height via grid animation */
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

	/* Very small screens - keep sidebar toggle but hide sidebar by default */
	@media (max-width: 480px) {
		.dispatch-workspace {
			grid-template-rows: min-content 0px auto !important;
			grid-template-areas:
				'header'
				'sidebar'
				'main' !important;
			transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		}

		/* Force sidebar collapsed by default on very small screens */
		.dispatch-workspace:not(.sidebar-collapsed) {
			grid-template-rows: min-content auto 0px !important;
			grid-template-areas:
				'header'
				'sidebar'
				'main' !important;
			transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
			main {
				opacity: 0;
			}
		}

		.sidebar {
			/* Don't force hide - let the collapse state control visibility */

			overflow-y: auto;
		}
	}

	/* ========================================
	   ACCESSIBILITY & PERFORMANCE
	   ======================================== */
	@media (prefers-reduced-motion: reduce) {
		.status-dot {
			animation: none;
		}
	}

	/* Focus management: removed old sidebar session-item styles */

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
