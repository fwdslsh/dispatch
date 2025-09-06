import { BaseHandler } from '../../shared/io/BaseHandler.js';

const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const AUTH_REQUIRED = TERMINAL_KEY.length >= 8;

export class AuthHandler extends BaseHandler {
    constructor(io) {
        super(io, '/auth');
        this.authenticatedSockets = new Set();
    }

    setupEventHandlers(socket) {
        socket.on('auth:login', this.handleLogin.bind(this, socket));
        socket.on('auth:check', this.handleCheck.bind(this, socket));
        socket.on('auth:logout', this.handleLogout.bind(this, socket));
    }

    handleDisconnect(socket) {
        this.authenticatedSockets.delete(socket.id);
        console.log(`[AUTH] Socket ${socket.id} removed from authenticated set`);
    }

    async handleLogin(socket, key, callback) {
        try {
            const success = !AUTH_REQUIRED || key === TERMINAL_KEY;
            
            if (success) {
                this.authenticatedSockets.add(socket.id);
                console.log(`[AUTH] Socket ${socket.id} authenticated`);
            } else {
                console.log(`[AUTH] Socket ${socket.id} authentication failed`);
            }

            const response = { 
                success, 
                authenticated: success,
                authRequired: AUTH_REQUIRED
            };

            if (callback && typeof callback === 'function') {
                callback(response);
            }

            this.emitToSocket(socket, 'auth:status', response);
        } catch (error) {
            console.error('[AUTH] Login error:', error);
            const errorResponse = { 
                success: false, 
                error: 'Authentication failed',
                authRequired: AUTH_REQUIRED
            };
            
            if (callback && typeof callback === 'function') {
                callback(errorResponse);
            }
        }
    }

    async handleCheck(socket, callback) {
        try {
            const authenticated = this.isAuthenticated(socket.id);
            const response = {
                success: true,
                authenticated,
                authRequired: AUTH_REQUIRED
            };

            if (callback && typeof callback === 'function') {
                callback(response);
            }

            this.emitToSocket(socket, 'auth:status', response);
        } catch (error) {
            console.error('[AUTH] Check error:', error);
            const errorResponse = {
                success: false,
                error: 'Authentication check failed',
                authenticated: false,
                authRequired: AUTH_REQUIRED
            };
            
            if (callback && typeof callback === 'function') {
                callback(errorResponse);
            }
        }
    }

    async handleLogout(socket, callback) {
        try {
            this.authenticatedSockets.delete(socket.id);
            console.log(`[AUTH] Socket ${socket.id} logged out`);

            const response = {
                success: true,
                authenticated: false,
                authRequired: AUTH_REQUIRED
            };

            if (callback && typeof callback === 'function') {
                callback(response);
            }

            this.emitToSocket(socket, 'auth:status', response);
        } catch (error) {
            console.error('[AUTH] Logout error:', error);
            const errorResponse = {
                success: false,
                error: 'Logout failed',
                authRequired: AUTH_REQUIRED
            };
            
            if (callback && typeof callback === 'function') {
                callback(errorResponse);
            }
        }
    }

    isAuthenticated(socketId) {
        return !AUTH_REQUIRED || this.authenticatedSockets.has(socketId);
    }

    requireAuth(socketId) {
        return this.isAuthenticated(socketId);
    }

    withAuth(handler, socket) {
        return (...args) => {
            if (!this.requireAuth(socket.id)) {
                const callback = args.find((arg) => typeof arg === 'function');
                if (callback) {
                    callback({ success: false, error: 'Authentication required' });
                }
                return;
            }
            return handler(...args);
        };
    }

    get config() {
        return {
            required: AUTH_REQUIRED,
            key: TERMINAL_KEY,
            keyLength: TERMINAL_KEY.length
        };
    }
}