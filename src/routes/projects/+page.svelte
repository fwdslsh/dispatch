<script>
	import { onDestroy, onMount } from 'svelte';
	import { io } from 'socket.io-client';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import TerminalPane from '$lib/components/TerminalPane.svelte';
	import ClaudePane from '$lib/components/ClaudePane.svelte';
	import TerminalSessionModal from '$lib/components/TerminalSessionModal.svelte';
	import ClaudeSessionModal from '$lib/components/ClaudeSessionModal.svelte';
	import CreateSessionModal from '$lib/components/CreateSessionModal.svelte';
	import { Button } from '$lib/shared/components';
	import ProjectSessionMenu from '$lib/shared/components/ProjectSessionMenu.svelte';
	import sessionSocketManager from '$lib/components/SessionSocketManager.js';

	let sessions = $state([]);
	let workspaces = $state([]);
	let selectedProject = $state(null);

	// Modal states
	let terminalModalOpen = $state(false);
	let claudeModalOpen = $state(false);
	let createSessionModalOpen = $state(false);

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
	const maxVisible = $derived(
		isMobile ? 1 : layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1
	);

	// Layout tracking for responsive behavior
	let previousCols = $state(0);
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
			const result = ids.map((id) => sessions.find((s) => s && s.id === id)).filter(Boolean);
			console.log('Desktop result:', result.length, 'maxVisible:', maxVisible);
			return result;
		}
	});

	// Track layout changes for responsive behavior
	$effect(() => {
		previousCols = cols;
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

	function unpinSession(sessionId) {
		if (isMobile) {
			// Remove from sessions array entirely for mobile
			const sessionIndex = sessions.findIndex((s) => s && s.id === sessionId);
			if (sessionIndex !== -1) {
				sessions = sessions.filter((s) => s && s.id !== sessionId);
				// Adjust currentMobileSession if needed
				const remainingSessions = sessions.filter((s) => s && s.id);
				if (remainingSessions.length === 0) {
					currentMobileSession = 0;
				} else if (currentMobileSession >= remainingSessions.length) {
					currentMobileSession = remainingSessions.length - 1;
				}
			}
		} else {
			// Remove from displayed array for desktop
			displayed = displayed.filter((id) => id !== sessionId);
		}
	}

	async function createTerminalSession(workspacePath) {
		// Ensure workspace exists
		const wsResp = await fetch('/api/workspaces', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'open', path: workspacePath })
		});
		if (!wsResp.ok) {
			const j = await wsResp.json().catch(() => null);
			console.error('Failed to open workspace:', j?.error || wsResp.statusText);
			throw new Error(j?.error || 'Failed to open workspace');
		}

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

	async function createClaudeSession({
		workspacePath,
		sessionId,
		projectName,
		resumeSession,
		createWorkspace = false
	}) {
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
		if (!workspaceResponse.ok) {
			const j = await workspaceResponse.json().catch(() => null);
			console.error('Failed to ensure workspace:', j?.error || workspaceResponse.statusText);
			throw new Error(j?.error || 'Failed to ensure workspace');
		}

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
			workspacePath: finalWorkspacePath, // Use the final workspace path from the API
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

	// Touch gesture handling for mobile swipe navigation
	let touchStartX = 0;
	let touchStartY = 0;
	let touchEndX = 0;
	let touchEndY = 0;
	let isSwipeInProgress = false;

	function handleTouchStart(e) {
		if (!isMobile) return;

		// Record touch start position
		touchStartX = e.changedTouches[0].screenX;
		touchStartY = e.changedTouches[0].screenY;
		isSwipeInProgress = true;
	}

	function handleTouchMove(e) {
		if (!isMobile || !isSwipeInProgress) return;

		touchEndX = e.changedTouches[0].screenX;
		touchEndY = e.changedTouches[0].screenY;

		// Track movement but don't interfere with scrolling
	}

	function handleTouchEnd(e) {
		if (!isMobile || !isSwipeInProgress) return;

		isSwipeInProgress = false;
		touchEndX = e.changedTouches[0].screenX;
		touchEndY = e.changedTouches[0].screenY;

		handleSwipeGesture();
	}

	function handleSwipeGesture() {
		const swipeThreshold = 75; // Minimum distance for a swipe
		const verticalThreshold = 50; // Maximum vertical movement to still count as horizontal swipe

		const deltaX = touchEndX - touchStartX;
		const deltaY = Math.abs(touchEndY - touchStartY);

		// Check if it's a horizontal swipe (not too much vertical movement)
		if (deltaY > verticalThreshold || Math.abs(deltaX) < swipeThreshold) {
			return;
		}

		// Detect left swipe (go to next session)
		if (deltaX < -swipeThreshold) {
			nextMobileSession();
		}

		// Detect right swipe (go to previous session)
		if (deltaX > swipeThreshold) {
			prevMobileSession();
		}
	}

	// Jump to specific session (for mobile session list)
	function jumpToSession(sessionIndex) {
		const allSessions = sessions.filter(
			(s) => s && typeof s === 'object' && 'id' in s && 'type' in s
		);
		if (sessionIndex >= 0 && sessionIndex < allSessions.length) {
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

	function toggleSessionMenu() {
		sessionMenuOpen = !sessionMenuOpen;
	}

	function handleSessionFocus(session) {
		console.log('Session focused:', session.id);
		// Notify the session socket manager about the focus change
		sessionSocketManager.handleSessionFocus(session.id);
	}

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

	async function handleUnifiedSessionCreate(params) {
		if (params.type === 'terminal') {
			await createTerminalSession(params.workspacePath);
		} else if (params.type === 'claude') {
			await createClaudeSession(params);
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

		// Cleanup session socket manager when leaving the page
		sessionSocketManager.disconnectAll();
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
			if (typeof localStorage !== 'undefined')
				localStorage.setItem(STORAGE.mobileIndex, String(currentMobileSession));
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
	<div class="session-sheet" class:open={sessionMenuOpen} role="dialog" aria-label="Sessions">
		<div class="sheet-header">
			<div class="sheet-title">Sessions</div>
			<button class="sheet-close" onclick={() => (sessionMenuOpen = false)} aria-label="Close"
				>✕</button
			>
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

					// For active sessions, just show them immediately
					if (detail.isActive) {
						// Check if session is already in our display
						const existing = sessions.find((s) => {
							if (!s) return false;
							if (detail.type === 'claude') {
								return (
									s.type === 'claude' &&
									(s.claudeSessionId === detail.id ||
										s.sessionId === detail.id ||
										s.id === detail.id)
								);
							}
							if (detail.type === 'pty') {
								return s.type === 'pty' && s.id === detail.id;
							}
							return false;
						});

						if (existing) {
							updateDisplayedWithSession(existing.id);
						} else {
							// Create a session entry for this active session
							// For Claude sessions, ensure we use the correct sessionId for history loading
							const s = {
								id: detail.id,
								type: detail.type,
								workspacePath: detail.workspacePath,
								projectName: detail.projectName,
								// Use sessionId if provided, otherwise use id as fallback
								claudeSessionId: detail.sessionId || detail.id,
								// Always set shouldResume to true for active sessions to trigger history loading
								shouldResume: true,
								isActiveSocket: true
							};
							console.log('Creating session entry for active session:', {
								id: s.id,
								claudeSessionId: s.claudeSessionId,
								type: s.type,
								shouldResume: s.shouldResume
							});
							sessions = [...sessions, s];
							updateDisplayedWithSession(detail.id);
						}
						sessionMenuOpen = false;
						return;
					}

					// For persisted sessions, check if already running first
					const existing = sessions.find((s) => {
						if (!s) return false;
						if (detail.type === 'claude') {
							return (
								s.type === 'claude' &&
								(s.claudeSessionId === detail.id || s.sessionId === detail.id || s.id === detail.id)
							);
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

					// Resume persisted sessions
					if (detail.type === 'claude') {
						const projectName = detail.projectName || selectedProject || 'project';
						createClaudeSession({
							workspacePath: detail.workspacePath || projectName,
							sessionId: detail.id,
							projectName,
							resumeSession: true,
							createWorkspace: false
						});
						sessionMenuOpen = false;
					} else if (detail.type === 'pty') {
						resumeTerminalSession({
							terminalId: detail.id,
							workspacePath: detail.workspacePath || selectedProject
						});
						sessionMenuOpen = false;
					}
				}}
			/>
		</div>
	</div>

	<!-- Main Workspace -->
	<main
		class="main-content"
		style={`--cols: ${cols};`}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		{#if visible.length === 0}
			<div class="empty-workspace">
				<div class="empty-content">
					<div class="empty-icon"></div>
					<h1>Dispatch</h1>
					<p>Create a terminal or Claude Code session to get started</p>
				</div>
			</div>
		{:else}
			<div class="session-grid">
				{#each visible as s, index (s.id)}
					{#if s && typeof s === 'object' && 'id' in s && 'type' in s}
						<div
							class="terminal-container"
							style="--animation-index: {index};"
							in:fly|global={{
								x: 0,
								y: isMobile ? 0 : 20,
								duration: isMobile ? 150 : 250,
								easing: cubicOut
							}}
							out:fly|global={{
								x: 0,
								y: isMobile ? 0 : -20,
								duration: isMobile ? 100 : 200,
								easing: cubicOut
							}}
							onclick={() => handleSessionFocus(s)}
							onkeydown={(e) => e.key === 'Enter' && handleSessionFocus(s)}
							role="button"
							tabindex="0"
							aria-label="Focus session {s.id}"
						>
							<div class="terminal-header">
								<div class="terminal-status">
									<span class="status-dot {s.type}"></span>
									<span class="terminal-type">{s.type === 'claude' ? 'Claude' : 'Terminal'}</span>
								</div>
								<div class="terminal-info">
									<span class="session-id">#{s.id.slice(0, 6)}</span>
									{#if s.projectName}
										<span class="project-name">{s.projectName}</span>
									{/if}
								</div>
								<button
									class="unpin-btn"
									onclick={() => unpinSession(s.id)}
									title="Unpin session from grid"
									aria-label="Unpin session"
									type="button"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
										/>
									</svg>
								</button>
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
										shouldResume={s.shouldResume || s.resumeSession || false}
										workspacePath={s.workspacePath}
									/>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</main>
	<footer>
		<div class="status-bar">
			<div class="left-group">
				{#if isMobile}
					<button
						class="bottom-btn"
						onclick={prevMobileSession}
						disabled={sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s)
							.length === 0}
						aria-label="Previous session">←</button
					>
					<span class="session-counter">
						{Math.min(
							currentMobileSession + 1,
							sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length
						)}
						/
						{sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s).length}
					</span>
					<button
						class="bottom-btn"
						onclick={nextMobileSession}
						disabled={sessions.filter((s) => s && typeof s === 'object' && 'id' in s && 'type' in s)
							.length === 0}
						aria-label="Next session">→</button
					>
				{/if}
			</div>
			<div class="center-group">
				<button
					class="add-session-btn"
					onclick={() => (createSessionModalOpen = true)}
					aria-label="Create new session"
					title="Create new session"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
				</button>
			</div>
			<div class="right-group">
				<button class="bottom-btn primary" onclick={toggleSessionMenu} aria-label="Open sessions"
					>{sessionMenuOpen ? 'Close' : 'Sessions'}</button
				>
			</div>
		</div>
	</footer>
</div>

<!-- Modals -->
<TerminalSessionModal
	bind:open={terminalModalOpen}
	{workspaces}
	onSessionCreate={createTerminalSession}
/>

<ClaudeSessionModal bind:open={claudeModalOpen} onSessionCreate={createClaudeSession} />

<CreateSessionModal
	bind:open={createSessionModalOpen}
	onSessionCreate={handleUnifiedSessionCreate}
/>

<style>
	/* Maximum Screen Space Utilization for Developers */

	.dispatch-workspace {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr min-content;
		grid-template-areas:
			'header'
			'main'
			'footer';
		background: transparent;
		color: var(--text-primary);
		overflow: hidden;
		/* Avoid horizontal overflow on small screens */
		max-width: 100svw;
		width: 100%;
		transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);

		&::before {
			content: '';
			position: absolute;
			inset: 0;
			opacity: 0.09;
			background-image: url('/fwdslsh-green-bg.png');
			background-repeat: no-repeat;
			background-position: center center;
			background-size: contain;
			pointer-events: none;
		}
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
		height: 32px;
		width: auto;
		display: block;
	}

	.brand-text {
		color: var(--primary);
		font-size: 1.5rem;
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
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.6rem;
		box-sizing: border-box;
		width: 100%;
		max-width: 100svw;
		background: var(--bg-panel);
		border-top: 1px solid var(--primary-dim);
	}
	.status-bar .left-group,
	.status-bar .center-group,
	.status-bar .right-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0; /* allow shrinking */
	}
	/* Layout the three groups */
	.status-bar .left-group {
		flex: 1 1 0;
		justify-content: flex-start;
	}
	.status-bar .center-group {
		flex: 0 0 auto;
		justify-content: center;
	}
	.status-bar .right-group {
		flex: 1 1 0;
		justify-content: flex-end;
	}
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

	.add-session-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		background: var(--primary);
		border: 2px solid var(--primary);
		border-radius: 50%;
		color: var(--bg);
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(46, 230, 107, 0.3);
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
		animation: pulse 2s infinite;
	}

	.add-session-btn:hover {
		background: color-mix(in oklab, var(--primary) 90%, white 10%);
		transform: scale(1.1);
		box-shadow: 0 4px 12px rgba(46, 230, 107, 0.4);
	}

	.add-session-btn:active {
		transform: scale(0.95);
	}

	.add-session-btn svg {
		width: 24px;
		height: 24px;
		stroke-width: 2.5;
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

	@media (max-width: 768px) {
		/* Tighter brand image on mobile */
		.brand-icon img {
			height: 22px;
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

	.empty-content h1 {
		font-size: 5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.75;
		text-shadow: 0 0 10px var(--glow);
	}

	.empty-content p {
		margin: 0;
	}

	.session-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: var(--space-1); /* Consistent minimal gaps */
		height: 100%;
		overflow: hidden;
		padding: var(--space-1);
		/* Ensure grid content can shrink to viewport */
		min-width: 0;
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
		/* Position context for swipe zone */
		position: relative;

		/* Simple transitions for hover states */
		transition: border-color 0.2s ease;
	}

	.terminal-container:hover {
		border-color: var(--primary);
	}

	/* Mobile session switching - simple slide animation */
	@media (max-width: 768px) {
		.terminal-container {
			/* Ensure full height is maintained during transitions */
			height: 100%;
			display: flex;
			flex-direction: column;
			/* Smoother, faster transitions for mobile */
			transition: opacity 0.15s ease-out;
			/* Prevent layout reflows */
			will-change: opacity;
			contain: layout style;
			/* Hardware acceleration */
			transform: translateZ(0);
			-webkit-transform: translateZ(0);
			backface-visibility: hidden;
			-webkit-backface-visibility: hidden;
		}

		/* Ensure child components maintain height */
		.terminal-viewport {
			flex: 1 1 auto;
			min-height: 0;
			height: 100%;
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

	/* Terminal header with session info and controls */
	.terminal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		background: var(--bg-panel);
		border-bottom: 1px solid var(--primary-dim);
		min-height: 44px;
		flex-shrink: 0;
		gap: var(--space-3);
	}

	.terminal-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-green);
		box-shadow: 0 0 8px color-mix(in oklab, var(--accent-green) 60%, transparent);
		animation: statusPulse 2s ease-in-out infinite;
	}

	.status-dot.claude {
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary-glow);
	}

	.status-dot.pty {
		background: var(--accent-amber);
		box-shadow: 0 0 8px color-mix(in oklab, var(--accent-amber) 60%, transparent);
	}

	@keyframes statusPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.terminal-type {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.terminal-info {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
	}

	.session-id {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--text-muted);
		background: var(--surface-hover);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid var(--surface-border);
	}

	.project-name {
		font-family: var(--font-sans);
		font-size: var(--font-size-1);
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}

	.unpin-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: var(--surface-hover);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		opacity: 0.7;
		flex-shrink: 0;
	}

	.unpin-btn:hover {
		background: var(--error, #ff6b6b);
		border-color: var(--error, #ff6b6b);
		color: white;
		opacity: 1;
		transform: scale(1.05);
	}

	.unpin-btn:active {
		transform: scale(0.95);
	}

	.terminal-viewport {
		flex: 1;
		overflow: hidden;
		background: var(--bg-dark);
		min-height: 0; /* Important for flex child */
		display: flex;
		flex-direction: column;
		position: relative;
		/* Prevent layout shifts */
		contain: layout;
	}

	/* ========================================
	   RESPONSIVE - MOBILE STILL FUNCTIONAL
	   ======================================== */
	@media (max-width: 768px) {
		.dispatch-workspace {
			grid-template-columns: 1fr !important;
			grid-template-rows: 1fr;
			grid-template-areas: 'main';
			transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
			height: 100vh;
			height: 100dvh; /* dynamic viewport to avoid overflow when URL bar shows */
			overflow: hidden;
		}

		.header {
			display: none; /* Hide header completely on mobile */
		}

		.header-layout {
			display: none; /* Hide layout controls on mobile */
		}

		.main-content {
			/* Ensure full height on mobile */
			height: 100%;
		}

		.session-grid {
			grid-template-columns: 1fr !important;
			padding: 0; /* Remove padding for flush mobile viewport */
			gap: 0; /* Remove gaps for flush mobile viewport */
			/* Ensure grid takes full height */
			height: 100%;
		}
		.brand-text {
			display: none;
		}

		/* Mobile terminal header adjustments */
		.terminal-header {
			padding: var(--space-2) var(--space-3);
			min-height: 40px;
		}

		.project-name {
			max-width: 100px;
			font-size: var(--font-size-0);
		}

		.unpin-btn {
			width: 32px;
			height: 32px;
		}
	}

	/* Very small screens */
	@media (max-width: 480px) {
		.dispatch-workspace {
			grid-template-rows: 1fr min-content !important;
			grid-template-areas:
				'main'
				'status' !important;
			transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

			/* Respect safe-area and prevent layout overflow */
			padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
		}
	}

	/* Session bottom sheet */
	.session-sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 60;
		-webkit-tap-highlight-color: transparent;
		display: none;
	}
	.session-sheet {
		position: fixed;
		left: 0;
		right: 0;
		background: var(--bg);
		border-top: 1px solid var(--primary-dim);
		height: calc(100dvh - 60px);
		overflow: hidden;
		z-index: 70;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		transform: translateY(100dvh);
		opacity: 0;
		transition: transform 0.15s ease-out;
		transition-property: all;
	}
	.session-sheet.open {
		transform: translateY(0);
		opacity: 0.975;
	}
	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--primary-dim);
	}
	.sheet-title {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--primary);
	}
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
	.sheet-body {
		overflow: hidden;
		min-height: 100%;
		padding: 0;
	}

	/* Mobile-specific styles for session sheet to take remaining viewport */
	@media (max-width: 768px) {
		.session-sheet {
			/* Calculate height: viewport height minus status bar (approximately 60px) */
			height: calc(100vh - 60px);
			height: calc(100dvh - 60px);
			max-height: calc(100vh - 60px);
			max-height: calc(100dvh - 60px);
			/* Ensure it doesn't go higher than the status bar */
			top: auto;
		}

		.sheet-header {
			/* More compact header on mobile */
			padding: 0.4rem 0.6rem;
			flex-shrink: 0;
		}

		.sheet-body {
			/* Make the body scrollable and take remaining space */
			flex: 1;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
			/* Add some breathing room at the bottom for iOS safe area */
			padding-bottom: env(safe-area-inset-bottom, 1rem);
		}
	}

	/* Very small screens - adjust for exact status bar height */
	@media (max-width: 480px) {
		.session-sheet {
			/* Fine-tune for smaller screens where status bar might be different */
			height: calc(100vh - 56px);
			height: calc(100dvh - 56px);
			max-height: calc(100vh - 56px);
			max-height: calc(100dvh - 56px);
		}
	}

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
