import { BaseHandler } from '../../shared/io/BaseHandler.js';
import directoryManager from '../../shared/utils/directory-manager.server.js';
import { randomUUID } from 'crypto';

export class SessionHandler extends BaseHandler {
    constructor(io, authHandler) {
        super(io, '/sessions');
        this.authHandler = authHandler;
        this.directoryManager = directoryManager;
        this.socketSessions = new Map();
        
        // Initialize DirectoryManager
        this.initializeDirectoryManager();
    }

    async initializeDirectoryManager() {
        try {
            await this.directoryManager.initialize();
            console.log('[SESSION] DirectoryManager initialized successfully');
        } catch (error) {
            console.error('[SESSION] Failed to initialize DirectoryManager:', error);
        }
    }

    setupEventHandlers(socket) {
        // Add auth event handler for namespace-specific authentication
        socket.on('auth', (key, callback) => {
            console.log(`[SESSION] Auth request from socket ${socket.id} with key: ${key ? 'present' : 'missing'}`);
            this.authHandler.handleLogin(socket, key, callback);
        });

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

            // Use DirectoryManager to create session with proper project integration
            const sessionData = await this.directoryManager.createSession(sessionOptions.projectId, {
                name: sessionOptions.name,
                mode: sessionOptions.mode,
                cols: sessionOptions.cols,
                rows: sessionOptions.rows,
                customOptions: sessionOptions.customOptions,
                socketId: socket.id
            });

            if (sessionData && sessionData.sessionId) {
                this.socketSessions.set(socket.id, sessionData.sessionId);

                console.log(`[SESSION] Created session ${sessionData.sessionId} for socket ${socket.id}`);

                // Broadcast session creation to all clients in namespace
                this.emitToNamespace('sessions:created', {
                    success: true,
                    sessionId: sessionData.sessionId,
                    session: { sessionId: sessionData.sessionId },
                    socketId: socket.id
                });

                const response = {
                    success: true,
                    sessionId: sessionData.sessionId,
                    session: { sessionId: sessionData.sessionId }
                };

                if (callback) callback(response);
            } else {
                throw new Error('Failed to create session through DirectoryManager');
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

            // Find the session in projects using DirectoryManager
            const sessionInfo = await this.findSessionInProjects(sessionId);

            if (sessionInfo) {
                this.socketSessions.set(socket.id, sessionId);
                console.log(`[SESSION] Socket ${socket.id} attached to session ${sessionId} in project ${sessionInfo.projectId}`);

                // Update session with attachment info
                if (sessionInfo.projectId) {
                    await this.directoryManager.updateSession(sessionInfo.projectId, sessionId, {
                        attachedAt: new Date().toISOString(),
                        socketId: socket.id,
                        cols,
                        rows
                    });
                }

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
                const errorResponse = { success: false, error: `Session ${sessionId} not found` };
                if (callback) callback(errorResponse);
            }
        } catch (error) {
            console.error('[SESSION] Error attaching to session:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    // Helper method to find a session across all projects
    async findSessionInProjects(sessionId) {
        try {
            // Get all projects
            const projectsData = await this.directoryManager.listProjects();
            
            // Search each project for the session
            for (const project of projectsData.projects || []) {
                try {
                    const projectSessions = await this.directoryManager.getProjectSessions(project.id);
                    const session = projectSessions.find(s => s.sessionId === sessionId || s.id === sessionId);
                    if (session) {
                        return {
                            ...session,
                            projectId: project.id,
                            projectName: project.name
                        };
                    }
                } catch (err) {
                    console.warn(`[SESSION] Could not search sessions in project ${project.id}:`, err.message);
                }
            }


            return null;
        } catch (error) {
            console.error('[SESSION] Error finding session in projects:', error);
            return null;
        }
    }

    async handleList(socket, callback) {
        try {
            // Get all sessions from all projects using DirectoryManager
            const allSessions = [];
            
            // Get all projects directly from projects.json instead of using listProjects
            const projectsData = await this.directoryManager.getProjectsLegacy();
            
            // For each project, get its sessions
            for (const project of projectsData.projects || []) {
                try {
                    const projectSessions = await this.directoryManager.getProjectSessions(project.id);
                    
                    // Add project context to each session
                    projectSessions.forEach(session => {
                        allSessions.push({
                            ...session,
                            projectId: project.id,
                            projectName: project.name
                        });
                    });
                } catch (err) {
                    console.warn(`[SESSION] Could not get sessions for project ${project.id}:`, err.message);
                }
            }
            

            console.log(`[SESSION] Listing ${allSessions.length} sessions for socket ${socket.id}`);

            const response = { success: true, sessions: allSessions };

            if (callback && typeof callback === 'function') {
                callback(response);
            }

            this.emitToSocket(socket, 'sessions:updated', response);
        } catch (error) {
            console.error('[SESSION] Error listing sessions:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback && typeof callback === 'function') {
                callback(errorResponse);
            }
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

            // Find the session using DirectoryManager
            const sessionInfo = await this.findSessionInProjects(targetSessionId);

            if (sessionInfo) {
                // Update session status to ended using DirectoryManager
                if (sessionInfo.projectId) {
                    await this.directoryManager.updateSession(sessionInfo.projectId, targetSessionId, {
                        status: 'ended',
                        endedAt: new Date().toISOString(),
                        exitCode: 0,
                        endedBySocketId: socket.id
                    });
                }

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
                const errorResponse = { success: false, error: `Session ${targetSessionId} not found` };
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