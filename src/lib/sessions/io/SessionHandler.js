import { BaseHandler } from '../../shared/io/BaseHandler.js';
import { TerminalManager } from '../../session-types/shell/server/terminal.server.js';
import directoryManager from '../../shared/services/directory-manager.server.js';
import { randomUUID } from 'crypto';

export class SessionHandler extends BaseHandler {
    constructor(io, authHandler) {
        super(io, '/sessions');
        this.authHandler = authHandler;
        this.terminalManager = new TerminalManager();
        this.socketSessions = new Map();
    }

    setupEventHandlers(socket) {
        socket.on('sessions:create', this.authHandler.withAuth(this.handleCreate.bind(this, socket), socket));
        socket.on('sessions:attach', this.authHandler.withAuth(this.handleAttach.bind(this, socket), socket));
        socket.on('sessions:list', this.authHandler.withAuth(this.handleList.bind(this, socket), socket));
        socket.on('sessions:end', this.authHandler.withAuth(this.handleEnd.bind(this, socket), socket));
        socket.on('sessions:detach', this.authHandler.withAuth(this.handleDetach.bind(this, socket), socket));
    }

    handleDisconnect(socket) {
        const sessionId = this.socketSessions.get(socket.id);
        if (sessionId) {
            console.log(`[SESSION] Socket ${socket.id} disconnected, cleaning up session ${sessionId}`);
            this.socketSessions.delete(socket.id);
        }
    }

    async handleCreate(socket, options, callback) {
        try {
            console.log(`[SESSION] Creating session for socket ${socket.id}:`, options);

            if (!options || typeof options !== 'object') {
                const errorResponse = { success: false, error: 'Invalid session options' };
                if (callback) callback(errorResponse);
                return;
            }

            const sessionOptions = {
                name: options.name || 'Terminal Session',
                mode: options.mode || 'shell',
                cols: Math.max(10, Math.min(500, parseInt(options.cols) || 80)),
                rows: Math.max(5, Math.min(200, parseInt(options.rows) || 24)),
                projectId: options.projectId || options.project?.id,
                customOptions: options.customOptions || {}
            };

            // Create directory context if project specified
            let workingDirectory;
            if (sessionOptions.projectId) {
                const project = await directoryManager.getProject(sessionOptions.projectId);
                workingDirectory = project?.path;
            }

            // Create terminal session
            const sessionId = sessionOptions.projectId
                ? await this.terminalManager.createSessionInProject(sessionOptions.projectId, {
                    ...sessionOptions,
                    workingDirectory
                })
                : this.terminalManager.createSimpleSession(randomUUID(), {
                    ...sessionOptions,
                    workingDirectory
                });

            if (sessionId) {
                this.socketSessions.set(socket.id, sessionId);

                console.log(`[SESSION] Created session ${sessionId} for socket ${socket.id}`);

                // Broadcast session creation to all clients in namespace
                this.emitToNamespace('sessions:created', {
                    success: true,
                    sessionId: sessionId,
                    session: { sessionId },
                    socketId: socket.id
                });

                const response = {
                    success: true,
                    sessionId: sessionId,
                    session: { sessionId }
                };

                if (callback) callback(response);
            } else {
                throw new Error('Failed to create terminal session');
            }
        } catch (error) {
            console.error('[SESSION] Error creating session:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    async handleAttach(socket, options, callback) {
        try {
            console.log(`[SESSION] Attaching socket ${socket.id} to session:`, options);

            if (!options.sessionId) {
                const errorResponse = { success: false, error: 'Session ID is required' };
                if (callback) callback(errorResponse);
                return;
            }

            const sessionId = options.sessionId;
            const cols = Math.max(10, Math.min(500, parseInt(options.cols) || 80));
            const rows = Math.max(5, Math.min(200, parseInt(options.rows) || 24));

            const success = await this.terminalManager.attachToSession(sessionId);

            if (success) {
                this.socketSessions.set(socket.id, sessionId);
                console.log(`[SESSION] Socket ${socket.id} attached to session ${sessionId}`);

                const sessionInfo = this.terminalManager.getSession(sessionId);
                const response = {
                    success: true,
                    sessionId,
                    session: sessionInfo
                };

                if (callback) callback(response);

                this.emitToNamespace('sessions:attached', {
                    success: true,
                    sessionId,
                    socketId: socket.id
                });
            } else {
                const errorResponse = { success: false, error: 'Failed to attach to session' };
                if (callback) callback(errorResponse);
            }
        } catch (error) {
            console.error('[SESSION] Error attaching to session:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    async handleList(socket, callback) {
        try {
            const sessions = this.terminalManager.listSessions();
            console.log(`[SESSION] Listing ${sessions.length} sessions for socket ${socket.id}`);

            const response = { success: true, sessions };

            if (callback) callback(response);

            this.emitToSocket(socket, 'sessions:updated', response);
        } catch (error) {
            console.error('[SESSION] Error listing sessions:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    async handleEnd(socket, sessionId, callback) {
        try {
            // If no sessionId provided, use the current socket's session
            let targetSessionId = sessionId;
            if (!targetSessionId) {
                targetSessionId = this.socketSessions.get(socket.id);
            }

            if (!targetSessionId) {
                const errorResponse = { success: false, error: 'No session to end' };
                if (callback) callback(errorResponse);
                return;
            }

            console.log(`[SESSION] Ending session ${targetSessionId} for socket ${socket.id}`);

            const success = this.terminalManager.endSession(targetSessionId);

            if (success) {
                // Remove from socket mapping if it was the current session
                if (this.socketSessions.get(socket.id) === targetSessionId) {
                    this.socketSessions.delete(socket.id);
                }

                // Broadcast session ended to all clients in namespace
                this.emitToNamespace('sessions:ended', {
                    success: true,
                    sessionId: targetSessionId,
                    socketId: socket.id,
                    exitCode: 0
                });

                console.log(`[SESSION] Session ${targetSessionId} ended successfully`);

                const response = { success: true };
                if (callback) callback(response);
            } else {
                const errorResponse = { success: false, error: 'Failed to end session' };
                if (callback) callback(errorResponse);
            }
        } catch (error) {
            console.error('[SESSION] Error ending session:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    async handleDetach(socket, callback) {
        try {
            const sessionId = this.socketSessions.get(socket.id);

            if (!sessionId) {
                const errorResponse = { success: false, error: 'No session to detach from' };
                if (callback) callback(errorResponse);
                return;
            }

            console.log(`[SESSION] Detaching socket ${socket.id} from session ${sessionId}`);

            this.socketSessions.delete(socket.id);
            console.log(`[SESSION] Socket ${socket.id} detached from session ${sessionId}`);

            const response = { success: true };
            if (callback) callback(response);

            this.emitToNamespace('sessions:detached', {
                success: true,
                sessionId,
                socketId: socket.id
            });
        } catch (error) {
            console.error('[SESSION] Error detaching from session:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    getSocketSession(socketId) {
        return this.socketSessions.get(socketId);
    }

    getAllSocketSessions() {
        return new Map(this.socketSessions);
    }
}