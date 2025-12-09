/**
 * WorkspaceViewModel.svelte.js
 *
 * ViewModel for WorkspacePage component.
 * Handles workspace state, session management, modal state, and view mode management.
 *
 * MVVM ARCHITECTURE:
 * - Pure business logic (no UI/DOM concerns)
 * - Manages session lifecycle, view modes, and navigation
 * - Coordinates between SessionViewModel and WorkspaceState
 * - Returns success/failure (never throws)
 */

import { createLogger } from '$lib/client/shared/utils/logger.js';
import {
	getComponentForSessionType,
	getClientSessionModule
} from '$lib/client/shared/session-modules/index.js';

const log = createLogger('workspace:viewmodel');

/**
 * WorkspaceViewModel
 * Manages workspace state, session operations, and view mode
 */
export class WorkspaceViewModel {
	// View mode state
	workspaceViewMode = $state('window-manager');

	// Session state
	activeSessionId = $state(null);
	sessionMenuOpen = $state(false);

	// Modal state
	activeModal = $state(null); // { type: 'createSession' | 'pwaInstructions', data: any } | null

	// BwinHost reference (managed by View)
	bwinHostRef = $state(null);

	// PWA state
	deferredPrompt = $state(null);

	// Error state
	error = $state(null);

	/**
	 * @param {import('./SessionViewModel.svelte.js').SessionViewModel} sessionViewModel - Session management ViewModel
	 * @param {import('./AppState.svelte.js').AppState} appStateManager - App state manager
	 * @param {Function} gotoFn - Navigation function (injected for testability)
	 */
	constructor(sessionViewModel, appStateManager, gotoFn) {
		this.sessionViewModel = sessionViewModel;
		this.appStateManager = appStateManager;
		this.workspaceState = appStateManager.workspaces;
		this.goto = gotoFn;

		// Derived state
		this.sessionsList = $derived.by(() => {
			const sessions = this.sessionViewModel?.sessions ?? [];
			log.info('[WorkspaceViewModel] SessionsList derived, count:', sessions.length, sessions);
			return sessions;
		});

		this.totalSessions = $derived(this.sessionsList.length);
		this.hasActiveSessions = $derived(this.totalSessions > 0);

		this.selectedSingleSession = $derived.by(() => {
			if (!this.sessionsList.length) return null;
			if (this.activeSessionId) {
				return (
					this.sessionsList.find((session) => session.id === this.activeSessionId) ??
					this.sessionsList[0]
				);
			}
			return this.sessionsList[0];
		});

		this.currentSessionIndex = $derived.by(() => {
			if (!this.selectedSingleSession) return 0;
			const index = this.sessionsList.findIndex(
				(session) => session.id === this.selectedSingleSession.id
			);
			return index >= 0 ? index : 0;
		});

		this.isSingleSessionView = $derived(this.workspaceViewMode === 'single-session');
		this.isWindowManagerView = $derived(!this.isSingleSessionView);
		this.createSessionModalOpen = $derived(this.activeModal?.type === 'createSession');
	}

	/**
	 * Initialize the ViewModel
	 * Loads sessions and sets up initial state
	 */
	async initialize() {
		try {
			log.info('Loading sessions...');
			await this.sessionViewModel.loadSessions();
			log.info('Sessions loaded, count:', this.sessionViewModel.sessions.length);

			// Auto-initialize workspace with default terminal if empty
			if (this.sessionViewModel.sessions.length === 0) {
				log.info('Empty workspace detected, will auto-create terminal on BwinHost mount');
			}

			return true;
		} catch (err) {
			this.error = `Failed to initialize workspace: ${err.message}`;
			log.error('Workspace initialization failed:', err);
			return false;
		}
	}

	/**
	 * Set workspace view mode
	 * @param {string} mode - View mode ('window-manager' or 'single-session')
	 */
	setWorkspaceViewMode(mode) {
		log.info('Setting workspace view mode to', mode);
		this.workspaceViewMode = mode;
		// Debug: Check derived values after setting
		setTimeout(() => {
			log.info(
				'After mode change - isSingleSessionView:',
				this.isSingleSessionView,
				'isWindowManagerView:',
				this.isWindowManagerView
			);
		}, 0);
	}

