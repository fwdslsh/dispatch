<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { innerWidth } from 'svelte/reactivity/window';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	// Services and ViewModels
	import { provideServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';
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
	let sessionViewModel = $state();
	let appStateManager = $state();
	let bwinHostRef = $state(null);

	// Component references
	let workspaceViewMode = $state('window-manager');
	let activeSessionId = $state(null);
	let editModeEnabled = $state(false);
	let openPaneIds = $state(new Set()); // Track which sessions have open panes

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

	// All sessions from ViewModel
	const allSessions = $derived(sessionViewModel?.sessions ?? []);
	const totalSessions = $derived(allSessions.length);
	const hasActiveSessions = $derived(totalSessions > 0);
	const selectedSingleSession = $derived.by(() => {
		if (!allSessions.length) return null;
		if (activeSessionId) {
			return allSessions.find((session) => session.id === activeSessionId) ?? allSessions[0];
		}
		return allSessions[0];
	});
	const currentSessionIndex = $derived.by(() => {
		if (!selectedSingleSession) return 0;
		const index = allSessions.findIndex((session) => session.id === selectedSingleSession.id);
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
		// 1. Initialize services
		sessionViewModel = await container.get('sessionViewModel');
		appStateManager = await container.get('appStateManager');

		// 2. Load sessions from API
		await sessionViewModel.loadSessions();

		// Setup PWA install prompt
		if (typeof window !== 'undefined') {
			function handleBeforeInstallPrompt(e) {
				e.preventDefault();
				deferredPrompt = e;
				log.info('PWA install prompt available');
			}

			window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

			// Save session IDs before page unload
			const handleBeforeUnload = () => {
				const sessionIds = Array.from(openPaneIds);
				localStorage.setItem('dispatch-session-ids', JSON.stringify(sessionIds));
				log.info('Saved session IDs:', sessionIds);
			};

			window.addEventListener('beforeunload', handleBeforeUnload);

			__removeWorkspacePageListeners = () => {
				window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
				window.removeEventListener('beforeunload', handleBeforeUnload);
			};
		}

		// Check for PWA shortcut parameters
		const urlParams = new SvelteURLSearchParams(window.location.search);
		const newSessionType = urlParams.get('new');
		if (newSessionType === 'pty' || newSessionType === 'claude') {
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
		// For quick-create buttons, create session directly with global settings
		if (sessionViewModel) {
			try {
				// Get default cwd from settings or use /workspace
				const cwd = settingsService.get('global.defaultWorkspaceDirectory', '/workspace');

				// Get global default settings for this session type
				const defaultOptions = getGlobalDefaultSettings(type);

				await sessionViewModel.createSession({
					type: type,
					cwd: cwd,
					options: defaultOptions
				});

				log.info(`Created ${type} session in ${cwd} with default options:`, defaultOptions);
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

	// Helper to get global default settings for a session type
	// This processes settings the same way ClaudeSettings component does for session mode
	function getGlobalDefaultSettings(sessionType) {
		switch (sessionType) {
			case SESSION_TYPE.CLAUDE: {
				// Get raw values from settings service
				const model = settingsService.get('claude.model', '');
				const customSystemPrompt = settingsService.get('claude.customSystemPrompt', '');
				const appendSystemPrompt = settingsService.get('claude.appendSystemPrompt', '');
				const maxTurns = settingsService.get('claude.maxTurns', null);
				const maxThinkingTokens = settingsService.get('claude.maxThinkingTokens', null);
				const fallbackModel = settingsService.get('claude.fallbackModel', '');
				const includePartialMessages = settingsService.get('claude.includePartialMessages', false);
				const continueConversation = settingsService.get('claude.continueConversation', false);
				const permissionMode = settingsService.get('claude.permissionMode', 'default');
				const executable = settingsService.get('claude.executable', 'auto');
				const executableArgs = settingsService.get('claude.executableArgs', '');
				const allowedTools = settingsService.get('claude.allowedTools', '');
				const disallowedTools = settingsService.get('claude.disallowedTools', '');
				const additionalDirectories = settingsService.get('claude.additionalDirectories', '');
				const strictMcpConfig = settingsService.get('claude.strictMcpConfig', false);

				// Process settings the same way ClaudeSettings component does for session mode
				const cleanSettings = {
					model: model.trim() || undefined,
					customSystemPrompt: customSystemPrompt.trim() || undefined,
					appendSystemPrompt: appendSystemPrompt.trim() || undefined,
					maxTurns: maxTurns || undefined,
					maxThinkingTokens: maxThinkingTokens || undefined,
					fallbackModel: fallbackModel.trim() || undefined,
					includePartialMessages: includePartialMessages || undefined,
					continue: continueConversation || undefined,
					permissionMode: permissionMode !== 'default' ? permissionMode : undefined,
					executable: executable !== 'auto' ? executable : undefined,
					executableArgs: executableArgs.trim()
						? executableArgs
								.split(',')
								.map((arg) => arg.trim())
								.filter(Boolean)
						: undefined,
					allowedTools: allowedTools.trim()
						? allowedTools
								.split(',')
								.map((tool) => tool.trim())
								.filter(Boolean)
						: undefined,
					disallowedTools: disallowedTools.trim()
						? disallowedTools
								.split(',')
								.map((tool) => tool.trim())
								.filter(Boolean)
						: undefined,
					additionalDirectories: additionalDirectories.trim()
						? additionalDirectories
								.split(',')
								.map((dir) => dir.trim())
								.filter(Boolean)
						: undefined,
					strictMcpConfig: strictMcpConfig || undefined
				};

				// Remove undefined values (only include overrides)
				return Object.fromEntries(
					Object.entries(cleanSettings).filter(([_, value]) => value !== undefined)
				);
			}
			case SESSION_TYPE.PTY:
			case SESSION_TYPE.FILE_EDITOR:
			default:
				// PTY and File Editor don't have configurable global settings yet
				return {};
		}
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

		const index = allSessions.findIndex((session) => session.id === id);
		if (index >= 0) {
			sessionViewModel?.setMobileSessionIndex?.(index);
		}
	}

	function handleToggleSessionMenu() {
		sessionMenuOpen = !sessionMenuOpen;
	}

	function handleNavigateSession(direction) {
		if (!allSessions.length) return;

		const currentIndex = allSessions.findIndex((session) => session.id === activeSessionId);
		const safeIndex = currentIndex >= 0 ? currentIndex : 0;

		if (direction === 'next') {
			const nextIndex = Math.min(safeIndex + 1, allSessions.length - 1);
			const targetSession = allSessions[nextIndex] ?? allSessions[safeIndex];
			if (targetSession) {
				updateActiveSession(targetSession.id);
			}
			sessionViewModel?.navigateToNextSession();
		} else if (direction === 'prev') {
			const prevIndex = Math.max(safeIndex - 1, 0);
			const targetSession = allSessions[prevIndex] ?? allSessions[safeIndex];
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

	async function handleSessionClose(sessionId) {
		const currentIndex = allSessions.findIndex((session) => session.id === sessionId);
		const fallbackSession =
			allSessions[currentIndex + 1] ?? allSessions[currentIndex - 1] ?? null;

		// Remove pane first
		removeSessionPane(sessionId);

		// Close session
		await sessionViewModel.closeSession(sessionId);

		if (sessionId === activeSessionId) {
			updateActiveSession(fallbackSession?.id ?? null);
		}
	}

	// T011: Pane management for sv-window-manager
	function addSessionToPane(session, paneConfig = {}) {
		// Normalize sessionType field
		const sessionType = session?.sessionType || session?.type;

		log.info('addSessionToPane called', {
			sessionId: session?.id,
			sessionType: sessionType,
			hasBwinHost: !!bwinHostRef,
			paneConfig
		});

		if (!bwinHostRef) {
			log.error('Cannot add pane: BwinHost not available', {
				sessionId: session?.id
			});
			return;
		}

		if (!session || !session.id || !sessionType) {
			log.error('Invalid session data for adding pane:', session);
			return;
		}

		const component = getComponentForSessionType(sessionType);
		if (!component) {
			log.error('No component found for session type:', sessionType);
			return;
		}

		// Get session module to prepare props (use normalized sessionType)
		const module = getClientSessionModule(sessionType);
		const props = module?.prepareProps ? module.prepareProps(session) : { sessionId: session.id };

		try {
			bwinHostRef.addPane(
				session.id, // Use sessionId as pane ID
				paneConfig, // Use saved pane config or defaults
				component, // Svelte component to render
				props // Props to pass to component
			);
			openPaneIds.add(session.id); // Track open pane
			log.info('Added session to pane:', session.id, sessionType);
		} catch (error) {
			log.error('Failed to add pane for session:', session.id, error);
		}
	}

	// Remove session pane
	function removeSessionPane(sessionId) {
		if (!bwinHostRef) return;

		bwinHostRef.removePane(sessionId);
		openPaneIds.delete(sessionId);
		log.info('Removed pane:', sessionId);
	}

	function handleSessionCreate(detail) {
		const { id, type } = detail;
		if (!id || !type) return;

		// Get session from ViewModel
		const session = sessionViewModel.getSession(id);
		if (!session) return;

		// Add pane
		addSessionToPane(session);
		updateActiveSession(id);

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

	// Restore saved sessions when BwinHost and sessionViewModel are ready
	$effect(() => {
		if (!bwinHostRef || !sessionViewModel) return;

		// Load session IDs from localStorage
		const savedSessionIds = localStorage.getItem('dispatch-session-ids');
		if (!savedSessionIds) {
			log.info('No saved session IDs found');
			return;
		}

		// Restore sessions asynchronously
		(async () => {
			try {
				const sessionIds = JSON.parse(savedSessionIds);
				log.info('Restoring sessions:', sessionIds);

				// Use for...of instead of forEach to properly await each operation
				for (const sessionId of sessionIds) {
					// Check if session is already loaded
					let session = sessionViewModel.getSession(sessionId);

					if (!session) {
						// Session not loaded - try to resume it
						log.info('Resuming session:', sessionId);
						try {
							await sessionViewModel.resumeSession(sessionId);
							// Reload sessions to pick up the resumed session
							await sessionViewModel.loadSessions();
							session = sessionViewModel.getSession(sessionId);
							log.info('Successfully resumed session:', sessionId);
						} catch (error) {
							log.warn('Failed to resume session:', sessionId, error.message);
							continue;  // Skip to next session
						}
					}

					// Add pane for restored/resumed session
					if (session && !openPaneIds.has(sessionId)) {
						log.info('Adding session to pane:', sessionId);
						addSessionToPane(session);
					}
				}

				log.info('Session restoration complete');
			} catch (error) {
				log.error('Failed to restore sessions:', error);
			}
		})();
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
							if (!selectedId) return;

							// Add pane for this session if not already open
							const session = sessionViewModel.getSession(selectedId);
							if (session && !openPaneIds.has(selectedId)) {
								addSessionToPane(session);
							}

							updateActiveSession(selectedId);
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
		--bw-container-height: calc(100vh - 155px); /* Adjust for header and status bar heights */
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
