/**
 * AIAdapter - Unified AI session adapter powered by OpenCode SDK
 *
 * v2.0 Hard Fork: OpenCode-first architecture
 * This adapter provides a thin wrapper around the OpenCode SDK,
 * leveraging its full capabilities for AI-powered development sessions.
 *
 * @file src/lib/server/ai/AIAdapter.js
 */

import { logger } from '../shared/utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

/**
 * @typedef {Object} AIAdapterOptions
 * @property {string} [baseUrl] - OpenCode server URL (default: http://localhost:4096)
 * @property {string} [model] - AI model to use
 * @property {string} [provider] - Provider name (anthropic, openai, etc.)
 * @property {number} [timeout] - Request timeout in ms
 * @property {number} [maxRetries] - Max retry attempts
 */

/**
 * Build OpenCode SDK options with defaults
 * @param {Object} options - Input options
 * @returns {Object} Resolved options
 */
function buildAIOptions(options = {}) {
	const { cwd, baseUrl, model, provider, timeout, maxRetries } = options;

	return {
		cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
		baseUrl: baseUrl || process.env.OPENCODE_SERVER_URL || 'http://localhost:4096',
		model: model || process.env.OPENCODE_MODEL || 'claude-sonnet-4-20250514',
		provider: provider || process.env.OPENCODE_PROVIDER || 'anthropic',
		timeout: timeout || 60000,
		maxRetries: maxRetries || 2
	};
}

/**
 * AIAdapter - Unified adapter for AI sessions using OpenCode SDK
 * Replaces ClaudeAdapter, OpenCodeAdapter, and OpenCodeTuiAdapter
 */
