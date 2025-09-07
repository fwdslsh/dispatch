import { BaseHandler } from '../../../shared/io/BaseHandler.js';
import { TerminalManager } from '../server/terminal.server.js';
import directoryManager from '../../../shared/utils/directory-manager.server.js';

export class ShellHandler extends BaseHandler {
    constructor(io, authHandler) {
        super(io, '/shell');
        this.authHandler = authHandler;
        this.terminalManager = new TerminalManager(); // Still needed for PTY management
        this.directoryManager = directoryManager; // Added for session persistence
        this.shellSessions = new Map(); // socket.id -> shell session info
        
        // Initialize DirectoryManager
        this.initializeDirectoryManager();
    }

    async initializeDirectoryManager() {
        try {
            await this.directoryManager.initialize();
            console.log('[SHELL] DirectoryManager initialized successfully');
        } catch (error) {
            console.error('[SHELL] Failed to initialize DirectoryManager:', error);
        }
    }

    setupEventHandlers(socket) {
        // Add auth event handler for namespace-specific authentication
        socket.on('auth', (key, callback) => {
            console.log(`[SHELL] Auth request from socket ${socket.id} with key: ${key ? 'present' : 'missing'}`);
            this.authHandler.handleLogin(socket, key, callback);
        });

        socket.on('shell:create', this.authHandler.withAuth(this.handleCreate.bind(this, socket), socket));
        socket.on('shell:connect', this.authHandler.withAuth(this.handleConnect.bind(this, socket), socket));
        socket.on('shell:execute', this.authHandler.withAuth(this.handleExecute.bind(this, socket), socket));
        socket.on('shell:end', this.authHandler.withAuth(this.handleEnd.bind(this, socket), socket));
    }

    handleDisconnect(socket) {
        const session = this.shellSessions.get(socket.id);
        if (session?.sessionId) {
            console.log(`[SHELL] Socket ${socket.id} disconnected, cleaning up shell session ${session.sessionId}`);
        }
        this.shellSessions.delete(socket.id);
    }

