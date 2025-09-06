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

    async checkAuth() {
        return new Promise((resolve, reject) => {
            this.emit('claude:auth', (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Authentication check failed'));
                }
            });
        });
    }

    async createSession(projectId = null, sessionOptions = {}) {
        return new Promise((resolve, reject) => {
            this.emit('claude:create', { projectId, sessionOptions }, (response) => {
                if (response.success) {
                    this.currentSession = response.session;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to create Claude session'));
                }
            });
        });
    }

    async sendMessage(message) {
        if (!this.currentSession?.id) {
            throw new Error('No active Claude session');
        }

        return new Promise((resolve, reject) => {
            this.emit('claude:send', {
                message,
                sessionId: this.currentSession.id
            }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to send message'));
                }
            });
        });
    }

    async getHistory() {
        if (!this.currentSession?.id) {
            throw new Error('No active Claude session');
        }

        return new Promise((resolve, reject) => {
            this.emit('claude:history', {
                sessionId: this.currentSession.id
            }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to get chat history'));
                }
            });
        });
    }

    async clearChat() {
        if (!this.currentSession?.id) {
            throw new Error('No active Claude session');
        }

        return new Promise((resolve, reject) => {
            this.emit('claude:clear', {
                sessionId: this.currentSession.id
            }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to clear chat'));
                }
            });
        });
    }

    async endSession() {
        if (!this.currentSession?.id) {
            throw new Error('No active Claude session');
        }

        const sessionId = this.currentSession.id;

        return new Promise((resolve, reject) => {
            this.emit('claude:end', { sessionId }, (response) => {
                if (response.success) {
                    this.currentSession = null;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to end session'));
                }
            });
        });
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
}