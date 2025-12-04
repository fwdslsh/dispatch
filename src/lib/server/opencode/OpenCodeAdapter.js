import { logger } from '../shared/utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';
import { buildOpenCodeOptions } from './opencode-options.js';

/**
 * @typedef {import('@opencode-ai/sdk').default} Opencode
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
		// Lazy load OpenCode SDK
		let Opencode;
		try {
			const opencodeModule = await import('@opencode-ai/sdk');
			Opencode = opencodeModule.default;
		} catch (error) {
			logger.error('OPENCODE_ADAPTER', 'Failed to load @opencode-ai/sdk:', error);
			throw new Error(`OpenCode SDK functionality not available: ${error.message}`);
		}

		// Prepare OpenCode SDK options with defaults
		const opencodeOptions = buildOpenCodeOptions({ ...options, cwd });

		logger.info('OPENCODE_ADAPTER', `Creating OpenCode session with options:`, {
			cwd: opencodeOptions.cwd,
			baseUrl: opencodeOptions.baseUrl,
			model: opencodeOptions.model
		});

		// Create OpenCode client
		const client = new Opencode({
			baseUrl: opencodeOptions.baseUrl,
			timeout: opencodeOptions.timeout || 60000,
			maxRetries: opencodeOptions.maxRetries || 2
		});

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

				for await (const event of eventStream) {
					if (isClosing) break;

					// Filter events for this session
					if (event.sessionID === sessionId) {
						emitOpenCodeEvent(event);

						// Session completed or idle
						if (event.type === 'session.idle' || event.type === 'session.completed') {
							logger.info('OPENCODE_ADAPTER', `Session ${sessionId} completed`);
							break;
						}
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
							activeSession = createResponse;
							logger.info('OPENCODE_ADAPTER', `Created session: ${activeSession.id}`);

							// Start event streaming
							startEventStream(activeSession.id).catch((error) => {
								logger.error('OPENCODE_ADAPTER', 'Failed to start event stream:', error);
							});
						}

						// Send prompt to session
						await client.session.prompt({
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
					} catch (error) {
						if (!isClosing) {
							logger.error('OPENCODE_ADAPTER', 'OpenCode query error:', error);
							try {
								onEvent({
									channel: 'opencode:error',
									type: 'execution_error',
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
