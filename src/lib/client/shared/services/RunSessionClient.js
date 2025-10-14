import { io } from 'socket.io-client';
import { createLogger } from '../utils/logger';
import { getClientId } from '../utils/uuid';

/**
 * Unified client for run session management
 * Replaces multiple session management classes with single interface
 */
export class RunSessionClient {
	constructor(config = {}) {
		this.config = {
			socketUrl: '',
			apiBaseUrl: '',
			apiKey: null,
			...config
		};
		this.socket = null;
		this.clientId = getClientId();
		this.attachedSessions = new Map(); // runId -> { lastSeq, onEvent }
		this.connected = false;
		this.authenticated = false;
		this.logger = createLogger('RunSessionClient');
		this.apiKey = this.config.apiKey || null;
		this.connect();
	}

	/**
	 * Connect to Socket.IO server
	 */
	connect() {
		if (this.socket?.connected) {
			return;
		}

		// Use configured URL or current origin for socket connection
		const socketUrl =
			this.config.socketUrl || (typeof window !== 'undefined' ? window.location.origin : '');
		this.socket = io(socketUrl, {
			path: '/socket.io',
			withCredentials: true,
			transports: ['websocket', 'polling']
		});

		this.socket.on('connect', async () => {
			this.logger.info('Connected to server');
			this.connected = true;
			this.identifyClient();

			// Try to authenticate automatically
			try {
				if (this.apiKey) {
					await this.authenticate({ apiKey: this.apiKey });
				} else {
					await this.authenticate(); // cookie-based
				}
			} catch (err) {
				this.logger.warn('Auto-authentication (cookie) failed:', err?.message || err);
			}
		});

		this.socket.on('disconnect', () => {
			console.log('RunSessionClient: Disconnected from server');
			this.connected = false;
			this.authenticated = false;
		});

		this.socket.on('run:event', (event) => {
			this.handleRunEvent(event);
		});

		this.socket.on('run:error', (error) => {
			console.error('RunSessionClient: Run error:', error);
			// Forward error to attached session handler if available
			const attachment = this.attachedSessions.get(error.runId);
			if (attachment && attachment.onError) {
				attachment.onError(error);
			}
		});
	}

	/**
	 * Identify client with stable clientId
	 * Note: Authentication is now done in authenticate() via client:hello
	 */
	identifyClient() {
		// No longer needed - authentication handled in authenticate()
		// Kept for backward compatibility but does nothing
	}

	/**
	 * Authenticate with server
	 */
	async authenticate(key) {
		return new Promise((resolve, reject) => {
			if (!this.connected) {
				reject(new Error('Not connected to server'));
				return;
			}

			// Support object payloads for explicit field control
			let payload = {};
			if (typeof key === 'object' && key !== null) {
				payload = { clientId: this.clientId, ...key };
			} else if (typeof key === 'string' && key.length > 0) {
				// Default to apiKey field for non-browser clients
				payload = { clientId: this.clientId, apiKey: key };
			} else {
				// Cookie-based
				payload = { clientId: this.clientId };
			}

			this.socket.emit('client:hello', payload, (response) => {
				if (response?.success) {
					this.authenticated = true;
					resolve();
				} else {
					reject(new Error(response?.error || 'Authentication failed'));
				}
			});
		});
	}

	/**
	 * Create a new run session
	 */
	async createRunSession(kind, cwd, options = {}) {
		const baseUrl = this.config.apiBaseUrl || '';
		const headers = { 'Content-Type': 'application/json' };
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
		const response = await fetch(`${baseUrl}/api/sessions`, {
			method: 'POST',
			headers,
			credentials: 'include',
			body: JSON.stringify({ kind, cwd, options })
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.error || 'Failed to create run session');
		}

		return result.runId;
	}

	/**
	 * Attach to a run session with event backlog
	 */
	async attachToRunSession(runId, onEvent, afterSeq = 0, onError = null) {
		return new Promise((resolve, reject) => {
			if (!this.authenticated) {
				reject(new Error('Not authenticated'));
				return;
			}

			this.socket.emit('run:attach', { runId, afterSeq }, (response) => {
				console.log('[RunSessionClient] Attach response:', response);
				if (response?.success) {
					// Store attachment info
					this.attachedSessions.set(runId, {
						lastSeq: afterSeq,
						onEvent,
						onError
					});

					console.log(
						'[RunSessionClient] Stored attachment for runId:',
						runId,
						'Total attachments:',
						this.attachedSessions.size
					);

					// Process backlog events
					if (response.events && Array.isArray(response.events)) {
						response.events.forEach((event) => {
							onEvent(event);
							// Update last sequence
							const attachment = this.attachedSessions.get(runId);
							if (attachment) {
								attachment.lastSeq = Math.max(attachment.lastSeq, event.seq || 0);
							}
						});
					}

					resolve({
						runId,
						backlogEvents: response.events?.length || 0
					});
				} else {
					reject(new Error(response?.error || 'Failed to attach to run session'));
				}
			});
		});
	}

