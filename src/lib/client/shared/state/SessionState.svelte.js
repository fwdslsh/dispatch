/**
 * SessionState.svelte.js
 *
 * Focused session state management using Svelte 5 runes.
 * Single responsibility: managing session data and lifecycle.
 */

import { createLogger } from '../utils/logger.js';
import { SESSION_TYPE } from '../../../shared/session-types.js';

const log = createLogger('session-state');

export class SessionState {
	constructor() {
		// Core session data
		this.sessions = $state([]);
		this.selectedSession = $state(null);
		this.loading = $state(false);
		this.error = $state(null);

		// Activity tracking
		this.sessionActivity = $state(new Map());
		this.lastMessageTimestamps = $state(new Map());

		// Derived state
		this.inLayoutSessions = $derived.by(() => this.sessions.filter((s) => s.inLayout));

		this.activeSessions = $derived.by(() => this.sessions.filter((s) => s.isActive));

		this.claudeSessions = $derived.by(() =>
			this.sessions.filter((s) => s.sessionType === SESSION_TYPE.CLAUDE)
		);

		this.terminalSessions = $derived.by(() =>
			this.sessions.filter((s) => s.sessionType === SESSION_TYPE.PTY)
		);

		this.sessionCount = $derived(this.sessions.length);
		this.hasActiveSessions = $derived(this.activeSessions.length > 0);
	}

	// Session CRUD operations
	loadSessions(sessions) {
		log.info('[SessionState] Loading sessions:', sessions);
		this.sessions = sessions.map((session) => ({
			id: session.id,
			typeSpecificId: session.typeSpecificId,
			workspacePath: session.workspacePath,
			sessionType: session.type || session.sessionType,
			isActive: session.isActive !== undefined ? session.isActive : true,
			inLayout: session.inLayout !== undefined ? session.inLayout : !!session.tileId,
			tileId: session.tileId ?? null,
			title: session.title || `${session.type} session`,
			createdAt: session.createdAt || new Date().toISOString(),
			lastActivity: session.lastActivity || new Date().toISOString(),
			activityState: session.activityState || 'idle'
		}));
		log.info('[SessionState] Processed sessions:', this.sessions);
		this.loading = false;
		this.error = null;
		log.info('Sessions loaded', { count: this.sessions.length });
	}

	addSession(sessionData) {
		const newSession = {
			...sessionData,
			createdAt: new Date().toISOString(),
			lastActivity: new Date().toISOString(),
			isActive: true,
			inLayout: false,
			tileId: sessionData.tileId ?? null
		};
		this.sessions.push(newSession);
		log.info('Session added', newSession.id);
	}

	updateSession(sessionId, updates) {
		const index = this.sessions.findIndex((s) => s.id === sessionId);
		if (index >= 0) {
			this.sessions[index] = { ...this.sessions[index], ...updates };
			log.info('Session updated', sessionId);
		}
	}

	removeSession(sessionId) {
		this.sessions = this.sessions.filter((s) => s.id !== sessionId);
		this.sessionActivity.delete(sessionId);
		this.lastMessageTimestamps.delete(sessionId);
		log.info('Session removed', sessionId);
	}

	// Activity tracking
	updateActivity(sessionId, activityState, timestamp) {
		this.sessionActivity.set(sessionId, activityState);
		if (timestamp) {
			this.lastMessageTimestamps.set(sessionId, timestamp);
		}
	}

	// Query methods
	getSession(sessionId) {
		return this.sessions.find((s) => s.id === sessionId) || null;
	}

	getSessionsByWorkspace(workspacePath) {
		return this.sessions.filter((s) => s.workspacePath === workspacePath);
	}

	getSessionsByType(sessionType) {
		return this.sessions.filter((s) => s.sessionType === sessionType);
	}

	// Loading and error state
	setLoading(loading) {
		this.loading = loading;
	}

	setError(error) {
		this.error = error;
	}

	clearError() {
		this.error = null;
	}
}
