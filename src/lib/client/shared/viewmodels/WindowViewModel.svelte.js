/**
 * Minimal WindowViewModel for UI tile tracking.
 * Simplified implementation for basic session-to-tile mapping.
 */

export class WindowViewModel {
	constructor() {
		this.windowGap = $state(6);
		this.minTileSize = $state(200);
		this.sessions = $state([]);
		this.tileAssignments = $state([]);
	}

	syncSessionsToTiles(sessions = []) {
		this.sessions = Array.isArray(sessions) ? [...sessions] : [];
		this.tileAssignments = this.sessions.map((session) => [session.id, session.id]);
	}

	getSessionForTile(tileId) {
		if (!tileId) return null;
		return this.sessions.find((session) => session.id === tileId) || null;
	}
}
