<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	// Services and ViewModels
	import {
		provideServiceContainer,
		useServiceContainer
	} from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { WorkspaceViewModel } from '$lib/client/shared/viewmodels/WorkspaceViewModel.svelte.js';
	import { LayoutViewModel } from '$lib/client/shared/viewmodels/LayoutViewModel.svelte.js';
	import { ModalViewModel } from '$lib/client/shared/viewmodels/ModalViewModel.svelte.js';

	// State modules
	import { sessionState } from '$lib/client/shared/state/session-state.svelte.js';
	import { workspaceState } from '$lib/client/shared/state/workspace-state.svelte.js';
	import { uiState } from '$lib/client/shared/state/ui-state.svelte.js';

	// Components
	import WorkspaceHeader from './WorkspaceHeader.svelte';
	import SessionGrid from './SessionGrid.svelte';
	import SessionWindowManager from './SessionWindowManager.svelte';
	import SessionContainer from './SessionContainer.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import SessionViewport from './SessionViewport.svelte';
	import StatusBar from './StatusBar.svelte';
	import EmptyWorkspace from './EmptyWorkspace.svelte';

	// Modals
	import TerminalSessionModal from '$lib/client/terminal/TerminalSessionModal.svelte';
	import ClaudeSessionModal from '$lib/client/claude/ClaudeSessionModal.svelte';
	import CreateSessionModalSimplified from '$lib/client/shared/components/CreateSessionModalSimplified.svelte';
	import SettingsModal from '$lib/client/shared/components/Settings/SettingsModal.svelte';
	import ProjectSessionMenuSimplified from '$lib/client/shared/components/ProjectSessionMenuSimplified.svelte';

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
	let workspaceViewModel = $state();
	let sessionViewModel = $state();
	let windowViewModel = $state();
	let tileAssignmentService = $state();

	// Component references
	let sessionWindowManager = $state();

	/** @type {LayoutViewModel} */
	let layoutViewModel = $state();
	let modalViewModel = $state();

	// Modal state from ViewModels
	const activeModal = $derived(
		modalViewModel?.topModalId ? modalViewModel.activeModals.get(modalViewModel.topModalId) : null
	);
	const sessionMenuOpen = $derived(uiState.layout.showBottomSheet);

	// Reactive modal open state for binding
	let createSessionModalOpen = $state(false);

	// Derived values from state
	const visibleSessions = $derived(sessionState.displayed);
	const currentBreakpoint = $derived(
		uiState.layout.isMobile ? 'mobile' : uiState.layout.isTablet ? 'tablet' : 'desktop'
	);

	// Session data from state
	const displayedSessions = $derived(visibleSessions || []);
	const currentWorkspace = $derived(workspaceState.current);

	// Debug effect to track session state changes
	$effect(() => {
		console.log('[WorkspacePage] Session state updated:');
		console.log('- sessionState.all.length:', sessionState.all.length);
		console.log('- sessionState.displayed.length:', sessionState.displayed.length);
		console.log('- visibleSessions.length:', visibleSessions.length);
		console.log('- displayedSessions.length:', displayedSessions.length);
		console.log('- useWindowManager:', useWindowManager);
		if (displayedSessions.length > 0) {
			console.log('- Sample displayedSession:', {
				id: displayedSessions[0]?.id,
				title: displayedSessions[0]?.title,
				type: displayedSessions[0]?.type
			});
		}
	});

	// Responsive state
	const isMobile = $derived(currentBreakpoint === 'mobile');
	// Use WindowManager on desktop if we have any sessions (not just displayed ones)
	const useWindowManager = $derived(!isMobile);

	// PWA installation handling
	let deferredPrompt = $state(null);

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

	// Sync createSessionModalOpen with activeModal state
	$effect(() => {
		if (activeModal?.type === 'createSession') {
			createSessionModalOpen = activeModal.open;
		} else if (createSessionModalOpen) {
			createSessionModalOpen = false;
		}
	});

	// Sync back to ModalViewModel when createSessionModalOpen changes to false
	$effect(() => {
		if (!createSessionModalOpen && activeModal?.type === 'createSession') {
			modalViewModel.closeModal('createSession');
		}
	});

	// Set up reactive session observation for tile assignment
	$effect(() => {
		if (tileAssignmentService && displayedSessions) {
			// Update the service with current sessions for reactive observation
			tileAssignmentService.currentSessions = displayedSessions;
		}
	});

	// Initialization
	onMount(async () => {
		// Authentication check
		if (browser) {
			const storedKey = localStorage.getItem('dispatch-auth-key');
			if (!storedKey) {
				console.log('No auth key found, redirecting to login');
				goto('/');
				return;
			}

			try {
				const response = await fetch(`/api/auth/check?key=${encodeURIComponent(storedKey)}`);
				if (!response.ok) {
					console.log('Auth key invalid, redirecting to login');
					localStorage.removeItem('dispatch-auth-key');
					goto('/');
					return;
				}
			} catch (error) {
				console.error('Failed to verify auth key:', error);
			}
		}

		// Initialize ViewModels
		const workspaceApi = await container.get('workspaceApi');
		const persistence = await container.get('persistence');
		const layout = await container.get('layout');
		const socketService = await container.get('socket');

		// Create WorkspaceViewModel directly (not shared with other components)
		workspaceViewModel = new WorkspaceViewModel(workspaceApi, persistence);

		// Get shared ViewModels from container (ensures proper dependency order)
		sessionViewModel = await container.get('sessionViewModel');
		windowViewModel = await container.get('windowViewModel');
		tileAssignmentService = await container.get('tileAssignmentService');

		layoutViewModel = new LayoutViewModel(layout);
		modalViewModel = new ModalViewModel();

		// Load initial data
		await workspaceViewModel.loadWorkspaces();
		await workspaceViewModel.loadRecentWorkspaces();
		console.log('[WorkspacePage] Loading sessions...');
		await sessionViewModel.loadSessions();
		console.log('[WorkspacePage] Sessions loaded');

		// TileAssignmentService is set up reactively via $effect above

		// Initialize responsive state
		layoutViewModel.updateResponsiveState();

		// Setup PWA install prompt
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				deferredPrompt = e;
				console.log('[PWA] Install prompt available');
			});

			window.addEventListener('resize', () => {
				layoutViewModel.updateResponsiveState();
			});
		}

		// Check for PWA shortcut parameters
		const urlParams = new URLSearchParams(window.location.search);
		const newSessionType = urlParams.get('new');
		if (newSessionType === 'terminal' || newSessionType === 'claude') {
			modalViewModel.openModal('create-session', { initialType: newSessionType });
			window.history.replaceState({}, '', '/workspace');
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', () => {
				layoutViewModel?.updateResponsiveState();
			});
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
					console.log('[PWA] User accepted the install prompt');
				} else {
					console.log('[PWA] User dismissed the install prompt');
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
		if (modalViewModel) {
			modalViewModel.openModal('settings');
		}
	}

	function handleCreateSession(type = 'claude') {
		// Clean session creation flow - no interception
		// The TileAssignmentService will handle tile assignment reactively after session creation
		if (modalViewModel) {
			modalViewModel.openCreateSessionModal(type);
		}
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
				console.error('Failed to create default workspace:', error);
				// Fall back to modal
				handleCreateSession(type);
				return;
			}
		}

		try {
			// Convert 'terminal' to 'pty' for API compatibility
			const apiType = type === 'terminal' ? 'pty' : type;
			await sessionViewModel.createSession(apiType, targetPath);
		} catch (error) {
			console.error('Failed to create session directly:', error);
			// Fall back to modal on error
			handleCreateSession(type);
		}
	}

	function handleToggleSessionMenu() {
		if (sessionMenuOpen) {
			uiState.layout.showBottomSheet = false;
		} else {
			uiState.layout.showBottomSheet = true;
		}
	}

	function handleNavigateSession(direction) {
		if (direction === 'next') {
			sessionViewModel.navigateToNextSession();
		} else if (direction === 'prev') {
			sessionViewModel.navigateToPrevSession();
		}
	}

	function handleSessionFocus(session) {
		console.log('Session focused:', session.id);
		sessionSocketManager.handleSessionFocus(session.id);
	}

	function handleSessionClose(sessionId) {
		// Close session in SessionViewModel
		sessionViewModel.closeSession(sessionId);

		// Notify WindowViewModel for tile management
		if (windowViewModel && !isMobile) {
			windowViewModel.handleSessionClosed(sessionId);
		}
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

		// Notify WindowViewModel for tile management
		if (windowViewModel && !isMobile) {
			windowViewModel.handleSessionCreated(id);
		}

		modalViewModel.closeModal('createSession');
	}
