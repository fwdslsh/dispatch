import { BaseHandler } from "../../../shared/io/BaseHandler";
import { claudeCodeService } from "../server/claude-code-service.server";

export class ClaudeHandler extends BaseHandler {
    constructor(io, authHandler) {
        super(io, '/claude');
        this.authHandler = authHandler;
        this.sessions = new Map(); // socket.id -> claude session
        this.claudeCodeService = claudeCodeService;
    }

    setupEventHandlers(socket) {
        socket.on('claude:auth', this.handleAuth.bind(this, socket)); // Remove auth requirement for this endpoint
        socket.on('claude:create', this.authHandler.withAuth(this.handleCreate.bind(this, socket), socket));
        socket.on('claude:send', this.authHandler.withAuth(this.handleSend.bind(this, socket), socket));
        socket.on('claude:history', this.authHandler.withAuth(this.handleHistory.bind(this, socket), socket));
        socket.on('claude:clear', this.authHandler.withAuth(this.handleClear.bind(this, socket), socket));
        socket.on('claude:end', this.authHandler.withAuth(this.handleEnd.bind(this, socket), socket));

        // Claude authentication flow events - these don't require external auth
        socket.on('claude:start-auth', this.handleStartAuth.bind(this, socket));
        socket.on('claude:submit-token', this.handleSubmitToken.bind(this, socket));
    }

    handleDisconnect(socket) {
        const session = this.sessions.get(socket.id);
        if (session?.id) {
            console.log(`[CLAUDE] Socket ${socket.id} disconnected, cleaning up session ${session.id}`);
        }
        this.sessions.delete(socket.id);
    }

