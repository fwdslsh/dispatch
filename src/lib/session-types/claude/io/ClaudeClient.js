import { BaseClient } from '../../../shared/io/BaseClient.js';

export class ClaudeClient extends BaseClient {
	constructor(io, config = {}) {
		super(io, '/claude', config);
		this.currentSession = null;
		this.isTyping = false;
	}

	setupEventListeners() {
		this.on('claude:auth-status', this.handleAuthStatus.bind(this));
		this.on('claude:session-created', this.handleSessionCreated.bind(this));
		this.on('claude:response', this.handleResponse.bind(this));
		this.on('claude:typing', this.handleTyping.bind(this));
		this.on('claude:cleared', this.handleCleared.bind(this));
		this.on('claude:session-ended', this.handleSessionEnded.bind(this));

		// Authentication flow events
		this.on('claude:auth-started', this.handleAuthStarted.bind(this));
		this.on('claude:auth-output', this.handleAuthOutput.bind(this));
		this.on('claude:auth-url', this.handleAuthUrl.bind(this));
		this.on('claude:auth-completed', this.handleAuthCompleted.bind(this));
	}

	handleAuthStatus(data) {
		if (this.onAuthStatus) {
			this.onAuthStatus(data);
		}
	}

	handleSessionCreated(data) {
		if (this.onSessionCreated) {
			this.onSessionCreated(data);
		}
	}

	handleResponse(data) {
		if (this.onResponse) {
			this.onResponse(data);
		}
	}

	handleTyping(data) {
		this.isTyping = data.isTyping;
		if (this.onTyping) {
			this.onTyping(data);
		}
	}

	handleCleared(data) {
		if (this.onCleared) {
			this.onCleared(data);
		}
	}

	handleSessionEnded(data) {
		if (this.currentSession?.id === data.sessionId) {
			this.currentSession = null;
		}

		if (this.onSessionEnded) {
			this.onSessionEnded(data);
		}
	}

	// New authentication event handlers
	handleAuthStarted(data) {
		if (this.onAuthStarted) {
			this.onAuthStarted(data);
		}
	}

	handleAuthOutput(data) {
		if (this.onAuthOutput) {
			this.onAuthOutput(data);
		}
	}

	handleAuthUrl(data) {
		if (this.onAuthUrl) {
			this.onAuthUrl(data);
		}
	}

	handleAuthCompleted(data) {
		if (this.onAuthCompleted) {
			this.onAuthCompleted(data);
		}
	}

	checkAuth(callback) {
		console.log('checkAuth called with callback');
		this.emit('claude:auth', (response) => {
			console.log('checkAuth response received:', response);
			if (response && response.success !== false) {
				console.log('checkAuth success, calling callback with:', response);
				callback(null, response);
			} else {
				console.log('checkAuth failed, calling callback with error:', response);
				callback(new Error(response?.error || 'Auth check failed'), null);
			}
		});
	}

	createSession(projectId = null, sessionOptions = {}, callback) {
		const params = { projectId, sessionOptions };
		this.emit('claude:create', params, (response) => {
			if (response && response.success) {
				this.currentSession = response.session;
			}
			this._handleResponse(callback)(response);
		});
	}

	sendMessage(message, callback) {
		if (!this.currentSession?.id) {
			callback(new Error('No active Claude session'), null);
			return;
		}

		const params = {
			message,
			sessionId: this.currentSession.id
		};
		this.emit('claude:send', params, this._handleResponse(callback));
	}

	getHistory(callback) {
		if (!this.currentSession?.id) {
			callback(new Error('No active Claude session'), null);
			return;
		}

		const params = { sessionId: this.currentSession.id };
		this.emit('claude:history', params, this._handleResponse(callback));
	}

	clearChat(callback) {
		if (!this.currentSession?.id) {
			callback(new Error('No active Claude session'), null);
			return;
		}

		const params = { sessionId: this.currentSession.id };
		this.emit('claude:clear', params, this._handleResponse(callback));
	}

	endSession(callback) {
		if (!this.currentSession?.id) {
			callback(new Error('No active Claude session'), null);
			return;
		}

		const sessionId = this.currentSession.id;
		this.emit('claude:end', { sessionId }, (response) => {
			if (response && response.success) {
				this.currentSession = null;
			}
			this._handleResponse(callback)(response);
		});
	}

	// Application authentication (TERMINAL_KEY)
	authenticate(key, callback) {
		this.emit('auth', key, (response) => {
			if (response && response.success) {
				console.log('Claude client authenticated with application');
			} else {
				console.error('Claude client application authentication failed:', response?.error);
			}
			callback(response);
		});
	}

	// New authentication methods
	startAuth(callback) {
		this.emit('claude:start-auth', this._handleResponse(callback));
	}

	submitToken(data, callback) {
		this.emit('claude:submit-token', data, this._handleResponse(callback));
	}

	getCurrentSession() {
		return this.currentSession;
	}

	hasActiveSession() {
		return this.currentSession !== null;
	}

	getIsTyping() {
		return this.isTyping;
	}

	// Event callback setters
	setOnAuthStatus(callback) {
		this.onAuthStatus = callback;
	}

	setOnSessionCreated(callback) {
		this.onSessionCreated = callback;
	}

	setOnResponse(callback) {
		this.onResponse = callback;
	}

	setOnTyping(callback) {
		this.onTyping = callback;
	}

	setOnCleared(callback) {
		this.onCleared = callback;
	}

	setOnSessionEnded(callback) {
		this.onSessionEnded = callback;
	}

	// New authentication callback setters
	setOnAuthStarted(callback) {
		this.onAuthStarted = callback;
	}

	setOnAuthOutput(callback) {
		this.onAuthOutput = callback;
	}

	setOnAuthUrl(callback) {
		this.onAuthUrl = callback;
	}

	setOnAuthCompleted(callback) {
		this.onAuthCompleted = callback;
	}
}