	/**
	 * Send input to a run session
	 */
	sendInput(runId, data) {
		if (!this.authenticated) {
			throw new Error('Not authenticated');
		}

		console.log('[RunSessionClient] Sending input:', {
			runId,
			data,
			connected: this.connected,
			authenticated: this.authenticated
		});
		this.socket.emit('run:input', { runId, data });
	}

	/**
	 * Resize terminal (PTY-specific operation)
	 */
	resizeTerminal(runId, cols, rows) {
		if (!this.authenticated) {
			throw new Error('Not authenticated');
		}

		this.socket.emit('run:resize', { runId, cols, rows });
	}

	/**
	 * Close a run session
	 */
	closeRunSession(runId) {
		if (!this.authenticated) {
			throw new Error('Not authenticated');
		}

		// Remove from attached sessions
		this.attachedSessions.delete(runId);

		// Send close event
		this.socket.emit('run:close', { runId });
	}

	/**
	 * Handle incoming run events
	 */
	handleRunEvent(event) {
		console.log('[RunSessionClient] Received run event:', event);
		const attachment = this.attachedSessions.get(event.runId);
		if (attachment) {
			// Update last sequence
			attachment.lastSeq = Math.max(attachment.lastSeq, event.seq || 0);
			// Forward event to handler
			attachment.onEvent(event);
		} else {
			console.warn(
				'[RunSessionClient] No attachment found for runId:',
				event.runId,
				'Available attachments:',
				Array.from(this.attachedSessions.keys())
			);
		}
	}

	/**
	 * Detach from a run session
	 */
	detachFromRunSession(runId) {
		this.attachedSessions.delete(runId);
	}

	/**
	 * Get list of run sessions
	 */
	async listRunSessions(kind = null) {
		const baseUrl = this.config.apiBaseUrl || '';
		const url = kind
			? `${baseUrl}/api/sessions?kind=${encodeURIComponent(kind)}`
			: `${baseUrl}/api/sessions`;
		const headers = {};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
		const response = await fetch(url, { headers, credentials: 'include' });
		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to list run sessions');
		}

		return result.sessions;
	}

	/**
	 * Delete a run session
	 */
	async deleteRunSession(runId) {
		const baseUrl = this.config.apiBaseUrl || '';
		const headers = {};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
		const response = await fetch(`${baseUrl}/api/sessions?runId=${encodeURIComponent(runId)}`, {
			method: 'DELETE',
			headers,
			credentials: 'include'
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.error || 'Failed to delete run session');
		}

		// Remove from attached sessions
		this.attachedSessions.delete(runId);

		return result;
	}

	/**
	 * Set workspace layout for current client
	 */
	async setWorkspaceLayout(runId, tileId) {
		const baseUrl = this.config.apiBaseUrl || '';
		const headers = { 'Content-Type': 'application/json' };
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
		const response = await fetch(`${baseUrl}/api/sessions`, {
			method: 'PUT',
			headers,
			credentials: 'include',
			body: JSON.stringify({
				action: 'setLayout',
				runId,
				clientId: this.clientId,
				tileId
			})
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.error || 'Failed to set workspace layout');
		}

		return result;
	}

	/**
	 * Remove workspace layout for current client
	 */
	async removeWorkspaceLayout(runId) {
		const baseUrl = this.config.apiBaseUrl || '';
		const headers = { 'Content-Type': 'application/json' };
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
		const response = await fetch(`${baseUrl}/api/sessions`, {
			method: 'PUT',
			headers,
			credentials: 'include',
			body: JSON.stringify({
				action: 'removeLayout',
				runId,
				clientId: this.clientId
			})
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.error || 'Failed to remove workspace layout');
		}

		return result;
	}

	/**
	 * Get workspace layout for current client
	 */
	async getWorkspaceLayout() {
		const baseUrl = this.config.apiBaseUrl || '';
		const headers = { 'Content-Type': 'application/json' };
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
		const response = await fetch(`${baseUrl}/api/sessions`, {
			method: 'PUT',
			headers,
			credentials: 'include',
			body: JSON.stringify({
				action: 'getLayout',
				clientId: this.clientId
			})
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.error || 'Failed to get workspace layout');
		}

		return result.layout;
	}

	/**
	 * Get connection status
	 */
	getStatus() {
		return {
			connected: this.connected,
			authenticated: this.authenticated,
			clientId: this.clientId,
			attachedSessions: Array.from(this.attachedSessions.keys())
		};
	}

	/**
	 * Disconnect from server
	 */
	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
		this.connected = false;
		this.authenticated = false;
		this.attachedSessions.clear();
	}

	/**
	 * Reconnect to server
	 */
	reconnect() {
		this.disconnect();
		this.connect();
	}

	/**
	 * Update API key at runtime (for non-browser clients)
	 * Automatically re-authenticates on next connect.
	 * @param {string|null} key
	 */
	setApiKey(key) {
		this.apiKey = key || null;
	}
}

// Export singleton instance with default config
// Can be reconfigured via runSessionClient.config
export const runSessionClient = new RunSessionClient({
	socketUrl: typeof window !== 'undefined' ? window.location.origin : '',
	apiBaseUrl: ''
});
