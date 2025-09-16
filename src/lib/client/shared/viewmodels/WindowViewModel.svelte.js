/**
 * WindowViewModel.svelte.js
 *
 * ViewModel for window management and tile-based layout using Svelte 5 runes.
 * Manages the mapping between sessions and window tiles, integrating with the WindowManager component.
 */

/**
 * @typedef {import('../components/window-manager/types.js').LayoutNode} LayoutNode
 * @typedef {import('../components/window-manager/types.js').Leaf} Leaf
 * @typedef {import('../components/window-manager/types.js').SplitNode} SplitNode
 */

export class WindowViewModel {
	/**
	 * @param {import('./SessionViewModel.svelte.js').SessionViewModel} sessionViewModel
	 * @param {import('../services/PersistenceService.js').PersistenceService} persistence
	 * @param {import('../services/LayoutService.svelte.js').LayoutService} layoutService
	 */
	constructor(sessionViewModel, persistence, layoutService) {
		this.sessionViewModel = sessionViewModel;
		this.persistence = persistence;
		this.layoutService = layoutService;

		// Window manager state
		this.tileToSessionMap = $state(new Map()); // tileId -> sessionId
		this.sessionToTileMap = $state(new Map()); // sessionId -> tileId
		this.focusedTileId = $state('root');
		this.windowLayout = $state(null); // LayoutNode tree for WindowManager
		this.nextTileId = $state(1); // Counter for generating unique tile IDs

		// Window manager configuration
		this.windowGap = $state(6);
		this.minTileSize = $state(200);
		this.keymap = $state({
			addRight: 'Control+Enter',
			addDown: 'Control+Shift+Enter',
			close: 'Control+Shift+x',
			focusNext: 'Alt+ArrowRight',
			focusPrev: 'Alt+ArrowLeft',
			growHeight: 'Control+ArrowUp',
			shrinkHeight: 'Control+ArrowDown'
		});

		// Derived state
		this.activeTiles = $derived.by(() => {
			const tiles = [];
			for (const [tileId, sessionId] of this.tileToSessionMap) {
				const session = this.sessionViewModel.getSession(sessionId);
				if (session) {
					tiles.push({ tileId, sessionId, session });
				}
			}
			return tiles;
		});

		this.focusedSession = $derived.by(() => {
			const sessionId = this.tileToSessionMap.get(this.focusedTileId);
			return sessionId ? this.sessionViewModel.getSession(sessionId) : null;
		});

		this.hasTiles = $derived(this.tileToSessionMap.size > 0);
		this.tileCount = $derived(this.tileToSessionMap.size);

		// Initialize with existing sessions
		this.initialize();
	}

	/**
	 * Initialize the window manager with existing sessions
	 */
	async initialize() {
		// Restore layout from persistence
		this.restoreLayout();

		// Set up reactive sync with session changes
		//this.setupSessionSync();
	}

	/**
	 * Setup reactive synchronization with SessionViewModel
	 */
	// setupSessionSync() {
	// 	// Watch for session changes and update tiles accordingly
	// 	$effect(() => {
	// 		const displayedSessions = this.sessionViewModel.visibleSessions;
	// 		this.syncSessionsToTiles(displayedSessions);
	// 	});

	// 	// Watch for mobile/desktop mode changes
	// 	$effect(() => {
	// 		if (this.layoutService.isMobile()) {
	// 			// Mobile mode - don't use window manager
	// 			this.clearAllTiles();
	// 		} else {
	// 			// Desktop mode - ensure displayed sessions have tiles
	// 			const displayedSessions = this.sessionViewModel.visibleSessions;
	// 			this.syncSessionsToTiles(displayedSessions);
	// 		}
	// 	});
	// }

	/**
	 * Synchronize sessions to tiles based on displayed sessions
	 * @param {Array} sessions
	 */
	syncSessionsToTiles(sessions) {
		if (this.layoutService.isMobile()) return;

		const currentSessionIds = new Set(this.tileToSessionMap.values());
		const newSessionIds = new Set(sessions.map((s) => s.id));

		// Remove tiles for sessions that are no longer displayed
		for (const [tileId, sessionId] of this.tileToSessionMap) {
			if (!newSessionIds.has(sessionId)) {
				this.removeTileForSession(sessionId);
			}
		}

		// Add tiles for new sessions
		for (const session of sessions) {
			if (!currentSessionIds.has(session.id)) {
				this.addTileForSession(session.id);
			}
		}

		// Update window layout if needed
		this.updateWindowLayout();
	}