	/**
	 * Handle logout
	 * Calls logout API and navigates to home
	 */
	async handleLogout() {
		try {
			// Call logout endpoint to clear session cookie
			await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});
			this.goto('/');
			return true;
		} catch (err) {
			log.error('Logout request failed:', err);
			// Continue with redirect even if logout fails
			this.goto('/');
			return false;
		}
	}

	/**
	 * Handle PWA install
	 * Shows install prompt or manual instructions
	 * @param {Object} pwaInstallGuides - PWA installation guide objects
	 */
	handleInstallPWA(pwaInstallGuides) {
		if (this.deferredPrompt) {
			this.deferredPrompt.prompt();
			this.deferredPrompt.userChoice.then((choiceResult) => {
				if (choiceResult.outcome === 'accepted') {
					log.info('PWA install prompt accepted');
				} else {
					log.info('PWA install prompt dismissed');
				}
				this.deferredPrompt = null;
			});
		} else {
			// Show manual installation instructions
			const isIOS =
				/iPad|iPhone|iPod/.test(navigator.userAgent) && !(/** @type {any} */ (window).MSStream);
			const guide = isIOS ? pwaInstallGuides.ios : pwaInstallGuides.default;
			log.info('Showing manual PWA install instructions', {
				platform: isIOS ? 'ios' : 'default'
			});
			this.activeModal = { type: 'pwaInstructions', data: guide };
		}
	}

	/**
	 * Navigate to settings
	 */
	async handleOpenSettings() {
		await this.goto('/settings');
	}

	/**
	 * Create a session directly with default workspace and settings
	 * @param {string} type - Session type
	 */
	async handleCreateSession(type = 'claude') {
		if (!this.sessionViewModel) {
			log.error('SessionViewModel not available');
			this.openCreateSessionModal(type);
			return null;
		}

		try {
			// Use the global default workspace path
			const defaultWorkspace = this.sessionViewModel.getDefaultWorkspace();

			// Get global default settings for this session type
			const defaultOptions = this.sessionViewModel.getDefaultSessionOptions(type);

			const session = await this.sessionViewModel.createSession({
				type: type,
				workspacePath: defaultWorkspace,
				options: defaultOptions
			});

			log.info(
				`Created ${type} session directly with workspace: ${defaultWorkspace} and default options:`,
				defaultOptions
			);

			return session;
		} catch (err) {
			log.error(`Failed to create ${type} session:`, err);
			// Fall back to opening the modal if direct creation fails
			this.openCreateSessionModal(type);
			return null;
		}
	}

	/**
	 * Open create session modal
	 * @param {string} type - Session type
	 */
	openCreateSessionModal(type = 'claude') {
		this.activeModal = { type: 'createSession', data: { type } };
	}

	/**
	 * Close active modal
	 */
	closeActiveModal() {
		this.activeModal = null;
	}

	/**
	 * Update active session
	 * @param {string|null} id - Session ID or null
	 */
	updateActiveSession(id) {
		if (!id) {
			if (this.activeSessionId !== null) {
				this.activeSessionId = null;
			}
			return;
		}

		if (this.activeSessionId !== id) {
			this.activeSessionId = id;
		}

		const index = this.sessionsList.findIndex((session) => session.id === id);
		if (index >= 0) {
			this.sessionViewModel?.setMobileSessionIndex?.(index);
		}
	}

	/**
	 * Toggle session menu
	 */
	toggleSessionMenu() {
		this.sessionMenuOpen = !this.sessionMenuOpen;
	}

	/**
	 * Navigate to next or previous session
	 * @param {string} direction - 'next' or 'prev'
	 */
	handleNavigateSession(direction) {
		if (!this.sessionsList.length) return;

		const currentIndex = this.sessionsList.findIndex(
			(session) => session.id === this.activeSessionId
		);
		const safeIndex = currentIndex >= 0 ? currentIndex : 0;

		if (direction === 'next') {
			const nextIndex = Math.min(safeIndex + 1, this.sessionsList.length - 1);
			const targetSession = this.sessionsList[nextIndex] ?? this.sessionsList[safeIndex];
			if (targetSession) {
				this.updateActiveSession(targetSession.id);
			}
			this.sessionViewModel?.navigateToNextSession();
		} else if (direction === 'prev') {
			const prevIndex = Math.max(safeIndex - 1, 0);
			const targetSession = this.sessionsList[prevIndex] ?? this.sessionsList[safeIndex];
			if (targetSession) {
				this.updateActiveSession(targetSession.id);
			}
			this.sessionViewModel?.navigateToPrevSession();
		}
	}

	/**
	 * Handle session focus
	 * @param {Object} session - Session object
	 */
	handleSessionFocus(session) {
		if (!session) return;
		this.updateActiveSession(session.id);
		// Session focus is now handled automatically by RunSessionClient
	}

	/**
	 * Handle session close
	 * @param {string} sessionId - Session ID to close
	 * @param {boolean} [skipPaneRemoval=false] - Skip pane removal (when called from pane's onClose)
	 */
	async handleSessionClose(sessionId, skipPaneRemoval = false) {
		const currentSessions = this.sessionsList;
		const currentIndex = currentSessions.findIndex((session) => session.id === sessionId);
		const fallbackSession =
			currentSessions[currentIndex + 1] ?? currentSessions[currentIndex - 1] ?? null;

		// Remove pane before closing session (unless pane is already being removed)
		if (!skipPaneRemoval) {
			this.removeSessionPane(sessionId);
		}

		// Close session in SessionViewModel (calls API, which triggers socket event)
		await this.sessionViewModel.closeSession(sessionId);

		// Update active session to fallback if needed
		if (sessionId === this.activeSessionId) {
			this.updateActiveSession(fallbackSession?.id ?? null);
		}

		// Socket.IO event will handle removing from sessions list
	}

	/**
	 * Assign session to tile
	 * @param {string} sessionId - Session ID
	 * @param {string} tileId - Tile ID
	 */
	handleSessionAssignToTile(sessionId, tileId) {
		this.sessionViewModel.addToLayout(sessionId, tileId);
	}

	/**
	 * Add session to BinaryWindow pane (sv-window-manager v0.2.2)
	 * @param {Object} session - Session object
	 */
	addSessionToPane(session) {
		if (!this.bwinHostRef) {
			log.warn('Cannot add pane: BinaryWindow not available', {
				hasWorkspaceState: !!this.workspaceState,
				hasRef: !!this.workspaceState?.windowManager?.bwinHostRef,
				hasBwinHost: !!this.bwinHostRef
			});
			return false;
		}

		if (!session || !session.id) {
			console.warn('Invalid session data for adding pane:', session);
			return false;
		}

		// Normalize session type property (accept both 'type' and 'sessionType')
		const sessionType = session.sessionType || session.type;
		if (!sessionType) {
			console.warn('Session missing type information:', session);
			return false;
		}

		console.log('Adding session to pane:', session.id, sessionType);
		const component = getComponentForSessionType(sessionType);
		if (!component) {
			log.error('No component found for session type:', sessionType);
			return false;
		}

		// Get session module to prepare props
		const module = getClientSessionModule(sessionType);
		const props = module?.prepareProps ? module.prepareProps(session) : { sessionId: session.id };

		try {
			// New API: addPane(targetSashId, { position, component, componentProps, title, id })
			this.bwinHostRef.addPane(
				'root', // targetSashId - add to root sash
				{
					id: session.id, // Use sessionId as pane ID
					position: 'right', // Split position
					title: session.title || sessionType || 'Session',
					component: component, // Svelte component to render
					componentProps: props // Props to pass to component
				}
			);
			log.info('Added session to pane:', session.id, sessionType);
			return true;
		} catch (err) {
			log.error('Failed to add pane for session:', session.id, err);
			return false;
		}
	}

	/**
	 * Remove session pane from BwinHost
	 * Note: Pane removal is now handled automatically by the onpaneremoved event
	 * This method is kept for compatibility but doesn't actually remove panes
	 * @param {string} sessionId - Session ID
	 */
	removeSessionPane(sessionId) {
		log.info('removeSessionPane called for:', sessionId, '(pane removal handled by event)');
		return true;
	}

	/**
	 * Handle session creation event
	 * @param {Object} detail - Session creation detail
	 */
	handleSessionCreate(detail) {
		const { id, type, workspacePath, typeSpecificId } = detail;
		if (!id || !type || !workspacePath) {
			log.warn('Invalid session creation detail:', detail);
			return false;
		}

		this.updateActiveSession(id);

		// Handle session creation in SessionViewModel (only needs id, type, workspacePath)
		this.sessionViewModel.handleSessionCreated({
			id,
			type: type,
			workspacePath
		});

		// Add session to BwinHost pane (include all detail for proper setup)
		this.addSessionToPane({ id, type, workspacePath, typeSpecificId });

		// Close local create session modal if open
		if (this.activeModal?.type === 'createSession') {
			this.activeModal = null;
		}

		return true;
	}

	/**
	 * Handle session selection from menu
	 * @param {Object} detail - Session selection detail
	 */
	async handleSessionSelected(detail) {
		const selectedId = detail?.id;
		if (selectedId) {
			this.updateActiveSession(selectedId);
		}

		try {
			await this.sessionViewModel.handleSessionSelected(detail);

			// If this was a resume operation, add the session to window manager
			if (detail?.shouldResume) {
				const session = this.sessionViewModel.sessions.find((s) => s.id === selectedId);
				if (session && session.isActive) {
					this.addSessionToPane(session);
				}
			}

			this.sessionMenuOpen = false;
			return true;
		} catch (err) {
			// Session resume failed - error is logged by sessionViewModel
			log.error('Failed to select session:', err);
			return false;
		}
	}

	/**
	 * Populate BwinHost with existing sessions
	 * Called when BwinHost mounts
	 */
	populateBwinHost() {
		if (!this.bwinHostRef) {
			return false;
		}

		// BwinHost is ready - add all existing sessions as panes
		log.info('BwinHost mounted, adding existing sessions to panes');

		for (const session of this.sessionsList) {
			if (session && session.isActive) {
				this.addSessionToPane(session);
			}
		}

		return true;
	}

	/**
	 * Ensure active session is set
	 * Auto-selects first session if none selected and sessions exist
	 */
	ensureActiveSession() {
		if (!this.sessionsList.length) {
			this.updateActiveSession(null);
			return;
		}

		if (!this.activeSessionId) {
			const fallbackId = this.sessionsList[0]?.id ?? null;
			if (fallbackId) {
				this.updateActiveSession(fallbackId);
			}
		}
	}

	/**
	 * Set BwinHost reference
	 * @param {Object} ref - BwinHost component reference
	 */
	setBwinHostRef(ref) {
		this.bwinHostRef = ref;
	}

	/**
	 * Set deferred PWA prompt
	 * @param {Object} prompt - Browser PWA install prompt
	 */
	setDeferredPrompt(prompt) {
		this.deferredPrompt = prompt;
	}

	/**
	 * Get current state for debugging
	 * @returns {Object} Current state snapshot
	 */
	getState() {
		return {
			workspaceViewMode: this.workspaceViewMode,
			activeSessionId: this.activeSessionId,
			sessionMenuOpen: this.sessionMenuOpen,
			activeModal: this.activeModal,
			totalSessions: this.totalSessions,
			hasActiveSessions: this.hasActiveSessions,
			currentSessionIndex: this.currentSessionIndex,
			error: this.error
		};
	}
}
