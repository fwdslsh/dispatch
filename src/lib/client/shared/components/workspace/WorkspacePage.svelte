<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	// Services and ViewModels
	import {
		provideServiceContainer
	} from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { WorkspaceViewModel } from '$lib/client/shared/viewmodels/WorkspaceViewModel.svelte.js';
	import { LayoutViewModel } from '$lib/client/shared/viewmodels/LayoutViewModel.svelte.js';
	import { createLogger } from '$lib/client/shared/utils/logger.js';

	// Components
	import WorkspaceHeader from './WorkspaceHeader.svelte';
	import SessionWindowManager from './SessionWindowManager.svelte';
	import StatusBar from './StatusBar.svelte';

	// Modals
	import CreateSessionModal from '$lib/client/shared/components/CreateSessionModal.svelte';
	import SettingsModal from '$lib/client/shared/components/Settings/SettingsModal.svelte';
	import ProjectSessionMenu from '$lib/client/shared/components/ProjectSessionMenu.svelte';

	// PWA components
	import PWAInstallPrompt from '$lib/client/shared/components/PWAInstallPrompt.svelte';
	import PWAUpdateNotification from '$lib/client/shared/components/PWAUpdateNotification.svelte';

	// Session socket manager
	import sessionSocketManager from '$lib/client/shared/components/SessionSocketManager.js';

	// Initialize service container
	const container = provideServiceContainer({
		apiBaseUrl: '',
		socketUrl: '',
		authTokenKey: 'dispatch-auth-key',
		debug: false
	});

	// ViewModels and Services
	const log = createLogger('workspace:page');
	let workspaceViewModel = $state();
	let sessionViewModel = $state();

	// Component references
	let sessionWindowManager = $state();

	/** @type {LayoutViewModel} */
	let layoutViewModel = $state();

	// activeModal: { type: string, data: any } | null
	let activeModal = $state(null);

	let sessionMenuOpen = $state(false);

	// Derived modal open state - simple check against activeModal.type
	const createSessionModalOpen = $derived(activeModal?.type === 'createSession');

	// Simple session count from sessionViewModel
	const totalSessions = $derived(sessionViewModel?.sessions?.length ?? 0);
	const hasActiveSessions = $derived(totalSessions > 0);
	const currentMobileSessionIndex = $derived(
		sessionViewModel?.currentMobileSession ?? 0
	);
	const currentWorkspace = $derived(workspaceViewModel?.selectedWorkspace ?? null);
	const currentBreakpoint = $derived(
		layoutViewModel
			? layoutViewModel.isMobile
				? 'mobile'
				: layoutViewModel.isTablet
					? 'tablet'
					: 'desktop'
			: 'desktop'
	);

	// Debug effect removed to prevent unnecessary reactive updates

	// Responsive state
	const isMobile = $derived(layoutViewModel?.isMobile ?? currentBreakpoint === 'mobile');
	const layoutColumns = $derived(layoutViewModel?.columns ?? 1);

	// PWA installation handling
	let deferredPrompt = $state(null);
	let lastWorkspacePath = undefined;
	let __removeWorkspacePageListeners = $state(null);

	// Handle mobile state changes through explicit method calls
	// Note: isMobile, isTablet, etc. are now derived values declared in constructor
	$effect(() => {
		// Only trigger method calls, don't mutate state directly
		if (layoutViewModel?.isMobile) {
			layoutViewModel.handleMobileStateChange();
		}
	});

	// Track column changes for transitions
	$effect(() => {
		if (layoutViewModel && layoutViewModel.columns !== layoutViewModel.previousCols) {
			layoutViewModel.transitioning = true;
			layoutViewModel.previousCols = layoutViewModel.columns;

			// Reset transition state after animation
			setTimeout(() => {
				if (layoutViewModel) {
					// Guard against component cleanup
					layoutViewModel.transitioning = false;
				}
			}, 300);
		}
	});

	// Simplified state management - no complex app state dispatch needed

	// Sessions map directly to tiles by index using WindowViewModel

	// Modal state is now derived from activeModal - no more bidirectional sync needed!

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

		// Initialize ViewModels
		const workspaceApi = await container.get('workspaceApi');
		const persistence = await container.get('persistence');
		const layout = await container.get('layout');
		const socketService = await container.get('socket');

		// Create WorkspaceViewModel directly (not shared with other components)
		workspaceViewModel = new WorkspaceViewModel(workspaceApi, persistence);

		// Get shared ViewModels from container
		sessionViewModel = await container.get('sessionViewModel');

	layoutViewModel = new LayoutViewModel(layout);

		// Load initial data
		await workspaceViewModel.loadWorkspaces();
		await workspaceViewModel.loadRecentWorkspaces();
		log.info('Loading sessions...');
		await sessionViewModel.loadSessions();
		log.info('Sessions loaded');

		// Initialize responsive state
		layoutViewModel.updateResponsiveState();

		// Setup PWA install prompt
		if (typeof window !== 'undefined') {
			function handleBeforeInstallPrompt(e) {
				e.preventDefault();
				deferredPrompt = e;
				log.info('PWA install prompt available');
			}

			function handleResize() {
				try {
					layoutViewModel?.updateResponsiveState();
				} catch (err) {
					log.warn('Failed to update responsive state on resize', err);
				}
			}

			window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.addEventListener('resize', handleResize);

			// Store cleanup handlers on the component instance for onDestroy
			__removeWorkspacePageListeners = () => {
				window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
				window.removeEventListener('resize', handleResize);
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

			sessionSocketManager.disconnectAll();
	});

	// Event handlers
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
		// Clean session creation flow - no interception
		// WindowViewModel handles tile assignment after session creation
		openCreateSessionModal(type);
	}

	// Direct session creation for empty tiles (bypasses modal)
	async function handleCreateSessionDirect(type, workspacePath = null) {
		let targetPath = workspacePath || currentWorkspace?.path;

		// If no workspace is available, create a default one
		if (!targetPath) {
			try {
				// Create a default workspace with timestamp
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const defaultWorkspaceName = `workspace-${timestamp}`;

				// Use the workspace view model to create a default workspace
				if (workspaceViewModel) {
					const result = await workspaceViewModel.createWorkspace(defaultWorkspaceName);
					targetPath = result.path;
				} else {
					// Fall back to modal
					handleCreateSession(type);
					return;
				}
			} catch (error) {
				log.error('Failed to create default workspace', error);
				// Fall back to modal
				handleCreateSession(type);
				return;
			}
		}

		try {
			// Convert 'terminal' to 'pty' for API compatibility
			const apiType = type === 'terminal' ? 'pty' : type;
			await sessionViewModel.createSession({ type: apiType, workspacePath: targetPath });
		} catch (error) {
			log.error('Failed to create session directly', error);
			// Fall back to modal on error
			handleCreateSession(type);
		}
	}

	function handleToggleSessionMenu() {
		sessionMenuOpen = !sessionMenuOpen;
	}

	function handleNavigateSession(direction) {
		if (direction === 'next') {
			sessionViewModel?.navigateToNextSession();
		} else if (direction === 'prev') {
			sessionViewModel?.navigateToPrevSession();
		}
	}

	function handleSessionFocus(session) {
		if(sessionSocketManager.activeSession == session.id) return;
		sessionSocketManager.handleSessionFocus(session.id);
	}

	function handleSessionClose(sessionId) {
		// Close session in SessionViewModel
		sessionViewModel.closeSession(sessionId);
	}

	function handleSessionUnpin(sessionId) {
		sessionViewModel.unpinSession(sessionId);
	}

	function handleSessionCreate(detail) {
		const { id, type, workspacePath, typeSpecificId } = detail;
		if (!id || !type || !workspacePath) return;

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
</script>

<div class="dispatch-workspace">
	<!-- Service container is provided via context -->

	<!-- Header (desktop only) -->
	<WorkspaceHeader onLogout={handleLogout} {layoutViewModel} />

	<!-- Bottom sheet for sessions -->
	{#if sessionMenuOpen}
		<div class="session-sheet" class:open={sessionMenuOpen} role="dialog" aria-label="Sessions">
			<div class="sheet-header">
				<div class="sheet-title">Sessions</div>
				<button
					class="sheet-close"
					onclick={() => sessionMenuOpen = false}
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<div class="sheet-body">
				<ProjectSessionMenu
					bind:selectedWorkspace={workspaceViewModel.selectedWorkspace}
					onNewSession={(e) => {
						const { type } = e.detail || {};
						handleCreateSession(type);
					}}
					onSessionSelected={async (e) => {
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
		<SessionWindowManager
			sessions={sessionViewModel?.sessions ?? []}
			onSessionFocus={handleSessionFocus}
			onSessionClose={handleSessionClose}
			onSessionUnpin={handleSessionUnpin}
			onCreateSession={handleCreateSession}
			bind:this={sessionWindowManager}
		/>
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
		currentSessionIndex={currentMobileSessionIndex}
		{totalSessions}
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