    async handleAuth(socket, callback) {
        try {
            console.log(`[CLAUDE] Auth check for ${socket.id}:`);

            const isAuthenticated = claudeCodeService.isAuthenticated(); // Remove await - this is a synchronous method
            console.log(`[CLAUDE] Auth check result for ${socket.id}: ${isAuthenticated}`);

            const response = {
                success: true,
                authenticated: isAuthenticated
            };

            if (callback) callback(response);
            this.emitToSocket(socket, 'claude:auth-status', response);
        } catch (error) {
            console.error('[CLAUDE] Auth check failed:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }

    async handleCreate(socket, data, callback) {
        try {
            const { projectId, sessionOptions = {} } = data || {};
            const sessionId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const claudeSession = {
                id: sessionId,
                projectId: projectId || 'unnamed-project',
                isAuthenticated: claudeCodeService.isAuthenticated(), // Remove await - this is a synchronous method
                messages: [],
                createdAt: new Date().toISOString()
            };

            // Add welcome message
            const welcomeMessage = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: `Hello! I'm Claude, your AI coding assistant. I'm ready to help you with ${projectId ? `project "${projectId}"` : 'your coding tasks'}.

${claudeSession.isAuthenticated ? "✅ I'm authenticated and ready to assist you!" : '⚠️ I need authentication to provide full assistance. Please run `claude setup-token` in your terminal.'}`,
                timestamp: new Date().toISOString()
            };

            claudeSession.messages.push(welcomeMessage);
            this.sessions.set(socket.id, claudeSession);

            console.log(`[CLAUDE] Session created: ${sessionId} for project: ${projectId}`);

            const response = {
                success: true,
                session: {
                    id: sessionId,
                    projectId: claudeSession.projectId,
                    authenticated: claudeSession.isAuthenticated,
                    welcomeMessage
                }
            };

            if (callback) callback(response);

            this.emitToSocket(socket, 'claude:session-created', {
                sessionId,
                projectId: claudeSession.projectId
            });
        } catch (error) {
            console.error('[CLAUDE] Session creation failed:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }

    async handleSend(socket, data, callback) {
        try {
            const { message, sessionId } = data || {};
            const claudeSession = this.sessions.get(socket.id);

            if (!claudeSession?.id || claudeSession.id !== sessionId) {
                const errorResponse = {
                    success: false,
                    error: 'Invalid session ID'
                };
                if (callback) callback(errorResponse);
                return;
            }

            const userMessage = {
                id: `msg-${Date.now()}`,
                role: 'user',
                content: message.trim(),
                timestamp: new Date().toISOString()
            };

            claudeSession.messages.push(userMessage);

            // Emit typing indicator
            this.emitToSocket(socket, 'claude:typing', { sessionId, isTyping: true });

            const response = {
                success: true,
                message: userMessage
            };

            if (callback) callback(response);

            // Query Claude if authenticated
            if (claudeSession.isAuthenticated) {
                try {
                    // Add project context to the message
                    const contextualMessage = `Project: ${claudeSession.projectId}\n\nUser: ${message}`;

                    const claudeResponse = await claudeCodeService.query(contextualMessage);

                    const assistantMessage = {
                        id: `msg-${Date.now() + 1}`,
                        role: 'assistant',
                        content: claudeResponse,
                        timestamp: new Date().toISOString()
                    };

                    claudeSession.messages.push(assistantMessage);

                    // Emit response
                    this.emitToSocket(socket, 'claude:response', {
                        sessionId,
                        message: assistantMessage
                    });
                } catch (error) {
                    console.error('[CLAUDE] Query failed:', error);

                    const errorMessage = {
                        id: `msg-${Date.now() + 1}`,
                        role: 'assistant',
                        content: `Sorry, I encountered an error: ${error.message}\n\nPlease make sure you're authenticated with Claude CLI by running: \`claude setup-token\``,
                        timestamp: new Date().toISOString(),
                        isError: true
                    };

                    claudeSession.messages.push(errorMessage);

                    this.emitToSocket(socket, 'claude:response', {
                        sessionId,
                        message: errorMessage
                    });
                }
            } else {
                // Not authenticated response
                const authMessage = {
                    id: `msg-${Date.now() + 1}`,
                    role: 'assistant',
                    content: "I need authentication to provide assistance. Please run the following command in your terminal:\n\n```bash\nclaude setup-token\n```\n\nAfter authentication, I'll be able to help you with your coding tasks!",
                    timestamp: new Date().toISOString()
                };

                claudeSession.messages.push(authMessage);

                this.emitToSocket(socket, 'claude:response', {
                    sessionId,
                    message: authMessage
                });
            }

            // Stop typing indicator
            this.emitToSocket(socket, 'claude:typing', { sessionId, isTyping: false });
        } catch (error) {
            console.error('[CLAUDE] Message handling failed:', error);

            const sessionId = data?.sessionId;
            if (sessionId) {
                this.emitToSocket(socket, 'claude:typing', { sessionId, isTyping: false });
            }

            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }

    async handleHistory(socket, data, callback) {
        try {
            const { sessionId } = data || {};
            const claudeSession = this.sessions.get(socket.id);

            if (!claudeSession?.id || claudeSession.id !== sessionId) {
                const errorResponse = {
                    success: false,
                    error: 'Invalid session ID'
                };
                if (callback) callback(errorResponse);
                return;
            }

            const response = {
                success: true,
                messages: claudeSession.messages
            };

            if (callback) callback(response);
        } catch (error) {
            console.error('[CLAUDE] Get history failed:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }

    async handleClear(socket, data, callback) {
        try {
            const { sessionId } = data || {};
            const claudeSession = this.sessions.get(socket.id);

            if (!claudeSession?.id || claudeSession.id !== sessionId) {
                const errorResponse = {
                    success: false,
                    error: 'Invalid session ID'
                };
                if (callback) callback(errorResponse);
                return;
            }

            claudeSession.messages = [
                {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: 'Chat history cleared. How can I help you with your project?',
                    timestamp: new Date().toISOString()
                }
            ];

            const response = { success: true };
            if (callback) callback(response);

            this.emitToSocket(socket, 'claude:cleared', { sessionId });
        } catch (error) {
            console.error('[CLAUDE] Clear chat failed:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }

    async handleEnd(socket, data, callback) {
        try {
            const { sessionId } = data || {};
            const claudeSession = this.sessions.get(socket.id);

            if (claudeSession?.id === sessionId) {
                console.log(`[CLAUDE] Session ended: ${sessionId}`);

                const endedSession = { ...claudeSession };
                this.sessions.delete(socket.id);

                const response = { success: true };
                if (callback) callback(response);

                this.emitToSocket(socket, 'claude:session-ended', {
                    sessionId: endedSession.id,
                    projectId: endedSession.projectId
                });
            } else {
                const errorResponse = {
                    success: false,
                    error: 'Invalid session ID'
                };
                if (callback) callback(errorResponse);
            }
        } catch (error) {
            console.error('[CLAUDE] End session failed:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }

    /**
     * Handle starting Claude authentication flow
     * Creates a PTY session and runs 'claude setup-token'
     */
    async handleStartAuth(socket, callback) {
        try {
            console.log(`[CLAUDE] Starting authentication flow for socket ${socket.id}`);

            // Import TerminalManager dynamically to avoid circular dependencies
            const { TerminalManager } = await import('../../shell/server/terminal.server.js');
            const terminalManager = new TerminalManager();

            // Create a temporary session for authentication
            const authSessionId = await terminalManager.createSessionInProject('claude-auth', {
                name: 'Claude Authentication',
                mode: 'shell',
                cols: 80,
                rows: 24,
                workingDirectory: process.cwd(),
                shell: process.env.SHELL || '/bin/bash'
            });

            if (!authSessionId) {
                throw new Error('Failed to create authentication session');
            }

            // Store the auth session for this socket
            const authSession = {
                id: authSessionId,
                terminalManager,
                socket,
                step: 'running-setup',
                outputBuffer: '',
                urlExtracted: false
            };

            // Store auth session (use a different map for auth sessions)
            if (!this.authSessions) {
                this.authSessions = new Map();
            }
            this.authSessions.set(socket.id, authSession);

            // Get the terminal session and set up output monitoring
            const terminalSession = authSession.terminalManager.sessions.get(authSessionId);
            if (terminalSession && terminalSession.ptyProcess) {
                // Monitor output for OAuth URL
                terminalSession.ptyProcess.onData((data) => {
                    this.handleAuthOutput(socket.id, data);
                });

                // Send the command to start authentication
                setTimeout(() => {
                    terminalSession.ptyProcess.write('claude setup-token\r');
                }, 500);
            }

            const response = {
                success: true,
                authSessionId,
                message: 'Authentication flow started'
            };

            if (callback) callback(response);

            // Emit status update
            this.emitToSocket(socket, 'claude:auth-started', response);

        } catch (error) {
            console.error('[CLAUDE] Start auth failed:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }

    /**
     * Handle authentication output and extract OAuth URL
     */
    handleAuthOutput(socketId, data) {
        const authSession = this.authSessions?.get(socketId);
        if (!authSession) return;

        authSession.outputBuffer += data;

        // Emit raw output for debugging
        this.emitToSocket(authSession.socket, 'claude:auth-output', { data });

        // Look for OAuth URL in the output
        if (!authSession.urlExtracted) {
            const urlMatch = authSession.outputBuffer.match(/https:\/\/console\.anthropic\.com[^\s\n\r]+/);
            if (urlMatch) {
                const oauthUrl = urlMatch[0];
                authSession.urlExtracted = true;
                authSession.step = 'waiting-for-token';

                console.log(`[CLAUDE] OAuth URL extracted: ${oauthUrl}`);

                // Emit the OAuth URL to the client
                this.emitToSocket(authSession.socket, 'claude:auth-url', {
                    url: oauthUrl,
                    message: 'Please visit this URL to get your authentication token'
                });
            }
        }
    }

    /**
     * Handle token submission from user
     */
    async handleSubmitToken(socket, data, callback) {
        try {
            const { token } = data || {};
            if (!token || typeof token !== 'string') {
                throw new Error('Token is required');
            }

            const authSession = this.authSessions?.get(socket.id);
            if (!authSession) {
                throw new Error('No active authentication session');
            }

            console.log(`[CLAUDE] Submitting token for socket ${socket.id}`);

            // Get the terminal session and send the token
            const terminalSession = authSession.terminalManager.sessions.get(authSession.id);
            if (terminalSession && terminalSession.ptyProcess) {
                // Send the token to the running setup-token command
                terminalSession.ptyProcess.write(token.trim() + '\r');

                // Wait a moment for the command to complete
                setTimeout(async () => {
                    try {
                        // Check if authentication is now successful
                        const isAuthenticated = claudeCodeService.isAuthenticated(); // Remove await - this is a synchronous method

                        if (isAuthenticated) {
                            console.log(`[CLAUDE] Authentication successful for socket ${socket.id}`);

                            // Clean up auth session
                            authSession.terminalManager.endSession(authSession.id);
                            this.authSessions.delete(socket.id);

                            // Emit success
                            this.emitToSocket(socket, 'claude:auth-completed', {
                                success: true,
                                authenticated: true,
                                message: 'Authentication completed successfully!'
                            });
                        } else {
                            // Authentication failed
                            this.emitToSocket(socket, 'claude:auth-completed', {
                                success: false,
                                authenticated: false,
                                message: 'Authentication failed. Please try again.'
                            });
                        }
                    } catch (error) {
                        console.error('[CLAUDE] Auth check failed:', error);
                        this.emitToSocket(socket, 'claude:auth-completed', {
                            success: false,
                            authenticated: false,
                            message: `Authentication check failed: ${error.message}`
                        });
                    }
                }, 2000);
            }

            const response = {
                success: true,
                message: 'Token submitted successfully'
            };

            if (callback) callback(response);

        } catch (error) {
            console.error('[CLAUDE] Submit token failed:', error);
            const errorResponse = {
                success: false,
                error: error.message
            };

            if (callback) callback(errorResponse);
        }
    }
}