export class AIAdapter {
	/**
	 * Create an AI session
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {AIAdapterOptions} [params.options={}] - AI options
	 * @param {Function} params.onEvent - Event callback
	 * @returns {Promise<Object>} Session handle
	 */
	async create({ cwd, options = {}, onEvent }) {
		logger.info('AI_ADAPTER', 'Creating AI session', { cwd, options });

		// Lazy load OpenCode SDK
		let OpencodeClient;
		try {
			const opencodeModule = await import('@opencode-ai/sdk');
			OpencodeClient = opencodeModule.OpencodeClient;
			if (!OpencodeClient) {
				const availableExports = Object.keys(opencodeModule).join(', ');
				logger.error('AI_ADAPTER', 'Available exports:', availableExports);
				throw new Error('OpencodeClient not found in @opencode-ai/sdk exports');
			}
			logger.info('AI_ADAPTER', 'OpenCode SDK loaded successfully');
		} catch (error) {
			logger.error('AI_ADAPTER', 'Failed to load @opencode-ai/sdk:', error);
			throw new Error(`OpenCode SDK not available: ${error.message}`);
		}

		// Build options with defaults
		const aiOptions = buildAIOptions({ ...options, cwd });

		logger.info('AI_ADAPTER', 'Creating AI session with options:', {
			cwd: aiOptions.cwd,
			baseUrl: aiOptions.baseUrl,
			model: aiOptions.model,
			provider: aiOptions.provider
		});

		// Create OpenCode client
		let client;
		try {
			client = new OpencodeClient({
				baseUrl: aiOptions.baseUrl,
				timeout: aiOptions.timeout,
				maxRetries: aiOptions.maxRetries
			});
			logger.info('AI_ADAPTER', 'OpenCode client created');
		} catch (error) {
			logger.error('AI_ADAPTER', 'Failed to create OpenCode client:', error);
			throw new Error(`Failed to create OpenCode client: ${error.message}`);
		}

		// Session state
		let activeSession = null;
		let isClosing = false;
		let eventStream = null;

		/**
		 * Emit an AI event to the client
		 * @param {Object} rawEvent - Raw event from OpenCode
		 */
		const emitEvent = (rawEvent) => {
			if (!rawEvent || isClosing) return;

			let serialized;
			try {
				serialized = JSON.parse(JSON.stringify(rawEvent));
			} catch (error) {
				logger.warn('AI_ADAPTER', 'Failed to serialize event', error);
				return;
			}

			try {
				onEvent({
					channel: 'ai:message',
					type: serialized.type || 'event',
					payload: { events: [serialized] }
				});
			} catch (error) {
				logger.error('AI_ADAPTER', 'Error emitting event:', error);
			}
		};

		/**
		 * Emit an error event to the client
		 * @param {string} message - Error message
		 * @param {Object} [details] - Additional error details
		 */
		const emitError = (message, details = {}) => {
			if (isClosing) return;

			try {
				onEvent({
					channel: 'ai:error',
					type: 'error',
					payload: { error: message, ...details }
				});
			} catch (error) {
				logger.error('AI_ADAPTER', 'Error emitting error event:', error);
			}
		};

		/**
		 * Start listening to the event stream for a session
		 * @param {string} sessionId - OpenCode session ID
		 */
		const startEventStream = async (sessionId) => {
			try {
				eventStream = await client.event.subscribe();

				const stream = eventStream?.stream || eventStream?.data || eventStream;

				logger.info('AI_ADAPTER', 'Event stream started for session:', sessionId);

				for await (const event of stream) {
					if (isClosing) break;

					// Extract session ID from various event structures
					const eventSessionId =
						event.properties?.sessionID ||
						event.properties?.part?.sessionID ||
						event.properties?.info?.sessionID ||
						event.sessionID;

					// Filter events for this session
					if (eventSessionId === sessionId) {
						logger.debug('AI_ADAPTER', 'Event received:', event.type);
						emitEvent(event);

						// Session completed
						if (event.type === 'session.idle' || event.type === 'session.completed') {
							logger.info('AI_ADAPTER', `Session ${sessionId} completed`);
							break;
						}
					}
				}
			} catch (error) {
				if (!isClosing) {
					logger.error('AI_ADAPTER', 'Event stream error:', error);
					emitError('Event stream error', { originalError: error.message });
				}
			}
		};

		// Return adapter interface
		return {
			kind: SESSION_TYPE.AI,

			/**
			 * Input stream for sending messages
			 */
			input: {
				/**
				 * Send a message to the AI session
				 * @param {string|Uint8Array} data - Message data
				 */
				async write(data) {
					if (isClosing) {
						logger.warn('AI_ADAPTER', 'Ignoring input - adapter is closing');
						return;
					}

					const message = typeof data === 'string' ? data : new TextDecoder().decode(data);

					try {
						// Create session if not exists
						if (!activeSession) {
							logger.info('AI_ADAPTER', 'Creating new OpenCode session');

							const createResponse = await client.session.create({
								body: {
									projectPath: aiOptions.cwd,
									model: aiOptions.model,
									provider: aiOptions.provider
								}
							});

							if (createResponse.error) {
								throw new Error(`Failed to create session: ${JSON.stringify(createResponse.error)}`);
							}

							activeSession = createResponse.data || createResponse;
							logger.info('AI_ADAPTER', `Session created: ${activeSession.id}`);

							// Start event streaming in background
							startEventStream(activeSession.id).catch((error) => {
								logger.error('AI_ADAPTER', 'Event stream failed:', error);
							});
						}

						// Send message to session
						logger.info('AI_ADAPTER', `Sending message to session ${activeSession.id}`);

						const promptResponse = await client.session.prompt({
							path: { id: activeSession.id },
							body: {
								skipInference: false,
								parts: [{ type: 'text', text: message }]
							}
						});

						logger.debug('AI_ADAPTER', 'Prompt response:', promptResponse);
					} catch (error) {
						if (!isClosing) {
							logger.error('AI_ADAPTER', 'Message error:', error);

							// Provide user-friendly error messages
							let userMessage = error.message;
							if (error.cause?.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
								userMessage = `Cannot connect to OpenCode server at ${aiOptions.baseUrl}. Please ensure the OpenCode server is running.`;
							}

							emitError(userMessage, {
								originalError: error.message,
								code: error.cause?.code
							});
						}
					}
				}
			},

			/**
			 * Close the AI session
			 */
			close() {
				try {
					isClosing = true;

					// Abort event stream if active
					if (eventStream?.controller) {
						eventStream.controller.abort();
					}

					if (activeSession) {
						logger.info('AI_ADAPTER', `Closing session ${activeSession.id}`);
					} else {
						logger.info('AI_ADAPTER', 'Closing adapter - no active session');
					}
				} catch (error) {
					logger.warn('AI_ADAPTER', 'Error during close:', error.message);
				} finally {
					activeSession = null;
					eventStream = null;
				}
			},

			/**
			 * Get the active OpenCode session
			 * @returns {Object|null} Active session or null
			 */
			getActiveSession() {
				return activeSession;
			},

			/**
			 * Get the OpenCode client for direct SDK access
			 * @returns {Object} OpenCode client instance
			 */
			getClient() {
				return client;
			}
		};
	}
}