	/**
	 * Add a tile for a session
	 * @param {string} sessionId
	 * @param {string|null} targetTileId - Tile to split, null for root
	 * @param {'row'|'column'} direction - Split direction
	 */
	addTileForSession(sessionId, targetTileId = null, direction = 'row') {
		// Don't add if session already has a tile
		if (this.sessionToTileMap.has(sessionId)) return;

		// Use sessionId as tileId for simplicity and consistency
		const tileId = sessionId;

		// Map tile to session (they're the same in this implementation)
		this.tileToSessionMap.set(tileId, sessionId);
		this.sessionToTileMap.set(sessionId, tileId);

		// Focus the new tile
		this.focusedTileId = tileId;

		this.saveLayout();
		console.log(`[WindowViewModel] Added tile for session ${sessionId}`);
	}

	/**
	 * Remove tile for a session
	 * @param {string} sessionId
	 */
	removeTileForSession(sessionId) {
		const tileId = this.sessionToTileMap.get(sessionId);
		if (!tileId) return;

		// Remove mappings
		this.tileToSessionMap.delete(tileId);
		this.sessionToTileMap.delete(sessionId);

		// Update focus if the focused tile was removed
		if (this.focusedTileId === tileId) {
			// Find another tile to focus
			const remainingTiles = Array.from(this.tileToSessionMap.keys());
			this.focusedTileId = remainingTiles.length > 0 ? remainingTiles[0] : 'root';
		}

		this.saveLayout();
		console.log(`[WindowViewModel] Removed tile for session ${sessionId}`);
	}

	/**
	 * Focus a tile and its associated session
	 * @param {string} tileId
	 */
	focusTile(tileId) {
		this.focusedTileId = tileId;

		// Also focus the session in SessionViewModel if applicable
		const sessionId = this.tileToSessionMap.get(tileId);
		if (sessionId) {
			this.sessionViewModel.selectedSessionId = sessionId;
		}

		this.saveLayout();
		console.log(`[WindowViewModel] Focused tile: ${tileId}, session: ${sessionId || 'none'}`);
	}

	/**
	 * Get session for a tile
	 * @param {string} tileId
	 * @returns {Object|null}
	 */
	getSessionForTile(tileId) {
		const sessionId = this.tileToSessionMap.get(tileId);
		return sessionId ? this.sessionViewModel.getSession(sessionId) : null;
	}

	/**
	 * Get tile for a session
	 * @param {string} sessionId
	 * @returns {string|null}
	 */
	getTileForSession(sessionId) {
		return this.sessionToTileMap.get(sessionId) || null;
	}

	/**
	 * Handle session creation - add to window manager
	 * @param {string} sessionId
	 */
	handleSessionCreated(sessionId) {
		if (!this.layoutService.isMobile()) {
			this.addTileForSession(sessionId);
		}
	}

	/**
	 * Handle session closure - remove from window manager
	 * @param {string} sessionId
	 */
	handleSessionClosed(sessionId) {
		this.removeTileForSession(sessionId);
	}

	/**
	 * Split the focused tile and add a new session
	 * @param {'row'|'column'} direction
	 * @param {string|null} sessionId - Session to add, null to create new
	 */
	async splitFocusedTile(direction, sessionId = null) {
		// If no session provided, trigger session creation
		if (!sessionId) {
			// This would trigger the create session modal
			// The session will be added to the split when created
			return { needsSession: true, tileId: this.focusedTileId, direction };
		}

		this.addTileForSession(sessionId, this.focusedTileId, direction);
		return { needsSession: false };
	}

	/**
	 * Close the focused tile and its session
	 */
	async closeFocusedTile() {
		const sessionId = this.tileToSessionMap.get(this.focusedTileId);
		if (sessionId) {
			// Close the session through SessionViewModel
			await this.sessionViewModel.closeSession(sessionId);
			// The tile will be removed automatically through session sync
		}
	}

