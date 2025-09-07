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

    create(options, callback) {
        const sessionOptions = {
            name: options.name || 'Terminal Session',
            mode: options.mode || 'shell',
            cols: options.cols || 80,
            rows: options.rows || 24,
            projectId: options.projectId,
            customOptions: options.customOptions || {}
        };

        this.emit('sessions:create', sessionOptions, (response) => {
            if (response && response.success) {
                this.currentSessionId = response.sessionId;
            }
            this._handleResponse(callback)(response);
        });
    }

    // Optional Promise version for backward compatibility
    createAsync(options) {
        return this._promisify(this.create.bind(this), options);
    }

    attach(sessionId, options = {}, callback) {
        const attachOptions = {
            sessionId,
            cols: options.cols || 80,
            rows: options.rows || 24
        };

        this.emit('sessions:attach', attachOptions, (response) => {
            if (response && response.success) {
                this.currentSessionId = sessionId;
            }
            this._handleResponse(callback)(response);
        });
    }

    // Optional Promise version for backward compatibility
    attachAsync(sessionId, options = {}) {
        return this._promisify(this.attach.bind(this), sessionId, options);
    }

    list(options = {}, callback) {
        // Handle optional options parameter
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        
        console.log('[SESSION-CLIENT] Emitting sessions:list event with callback:', typeof callback);
        this.emit('sessions:list', options, (response) => {
            console.log('[SESSION-CLIENT] Received sessions:list response:', response);
            if (response && response.success) {
                this.sessions = response.sessions || [];
            }
            this._handleResponse(callback)(response);
        });
    }

    // Optional Promise version for backward compatibility
    listAsync(options = {}) {
        return this._promisify(this.list.bind(this), options);
    }

    end(sessionId = null, callback) {
        const targetSessionId = sessionId || this.currentSessionId;
        
        this.emit('sessions:end', targetSessionId, (response) => {
            if (response && response.success) {
                if (!sessionId || sessionId === this.currentSessionId) {
                    this.currentSessionId = null;
                }
            }
            this._handleResponse(callback)(response);
        });
    }

    // Optional Promise version for backward compatibility
    endAsync(sessionId = null) {
        return this._promisify(this.end.bind(this), sessionId);
    }

    detach(callback) {
        this.emit('sessions:detach', (response) => {
            if (response && response.success) {
                this.currentSessionId = null;
            }
            this._handleResponse(callback)(response);
        });
    }

    // Optional Promise version for backward compatibility
    detachAsync() {
        return this._promisify(this.detach.bind(this));
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