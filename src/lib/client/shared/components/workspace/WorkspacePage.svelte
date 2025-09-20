<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { innerWidth } from 'svelte/reactivity/window';
	// Services and ViewModels
	import { provideServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	// WorkspaceViewModel removed - obsolete in unified architecture
	import { createLogger } from '$lib/client/shared/utils/logger.js';

	// Components
	import WorkspaceHeader from './WorkspaceHeader.svelte';
	import SessionWindowManager from './SessionWindowManager.svelte';
	import SingleSessionView from './SingleSessionView.svelte';
	import StatusBar from './StatusBar.svelte';

	// Modals
	import CreateSessionModal from '$lib/client/shared/components/CreateSessionModal.svelte';
	import SettingsModal from '$lib/client/shared/components/Settings/SettingsModal.svelte';
	import ProjectSessionMenu from '$lib/client/shared/components/ProjectSessionMenu.svelte';

	// PWA components
	import PWAInstallPrompt from '$lib/client/shared/components/PWAInstallPrompt.svelte';
	import PWAUpdateNotification from '$lib/client/shared/components/PWAUpdateNotification.svelte';

	// SessionSocketManager removed - RunSessionClient now handles socket management automatically

	// Initialize service container with proper URLs for remote connections
	// Use relative URLs that work for both local and remote access
	const container = provideServiceContainer({
		apiBaseUrl: '', // Empty string means use current origin for API calls
		socketUrl: typeof window !== 'undefined' ? window.location.origin : '', // Use current origin for socket connections
		authTokenKey: 'dispatch-auth-key',
		debug: false
	});

	// ViewModels and Services
	const log = createLogger('workspace:page');
	// workspaceViewModel removed - obsolete in unified architecture
	let sessionViewModel = $state();

	// Component references
	let workspaceViewMode = $state('window-manager');
	let activeSessionId = $state(null);

	// activeModal: { type: string, data: any } | null
	let activeModal = $state(null);

	let sessionMenuOpen = $state(false);

	// Derived modal open state - simple check against activeModal.type
	const createSessionModalOpen = $derived(activeModal?.type === 'createSession');

	// Simple session count from sessionViewModel
	const sessionsList = $derived.by(() => {
		const sessions = sessionViewModel?.sessions ?? [];

		log.info('[WorkspacePage] SessionsList derived, count:', sessions.length, sessions);
		return sessions;
	});
	const totalSessions = $derived(sessionsList.length);
	const hasActiveSessions = $derived(totalSessions > 0);
	const selectedSingleSession = $derived.by(() => {
		if (!sessionsList.length) return null;
		if (activeSessionId) {
			return sessionsList.find((session) => session.id === activeSessionId) ?? sessionsList[0];
		}
		return sessionsList[0];
	});
	const currentSessionIndex = $derived.by(() => {
		if (!selectedSingleSession) return 0;
		const index = sessionsList.findIndex((session) => session.id === selectedSingleSession.id);
		return index >= 0 ? index : 0;
	});
	const isSingleSessionView = $derived(workspaceViewMode === 'single-session');
	const isWindowManagerView = $derived(!isSingleSessionView);


	// Responsive state
	const isMobile = $derived(innerWidth.current <= 500);
	$effect(() => {
		if (innerWidth.current <= 500) {
			setWorkspaceViewMode('single-session');
		}
	});
	// PWA installation handling
	let deferredPrompt = $state(null);
	let __removeWorkspacePageListeners = $state(null);

	// Initialization
	onMount(async () => {
		// Authentication check
		if (browser) {
			const storedKey = localStorage.getItem('dispatch-auth-key');
			if (!storedKey) {
				log.info('No auth key found, redirecting to login');
				goto('/');
				return;
			}

			try {
				const response = await fetch(`/api/auth/check?key=${encodeURIComponent(storedKey)}`);
				if (!response.ok) {
					log.warn('Auth key invalid, redirecting to login');
					localStorage.removeItem('dispatch-auth-key');
					goto('/');
					return;
				}
			} catch (error) {
				log.error('Failed to verify auth key', error);
			}
		}

		// Get shared ViewModels from container
		sessionViewModel = await container.get('sessionViewModel');

		// Load initial data - workspace loading removed in unified architecture
		log.info('Loading sessions...');
		await sessionViewModel.loadSessions();
		log.info('Sessions loaded, count:', sessionViewModel.sessions.length);

		// Setup PWA install prompt
		if (typeof window !== 'undefined') {
			function handleBeforeInstallPrompt(e) {
				e.preventDefault();
				deferredPrompt = e;
				log.info('PWA install prompt available');
			}

			window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

			// Store cleanup handlers on the component instance for onDestroy
			__removeWorkspacePageListeners = () => {
				window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			};
		}

		// Check for PWA shortcut parameters
		const urlParams = new URLSearchParams(window.location.search);
		const newSessionType = urlParams.get('new');
		if (newSessionType === 'pty' || newSessionType === 'claude') {
			// Use local modal helper to open create-session modal
			openCreateSessionModal(newSessionType);
			window.history.replaceState({}, '', '/workspace');
		}
	});

	onDestroy(() => {
		try {
			if (typeof __removeWorkspacePageListeners === 'function') {
				__removeWorkspacePageListeners();
			}
		} catch (err) {
			log.warn('Error during cleanup of workspace page listeners', err);
		}

		// RunSessionClient handles disconnection automatically
	});

	// Event handlers
	function setWorkspaceViewMode(mode) {
		log.info('Setting workspace view mode to', mode);
		workspaceViewMode = mode;
	}

	function handleLogout() {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('dispatch-auth-key');
		}
		goto('/');
	}

	function handleInstallPWA() {
		if (deferredPrompt) {
			deferredPrompt.prompt();
			deferredPrompt.userChoice.then((choiceResult) => {
				if (choiceResult.outcome === 'accepted') {
					log.info('PWA install prompt accepted');
				} else {
					log.info('PWA install prompt dismissed');
				}
				deferredPrompt = null;
			});
		} else {
			// Show manual installation instructions
			const isIOS =
				/iPad|iPhone|iPod/.test(navigator.userAgent) && !(/** @type {any} */ (window).MSStream);
			if (isIOS) {
				alert(
					'To install this app on iOS:\n1. Tap the share button ⎙\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to install'
				);
			} else {
				alert(
					'To install this app:\n1. Look for an install icon in your browser\'s address bar\n2. Or check your browser\'s menu for "Install" or "Add to Home Screen" option'
				);
			}
		}
	}

	function handleOpenSettings() {
		// Open settings modal locally
		activeModal = { type: 'settings', data: null };
	}

	function handleCreateSession(type = 'claude') {
		console.log('[WorkspacePage] handleCreateSession called:', type);
		// For SessionWindowManager buttons, create session directly
		openCreateSessionModal(type);
	}

	function updateActiveSession(id) {
		if (!id) {
			if (activeSessionId !== null) {
				activeSessionId = null;
			}
			return;
		}

		if (activeSessionId !== id) {
			activeSessionId = id;
		}

		const index = sessionsList.findIndex((session) => session.id === id);
		if (index >= 0) {
			sessionViewModel?.setMobileSessionIndex?.(index);
		}
	}

	function handleToggleSessionMenu() {
		sessionMenuOpen = !sessionMenuOpen;
	}

	function handleNavigateSession(direction) {
		if (!sessionsList.length) return;

		const currentIndex = sessionsList.findIndex((session) => session.id === activeSessionId);
		const safeIndex = currentIndex >= 0 ? currentIndex : 0;

		if (direction === 'next') {
			const nextIndex = Math.min(safeIndex + 1, sessionsList.length - 1);
			const targetSession = sessionsList[nextIndex] ?? sessionsList[safeIndex];
			if (targetSession) {
				updateActiveSession(targetSession.id);
			}
			sessionViewModel?.navigateToNextSession();
		} else if (direction === 'prev') {
			const prevIndex = Math.max(safeIndex - 1, 0);
			const targetSession = sessionsList[prevIndex] ?? sessionsList[safeIndex];
			if (targetSession) {
				updateActiveSession(targetSession.id);
			}
			sessionViewModel?.navigateToPrevSession();
		}
	}

	function handleSessionFocus(session) {
		if (!session) return;
		updateActiveSession(session.id);
		// Session focus is now handled automatically by RunSessionClient
	}

	function handleSessionClose(sessionId) {
		const currentSessions = sessionsList;
		const currentIndex = currentSessions.findIndex((session) => session.id === sessionId);
		const fallbackSession =
			currentSessions[currentIndex + 1] ?? currentSessions[currentIndex - 1] ?? null;

		// Close session in SessionViewModel
		sessionViewModel.closeSession(sessionId);

		if (sessionId === activeSessionId) {
			updateActiveSession(fallbackSession?.id ?? null);
		}
	}

	function handleSessionAssignToTile(sessionId, tileId) {
		sessionViewModel.addToLayout(sessionId, tileId);
	}

	function handleSessionCreate(detail) {
		const { id, type, workspacePath, typeSpecificId } = detail;
		if (!id || !type || !workspacePath) return;

		updateActiveSession(id);

		// Handle session creation in SessionViewModel
		sessionViewModel.handleSessionCreated({
			id,
			type: type === 'terminal' ? 'pty' : type,
			workspacePath,
			typeSpecificId
		});

		// Close local create session modal if open
		if (activeModal?.type === 'createSession') {
			activeModal = null;
		}
	}

	// Local modal helpers
	function openCreateSessionModal(type = 'claude') {
		activeModal = { type: 'createSession', data: { type } };
	}

	function closeActiveModal() {
		activeModal = null;
	}

	$effect(() => {
		if (!sessionsList.length) {
			updateActiveSession(null);
			return;
		}

		if (!activeSessionId) {
			const fallbackId = sessionsList[0]?.id ?? null;
			if (fallbackId) {
				updateActiveSession(fallbackId);
			}
		}
	});
