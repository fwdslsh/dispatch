/**
 * Minimal WindowViewModel for UI tile tracking.
 */

export class WindowViewModel {
	constructor() {
		this.windowGap = $state(6);
		this.minTileSize = $state(200);
		this.keymap = $state({});

		this.sessions = $state([]);
		this.tileAssignments = $state([]); // [tileId, sessionId]
	}

	syncSessionsToTiles(sessions = []) {
		this.sessions = Array.isArray(sessions) ? [...sessions] : [];
		this.tileAssignments = this.sessions.map((session) => [session.id, session.id]);
	}

	getSessionForTile(tileId) {
		if (!tileId) return null;
		return this.sessions.find((session) => session.id === tileId) || null;
	}

	focusTile(tileId) {
		// No-op for now; focus is handled by SessionWindowManager callbacks.
	}

	clearTileAssignment(tileId) {
		if (!tileId) return;
		this.tileAssignments = this.tileAssignments.filter(([id]) => id !== tileId);
	}

	saveLayout() {
		// Persisting layout is optional for this simplified implementation.
	}
}
