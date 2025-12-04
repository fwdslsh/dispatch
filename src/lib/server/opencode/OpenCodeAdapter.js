import { logger } from '../shared/utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';
import { buildOpenCodeOptions } from './opencode-options.js';

/**
 * @typedef {import('@opencode-ai/sdk').OpencodeClient} OpencodeClient
 */

/**
 * OpenCode adapter for OpenCode sessions using @opencode-ai/sdk
 * Provides a simple adapter interface that wraps OpenCode SDK functionality
 */
export class OpenCodeAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {Object} [params.options={}] - OpenCode options
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		logger.info('OPENCODE_ADAPTER', 'create() called with params:', {
			cwd,
			options,
			hasOnEvent: typeof onEvent === 'function'
		});

		// Lazy load OpenCode SDK
		let OpencodeClient;
		try {
			const opencodeModule = await import('@opencode-ai/sdk');
			OpencodeClient = opencodeModule.OpencodeClient;
			if (!OpencodeClient) {
				const availableExports = Object.keys(opencodeModule).join(', ');
				logger.error('OPENCODE_ADAPTER', 'Available exports:', availableExports);
				throw new Error('OpencodeClient not found in @opencode-ai/sdk exports');
			}
			logger.info('OPENCODE_ADAPTER', 'Successfully loaded OpencodeClient');
		} catch (error) {
			logger.error('OPENCODE_ADAPTER', 'Failed to load @opencode-ai/sdk:', error);
			throw new Error(`OpenCode SDK functionality not available: ${error.message}`);
		}

		// Prepare OpenCode SDK options with defaults
		const opencodeOptions = buildOpenCodeOptions({ ...options, cwd });

		logger.info('OPENCODE_ADAPTER', `Creating OpenCode session with options:`, {
			cwd: opencodeOptions.cwd,
			baseUrl: opencodeOptions.baseUrl,
			model: opencodeOptions.model,
			provider: opencodeOptions.provider
		});

		// Create OpenCode client
		let client;
		try {
			client = new OpencodeClient({
				baseUrl: opencodeOptions.baseUrl,
				timeout: opencodeOptions.timeout || 60000,
				maxRetries: opencodeOptions.maxRetries || 2
			});
			logger.info('OPENCODE_ADAPTER', 'OpencodeClient instance created successfully');
		} catch (error) {
			logger.error('OPENCODE_ADAPTER', 'Failed to create OpencodeClient:', error);
			throw new Error(`Failed to create OpenCode client: ${error.message}`);
		}

		let activeSession = null;
		let isClosing = false;
		let eventStream = null;

		const emitOpenCodeEvent = (rawEvent) => {
			if (!rawEvent) return;

			let serialized;
			try {
				serialized = JSON.parse(JSON.stringify(rawEvent));
			} catch (error) {
				logger.warn('OPENCODE_ADAPTER', 'Failed to serialize OpenCode event', error);
				return;
			}

			try {
				onEvent({
					channel: 'opencode:message',
					type: serialized.type || 'event',
					payload: {
						events: [serialized]
					}
				});
			} catch (error) {
				logger.error('OPENCODE_ADAPTER', 'Error in emitOpenCodeEvent:', error);
			}
		};

		// Start event subscription
		const startEventStream = async (sessionId) => {
			try {
				eventStream = await client.event.subscribe();

				// Debug: log the event stream response
				logger.info('OPENCODE_ADAPTER', 'Event subscribe response type:', typeof eventStream);
				logger.info('OPENCODE_ADAPTER', 'Event stream keys:', Object.keys(eventStream || {}));

				// The SDK might return a response object, not an async iterable
				// Try to get the actual stream
				const stream = eventStream?.stream || eventStream?.data || eventStream;

				logger.info('OPENCODE_ADAPTER', 'Starting event loop for session:', sessionId);
				for await (const event of stream) {
					logger.info('OPENCODE_ADAPTER', 'Received event:', event);
					if (isClosing) break;

					// Extract sessionID from various event structures
					const eventSessionId =
						event.properties?.sessionID ||
						event.properties?.part?.sessionID ||
						event.properties?.info?.sessionID ||
						event.sessionID;

					// Filter events for this session
					if (eventSessionId === sessionId) {
						logger.info('OPENCODE_ADAPTER', 'Event matches session, emitting:', event.type);
						emitOpenCodeEvent(event);

						// Session completed or idle
						if (event.type === 'session.idle' || event.type === 'session.completed') {
							logger.info('OPENCODE_ADAPTER', `Session ${sessionId} completed`);
							break;
						}
					} else {
						logger.info('OPENCODE_ADAPTER', `Event for different session. Got: ${eventSessionId}, Expected: ${sessionId}`);
					}
				}
			} catch (error) {
				if (!isClosing) {
					logger.error('OPENCODE_ADAPTER', 'Event stream error:', error);
					try {
						onEvent({
							channel: 'opencode:error',
							type: 'stream_error',
							payload: {
								error: error.message,
								stack: error.stack
							}
						});
					} catch (eventError) {
						logger.error('OPENCODE_ADAPTER', 'Error sending error event:', eventError);
					}
				}
			}
		};

		// Return adapter interface
		return {
			kind: SESSION_TYPE.OPENCODE,
			input: {
				async write(/** @type {string | Uint8Array} */ data) {
					if (isClosing) {
						logger.warn('OPENCODE_ADAPTER', 'Ignoring input - adapter is closing');
						return;
					}

					const message = typeof data === 'string' ? data : new TextDecoder().decode(data);

					try {
						// Create session if not exists
						if (!activeSession) {
							const createResponse = await client.session.create({
								body: {
									projectPath: opencodeOptions.cwd,
									model: opencodeOptions.model,
									provider: opencodeOptions.provider || 'anthropic'
								}
							});

							// Debug: log the full response structure
							logger.info('OPENCODE_ADAPTER', 'Full createResponse:', JSON.stringify(createResponse, null, 2));

							// openapi-fetch returns { data, error, response }
							// The data field contains the Session object with id field
							if (createResponse.error) {
								throw new Error(`Failed to create session: ${JSON.stringify(createResponse.error)}`);
							}

							// Extract the Session object from the response
							activeSession = createResponse.data || createResponse;
							logger.info('OPENCODE_ADAPTER', `Created session: ${activeSession.id}`);

							// Start event streaming
							startEventStream(activeSession.id).catch((error) => {
								logger.error('OPENCODE_ADAPTER', 'Failed to start event stream:', error);
							});
						}

						// Send prompt to session
						logger.info('OPENCODE_ADAPTER', `Sending prompt to session ${activeSession.id}:`, message);
						const promptResponse = await client.session.prompt({
							path: { id: activeSession.id },
							body: {
								skipInference: false,
								parts: [
									{
										type: 'text',
										text: message
									}
								]
							}
						});
						logger.info('OPENCODE_ADAPTER', 'Prompt response:', JSON.stringify(promptResponse, null, 2));
					} catch (error) {
						if (!isClosing) {
							logger.error('OPENCODE_ADAPTER', 'OpenCode query error:', error);

							// Determine user-friendly error message
							let userMessage = error.message;
							if (error.cause?.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
								userMessage = `Cannot connect to OpenCode server at ${opencodeOptions.baseUrl}. Please ensure the OpenCode server is running.`;
							}

							try {
								onEvent({
									channel: 'opencode:error',
									type: 'execution_error',
									payload: {
										error: userMessage,
										originalError: error.message,
										code: error.cause?.code,
										stack: error.stack
									}
								});
							} catch (eventError) {
								logger.error('OPENCODE_ADAPTER', 'Error sending error event:', eventError);
							}
						}
					}
				}
			},
			close() {
				try {
					// Set closing flag to stop processing new events
					isClosing = true;

					// Close event stream
					if (eventStream && eventStream.controller) {
						eventStream.controller.abort();
					}

					// Log that we're closing
					if (activeSession) {
						logger.info(
							'OPENCODE_ADAPTER',
							`OpenCode adapter closing - session ${activeSession.id}`
						);
					} else {
						logger.info('OPENCODE_ADAPTER', 'OpenCode adapter closing - no active session');
					}
				} catch (error) {
					logger.warn('OPENCODE_ADAPTER', 'Error during close:', error.message || 'Unknown error');
				} finally {
					// Clear references to allow garbage collection
					activeSession = null;
					eventStream = null;
				}
			},
			// Expose any additional methods that might be useful
			getActiveSession() {
				return activeSession;
			}
		};
	}
}