    async handleCreate(socket, options, callback) {
        try {
            console.log(`[SHELL] Creating shell session for socket ${socket.id}:`, options);

            const sessionOptions = {
                name: options.name || 'Shell Session',
                mode: 'shell',
                cols: Math.max(10, Math.min(500, parseInt(options.cols) || 80)),
                rows: Math.max(5, Math.min(200, parseInt(options.rows) || 24)),
                projectId: options.projectId,
                workingDirectory: options.workingDirectory,
                shell: options.shell || '/bin/bash'
            };

            // Create session in DirectoryManager for persistence
            const directorySession = await this.directoryManager.createSession(sessionOptions.projectId, {
                name: sessionOptions.name,
                mode: sessionOptions.mode,
                cols: sessionOptions.cols,
                rows: sessionOptions.rows,
                customOptions: {
                    shell: sessionOptions.shell,
                    workingDirectory: sessionOptions.workingDirectory
                },
                socketId: socket.id
            });

            if (!directorySession?.id) {
                throw new Error('Failed to create session in DirectoryManager');
            }

            const sessionId = directorySession.id;

            // Create PTY session in TerminalManager for actual terminal process
            const terminalSessionOptions = {
                ...sessionOptions
            };
            const terminalSessionData = await this.terminalManager.createSessionInProject(sessionOptions.projectId, terminalSessionOptions);

            if (terminalSessionData?.id) {
                // Use the terminal session ID for PTY operations
                const terminalSessionId = terminalSessionData.id;
                
                // Attach socket to terminal session for PTY I/O
                await this.terminalManager.attachToSession(socket, { sessionId: terminalSessionId });

                const shellSession = {
                    sessionId, // DirectoryManager session ID (for persistence)
                    terminalSessionId, // TerminalManager session ID (for PTY operations)
                    projectId: sessionOptions.projectId,
                    shell: sessionOptions.shell,
                    workingDirectory: sessionOptions.workingDirectory,
                    createdAt: new Date().toISOString()
                };

                this.shellSessions.set(socket.id, shellSession);

                // Set up shell-specific input handling
                const handleInput = (data) => {
                    const session = this.shellSessions.get(socket.id);
                    if (session?.sessionId === sessionId) {
                        this.terminalManager.sendInput(session.terminalSessionId, data);
                    }
                };

                const handleResize = (dims) => {
                    const session = this.shellSessions.get(socket.id);
                    if (session?.sessionId === sessionId) {
                        this.terminalManager.resize(session.terminalSessionId, dims.cols, dims.rows);
                    }
                };

                // Remove any existing handlers first
                socket.removeAllListeners('shell:input');
                socket.removeAllListeners('shell:resize');

                // Add new handlers
                socket.on('shell:input', handleInput);
                socket.on('shell:resize', handleResize);

                console.log(`[SHELL] Created shell session ${sessionId} for socket ${socket.id}`);

                const response = {
                    success: true,
                    sessionId,
                    session: shellSession
                };

                if (callback) callback(response);

                this.emitToSocket(socket, 'shell:session-created', {
                    sessionId,
                    session: shellSession
                });
            } else {
                throw new Error('Failed to create PTY session in TerminalManager');
            }
        } catch (error) {
            console.error('[SHELL] Error creating shell session:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };
            if (callback) callback(errorResponse);
        }
    }

    async handleConnect(socket, data, callback) {
        try {
            const { sessionId } = data || {};
            
            if (!sessionId) {
                const errorResponse = {
                    success: false,
                    error: 'Session ID is required'
                };
                if (callback) callback(errorResponse);
                return;
            }

            console.log(`[SHELL] Connecting socket ${socket.id} to shell session ${sessionId}`);

            const success = await this.terminalManager.attachToSession(socket, { sessionId });

            if (success) {
                const session = this.terminalManager.sessions.get(sessionId);
                
                const shellSession = {
                    sessionId,
                    shell: session?.shell || '/bin/bash',
                    workingDirectory: session?.workingDirectory,
                    connectedAt: new Date().toISOString()
                };

                this.shellSessions.set(socket.id, shellSession);

                console.log(`[SHELL] Socket ${socket.id} connected to shell session ${sessionId}`);

                const response = {
                    success: true,
                    sessionId,
                    session: shellSession
                };

                if (callback) callback(response);

                this.emitToSocket(socket, 'shell:connected', {
                    sessionId,
                    session: shellSession
                });
            } else {
                const errorResponse = {
                    success: false,
                    error: 'Failed to connect to shell session'
                };
                if (callback) callback(errorResponse);
            }
        } catch (error) {
            console.error('[SHELL] Error connecting to shell session:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };
            if (callback) callback(errorResponse);
        }
    }

    async handleExecute(socket, data, callback) {
        try {
            const { command } = data || {};
            const shellSession = this.shellSessions.get(socket.id);

            if (!shellSession?.sessionId) {
                const errorResponse = {
                    success: false,
                    error: 'No active shell session'
                };
                if (callback) callback(errorResponse);
                return;
            }

            if (!command || typeof command !== 'string') {
                const errorResponse = {
                    success: false,
                    error: 'Command is required and must be a string'
                };
                if (callback) callback(errorResponse);
                return;
            }

            console.log(`[SHELL] Executing command in session ${shellSession.sessionId}: ${command}`);

            // Send command with newline to execute it
            const commandWithNewline = command.endsWith('\n') ? command : command + '\n';
            this.terminalManager.sendInput(shellSession.terminalSessionId, commandWithNewline);

            const response = {
                success: true,
                sessionId: shellSession.sessionId,
                command: command.trim()
            };

            if (callback) callback(response);

            this.emitToSocket(socket, 'shell:command-executed', {
                sessionId: shellSession.sessionId,
                command: command.trim()
            });
        } catch (error) {
            console.error('[SHELL] Error executing command:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };
            if (callback) callback(errorResponse);
        }
    }

    async handleEnd(socket, data, callback) {
        try {
            const shellSession = this.shellSessions.get(socket.id);
            const sessionId = data?.sessionId || shellSession?.sessionId;

            if (!sessionId) {
                const errorResponse = {
                    success: false,
                    error: 'No shell session to end'
                };
                if (callback) callback(errorResponse);
                return;
            }

            console.log(`[SHELL] Ending shell session ${sessionId} for socket ${socket.id}`);

            // End the PTY session in TerminalManager
            const terminalSuccess = this.terminalManager.endSession(shellSession?.terminalSessionId || sessionId);

            // Update session status in DirectoryManager
            const projectId = shellSession?.projectId;
            if (projectId) {
                try {
                    await this.directoryManager.updateSession(projectId, sessionId, {
                        status: 'ended',
                        endedAt: new Date().toISOString(),
                        exitCode: 0,
                        endedBySocketId: socket.id
                    });
                } catch (dmError) {
                    console.warn(`[SHELL] Failed to update session in DirectoryManager:`, dmError);
                }
            }

            if (terminalSuccess) {
                this.shellSessions.delete(socket.id);

                console.log(`[SHELL] Shell session ${sessionId} ended successfully`);

                const response = { success: true };
                if (callback) callback(response);

                this.emitToSocket(socket, 'shell:session-ended', {
                    sessionId,
                    exitCode: 0
                });
            } else {
                const errorResponse = {
                    success: false,
                    error: 'Failed to end shell session'
                };
                if (callback) callback(errorResponse);
            }
        } catch (error) {
            console.error('[SHELL] Error ending shell session:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };
            if (callback) callback(errorResponse);
        }
    }

    // Method to emit shell output to connected sockets
    emitShellOutput(sessionId, data) {
        for (const [socketId, session] of this.shellSessions.entries()) {
            if (session.sessionId === sessionId) {
                const socket = this.namespace.sockets.get(socketId);
                if (socket) {
                    this.emitToSocket(socket, 'shell:output', {
                        sessionId,
                        data
                    });
                }
            }
        }
    }

    getShellSession(socketId) {
        return this.shellSessions.get(socketId);
    }

    getAllShellSessions() {
        return new Map(this.shellSessions);
    }
}