</script>

<div class="dispatch-workspace">
	<!-- Service container is provided via context -->

	<!-- Header (desktop only) -->
	<WorkspaceHeader onLogout={handleLogout} />

	<!-- Bottom sheet for sessions -->
	{#if sessionMenuOpen}
		<div class="session-sheet" class:open={sessionMenuOpen} role="dialog" aria-label="Sessions">
			<div class="sheet-header">
				<div class="sheet-title">Sessions</div>
				<button
					class="sheet-close"
					onclick={() => (uiState.layout.showBottomSheet = false)}
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<div class="sheet-body">
				<ProjectSessionMenuSimplified
					bind:selectedWorkspace={workspaceState.current}
					onNewSession={(e) => {
						const { type } = e.detail || {};
						handleCreateSession(type);
					}}
					onSessionSelected={(e) => {
						sessionViewModel.handleSessionSelected(e.detail);
						uiState.layout.showBottomSheet = false;
					}}
				/>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<main class="main-content">
		{#if useWindowManager && windowViewModel}
			<!-- Desktop: Use tiling window manager -->
			<SessionWindowManager
				{windowViewModel}
				{tileAssignmentService}
				sessions={displayedSessions}
				onSessionFocus={handleSessionFocus}
				onSessionClose={handleSessionClose}
				onSessionUnpin={handleSessionUnpin}
				onCreateSession={handleCreateSession}
				onCreateSessionDirect={handleCreateSessionDirect}
				bind:this={sessionWindowManager}
			/>
		{:else}
			<!-- Mobile: Use traditional grid layout -->
			<SessionGrid sessions={displayedSessions} onSessionFocus={handleSessionFocus}>
				{#snippet sessionContainer(session, index)}
					<SessionContainer
						{session}
						{index}
						onClose={handleSessionClose}
						onUnpin={handleSessionUnpin}
					>
						{#snippet header({ session, onClose, onUnpin, index })}
							<SessionHeader {session} {onClose} {onUnpin} {index} />
						{/snippet}

						{#snippet content({ session, isLoading, index })}
							<SessionViewport {session} {isLoading} {index} />
						{/snippet}
					</SessionContainer>
				{/snippet}
			</SessionGrid>
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
	/>
</div>

<!-- Modals -->
{#if activeModal}
	{#if activeModal.type === 'createSession'}
		<CreateSessionModalSimplified
			bind:open={createSessionModalOpen}
			initialType={activeModal.data?.type || 'claude'}
			oncreated={handleSessionCreate}
		/>
	{:else if activeModal.type === 'settings'}
		<SettingsModal open={true} onclose={() => modalViewModel.closeModal('settings')} />
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
