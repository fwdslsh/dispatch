import { BaseClient } from '../../shared/io/BaseClient.js';

export class TerminalClient extends BaseClient {
    constructor(io, config = {}) {
        super(io, '/terminals', config);
    }

    setupEventListeners() {
        this.on('terminals:output', this.handleOutput.bind(this));
        this.on('terminals:error', this.handleError.bind(this));
        this.on('terminals:input-received', this.handleInputReceived.bind(this));
        this.on('terminals:resized', this.handleResized.bind(this));
        this.on('terminals:status-update', this.handleStatusUpdate.bind(this));
        this.on('terminals:session-status', this.handleSessionStatus.bind(this));
    }

    handleOutput(data) {
        if (this.onOutput) {
            this.onOutput(data);
        }
    }

    handleError(data) {
        console.error('[TERMINAL-CLIENT] Terminal error:', data.error);
        if (this.onError) {
            this.onError(data);
        }
    }

    handleInputReceived(data) {
        if (this.onInputReceived) {
            this.onInputReceived(data);
        }
    }

    handleResized(data) {
        if (this.onResized) {
            this.onResized(data);
        }
    }

    handleStatusUpdate(data) {
        if (this.onStatusUpdate) {
            this.onStatusUpdate(data);
        }
    }

    handleSessionStatus(data) {
        if (this.onSessionStatus) {
            this.onSessionStatus(data);
        }
    }

    sendInput(data) {
        if (typeof data !== 'string') {
            console.warn('[TERMINAL-CLIENT] Input must be a string');
            return;
        }
        
        this.emit('terminals:input', data);
    }

    resize(cols, rows) {
        if (!cols || !rows || typeof cols !== 'number' || typeof rows !== 'number') {
            console.warn('[TERMINAL-CLIENT] Invalid resize dimensions');
            return;
        }

        this.emit('terminals:resize', { cols, rows });
    }

    async getStatus() {
        return new Promise((resolve, reject) => {
            this.emit('terminals:status', (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to get terminal status'));
                }
            });
        });
    }

    // Event callback setters
    setOnOutput(callback) {
        this.onOutput = callback;
    }

    setOnError(callback) {
        this.onError = callback;
    }

    setOnInputReceived(callback) {
        this.onInputReceived = callback;
    }

    setOnResized(callback) {
        this.onResized = callback;
    }

    setOnStatusUpdate(callback) {
        this.onStatusUpdate = callback;
    }

    setOnSessionStatus(callback) {
        this.onSessionStatus = callback;
    }

    // Utility methods for common terminal operations
    sendText(text) {
        this.sendInput(text);
    }

    sendKey(key) {
        // Handle special keys
        const specialKeys = {
            'Enter': '\r',
            'Tab': '\t',
            'Backspace': '\x7f',
            'Escape': '\x1b',
            'ArrowUp': '\x1b[A',
            'ArrowDown': '\x1b[B',
            'ArrowRight': '\x1b[C',
            'ArrowLeft': '\x1b[D',
            'Home': '\x1b[H',
            'End': '\x1b[F',
            'PageUp': '\x1b[5~',
            'PageDown': '\x1b[6~',
            'Delete': '\x1b[3~'
        };

        if (specialKeys[key]) {
            this.sendInput(specialKeys[key]);
        } else {
            this.sendInput(key);
        }
    }

    sendCtrlKey(char) {
        if (typeof char !== 'string' || char.length !== 1) {
            console.warn('[TERMINAL-CLIENT] Ctrl key must be a single character');
            return;
        }
        
        // Convert to control character (Ctrl+A = \x01, Ctrl+C = \x03, etc.)
        const controlCode = String.fromCharCode(char.toLowerCase().charCodeAt(0) - 96);
        this.sendInput(controlCode);
    }
}