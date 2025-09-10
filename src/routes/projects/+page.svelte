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
	import ProjectSessionMenu from '$lib/shared/components/ProjectSessionMenu.svelte';

	let sessions = $state([]);
	let workspaces = $state([]);
	let selectedProject = $state(null);

	// Modal states
	let terminalModalOpen = $state(false);
	let claudeModalOpen = $state(false);

	// Session grid state - responsive layout
	let layoutPreset = $state('2up'); // '1up' | '2up' | '4up'
	let displayed = $state([]); // array of session IDs to display in grid order (replaces pinned)
	let currentMobileSession = $state(0); // current session index for mobile

	// Persistence keys
	const STORAGE = {
		layout: 'dispatch-projects-layout',
		mobileIndex: 'dispatch-projects-current-mobile'
	};

	// Prevent persistence effects from overwriting saved state during initial restore
	let restoring = $state(true);

	// Bottom sheet state
	let sessionMenuOpen = $state(false);

	// Responsive layout logic
	let isMobile = $state(false);
	let cols = $derived(isMobile ? 1 : layoutPreset === '1up' ? 1 : layoutPreset === '2up' ? 2 : 2);
	const maxVisible = $derived(isMobile ? 1 : layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1);
	
	// Layout tracking for responsive behavior
	let previousCols = $state(cols);
	let previousMobileSession = $state(currentMobileSession);
	let mobileDirection = $state(0); // -1 for left, 1 for right
	let visible = $derived.by(() => {
		console.log('DEBUG visible derivation:', {
			sessionsCount: sessions.length,
			displayedCount: displayed.length,
			sessions: sessions.map((s) => ({ id: s?.id, type: s?.type })),
			displayed,
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
			// Desktop: map displayed slots to sessions
			const ids = displayed.slice(0, maxVisible);
			const result = ids
				.map((id) => sessions.find((s) => s && s.id === id))
				.filter(Boolean);
			console.log('Desktop result:', result.length, 'maxVisible:', maxVisible);
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

	function updateDisplayedWithSession(sessionId) {
		if (isMobile) {
			const allSessions = sessions.filter((s) => s && s.id);
			const idx = allSessions.findIndex((s) => s.id === sessionId);
			if (idx !== -1) currentMobileSession = idx;
			return;
		}
		const without = displayed.filter((id) => id !== sessionId);
		const head = without.slice(0, Math.max(0, maxVisible - 1));
		displayed = [...head, sessionId];
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
					updateDisplayedWithSession(response.id);
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
		updateDisplayedWithSession(id);
	}

	// Pinning removed — display is controlled by displayed[]

	// Mobile session navigation
	function nextMobileSession() {
		const allSessions = sessions.filter(
			(s) => s && typeof s === 'object' && 'id' in s && 'type' in s
		);
		if (allSessions.length === 0) return;
		currentMobileSession = (currentMobileSession + 1) % allSessions.length;
	}

	function prevMobileSession() {
		const allSessions = sessions.filter(
			(s) => s && typeof s === 'object' && 'id' in s && 'type' in s
		);
		if (allSessions.length === 0) return;
		currentMobileSession = (currentMobileSession - 1 + allSessions.length) % allSessions.length;
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
		const nowMobile = window.innerWidth <= 768;
		// Only act on transition between desktop and mobile; don't reset index on every resize
		if (nowMobile !== isMobile) {
			// Preserve currentMobileSession; avoid resetting to 0 to prevent jumps when virtual keyboard opens
		}
		isMobile = nowMobile;

	}

	function toggleSessionMenu() { sessionMenuOpen = !sessionMenuOpen; }

	async function resumeTerminalSession({ terminalId, workspacePath }) {
		try {
			const r = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					type: 'pty',
					workspacePath,
					options: { resumeSession: true, terminalId }
				})
			});
			if (!r.ok) throw new Error('Failed to resume terminal');
			const { id } = await r.json();
			const s = { id, type: 'pty', workspacePath, resumeSession: true };
			sessions = [...sessions, s];
			updateDisplayedWithSession(id);
		} catch (e) {
			console.error('Error resuming terminal session:', e);
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

		// Initialize displayed slots once after initial load
		try {
			const ids = sessions.filter((s) => s && s.id).map((s) => s.id);
			if (!isMobile && ids.length > 0) {
				const desired = ids.slice(0, Math.max(1, maxVisible));
				displayed = desired;
			}
		} catch {}

		// Initialize responsive state
		updateMobileState();
		window.addEventListener('resize', updateMobileState);

		// no sidebar state

		// Restore layout preset
		const savedLayout = localStorage.getItem(STORAGE.layout);
		if (savedLayout && ['1up', '2up', '4up'].includes(savedLayout)) {
			layoutPreset = savedLayout;
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

	// Keep displayed slots within bounds when layout changes (prune only)
	$effect(() => {
		if (isMobile) return; // mobile uses currentMobileSession
		maxVisible; // dependency on layout
		if (displayed.length > maxVisible) {
			const next = displayed.slice(Math.max(0, displayed.length - maxVisible));
			if (next.length !== displayed.length) displayed = next;
		}
	});

	$effect(() => {
		if (restoring) return;
		try {
			if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.mobileIndex, String(currentMobileSession));
		} catch {}
	});
</script>

<div class="dispatch-workspace">
	<!-- Compact Header -->
	<header class="header">
		<div class="header-brand">
			<span class="brand-icon">
				<img src="/favicon.png" alt="Dispatch" height="32" />
			</span>
			<span class="brand-text">Dispatch</span>
		</div>

		<!-- Sessions toggle moved to status bar -->

		<div class="header-actions"></div>

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

		<!-- Mobile session navigation moved to bottom bar -->
	</header>

	<!-- Bottom sheet for sessions -->
	{#if sessionMenuOpen}
		<div class="session-sheet-backdrop" onclick={() => (sessionMenuOpen = false)}></div>
		<div class="session-sheet" role="dialog" aria-label="Sessions">
			<div class="sheet-header">
				<div class="sheet-title">Sessions</div>
				<button class="sheet-close" onclick={() => (sessionMenuOpen = false)} aria-label="Close">✕</button>
			</div>
			<div class="sheet-body">
				<ProjectSessionMenu 
					storagePrefix="dispatch-projects" 
					bind:selectedProject
					onNewSession={(e) => {
						const { type } = e.detail || {};
						if (type === 'claude') {
							claudeModalOpen = true;
						} else if (type === 'pty') {
							terminalModalOpen = true;
						}
					}}
					onSessionSelected={(e) => {
						const detail = e.detail || {};
						if (!detail.id) return;
						// If already running, just show it immediately
						const existing = sessions.find((s) => {
							if (!s) return false;
							if (detail.type === 'claude') {
								return s.type === 'claude' && (s.claudeSessionId === detail.id || s.sessionId === detail.id || s.id === detail.id);
							}
							if (detail.type === 'pty') {
								return s.type === 'pty' && s.id === detail.id;
							}
							return false;
						});
						if (existing) {
							updateDisplayedWithSession(existing.id);
							sessionMenuOpen = false;
							return;
						}
						if (detail.type === 'claude') {
							const projectName = detail.projectName || selectedProject || 'project';
							createClaudeSession({
								workspacePath: projectName,
								sessionId: detail.id,
								projectName,
								resumeSession: true,
								createWorkspace: false
							});
							sessionMenuOpen = false;
						} else if (detail.type === 'pty') {
							resumeTerminalSession({ terminalId: detail.id, workspacePath: detail.workspacePath || selectedProject });
							sessionMenuOpen = false;
						}
					}}
				/>
			</div>
		</div>
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
							<!-- <div class="terminal-header">
								<div class="terminal-status">
									<span class="status-dot"></span>
									<span class="terminal-type">{s.type === 'claude' ? 'Claude' : 'Terminal'}</span>
								</div>
								<div class="terminal-info">Session {s.id.slice(0, 6)}</div>
							</div> -->
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

<div class="status-bar">
  <div class="left-group">
    {#if isMobile}
    <button class="bottom-btn" onclick={prevMobileSession} disabled={sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length === 0} aria-label="Previous session">←</button>
    <span class="session-counter">
      {Math.min(currentMobileSession + 1, sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length)}
      /
      {sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length}
    </span>
    <button class="bottom-btn" onclick={nextMobileSession} disabled={sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length === 0} aria-label="Next session">→</button>
    {/if}
  </div>
  <div class="right-group">
    <button class="bottom-btn primary" onclick={toggleSessionMenu} aria-label="Open sessions">{sessionMenuOpen ? 'Close' : 'Sessions'}</button>
  </div>
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
		height: 100dvh;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'header'
			'main';
		background: var(--bg-dark);
		color: var(--text-primary);
		overflow: hidden;
		/* Avoid horizontal overflow on small screens */
		max-width: 100svw;
		width: 100%;
		transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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

	/* Ensure header image scales safely */
	.brand-icon img {
		max-width: 100%;
		height: 28px;
		width: auto;
		display: block;
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

	/* Status bar (always visible) */
	.status-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.6rem;
		/* Respect safe-area and prevent layout overflow */
		padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
		box-sizing: border-box;
		width: 100%;
		max-width: 100svw;
		background: var(--bg-panel);
		border-top: 1px solid var(--primary-dim);
		z-index: 50;
	}
	.status-bar .left-group,
	.status-bar .right-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0; /* allow shrinking */
	}
	/* Let left group take remaining space; keep right controls tight */
	.status-bar .left-group { flex: 1 1 auto; }
	.status-bar .right-group { flex: 0 0 auto; }
	.bottom-btn {
		background: var(--surface-hover);
		border: 1px solid var(--surface-border);
		color: var(--text);
		border-radius: 0.35rem;
		padding: 0.3rem 0.6rem;
		font-family: var(--font-mono);
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
		cursor: pointer;
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
		overflow: hidden;
		text-overflow: ellipsis;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Sidebar removed — using bottom sheet */



	/* ========================================
	   MAXIMUM WORKSPACE AREA
	   ======================================== */
	.main-content {
		grid-area: main;
		overflow: hidden;
		position: relative;
		/* Prevent grid child overflow in narrow viewports */
		min-width: 0;
	}

	/* Main content leaves room for status bar */
	.main-content { padding-bottom: calc(56px + env(safe-area-inset-bottom)); }

	@media (max-width: 768px) {
		/* Tighter brand image on mobile */
		.brand-icon img { height: 22px; }
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
		/* Ensure grid content can shrink to viewport */
		min-width: 0;
		
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
		/* Allow shrinking inside grid to prevent width overflow */
		min-width: 0;
		
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
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
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
			grid-template-rows: auto 1fr;
			grid-template-areas:
				'header'
				'main';
			transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
			height: 100vh;
			height: 100dvh; /* dynamic viewport to avoid overflow when URL bar shows */
			overflow: hidden;
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

		.session-grid { 
			grid-template-columns: 1fr !important; 
			padding: 0; /* Remove padding for flush mobile viewport */
			gap: 0; /* Remove gaps for flush mobile viewport */
		}
		.brand-text { display: none; }
	}

	/* Very small screens */
	@media (max-width: 480px) {
		.dispatch-workspace {
			grid-template-rows: min-content auto !important;
			grid-template-areas:
				'header'
				'main' !important;
			transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		}
	}

	/* Session bottom sheet */
	.session-sheet-backdrop {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.4);
		z-index: 60;
		-webkit-tap-highlight-color: transparent;
	}
	.session-sheet {
		position: fixed;
		left: 0; right: 0; bottom: 0;
		background: var(--bg);
		border-top: 1px solid var(--primary-dim);
		max-height: 90vh;
		max-height: 90dvh;
		height: auto;
		overflow: hidden;
		z-index: 70;
		box-shadow: 0 -8px 24px rgba(0,0,0,0.3);
		display: flex; 
		flex-direction: column;
		transform: translateY(0);
		transition: transform 0.3s ease-out;
	}
	.sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--primary-dim); }
	.sheet-title { font-family: var(--font-mono); font-weight: 700; color: var(--primary); }
	.sheet-close { 
		background: var(--surface-hover); 
		border: 1px solid var(--surface-border); 
		color: var(--text); 
		border-radius: 0.35rem; 
		padding: 0.25rem 0.5rem;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
		cursor: pointer;
	}
	.sheet-body { overflow: auto; min-height: 0; padding: 0.5rem; }

	/* Mobile-specific touch improvements */
	@media (hover: none) and (pointer: coarse) {
		.bottom-btn:active,
		.sheet-close:active {
			opacity: 0.8;
			transform: scale(0.95);
		}
	}
	
	/* ========================================
	   ACCESSIBILITY & PERFORMANCE
	   ======================================== */


	/* Focus management: removed old sidebar session-item styles */

	/* High DPI displays - optimize for developer monitors */
	@media (min-resolution: 144dpi) {
	
		.header {
			min-height: 45px;
		}
	}
</style>
