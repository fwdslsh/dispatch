/**
 * session-state.svelte.js
 *
 * Shared session state using Svelte 5 runes.
 * Provides global reactive state that can be imported and used across components.
 */

// Reactive state using $state
export const sessionState = $state({
	all: [],
	displayed: [],
	selected: null,
	currentMobileSession: 0,
	isLoading: false,
	error: null
});

// Computed value helpers - create these derived values in your components instead
// Example: const sessionCount = $derived(sessionState.all.length);
// Available computations:
// - pinnedSessions: sessionState.all.filter(s => s.pinned)
// - activeSessions: sessionState.all.filter(s => s.isActive)
// - claudeSessions: sessionState.all.filter(s => s.type === 'claude')
// - terminalSessions: sessionState.all.filter(s => s.type === 'pty' || s.type === 'terminal')
// - sessionCount: sessionState.all.length
// - displayedSessionCount: sessionState.displayed.length
// - hasActiveSessions: sessionState.all.some(s => s.isActive)
// - hasPinnedSessions: sessionState.all.some(s => s.pinned)
// - currentDisplayedSession: sessionState.displayed[sessionState.currentMobileSession] || null
// - canNavigateLeft: sessionState.currentMobileSession > 0
// - canNavigateRight: sessionState.currentMobileSession < sessionState.displayed.length - 1
// - visibleSessions: sessionState.displayed

// State mutation functions
export function addSession(session) {
	if (!sessionState.all.find(s => s.id === session.id)) {
		sessionState.all.push(session);
	}
}

export function removeSession(id) {
	sessionState.all = sessionState.all.filter(s => s.id !== id);
	sessionState.displayed = sessionState.displayed.filter(s => s.id !== id);

	// Adjust mobile session index if needed
	if (sessionState.currentMobileSession >= sessionState.displayed.length) {
		sessionState.currentMobileSession = Math.max(0, sessionState.displayed.length - 1);
	}
}

export function updateSession(id, updates) {
	const session = sessionState.all.find(s => s.id === id);
	if (session) {
		Object.assign(session, updates);
	}

	const displayedSession = sessionState.displayed.find(s => s.id === id);
	if (displayedSession) {
		Object.assign(displayedSession, updates);
	}
}

export function selectSession(session) {
	sessionState.selected = session;
}

export function setDisplayedSessions(sessions) {
	sessionState.displayed = sessions;

	// Reset mobile session index if out of bounds
	if (sessionState.currentMobileSession >= sessions.length) {
		sessionState.currentMobileSession = Math.max(0, sessions.length - 1);
	}
}

export function setAllSessions(sessions) {
	sessionState.all = sessions;
}

export function toggleSessionPin(id) {
	const session = sessionState.all.find(s => s.id === id);
	if (session) {
		session.pinned = !session.pinned;
	}
}

export function setSessionActive(id, isActive) {
	const session = sessionState.all.find(s => s.id === id);
	if (session) {
		session.isActive = isActive;
	}
}

// Mobile navigation functions
export function setCurrentMobileSession(index) {
	if (index >= 0 && index < sessionState.displayed.length) {
		sessionState.currentMobileSession = index;
	}
}

export function navigateMobileSession(direction) {
	const newIndex = sessionState.currentMobileSession + direction;
	if (newIndex >= 0 && newIndex < sessionState.displayed.length) {
		sessionState.currentMobileSession = newIndex;
	}
}

export function navigateToNextSession() {
	navigateMobileSession(1);
}

export function navigateToPrevSession() {
	navigateMobileSession(-1);
}

// Loading and error state
export function setSessionsLoading(loading) {
	sessionState.isLoading = loading;
}

export function setSessionsError(error) {
	sessionState.error = error;
}

export function clearSessionsError() {
	sessionState.error = null;
}

// Bulk operations
export function clearAllSessions() {
	sessionState.all = [];
	sessionState.displayed = [];
	sessionState.selected = null;
	sessionState.currentMobileSession = 0;
}

export function updateSessionOrder(newOrder) {
	sessionState.displayed = newOrder;
}

// Session filtering helpers
export function getSessionsByWorkspace(workspacePath) {
	return sessionState.all.filter(s => s.workspacePath === workspacePath);
}

export function getSessionsByType(type) {
	return sessionState.all.filter(s => s.type === type);
}

export function getSessionById(id) {
	return sessionState.all.find(s => s.id === id);
}