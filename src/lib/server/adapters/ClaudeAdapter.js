import { logger } from '../utils/logger.js';

/**
 * @typedef {import('@anthropic-ai/claude-code').Options} ClaudeOptions
 * @typedef {import('@anthropic-ai/claude-code').PermissionMode} PermissionMode
 * @typedef {import('@anthropic-ai/claude-code').SDKMessage} SDKMessage
 */

/**
 * Claude adapter for Claude Code sessions using @anthropic-ai/claude-code
 * Provides a simple adapter interface that wraps Claude Code SDK functionality
 */
export class ClaudeAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {ClaudeOptions} [params.options={}] - Claude options
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		// Lazy load Claude Code SDK
		let query;
		try {
			const claudeCode = await import('@anthropic-ai/claude-code');
			query = claudeCode.query;
		} catch (error) {
			logger.error('CLAUDE_ADAPTER', 'Failed to load @anthropic-ai/claude-code:', error);
			throw new Error(`Claude Code functionality not available: ${error.message}`);
		}

		// Prepare Claude Code SDK options with defaults
		const claudeOptions = {
			cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
			model: options.model,
			permissionMode: options.permissionMode || 'default',
			maxTurns: options.maxTurns,
			env: options.env || {},
			additionalDirectories: options.additionalDirectories || [],
			allowedTools: options.allowedTools,
			disallowedTools: options.disallowedTools,
			customSystemPrompt: options.customSystemPrompt,
			appendSystemPrompt: options.appendSystemPrompt,
			mcpServers: options.mcpServers || {},
			hooks: options.hooks || {},
			includePartialMessages: options.includePartialMessages || false,
			// Allow any other SDK options
			...options
		};

		logger.info('CLAUDE_ADAPTER', `Creating Claude session with options:`, {
			cwd: claudeOptions.cwd,
			model: claudeOptions.model,
			permissionMode: claudeOptions.permissionMode,
			maxTurns: claudeOptions.maxTurns,
			includePartialMessages: claudeOptions.includePartialMessages
		});

		let activeQuery = null;

		const emitClaudeEvent = (rawEvent) => {
			if (!rawEvent) return;

			let serialized;
			try {
				serialized = JSON.parse(JSON.stringify(rawEvent));
			} catch (error) {
				logger.warn('CLAUDE_ADAPTER', 'Failed to serialize Claude event', error);
				return;
			}

			onEvent({
				channel: 'claude:message',
				type: serialized.type || 'event',
				payload: {
					events: [serialized]
				}
			});
		};

		// Return adapter interface
		return {
			kind: 'claude',
			input: {
				async write(/** @type {string | Uint8Array} */ data) {
					const message = typeof data === 'string' ? data : new TextDecoder().decode(data);

					// Create new query with the message
					activeQuery = query({
						prompt: message,
						options: claudeOptions
					});

					// Stream messages as events
					try {
						for await (const messageEvent of activeQuery) {
							emitClaudeEvent(messageEvent);
						}
					} catch (error) {
						logger.error('CLAUDE_ADAPTER', 'Claude query error:', error);
						onEvent({
							channel: 'claude:error',
							type: 'execution_error',
							payload: {
								error: error.message,
								stack: error.stack
							}
						});
					}
				}
			},
			close() {
				if (activeQuery && activeQuery.interrupt) {
					try {
						activeQuery.interrupt();
						logger.info('CLAUDE_ADAPTER', 'Claude query interrupted');
					} catch (error) {
						logger.warn('CLAUDE_ADAPTER', 'Failed to interrupt Claude query:', error);
					}
				}
			},
			// Expose any additional methods that might be useful
			getActiveQuery() {
				return activeQuery;
			}
		};
	}
}
