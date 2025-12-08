<script>
	import { onMount, onDestroy } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { innerWidth } from 'svelte/reactivity/window';
	import { provideServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { createLogger } from '$lib/client/shared/utils/logger.js';
	import { BinaryWindow, addEventHandler, removeEventHandler } from 'sv-window-manager';

	let windowManagerLoadError = $state(null);

	// Components
	import WorkspaceHeader from './WorkspaceHeader.svelte';
	import SingleSessionView from './SingleSessionView.svelte';
	import StatusBar from './WorkspaceStatusBar.svelte';
	import CreateSessionModal from '$lib/client/shared/components/CreateSessionModal.svelte';
	import ProjectSessionMenu from '$lib/client/shared/components/ProjectSessionMenu.svelte';
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import PWAInstallPrompt from '$lib/client/shared/components/PWAInstallPrompt.svelte';
	import PWAUpdateNotification from '$lib/client/shared/components/PWAUpdateNotification.svelte';
	import Shell from '../Shell.svelte';
	import CommandPalette from '../CommandPalette.svelte';

	// Command palette state
	let commandPaletteOpen = $state(false);

	// Initialize service container
	const container = provideServiceContainer({
		apiBaseUrl: '',
		socketUrl: typeof window !== 'undefined' ? window.location.origin : '',
		authTokenKey: 'dispatch-auth-token',
		debug: false
	});

	const log = createLogger('workspace:page');
	let workspaceViewModel = $state(null); // Reactive state for ViewModel
	let isWorkspaceReady = $state(false); // Reactive flag for initialization
	let __removeWorkspacePageListeners = $state(null);

	// PWA install guides for manual installation
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

	// Responsive state - View concern
	const isMobile = $derived(innerWidth.current <= 500);
	$effect(() => {
		if (innerWidth.current <= 500 && workspaceViewModel) {
			workspaceViewModel.setWorkspaceViewMode('single-session');
		}
	});

	// Local reactive state for view mode (synced with ViewModel)
	let viewMode = $state('window-manager');

	// Sync local viewMode with ViewModel changes
	$effect(() => {
		if (workspaceViewModel) {
			console.log('[WorkspacePage] Syncing viewMode from ViewModel:', workspaceViewModel.workspaceViewMode);
			viewMode = workspaceViewModel.workspaceViewMode;
		}
	});

	// Mount lifecycle
	onMount(async () => {
		// Get ViewModel from container
		workspaceViewModel = await container.get('workspaceViewModel');

		// Initialize workspace (loads sessions)
		await workspaceViewModel.initialize();

		// Mark workspace as ready (triggers reactivity)
		isWorkspaceReady = true;

		// Get socket service and set up session:closed handler
		const socketService = await container.get('socket');

		// Ensure socket is connected
		if (!socketService.socket?.connected) {
			await socketService.connect({ path: '/socket.io' });
		}

		// Set up global session:closed event handler
		socketService.on('session:closed', ({ sessionId }) => {
			log.info('Received session:closed event for:', sessionId);

			// Remove session from SessionViewModel
			workspaceViewModel.sessionViewModel.removeSession(sessionId);

			// Note: Pane removal is now handled by onpaneremoved event handler
			// No need to manually remove pane here
		});

		// Set up global pane removal event handler (sv-window-manager v0.2.2)
		const handlePaneRemoved = async (evt) => {
			log.info('Pane removed by user, closing session:', evt.pane.id);
			// Skip pane removal since pane is already removed (that's why this event fired)
			await workspaceViewModel.handleSessionClose(evt.pane.id, true);
		};
		addEventHandler('onpaneremoved', handlePaneRemoved);

		// Populate BinaryWindow with existing sessions once after initialization
		if (workspaceViewModel.bwinHostRef) {
			workspaceViewModel.populateBwinHost();
		}

		// Setup PWA install prompt (browser-specific, stays in View)
		if (typeof window !== 'undefined') {
			function handleBeforeInstallPrompt(e) {
				e.preventDefault();
				workspaceViewModel.setDeferredPrompt(e);
				log.info('PWA install prompt available');
			}

			window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

			__removeWorkspacePageListeners = () => {
				window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
				removeEventHandler('onpaneremoved', handlePaneRemoved);
			};
		}

		// Check for PWA shortcut parameters
		const urlParams = new SvelteURLSearchParams(window.location.search);
		const newSessionType = urlParams.get('new');
		if (newSessionType === 'pty' || newSessionType === 'claude') {
			workspaceViewModel.openCreateSessionModal(newSessionType);
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
	});

	// Effects for ViewModel state synchronization
	$effect(() => {
		if (workspaceViewModel) {
			workspaceViewModel.ensureActiveSession();
		}
	});

	// Effect to populate BinaryWindow when view switches to window-manager
	$effect(() => {
		if (viewMode === 'window-manager' && workspaceViewModel) {
			console.log('[WorkspacePage] Switched to window-manager mode');
			// Use setTimeout to wait for bind:this to complete
			setTimeout(() => {
				console.log('[WorkspacePage] Checking if BwinHost ref is ready...');
				if (workspaceViewModel.bwinHostRef) {
					console.log('[WorkspacePage] BwinHost ref is ready, populating panes');
					workspaceViewModel.populateBwinHost();
				} else {
					console.log('[WorkspacePage] BwinHost ref not ready yet');
				}
			}, 0);
		}
	});
</script>

<Shell>
	{#snippet header()}
		<WorkspaceHeader
			onLogout={() => workspaceViewModel?.handleLogout()}
			onInstallPWA={() => workspaceViewModel?.handleInstallPWA(PWA_INSTALL_GUIDES)}
		/>
	{/snippet}

	<div class="dispatch-workspace">
		<!-- Session menu bottom sheet -->
		{#if workspaceViewModel?.sessionMenuOpen}
			<div
				class="session-sheet flex-col"
				class:open={workspaceViewModel.sessionMenuOpen}
				role="dialog"
				aria-label="Sessions"
			>
				<div class="flex-between p-3" style="border-bottom: 1px solid var(--primary-muted);">
					<div class="modal-title" style="color: var(--primary); font-weight: 700;">Sessions</div>
					<button
						class="sheet-close"
						onclick={() => (workspaceViewModel.sessionMenuOpen = false)}
						aria-label="Close"
					>
						✕
					</button>
				</div>
				<div class="sheet-body">
					<ProjectSessionMenu
						onNewSession={(e) => {
							const { type } = e.detail || {};
							workspaceViewModel?.handleCreateSession(type);
						}}
						onSessionSelected={(e) => {
							workspaceViewModel?.handleSessionSelected(e.detail);
						}}
					/>
				</div>
			</div>
		{/if}

		<!-- Main Content -->
		<div class="workspace-content">
			{#if windowManagerLoadError}
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
							<button
								class="btn-secondary"
								onclick={() => workspaceViewModel?.handleOpenSettings()}
							>
								Go to Settings
							</button>
						</div>
					</div>
				</div>
			{:else if isWorkspaceReady && viewMode === 'window-manager'}
				<BinaryWindow
					bind:this={workspaceViewModel.bwinHostRef}
					settings={{ id: 'root', fitContainer: true }}
				/>
			{:else}
				<SingleSessionView
					session={workspaceViewModel?.selectedSingleSession}
					sessionIndex={workspaceViewModel?.currentSessionIndex}
					totalSessions={workspaceViewModel?.totalSessions}
					onSessionFocus={(session) => workspaceViewModel?.handleSessionFocus(session)}
					onSessionClose={(sessionId) => workspaceViewModel?.handleSessionClose(sessionId)}
					onCreateSession={(type) => workspaceViewModel?.handleCreateSession(type)}
					onNavigateSession={(direction) => workspaceViewModel?.handleNavigateSession(direction)}
				/>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<StatusBar
			onOpenSettings={() => workspaceViewModel?.handleOpenSettings()}
			onCreateSession={(type) => workspaceViewModel?.openCreateSessionModal(type)}
			onToggleSessionMenu={() => workspaceViewModel?.toggleSessionMenu()}
			onNavigateSession={(direction) => workspaceViewModel?.handleNavigateSession(direction)}
			onViewModeChange={(mode) => {
				console.log('[WorkspacePage] onViewModeChange called, setting viewMode to:', mode);
				workspaceViewModel?.setWorkspaceViewMode(mode);
				viewMode = mode;
				console.log('[WorkspacePage] viewMode after update:', viewMode);
			}}
			sessionMenuOpen={workspaceViewModel?.sessionMenuOpen}
			{isMobile}
			hasActiveSessions={workspaceViewModel?.hasActiveSessions}
			currentSessionIndex={workspaceViewModel?.currentSessionIndex}
			totalSessions={workspaceViewModel?.totalSessions}
			viewMode={viewMode}
		/>
	{/snippet}

	<!-- Modals -->
	{#if workspaceViewModel?.activeModal}
		{#if workspaceViewModel.activeModal.type === 'createSession'}
			<CreateSessionModal
				open={workspaceViewModel.createSessionModalOpen}
				initialType={workspaceViewModel.activeModal.data?.type || 'claude'}
				oncreated={(detail) => workspaceViewModel.handleSessionCreate(detail)}
				onclose={() => workspaceViewModel.closeActiveModal()}
			/>
		{:else if workspaceViewModel.activeModal.type === 'pwaInstructions'}
			<Modal
				open={true}
				title={workspaceViewModel.activeModal.data?.title}
				size="small"
				onclose={() => workspaceViewModel.closeActiveModal()}
			>
				<div class="flex-col gap-4" style="line-height: 1.6;">
					{#if workspaceViewModel.activeModal.data?.description}
						<p class="m-0 text-muted" style="color: var(--text-secondary);">
							{workspaceViewModel.activeModal.data.description}
						</p>
					{/if}
					{#if workspaceViewModel.activeModal.data?.steps?.length}
						<ol class="pwa-instructions__steps flex-col gap-2">
							{#each workspaceViewModel.activeModal.data.steps as step, i (i)}
								<li>{step}</li>
							{/each}
						</ol>
					{/if}
				</div>
				{#snippet footer()}
					<div class="flex gap-3" style="justify-content: flex-end;">
						<Button variant="primary" onclick={() => workspaceViewModel.closeActiveModal()}>
							Got it
						</Button>
					</div>
				{/snippet}
			</Modal>
		{/if}
	{/if}

	<PWAInstallPrompt />
	<PWAUpdateNotification />

	<!-- Command Palette (Cmd/Ctrl+K) -->
	<CommandPalette
		bind:open={commandPaletteOpen}
		onCreateTerminal={() => workspaceViewModel?.handleCreateSession('pty')}
		onCreateAI={() => workspaceViewModel?.handleCreateSession('ai')}
		onLogout={() => workspaceViewModel?.handleLogout()}
	/>
</Shell>

<style>
	.dispatch-workspace {
		--bw-container-height: stretch;
		--bw-container-width: stretch;
		--bw-font-family: var(--font-sans);
		--bw-font-size: var(--font-size-1);
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
		--bw-glass-clearance: var(--space-0);
		--bw-glass-border-radius: var(--radius);
		--bw-glass-header-height: 30px;
		--bw-glass-header-gap: var(--space-1);
		--bw-sill-gap: var(--space-2);
		--bw-action-gap: var(--space-0);
		--bw-minimized-glass-height: 10px;
		--bw-minimized-glass-basis: 10%;
	}

	.workspace-content {
		height: var(--bw-container-height);
		width: 100%;
		position: relative;
	}

	:global(.bw-glass-action) {
		background: transparent;
		border: none;
		color: var(--primary);
	}

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

	.sheet-body {
		overflow-y: auto;
		overflow-x: hidden;
		min-height: calc(100% - 60px);
		padding: 0;
		-webkit-overflow-scrolling: touch;
	}

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

	.pwa-instructions__steps {
		margin: 0;
		padding-left: 1.25rem;
	}

	.pwa-instructions__steps li {
		color: var(--text-primary);
	}

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
