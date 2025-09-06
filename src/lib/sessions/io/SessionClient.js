import { BaseClient } from '../../shared/io/BaseClient.js';

export class SessionClient extends BaseClient {
    constructor(io, config = {}) {
        super(io, '/sessions', config);
        this.currentSessionId = null;
        this.sessions = [];
    }

    setupEventListeners() {
        this.on('sessions:created', this.handleSessionCreated.bind(this));
        this.on('sessions:attached', this.handleSessionAttached.bind(this));
        this.on('sessions:ended', this.handleSessionEnded.bind(this));
        this.on('sessions:detached', this.handleSessionDetached.bind(this));
        this.on('sessions:updated', this.handleSessionsUpdated.bind(this));
    }

    handleSessionCreated(data) {
        if (data.success && data.session) {
            if (this.onSessionCreated) {
                this.onSessionCreated(data);
            }
        }
    }

    handleSessionAttached(data) {
        if (data.success && data.sessionId) {
            if (this.onSessionAttached) {
                this.onSessionAttached(data);
            }
        }
    }

    handleSessionEnded(data) {
        if (data.success && data.sessionId) {
            // Clear current session if it was ended
            if (this.currentSessionId === data.sessionId) {
                this.currentSessionId = null;
            }
            
            if (this.onSessionEnded) {
                this.onSessionEnded(data);
            }
        }
    }

    handleSessionDetached(data) {
        if (data.success && data.sessionId) {
            // Clear current session if we detached from it
            if (this.currentSessionId === data.sessionId) {
                this.currentSessionId = null;
            }
            
            if (this.onSessionDetached) {
                this.onSessionDetached(data);
            }
        }
    }

    handleSessionsUpdated(data) {
        if (data.success && data.sessions) {
            this.sessions = data.sessions;
            
            if (this.onSessionsUpdated) {
                this.onSessionsUpdated(data.sessions);
            }
        }
    }

    async create(options) {
        return new Promise((resolve, reject) => {
            const sessionOptions = {
                name: options.name || 'Terminal Session',
                mode: options.mode || 'shell',
                cols: options.cols || 80,
                rows: options.rows || 24,
                projectId: options.projectId,
                customOptions: options.customOptions || {}
            };

            this.emit('sessions:create', sessionOptions, (response) => {
                if (response.success) {
                    this.currentSessionId = response.sessionId;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to create session'));
                }
            });
        });
    }

    async attach(sessionId, options = {}) {
        return new Promise((resolve, reject) => {
            const attachOptions = {
                sessionId,
                cols: options.cols || 80,
                rows: options.rows || 24
            };

            this.emit('sessions:attach', attachOptions, (response) => {
                if (response.success) {
                    this.currentSessionId = sessionId;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to attach to session'));
                }
            });
        });
    }

    async list() {
        return new Promise((resolve, reject) => {
            this.emit('sessions:list', (response) => {
                if (response.success) {
                    this.sessions = response.sessions || [];
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to list sessions'));
                }
            });
        });
    }

    async end(sessionId = null) {
        return new Promise((resolve, reject) => {
            const targetSessionId = sessionId || this.currentSessionId;
            
            this.emit('sessions:end', targetSessionId, (response) => {
                if (response.success) {
                    if (!sessionId || sessionId === this.currentSessionId) {
                        this.currentSessionId = null;
                    }
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to end session'));
                }
            });
        });
    }

    async detach() {
        return new Promise((resolve, reject) => {
            this.emit('sessions:detach', (response) => {
                if (response.success) {
                    this.currentSessionId = null;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to detach from session'));
                }
            });
        });
    }

    getCurrentSessionId() {
        return this.currentSessionId;
    }

    getSessions() {
        return this.sessions;
    }

    isAttached() {
        return this.currentSessionId !== null;
    }

    // Event callback setters
    setOnSessionCreated(callback) {
        this.onSessionCreated = callback;
    }

    setOnSessionAttached(callback) {
        this.onSessionAttached = callback;
    }

    setOnSessionEnded(callback) {
        this.onSessionEnded = callback;
    }

    setOnSessionDetached(callback) {
        this.onSessionDetached = callback;
    }

    setOnSessionsUpdated(callback) {
        this.onSessionsUpdated = callback;
    }
}