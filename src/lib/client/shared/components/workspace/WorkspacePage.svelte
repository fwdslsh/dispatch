<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { innerWidth } from 'svelte/reactivity/window';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	// Services and ViewModels
	import { provideServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	// WorkspaceViewModel removed - obsolete in unified architecture
	import { createLogger } from '$lib/client/shared/utils/logger.js';
	import { SESSION_TYPE } from '$lib/shared/session-types.js';
	import {
		getComponentForSessionType,
		getClientSessionModule
	} from '$lib/client/shared/session-modules/index.js';
	import { BwinHost } from 'sv-window-manager';

	let windowManagerLoadError = $state(null);

	// Components
	import WorkspaceHeader from './WorkspaceHeader.svelte';
	import SingleSessionView from './SingleSessionView.svelte';
	import StatusBar from './WorkspaceStatusBar.svelte';

	// Modals
	import CreateSessionModal from '$lib/client/shared/components/CreateSessionModal.svelte';
	import ProjectSessionMenu from '$lib/client/shared/components/ProjectSessionMenu.svelte';
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';

	// PWA components
	import PWAInstallPrompt from '$lib/client/shared/components/PWAInstallPrompt.svelte';
	import PWAUpdateNotification from '$lib/client/shared/components/PWAUpdateNotification.svelte';
	import Shell from '../Shell.svelte';

	// SessionSocketManager removed - RunSessionClient now handles socket management automatically

	// Initialize service container with proper URLs for remote connections
	// Use relative URLs that work for both local and remote access
	const container = provideServiceContainer({
		apiBaseUrl: '', // Empty string means use current origin for API calls
		socketUrl: typeof window !== 'undefined' ? window.location.origin : '', // Use current origin for socket connections
		authTokenKey: 'dispatch-auth-token',
		debug: false
	});

	// ViewModels and Services
	const log = createLogger('workspace:page');
	// workspaceViewModel removed - obsolete in unified architecture
	let sessionViewModel = $state();
	let appStateManager = $state();
	let workspaceState = $state();
	let bwinHostRef = $state(null);

	// Component references
	let workspaceViewMode = $state('window-manager');
	let activeSessionId = $state(null);
	let editModeEnabled = $state(false);

	const PWA_INSTALL_GUIDES = {
		ios: {
			title: 'Install Dispatch on iOS',
			description: 'Add Dispatch to your home screen to launch it like a native app:',
			steps: [
				'Tap the share button (the square with an arrow) in Safari.',
				'Scroll down and choose "Add to Home Screen".',
				'Tap "Add" to confirm.'
			]
		},
		default: {
			title: 'Install Dispatch',
			description: 'Install Dispatch as a Progressive Web App using your browser:',
			steps: [
				'Look for an install icon in the address bar.',
				'Or open the browser menu and choose "Install" or "Add to Home Screen".'
			]
		}
	};

	// activeModal: { type: 'createSession' | 'pwaInstructions', data: any } | null
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
		// Authentication is handled server-side via session cookies
		// No client-side auth check needed

		// Get shared ViewModels from container
		sessionViewModel = await container.get('sessionViewModel');
		appStateManager = await container.get('appStateManager');
		workspaceState = appStateManager.workspaces;

		// Load initial data - workspace loading removed in unified architecture
		log.info('Loading sessions...');
		await sessionViewModel.loadSessions();
		log.info('Sessions loaded, count:', sessionViewModel.sessions.length);

		// Auto-initialize workspace with default terminal if empty (T005 integration)
		if (sessionViewModel.sessions.length === 0) {
			log.info('Empty workspace detected, will auto-create terminal on BwinHost mount');
		}

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
		const urlParams = new SvelteURLSearchParams(window.location.search);
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

	function toggleEditMode() {
		editModeEnabled = !editModeEnabled;
		log.info('Edit mode toggled:', editModeEnabled);
	}

	async function handleLogout() {
		try {
			// Call logout endpoint to clear session cookie
			await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});
		} catch (error) {
			log.error('Logout request failed:', error);
			// Continue with redirect even if logout fails
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
			const guide = isIOS ? PWA_INSTALL_GUIDES.ios : PWA_INSTALL_GUIDES.default;
			log.info('Showing manual PWA install instructions', { platform: isIOS ? 'ios' : 'default' });
			activeModal = { type: 'pwaInstructions', data: guide };
		}
	}

	async function handleOpenSettings() {
		await goto('/settings');
	}

	async function handleCreateSession(type = 'claude') {
		// For quick-create buttons, create session directly with default workspace and global settings
		if (sessionViewModel) {
			try {
				// Use the global default workspace path
				const defaultWorkspace = getUserDefaultWorkspace();

				// Get global default settings for this session type
				const defaultOptions = getGlobalDefaultSettings(type);

				await sessionViewModel.createSession({
					type: type,
					workspacePath: defaultWorkspace,
					options: defaultOptions
				});

				log.info(
					`Created ${type} session directly with workspace: ${defaultWorkspace} and default options:`,
					defaultOptions
				);
			} catch (error) {
				log.error(`Failed to create ${type} session:`, error);
				// Fall back to opening the modal if direct creation fails
				openCreateSessionModal(type);
			}
		} else {
			// Fallback to modal if sessionViewModel not available
			openCreateSessionModal(type);
		}
	}

	// Function to handle create session button (opens modal)
	function handleCreateSessionModal(type = 'claude') {
		openCreateSessionModal(type);
	}

	// Helper to get user's default workspace via ViewModel (MVVM pattern)
	function getUserDefaultWorkspace() {
		return sessionViewModel?.getDefaultWorkspace() || '';
	}

	// Helper to get global default settings for a session type via ViewModel (MVVM pattern)
	// Delegates to SessionViewModel which processes settings the same way session components do
	function getGlobalDefaultSettings(sessionType) {
		return sessionViewModel?.getDefaultSessionOptions(sessionType) || {};
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

		// T013: Remove pane before closing session
		removeSessionPane(sessionId);

		// Close session in SessionViewModel
		sessionViewModel.closeSession(sessionId);

		if (sessionId === activeSessionId) {
			updateActiveSession(fallbackSession?.id ?? null);
		}
	}

	function handleSessionAssignToTile(sessionId, tileId) {
		sessionViewModel.addToLayout(sessionId, tileId);
	}

	// T011: Pane management for sv-window-manager
	function addSessionToPane(session) {
		if (!bwinHostRef) {
			log.warn('Cannot add pane: BwinHost not available', {
				hasWorkspaceState: !!workspaceState,
				hasRef: !!workspaceState?.windowManager?.bwinHostRef,
				hasBwinHost: !!BwinHost
			});
			return;
		}

		if (!session || !session.id || !session.sessionType) {
			console.warn('Invalid session data for adding pane:', session);
			return;
		}
		console.log('Adding session to pane:', session.id, session.sessionType);
		const component = getComponentForSessionType(session.sessionType);
		if (!component) {
			log.error('No component found for session type:', session.sessionType);
			return;
		}

		// Get session module to prepare props
		const module = getClientSessionModule(session.type);
		const props = module?.prepareProps ? module.prepareProps(session) : { sessionId: session.id };

		try {
			bwinHostRef.addPane(
				session.id, // Use sessionId as pane ID
				{}, // Pane config (use library defaults)
				component, // Svelte component to render
				props // Props to pass to component
			);
			log.info('Added session to pane:', session.id, session.type);
		} catch (error) {
			log.error('Failed to add pane for session:', session.id, error);
		}
	}

	// T013: Remove pane when session closes
	function removeSessionPane(sessionId) {
		if (!bwinHostRef) {
			return;
		}

		try {
			// sv-window-manager should handle pane removal via its own API
			// For now, we rely on the library's internal management
			// TODO: Check sv-window-manager API for explicit pane removal method
			log.info('Session closed, pane should be removed by library:', sessionId);
			bwinHostRef.removePane(sessionId);
		} catch (error) {
			log.error('Failed to remove pane:', sessionId, error);
		}
	}

	function handleSessionCreate(detail) {
		const { id, type, workspacePath, typeSpecificId } = detail;
		if (!id || !type || !workspacePath) return;

		updateActiveSession(id);

		// Handle session creation in SessionViewModel
		sessionViewModel.handleSessionCreated({
			id,
			type: type,
			workspacePath,
			typeSpecificId
		});

		// T011: Add session to BwinHost pane
		addSessionToPane({ id, type, workspacePath, typeSpecificId });

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

	// T011: Populate BwinHost with existing sessions when it mounts
	$effect(() => {
		if (!bwinHostRef) {
			return;
		}

		// BwinHost is ready - add all existing sessions as panes
		log.info('BwinHost mounted, adding existing sessions to panes');

		for (const session of sessionsList) {
			if (session && session.isActive) {
				addSessionToPane(session);
			}
		}
	});
</script>

<Shell>
	{#snippet header()}
		<!-- Header (desktop only) -->
		<WorkspaceHeader
			onLogout={handleLogout}
			viewMode={workspaceViewMode}
			{editModeEnabled}
			onEditModeToggle={toggleEditMode}
			onInstallPWA={handleInstallPWA}
			onViewModeChange={setWorkspaceViewMode}
		/>
	{/snippet}
	<div class="dispatch-workspace">
		<!-- Service container is provided via context -->

		<!-- Bottom sheet for sessions -->
		{#if sessionMenuOpen}
			<div
				class="session-sheet flex-col"
				class:open={sessionMenuOpen}
				role="dialog"
				aria-label="Sessions"
			>
				<div class="flex-between p-3" style="border-bottom: 1px solid var(--primary-muted);">
					<div class="modal-title" style="color: var(--primary); font-weight: 700;">Sessions</div>
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
							} catch {
								// Session resume failed - error is logged by sessionViewModel
							}
							sessionMenuOpen = false;
						}}
					/>
				</div>
			</div>
		{/if}

		<!-- Main Content -->
		<div class="workspace-content">
			{#if windowManagerLoadError}
				<!-- T001a: Error UI when sv-window-manager fails to load -->
				<div class="window-manager-error">
					<div class="error-content surface-raised border border-danger radius p-4">
						<h2 class="text-danger mb-2">Window Manager Load Error</h2>
						<p class="text-muted mb-3">
							Failed to load the sv-window-manager library. Workspace operations are unavailable
							until this is resolved.
						</p>
						<details>
							<summary class="cursor-pointer text-sm opacity-70">Error Details</summary>
							<pre
								class="mt-2 p-2 surface radius text-xs overflow-auto">{windowManagerLoadError}</pre>
						</details>
						<div class="mt-4 flex gap-2">
							<button class="btn-primary" onclick={() => window.location.reload()}>
								Reload Page
							</button>
							<button class="btn-secondary" onclick={() => goto('/settings')}>
								Go to Settings
							</button>
						</div>
					</div>
				</div>
			{:else if isWindowManagerView}
				<BwinHost bind:this={bwinHostRef} config={{ fitContainer: true }} />
			{:else}
				<SingleSessionView
					session={selectedSingleSession}
					sessionIndex={currentSessionIndex}
					onSessionFocus={handleSessionFocus}
					onSessionClose={handleSessionClose}
					onCreateSession={handleCreateSession}
				/>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<!-- Status Bar -->
		<StatusBar
			onOpenSettings={handleOpenSettings}
			onCreateSession={handleCreateSessionModal}
			onToggleSessionMenu={handleToggleSessionMenu}
			onNavigateSession={handleNavigateSession}
			{sessionMenuOpen}
			{isMobile}
			{hasActiveSessions}
			{currentSessionIndex}
			{totalSessions}
			viewMode={workspaceViewMode}
		/>
	{/snippet}
	<!-- Modals -->
	{#if activeModal}
		{#if activeModal.type === 'createSession'}
			<CreateSessionModal
				open={createSessionModalOpen}
				initialType={activeModal.data?.type || 'claude'}
				oncreated={handleSessionCreate}
				onclose={closeActiveModal}
			/>
		{:else if activeModal.type === 'pwaInstructions'}
			<Modal open={true} title={activeModal.data?.title} size="small" onclose={closeActiveModal}>
				<div class="flex-col gap-4" style="line-height: 1.6;">
					{#if activeModal.data?.description}
						<p class="m-0 text-muted" style="color: var(--text-secondary);">
							{activeModal.data.description}
						</p>
					{/if}
					{#if activeModal.data?.steps?.length}
						<ol class="pwa-instructions__steps flex-col gap-2">
							{#each activeModal.data.steps as step, i (i)}
								<li>{step}</li>
							{/each}
						</ol>
					{/if}
				</div>
				{#snippet footer()}
					<div class="flex gap-3" style="justify-content: flex-end;">
						<Button variant="primary" onclick={closeActiveModal}>Got it</Button>
					</div>
				{/snippet}
			</Modal>
		{/if}
	{/if}

	<PWAInstallPrompt />
	<PWAUpdateNotification />
</Shell>

<style>
	.dispatch-workspace {
		--bw-container-height: calc(100vh - 175px); /* Adjust for header and status bar heights */
		--bw-container-width: stretch;

		/* Typography */
		--bw-font-family: var(--font-sans);
		--bw-font-size: var(--font-size-1);

		/* Colors - Using theme variables */
		--bw-drop-area-bg-color: var(--primary-muted);
		--bw-pane-bg-color: var(--bg);
		--bw-muntin-bg-color: var(--surface);
		--bw-glass-bg-color: var(--surface);
		--bw-glass-border-color: var(--surface-border);

		--bw-glass-border-color-disabled: var(--line);
		--bw-glass-bg-color-disabled: var(--surface);
		--bw-glass-header-bg-color: var(--elev);
		--bw-glass-tab-hover-bg: var(--hover-bg);
		--bw-glass-action-hover-bg: var(--hover-bg);
		--bw-minimized-glass-hover-bg: var(--hover-bg);

		/* Sizing & Spacing */
		--bw-glass-clearance: var(--space-0);
		--bw-glass-border-radius: var(--radius);
		--bw-glass-header-height: 30px;
		--bw-glass-header-gap: var(--space-1);
		--bw-sill-gap: var(--space-2);
		--bw-action-gap: var(--space-0);
		--bw-minimized-glass-height: 10px;
		--bw-minimized-glass-basis: 10%;

		:global(.bw-glass-action){
			background: transparent;
			border: none;
			color: var(--primary);
		}
	}
	/* Workspace-specific layout */
	/* .dispatch-workspace {
		position: relative;
		display: grid;
		overflow: hidden;
		height: stretch;
		width: stretch;
		.workspace-content {
			overflow: hidden;
		}
	} */

	/* Session bottom sheet - mobile specific */
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

	/* Sheet body */
	.sheet-body {
		overflow-y: auto;
		overflow-x: hidden;
		min-height: calc(100% - 60px);
		padding: 0;
		-webkit-overflow-scrolling: touch;
	}

	/* Sheet close button */
	.sheet-close {
		background: var(--surface-hover);
		border: 1px solid var(--surface-border);
		color: var(--text);
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.5rem;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
		cursor: pointer;
	}

	/* PWA instructions content */
	.pwa-instructions__steps {
		margin: 0;
		padding-left: 1.25rem;
	}

	.pwa-instructions__steps li {
		color: var(--text-primary);
	}

	/* Window manager error UI (T001a) */
	.window-manager-error {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--space-4);
	}

	.window-manager-error .error-content {
		max-width: 600px;
		width: 100%;
	}

	/* Mobile responsive adjustments */
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