</script>

<div class="dispatch-workspace">
	<!-- Service container is provided via context -->

	<!-- Header (desktop only) -->
	<WorkspaceHeader
		onLogout={handleLogout}
		viewMode={workspaceViewMode}
		onInstallPWA={handleInstallPWA}
		onViewModeChange={setWorkspaceViewMode}
	/>

	<!-- Bottom sheet for sessions -->
	{#if sessionMenuOpen}
		<div class="session-sheet" class:open={sessionMenuOpen} role="dialog" aria-label="Sessions">
			<div class="sheet-header">
				<div class="sheet-title">Sessions</div>
				<button class="sheet-close" onclick={() => (sessionMenuOpen = false)} aria-label="Close">
					✕
				</button>
			</div>
			<div class="sheet-body">
				<ProjectSessionMenu
					onNewSession={(e) => {
						const { type } = e.detail || {};
						handleCreateSession(type);
					}}
					onSessionSelected={async (e) => {
						const selectedId = e.detail?.id;
						if (selectedId) {
							updateActiveSession(selectedId);
						}

						try {
							await sessionViewModel.handleSessionSelected(e.detail);
						} catch (error) {
							console.error('Error resuming session:', error);
						}
						sessionMenuOpen = false;
					}}
				/>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<main class="main-content">
		{#if isWindowManagerView}
			<SessionWindowManager
				sessions={sessionsList}
				onSessionFocus={handleSessionFocus}
				onSessionClose={handleSessionClose}
				onSessionAssignToTile={handleSessionAssignToTile}
				onCreateSession={handleCreateSession}
			/>
		{:else}
			<SingleSessionView
				session={selectedSingleSession}
				sessionIndex={currentSessionIndex}
				onSessionFocus={handleSessionFocus}
				onSessionClose={handleSessionClose}
				onCreateSession={handleCreateSession}
			/>
		{/if}
	</main>

	<!-- Status Bar -->
	<StatusBar
		onLogout={handleLogout}
		onInstallPWA={handleInstallPWA}
		onOpenSettings={handleOpenSettings}
		onCreateSession={handleCreateSession}
		onToggleSessionMenu={handleToggleSessionMenu}
		onNavigateSession={handleNavigateSession}
		{sessionMenuOpen}
		{isMobile}
		{hasActiveSessions}
		sessionCount={totalSessions}
		{currentSessionIndex}
		{totalSessions}
		viewMode={workspaceViewMode}
	/>
</div>

<!-- Modals -->
{#if activeModal}
	{#if activeModal.type === 'createSession'}
		<CreateSessionModal
			open={createSessionModalOpen}
			initialType={activeModal.data?.type || 'claude'}
			oncreated={handleSessionCreate}
			onclose={closeActiveModal}
		/>
	{:else if activeModal.type === 'settings'}
		<SettingsModal open={true} onclose={closeActiveModal} />
	{/if}
{/if}

<PWAInstallPrompt />
<PWAUpdateNotification />

<style>
	.dispatch-workspace {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: min-content 1fr min-content;
		grid-template-areas:
			'header'
			'main'
			'footer';
		background: transparent;
		color: var(--text-primary);
		overflow: hidden;
		max-width: 100svw;
		width: 100%;
		transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
	}

	.dispatch-workspace::before {
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

	.main-content {
		grid-area: main;
		overflow: hidden;
		position: relative;
		min-width: 0;
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
	}

	/* Session bottom sheet */
	.session-sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--bg);
		border: none;
		height: calc(100dvh - 56px);
		overflow: hidden;
		z-index: 50;
		box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		opacity: 0;
		transform: translateY(100%);
		transition:
			transform 0.15s ease-out,
			opacity 0.15s ease-out;
	}

	.session-sheet.open {
		transform: translateY(-56px);
		opacity: 0.975;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-3);
		border-bottom: 1px solid var(--primary-muted);
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
		min-height: calc(100% - var(--space-6));
		padding: 0;
	}

	/* Very small screens */
	@media (max-width: 480px) {
		.dispatch-workspace {
			padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
		}

		.session-sheet {
			height: calc(100% - 56px);
			min-height: calc(100% - 56px);
			transform: translateY(calc(100% + 52px));
		}

		.sheet-body {
			min-height: calc(100% - 60px);
		}
	}
</style>