	/**
	 * Update window layout tree for WindowManager
	 */
	updateWindowLayout() {
		// For now, let WindowManager handle its own layout tree
		// We just provide the tile content mapping
		// Future enhancement: Could build custom layout trees here
	}

	/**
	 * Generate unique tile ID
	 * @returns {string}
	 */
	generateTileId() {
		return `tile-${this.nextTileId++}`;
	}

	/**
	 * Clear all tiles (for mobile mode)
	 */
	clearAllTiles() {
		this.tileToSessionMap.clear();
		this.sessionToTileMap.clear();
		this.focusedTileId = 'root';
		this.saveLayout();
	}

	/**
	 * Save layout state to persistence
	 */
	saveLayout() {
		try {
			const layoutState = {
				tileToSessionMap: Array.from(this.tileToSessionMap.entries()),
				sessionToTileMap: Array.from(this.sessionToTileMap.entries()),
				focusedTileId: this.focusedTileId,
				nextTileId: this.nextTileId,
				windowLayout: this.windowLayout
			};

			this.persistence.set('dispatch-window-layout', layoutState);
		} catch (error) {
			// Gracefully handle persistence errors in test/non-browser environments
			console.warn('[WindowViewModel] Failed to save layout state:', error);
		}
	}

	/**
	 * Restore layout state from persistence
	 */
	restoreLayout() {
		try {
			const savedState = this.persistence.get('dispatch-window-layout', {});

			if (savedState.tileToSessionMap && Array.isArray(savedState.tileToSessionMap)) {
				this.tileToSessionMap = new Map(savedState.tileToSessionMap);
			}
			if (savedState.sessionToTileMap && Array.isArray(savedState.sessionToTileMap)) {
				this.sessionToTileMap = new Map(savedState.sessionToTileMap);
			}
			if (savedState.focusedTileId) {
				this.focusedTileId = savedState.focusedTileId;
			}
			if (savedState.nextTileId) {
				this.nextTileId = savedState.nextTileId;
			}
			if (savedState.windowLayout) {
				this.windowLayout = savedState.windowLayout;
			}
		} catch (error) {
			// Gracefully handle persistence errors in test/non-browser environments
			console.warn('[WindowViewModel] Failed to restore layout state:', error);
		}

		console.log('[WindowViewModel] Restored layout state:', {
			tiles: this.tileToSessionMap.size,
			focused: this.focusedTileId
		});
	}

	/**
	 * Sync focused tile from WindowManager component
	 * This is called when WindowManager's internal focus changes
	 * @param {string} tileId
	 */
	syncFocusFromWindowManager(tileId) {
		if (tileId !== this.focusedTileId) {
			this.focusedTileId = tileId;

			// Update session selection
			const sessionId = this.tileToSessionMap.get(tileId);
			if (sessionId) {
				this.sessionViewModel.selectedSessionId = sessionId;
			}

			this.saveLayout();
			console.log(`[WindowViewModel] Synced focus from WindowManager: ${tileId}`);
		}
	}

	/**
	 * Handle keyboard shortcuts
	 * @param {KeyboardEvent} event
	 * @returns {boolean} Whether the event was handled
	 */
	handleKeyboard(event) {
		// Let WindowManager handle its own keyboard events
		// This is here for potential custom handling in the future
		return false;
	}

	/**
	 * Set window manager configuration
	 * @param {Object} config
	 * @param {number} config.gap
	 * @param {number} config.minSize
	 * @param {Object} config.keymap
	 */
	setConfig(config) {
		if (config.gap !== undefined) this.windowGap = config.gap;
		if (config.minSize !== undefined) this.minTileSize = config.minSize;
		if (config.keymap) this.keymap = { ...this.keymap, ...config.keymap };
	}

	/**
	 * Get current window state for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			tileCount: this.tileCount,
			focusedTileId: this.focusedTileId,
			hasTiles: this.hasTiles,
			activeTiles: this.activeTiles.map((t) => ({
				tileId: t.tileId,
				sessionId: t.sessionId,
				sessionType: t.session?.sessionType
			})),
			isMobile: this.layoutService.isMobile()
		};
	}

	/**
	 * Reset window state
	 */
	reset() {
		this.clearAllTiles();
		this.nextTileId = 1;
		this.windowLayout = null;
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.reset();
	}
}
