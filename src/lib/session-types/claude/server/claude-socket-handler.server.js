/**
 * Claude Socket.IO Handler - Server-side Claude Code service integration
 *
 * Wraps claude-code-service in Socket.IO handlers for client communication.
 * Handles authentication, chat messages, and session management.
 */

import { claudeCodeService } from './claude-code-service.server.js';

/**
 * Create Claude-specific socket handlers
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} options - Handler options
 */
export function createClaudeHandlers(socket, options = {}) {
	const { sessionManager = null, logger = console } = options;

	// Claude session state
	let claudeSession = {
		id: null,
		projectId: null,
		isAuthenticated: false,
		messages: []
	};

	/**
	 * Check Claude CLI authentication status
	 */
	socket.on('claude:check-auth', async (callback) => {
		try {
			const isAuthenticated = await claudeCodeService.isAuthenticated();
			claudeSession.isAuthenticated = isAuthenticated;

			logger.log(`Claude auth check for ${socket.id}: ${isAuthenticated}`);

			callback({
				success: true,
				authenticated: isAuthenticated
			});
		} catch (error) {
			logger.error('Claude auth check failed:', error);
			callback({
				success: false,
				error: error.message
			});
		}
	});

	/**
	 * Initialize Claude chat session
	 */
	socket.on('claude:init-session', async ({ projectId, sessionOptions = {} }, callback) => {
		try {
			const sessionId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			claudeSession = {
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

			logger.log(`Claude session initialized: ${sessionId} for project: ${projectId}`);

			callback({
				success: true,
				session: {
					id: sessionId,
					projectId: claudeSession.projectId,
					authenticated: claudeSession.isAuthenticated,
					welcomeMessage
				}
			});

			// Emit session created event
			socket.emit('claude:session-created', {
				sessionId,
				projectId: claudeSession.projectId
			});
		} catch (error) {
			logger.error('Claude session initialization failed:', error);
			callback({
				success: false,
				error: error.message
			});
		}
	});

	/**
	 * Send message to Claude
	 */
	socket.on('claude:send-message', async ({ message, sessionId }, callback) => {
		try {
			if (!claudeSession.id || claudeSession.id !== sessionId) {
				callback({
					success: false,
					error: 'Invalid session ID'
				});
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
			socket.emit('claude:typing', { sessionId, isTyping: true });

			callback({
				success: true,
				message: userMessage
			});

			// Query Claude if authenticated
			if (claudeSession.isAuthenticated) {
				try {
					// Add project context to the message
					const contextualMessage = `Project: ${claudeSession.projectId}\n\nUser: ${message}`;

					const response = await claudeCodeService.query(contextualMessage);

					const assistantMessage = {
						id: `msg-${Date.now() + 1}`,
						role: 'assistant',
						content: response,
						timestamp: new Date().toISOString()
					};

					claudeSession.messages.push(assistantMessage);

					// Emit response
					socket.emit('claude:message-response', {
						sessionId,
						message: assistantMessage
					});
				} catch (error) {
					logger.error('Claude query failed:', error);

					const errorMessage = {
						id: `msg-${Date.now() + 1}`,
						role: 'assistant',
						content: `Sorry, I encountered an error: ${error.message}\n\nPlease make sure you're authenticated with Claude CLI by running: \`claude setup-token\``,
						timestamp: new Date().toISOString(),
						isError: true
					};

					claudeSession.messages.push(errorMessage);

					socket.emit('claude:message-response', {
						sessionId,
						message: errorMessage
					});
				}
			} else {
				// Not authenticated response
				const authMessage = {
					id: `msg-${Date.now() + 1}`,
					role: 'assistant',
					content:
						"I need authentication to provide assistance. Please run the following command in your terminal:\n\n```bash\nclaude setup-token\n```\n\nAfter authentication, I'll be able to help you with your coding tasks!",
					timestamp: new Date().toISOString()
				};

				claudeSession.messages.push(authMessage);

				socket.emit('claude:message-response', {
					sessionId,
					message: authMessage
				});
			}

			// Stop typing indicator
			socket.emit('claude:typing', { sessionId, isTyping: false });
		} catch (error) {
			logger.error('Claude message handling failed:', error);

			socket.emit('claude:typing', { sessionId, isTyping: false });

			callback({
				success: false,
				error: error.message
			});
		}
	});

	/**
	 * Clear chat history
	 */
	socket.on('claude:clear-chat', ({ sessionId }, callback) => {
		try {
			if (!claudeSession.id || claudeSession.id !== sessionId) {
				callback({
					success: false,
					error: 'Invalid session ID'
				});
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

			callback({
				success: true
			});

			socket.emit('claude:chat-cleared', { sessionId });
		} catch (error) {
			logger.error('Claude clear chat failed:', error);
			callback({
				success: false,
				error: error.message
			});
		}
	});

	/**
	 * Get chat history
	 */
	socket.on('claude:get-history', ({ sessionId }, callback) => {
		try {
			if (!claudeSession.id || claudeSession.id !== sessionId) {
				callback({
					success: false,
					error: 'Invalid session ID'
				});
				return;
			}

			callback({
				success: true,
				messages: claudeSession.messages
			});
		} catch (error) {
			logger.error('Claude get history failed:', error);
			callback({
				success: false,
				error: error.message
			});
		}
	});

	/**
	 * End Claude session
	 */
	socket.on('claude:end-session', ({ sessionId }, callback) => {
		try {
			if (claudeSession.id === sessionId) {
				logger.log(`Claude session ended: ${sessionId}`);

				const endedSession = { ...claudeSession };

				// Reset session
				claudeSession = {
					id: null,
					projectId: null,
					isAuthenticated: false,
					messages: []
				};

				callback({
					success: true
				});

				socket.emit('claude:session-ended', {
					sessionId: endedSession.id,
					projectId: endedSession.projectId
				});
			} else {
				callback({
					success: false,
					error: 'Invalid session ID'
				});
			}
		} catch (error) {
			logger.error('Claude end session failed:', error);
			callback({
				success: false,
				error: error.message
			});
		}
	});

	/**
	 * Handle disconnect
	 */
	socket.on('disconnect', () => {
		if (claudeSession.id) {
			logger.log(`Claude session disconnected: ${claudeSession.id}`);
		}
	});

	return {
		getSession: () => claudeSession,
		cleanup: () => {
			claudeSession = {
				id: null,
				projectId: null,
				isAuthenticated: false,
				messages: []
			};
		}
	};
}

/**
 * Export handler factory for integration with main socket handler
 */
export default createClaudeHandlers;
