import { BaseHandler } from '../../../shared/io/BaseHandler.js';
import { TerminalManager } from '../server/terminal.server.js';

export class TerminalHandler extends BaseHandler {
    constructor(io, authHandler, sessionHandler) {
        super(io, '/terminals');
        this.authHandler = authHandler;
        this.sessionHandler = sessionHandler;
        this.terminalManager = new TerminalManager();
    }

    setupEventHandlers(socket) {
        socket.on('terminals:input', this.authHandler.withAuth(this.handleInput.bind(this, socket), socket));
        socket.on('terminals:resize', this.authHandler.withAuth(this.handleResize.bind(this, socket), socket));
        socket.on('terminals:status', this.authHandler.withAuth(this.handleStatus.bind(this, socket), socket));
    }

    handleInput(socket, data) {
        try {
            const sessionId = this.sessionHandler.getSocketSession(socket.id);

            if (!sessionId) {
                console.warn(`[TERMINAL] No session for input from socket ${socket.id}`);
                this.emitToSocket(socket, 'terminals:error', {
                    error: 'No active session for terminal input'
                });
                return;
            }

            if (typeof data !== 'string') {
                console.warn(`[TERMINAL] Invalid input data type from socket ${socket.id}:`, typeof data);
                this.emitToSocket(socket, 'terminals:error', {
                    error: 'Invalid input data type'
                });
                return;
            }

            console.log(`[TERMINAL] Sending input to session ${sessionId} from socket ${socket.id}`);
            this.terminalManager.sendInput(sessionId, data);

            // Acknowledge input received
            this.emitToSocket(socket, 'terminals:input-received', {
                success: true,
                sessionId
            });
        } catch (error) {
            console.error('[TERMINAL] Error sending input:', error);
            this.emitToSocket(socket, 'terminals:error', {
                error: error.message
            });
        }
    }

    handleResize(socket, dims) {
        try {
            const sessionId = this.sessionHandler.getSocketSession(socket.id);

            if (!sessionId) {
                console.warn(`[TERMINAL] No session to resize for socket ${socket.id}`);
                this.emitToSocket(socket, 'terminals:error', {
                    error: 'No active session for terminal resize'
                });
                return;
            }

            if (!dims || !dims.cols || !dims.rows) {
                console.warn(`[TERMINAL] Invalid resize dimensions from socket ${socket.id}:`, dims);
                this.emitToSocket(socket, 'terminals:error', {
                    error: 'Invalid resize dimensions'
                });
                return;
            }

            const cols = Math.max(10, Math.min(500, parseInt(dims.cols)));
            const rows = Math.max(5, Math.min(200, parseInt(dims.rows)));

            console.log(`[TERMINAL] Resizing session ${sessionId} to ${cols}x${rows} from socket ${socket.id}`);
            this.terminalManager.resize(sessionId, cols, rows);

            // Acknowledge resize
            this.emitToSocket(socket, 'terminals:resized', {
                success: true,
                sessionId,
                cols,
                rows
            });
        } catch (error) {
            console.error('[TERMINAL] Error resizing session:', error);
            this.emitToSocket(socket, 'terminals:error', {
                error: error.message
            });
        }
    }

    handleStatus(socket, callback) {
        try {
            const sessionId = this.sessionHandler.getSocketSession(socket.id);
            
            const status = {
                success: true,
                sessionId: sessionId || null,
                hasActiveSession: !!sessionId,
                connected: true
            };

            if (sessionId) {
                const sessionInfo = this.terminalManager.sessions.get(sessionId);
                status.sessionInfo = sessionInfo;
            }

            if (callback) callback(status);
            this.emitToSocket(socket, 'terminals:status-update', status);
        } catch (error) {
            console.error('[TERMINAL] Error getting terminal status:', error);
            const errorResponse = {
                success: false,
                error: error.message,
                hasActiveSession: false,
                connected: true
            };
            
            if (callback) callback(errorResponse);
        }
    }

    // Method to emit output to a specific socket (called by terminal manager)
    emitOutput(socketId, data) {
        const socket = this.namespace.sockets.get(socketId);
        if (socket) {
            this.emitToSocket(socket, 'terminals:output', data);
        }
    }

    // Method to emit output to all sockets attached to a session
    emitOutputToSession(sessionId, data) {
        // Find all sockets attached to this session
        const socketSessions = this.sessionHandler.getAllSocketSessions();
        
        for (const [socketId, attachedSessionId] of socketSessions.entries()) {
            if (attachedSessionId === sessionId) {
                this.emitOutput(socketId, data);
            }
        }
    }

    // Method to notify about session status changes
    emitSessionStatus(sessionId, status) {
        const socketSessions = this.sessionHandler.getAllSocketSessions();
        
        for (const [socketId, attachedSessionId] of socketSessions.entries()) {
            if (attachedSessionId === sessionId) {
                const socket = this.namespace.sockets.get(socketId);
                if (socket) {
                    this.emitToSocket(socket, 'terminals:session-status', {
                        sessionId,
                        status
                    });
                }
            }
        }
    }
}