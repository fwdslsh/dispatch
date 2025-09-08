/**
 * SessionsViewModel - MVVM pattern for session management
 * Extends BaseViewModel with Svelte 5 runes for reactive state management
 */
import { BaseViewModel } from '../../shared/components/BaseViewModel.svelte.js';
import { SessionClient } from '../io/SessionClient.js';
import { io } from 'socket.io-client';

export class SessionsViewModel extends BaseViewModel {
	// Session state using Svelte 5 $state runes
	sessions = $state([]);
	activeSessions = $state([]);
	currentSession = $state(null);

	// Services - static imports for dependencies
	sessionClient = null;

	// Derived state using $derived rune
	hasSessions = $derived(this.sessions.length > 0);
	hasActiveSessions = $derived(this.activeSessions.length > 0);
	sessionCount = $derived(this.sessions.length);

	constructor() {
		super();
		this._initializeClient();
	}

	/**
	 * Initialize the session client with socket.io
	 */
	_initializeClient() {
		try {
			this.sessionClient = new SessionClient(io, {});
		} catch (err) {
			this.setError(`Failed to initialize session client: ${err.message}`);
		}
	}

	/**
	 * Load sessions from the server
	 */
	async loadSessions() {
		if (this.loading || !this.sessionClient) {
			console.log('[SESSIONS-VM] loadSessions called but skipped:', { loading: this.loading, hasClient: !!this.sessionClient });
			return;
		}

		console.log('[SESSIONS-VM] Starting to load sessions...');
		this.loading = true;
		this.setError(null);

		// Use callback-based approach instead of Promise
		this.sessionClient.list((response) => {
			console.log('[SESSIONS-VM] Session list response:', response);
			try {
				if (response && response.success) {
					this.sessions = response.sessions || [];
					this.activeSessions = this.sessions.filter(s => s.status === 'active');
					console.log('[SESSIONS-VM] Loaded sessions:', { total: this.sessions.length, active: this.activeSessions.length });
				} else {
					console.error('[SESSIONS-VM] Session list response not successful:', response);
					this.setError(`Failed to load sessions: ${response?.error || 'Unknown error'}`);
					this.sessions = [];
					this.activeSessions = [];
				}
			} catch (err) {
				console.error('[SESSIONS-VM] Error processing session response:', err);
				this.setError(`Failed to process sessions: ${err.message}`);
				this.sessions = [];
				this.activeSessions = [];
			} finally {
				this.loading = false;
			}
		});
	}

	/**
	 * Attach to a specific session
	 */
	async attachToSession(sessionId, options = {}) {
		if (this.loading || !this.sessionClient) return;

		this.loading = true;
		this.setError(null);

		try {
			const response = await this.sessionClient.attachAsync(sessionId, options);
			if (response.success) {
				this.currentSession = response.session;
			}
			return response;
		} catch (err) {
			this.setError(`Failed to attach to session: ${err.message}`);
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * End a session
	 */
	async endSession(sessionId) {
		if (this.loading || !this.sessionClient) return;

		this.loading = true;
		this.setError(null);

		try {
			const response = await this.sessionClient.endAsync(sessionId);
			if (response.success) {
				// Remove from sessions list
				this.sessions = this.sessions.filter(s => s.id !== sessionId);
				this.activeSessions = this.activeSessions.filter(s => s.id !== sessionId);

				// Clear current session if it was ended
				if (this.currentSession?.id === sessionId) {
					this.currentSession = null;
				}
			}
			return response;
		} catch (err) {
			this.setError(`Failed to end session: ${err.message}`);
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Refresh sessions list
	 */
	async refreshSessions() {
		await this.loadSessions();
	}

	/**
	 * Clear current session
	 */
	clearCurrentSession() {
		this.currentSession = null;
	}

	/**
	 * Set current session
	 */
	setCurrentSession(session) {
		this.currentSession = session;
	}

	/**
	 * Clean up resources
	 */
	dispose() {
		if (this.sessionClient) {
			// Clean up socket connections if needed
			this.sessionClient = null;
		}
		super.dispose();
	}
}