/**
 * TileAssignmentService.svelte.js
 *
 * Core service for managing session-to-tile assignments in the window manager.
 * Uses reactive observation to assign sessions after they're created without
 * interfering with the session creation flow.
 */

export class TileAssignmentService {
	/**
	 * @param {import('../viewmodels/WindowViewModel.svelte.js').WindowViewModel} windowViewModel
	 */
	constructor(windowViewModel) {
		this.windowViewModel = windowViewModel;

		// Reactive state for tile assignments
		this.tileAssignments = $state(new Map()); // tileId -> sessionId
		this.sessionAssignments = $state(new Map()); // sessionId -> tileId

		// Context state for assignment targeting
		this.targetTileId = $state(null); // Which tile should receive the next session
		this.targetSessionType = $state(null); // What type of session is being created
		this.useFocusedTile = $state(false); // Whether to use focused tile for assignment

		// Session tracking for reactive observation
		this.previousSessionIds = $state(new Set());
		this.currentSessions = $state([]);

		// Debug state
		this.debugEnabled = $state(false);
	}

	/**
	 * Set up reactive observation of sessions
	 * @param {Array} sessions - Current sessions array from SessionViewModel
	 */
	observeSessions(sessions) {
		this.currentSessions = sessions;

		// Reactive effect to detect new sessions
		$effect(() => {
			const currentSessionIds = new Set(this.currentSessions.map(s => s.id));

			// Find newly created sessions
			const newSessionIds = [...currentSessionIds].filter(id =>
				!this.previousSessionIds.has(id)
			);

			// Assign new sessions to tiles
			for (const sessionId of newSessionIds) {
				this.assignSessionToTile(sessionId);
			}

			// Update previous session set
			this.previousSessionIds = new Set(currentSessionIds);
		});

		// Clean up assignments when sessions are removed
		$effect(() => {
			const currentSessionIds = new Set(this.currentSessions.map(s => s.id));
			const assignmentsToRemove = [];

			for (const [tileId, sessionId] of this.tileAssignments) {
				if (!currentSessionIds.has(sessionId)) {
					assignmentsToRemove.push(tileId);
				}
			}

			for (const tileId of assignmentsToRemove) {
				this.removeAssignment(tileId);
			}
		});
	}

	/**
	 * Set target tile for the next session (for tile button creation)
	 * @param {string} tileId - The specific tile to target
	 * @param {string} sessionType - Type of session being created
	 */
	setTargetTileForType(tileId, sessionType) {
		this.targetTileId = tileId;
		this.targetSessionType = sessionType;
		this.useFocusedTile = false;

		if (this.debugEnabled) {
			console.log('[TileAssignmentService] Set target tile:', { tileId, sessionType });
		}
	}

	/**
	 * Use focused tile as target for the next session (for modal/menu creation)
	 * @param {string} sessionType - Type of session being created
	 */
	setFocusedTileAsTarget(sessionType) {
		this.targetSessionType = sessionType;
		this.useFocusedTile = true;
		this.targetTileId = null; // Will be resolved when session is created

		if (this.debugEnabled) {
			console.log('[TileAssignmentService] Set focused tile as target:', { sessionType });
		}
	}

	/**
	 * Assign a session to the appropriate tile based on current context
	 * @param {string} sessionId - The session to assign
	 */
	assignSessionToTile(sessionId) {
		let targetTileId = this.targetTileId;

		// Resolve focused tile if needed
		if (this.useFocusedTile) {
			targetTileId = this.windowViewModel?.focusedTileId || 'root';

			// Check if focused tile is already occupied
			if (this.tileAssignments.has(targetTileId)) {
				// Find an empty tile or use root
				targetTileId = this.findEmptyTileOrRoot();
			}
		}

		// Default to root if no target specified
		if (!targetTileId) {
			targetTileId = 'root';
		}

		// Make the assignment
		this.setAssignment(targetTileId, sessionId);

		// Clear context after assignment
		this.clearContext();

		if (this.debugEnabled) {
			console.log('[TileAssignmentService] Assigned session to tile:', {
				sessionId,
				targetTileId,
				totalAssignments: this.tileAssignments.size
			});
		}
	}

	/**
	 * Manually assign a session to a specific tile
	 * @param {string} tileId - Target tile
	 * @param {string} sessionId - Session to assign
	 */
	setAssignment(tileId, sessionId) {
		// Remove any existing assignment for this session
		this.removeSessionAssignment(sessionId);

		// Remove any existing assignment for this tile
		this.removeAssignment(tileId);

		// Make new assignment
		this.tileAssignments.set(tileId, sessionId);
		this.sessionAssignments.set(sessionId, tileId);

		// Trigger reactivity
		this.tileAssignments = new Map(this.tileAssignments);
		this.sessionAssignments = new Map(this.sessionAssignments);
	}

	/**
	 * Remove assignment for a tile
	 * @param {string} tileId - Tile to clear
	 */
	removeAssignment(tileId) {
		const sessionId = this.tileAssignments.get(tileId);
		if (sessionId) {
			this.tileAssignments.delete(tileId);
			this.sessionAssignments.delete(sessionId);

			// Trigger reactivity
			this.tileAssignments = new Map(this.tileAssignments);
			this.sessionAssignments = new Map(this.sessionAssignments);
		}
	}

	/**
	 * Remove assignment for a session
	 * @param {string} sessionId - Session to clear
	 */
	removeSessionAssignment(sessionId) {
		const tileId = this.sessionAssignments.get(sessionId);
		if (tileId) {
			this.removeAssignment(tileId);
		}
	}

	/**
	 * Get session assigned to a tile
	 * @param {string} tileId - Tile to check
	 * @returns {string|null} Session ID or null
	 */
	getSessionForTile(tileId) {
		return this.tileAssignments.get(tileId) || null;
	}

	/**
	 * Get tile assigned to a session
	 * @param {string} sessionId - Session to check
	 * @returns {string|null} Tile ID or null
	 */
	getTileForSession(sessionId) {
		return this.sessionAssignments.get(sessionId) || null;
	}

	/**
	 * Find an empty tile or return root as fallback
	 * @returns {string} Tile ID
	 */
	findEmptyTileOrRoot() {
		// This would need to query the WindowManager for all tile IDs
		// For now, just return root as fallback
		return 'root';
	}

	/**
	 * Clear assignment context after session creation
	 */
	clearContext() {
		this.targetTileId = null;
		this.targetSessionType = null;
		this.useFocusedTile = false;
	}

	/**
	 * Get current state for debugging
	 * @returns {Object} Current state
	 */
	getState() {
		return {
			tileAssignments: Array.from(this.tileAssignments.entries()),
			sessionAssignments: Array.from(this.sessionAssignments.entries()),
			context: {
				targetTileId: this.targetTileId,
				targetSessionType: this.targetSessionType,
				useFocusedTile: this.useFocusedTile
			},
			sessionCount: this.currentSessions.length,
			assignmentCount: this.tileAssignments.size
		};
	}

	/**
	 * Enable debug logging
	 * @param {boolean} enabled - Whether to enable debug logs
	 */
	setDebugEnabled(enabled) {
		this.debugEnabled = enabled;
	}

	/**
	 * Reset all assignments
	 */
	reset() {
		this.tileAssignments.clear();
		this.sessionAssignments.clear();
		this.clearContext();
		this.previousSessionIds.clear();

		// Trigger reactivity
		this.tileAssignments = new Map();
		this.sessionAssignments = new Map();
		this.previousSessionIds = new Set();
	}
}