/**
 * AppState.svelte.js
 *
 * Simplified application state manager that composes focused state managers.
 * Replaces the complex AppStateManager with clear separation of concerns.
 */

import { SessionState } from './SessionState.svelte.js';
import { UIState } from './UIState.svelte.js';
import { createLogger } from '../utils/logger.js';

const _log = createLogger('app-state');

export class AppState {
	constructor() {
		// Compose focused state managers
		this.sessions = new SessionState();
		this.ui = new UIState();

		// Combined derived state for complex queries
		this.visibleSessions = $derived.by(() => {
			if (this.ui.layout.isMobile) {
				// Mobile: show current session only
				const validSessions = this.sessions.sessions.filter((s) => s && s.id);
				if (validSessions.length === 0) return [];
				const validIndex = Math.min(this.ui.layout.currentMobileSession, validSessions.length - 1);
				return validSessions.slice(validIndex, validIndex + 1);
			} else {
				// Desktop: map displayed slots to sessions
				const maxVisible = this.ui.layout.maxVisible;
				const ids = this.ui.display.displayedSessionIds.slice(0, maxVisible);
				return ids.map((id) => this.sessions.getSession(id)).filter(Boolean);
			}
		});

		this.currentDisplayedSession = $derived.by(() => {
			if (!this.ui.layout.isMobile) return null;
			const validSessions = this.sessions.sessions.filter((s) => s && s.id);
			const validIndex = Math.min(this.ui.layout.currentMobileSession, validSessions.length - 1);
			return validSessions[validIndex] || null;
		});

		this.canNavigateRight = $derived(
			this.ui.layout.currentMobileSession < this.sessions.sessions.length - 1
		);
	}

	// Convenience methods that delegate to focused managers
	loadSessions(sessions) {
		this.sessions.loadSessions(sessions);

		// Auto-populate display
		const visibleLimit = this.ui.layout.maxVisible || Math.max(1, sessions.length);
		const sessionIds = sessions.slice(0, visibleLimit).map((s) => s.id);
		this.ui.setDisplayedSessions(sessionIds);
	}

	createSession(sessionData) {
		this.sessions.addSession(sessionData);

		// Auto-add to display
		if (this.ui.layout.isMobile) {
			const index = this.sessions.sessions.length - 1;
			this.ui.setMobileSession(index, this.sessions.sessions.length);
		} else {
			this.ui.addToDisplay(sessionData.id);
		}
	}

	removeSession(sessionId) {
		this.sessions.removeSession(sessionId);
		this.ui.removeFromDisplay(sessionId);

		// Adjust mobile index if needed
		if (this.ui.layout.isMobile) {
			const sessionCount = this.sessions.sessions.length;
			if (sessionCount === 0) {
				this.ui.setMobileSession(0, 0);
			} else if (this.ui.layout.currentMobileSession >= sessionCount) {
				this.ui.setMobileSession(sessionCount - 1, sessionCount);
			}
		}
	}

	navigateMobile(direction) {
		this.ui.setMobileSession(direction, this.sessions.sessions.length);
	}

	// Debug helper
	getStateSnapshot() {
		return {
			sessions: {
				count: this.sessions.sessionCount,
				active: this.sessions.activeSessions.length
			},
			ui: {
				layout: this.ui.layout.preset,
				isMobile: this.ui.layout.isMobile,
				displayedSessions: this.ui.display.displayedSessionIds.length,
				activeModal: this.ui.modals.activeModal?.type || null
			}
		};
	}
}
