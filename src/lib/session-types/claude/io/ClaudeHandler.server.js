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
        socket.on('claude:auth', this.authHandler.withAuth(this.handleAuth.bind(this, socket), socket));
        socket.on('claude:create', this.authHandler.withAuth(this.handleCreate.bind(this, socket), socket));
        socket.on('claude:send', this.authHandler.withAuth(this.handleSend.bind(this, socket), socket));
        socket.on('claude:history', this.authHandler.withAuth(this.handleHistory.bind(this, socket), socket));
        socket.on('claude:clear', this.authHandler.withAuth(this.handleClear.bind(this, socket), socket));
        socket.on('claude:end', this.authHandler.withAuth(this.handleEnd.bind(this, socket), socket));
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
            const isAuthenticated = await claudeCodeService.isAuthenticated();

            console.log(`[CLAUDE] Auth check for ${socket.id}: ${isAuthenticated}`);

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
                isAuthenticated: await claudeCodeService.isAuthenticated(),
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
}