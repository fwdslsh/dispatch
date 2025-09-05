import { query } from '@anthropic-ai/claude-code';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Service wrapper for Claude Code SDK integration
 * Simplified implementation using official SDK patterns
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ClaudeCodeService {
	constructor(options = {}) {
		// Get the absolute path to the CLI executable
		const cliPath = resolve(__dirname, '../../../node_modules/.bin/claude');

		this.defaultOptions = {
			maxTurns: 10,
			customSystemPrompt:
				'You are a helpful coding assistant integrated into a web terminal interface.',
			allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'Task'],
			permissionMode: 'bypassPermissions',
			pathToClaudeCodeExecutable: cliPath,
			...options
		};
	}

	/**
	 * Check if Claude CLI is authenticated by verifying credentials file
	 * @returns {boolean} True if authenticated (credentials.json exists with token)
	 */
	isAuthenticated() {
		try {
			const homeDir = os.homedir();
			const credentialsPath = path.join(homeDir, '.claude', 'credentials.json');

			// Check if credentials file exists
			if (!fs.existsSync(credentialsPath)) {
				return false;
			}

			// Read and parse the credentials file
			const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
			const credentials = JSON.parse(credentialsContent);

			// Check if token property exists and has a value
			return !!(
				credentials.token &&
				typeof credentials.token === 'string' &&
				credentials.token.trim().length > 0
			);
		} catch (error) {
			console.error('Error checking Claude authentication:', error);
			return false;
		}
	}

	/**
	 * Execute a query using Claude Code SDK
	 * @param {string} prompt - The prompt to send to Claude
	 * @param {Object} options - Query options
	 * @returns {Promise<string>} The complete response from Claude
	 */
	async query(prompt, options = {}) {
		const queryOptions = {
			...this.defaultOptions,
			...options
		};

		try {
			let fullResponse = '';

			// Use the official SDK query function with correct parameter structure
			for await (const message of query({
				prompt,
				options: queryOptions
			})) {
				if (message.type === 'result') {
					fullResponse += message.result;
				} else if (message.type === 'assistant') {
					fullResponse += message.content;
				}
			}

			return fullResponse;
		} catch (error) {
			// Provide better error information while maintaining compatibility
			if (error.message?.includes('not authenticated')) {
				throw new Error('Not authenticated with Claude CLI. Please run: claude setup-token');
			} else if (error.code === 'ETIMEDOUT') {
				throw new Error('Claude request timed out');
			} else if (
				error.message?.includes('exited with code 1') ||
				error.message?.includes('ENOENT')
			) {
				throw new Error(
					'Claude CLI not found or not properly installed. Please run: npm install -g @anthropic-ai/claude-cli && claude setup-token'
				);
			} else {
				throw new Error(`Claude query failed: ${error.message || error.toString()}`);
			}
		}
	}

	/**
	 * Stream query responses for real-time updates
	 * @param {string} prompt - The prompt to send to Claude
	 * @param {Object} options - Query options
	 * @param {Function} onMessage - Callback for each message chunk
	 * @returns {Promise<string>} Promise that resolves with the complete response
	 */
	async streamQuery(prompt, options = {}, onMessage = null) {
		const queryOptions = {
			...this.defaultOptions,
			...options
		};

		let fullResponse = '';

		try {
			for await (const message of query({
				prompt,
				options: queryOptions
			})) {
				if (message.type === 'result') {
					fullResponse += message.result;
					if (onMessage) onMessage({ type: 'result', content: message.result });
				} else if (message.type === 'assistant') {
					fullResponse += message.content;
					if (onMessage) onMessage({ type: 'assistant', content: message.content });
				} else if (onMessage) {
					onMessage(message);
				}
			}

			return fullResponse;
		} catch (error) {
			if (error.message?.includes('not authenticated')) {
				throw new Error('Not authenticated with Claude CLI. Please run: claude setup-token');
			} else {
				console.log('Claude query error:', error);
				throw new Error(`Claude query failed: ${error.message}`);
			}
		}
	}
}

// Export a singleton instance for convenience
export const claudeCodeService = new ClaudeCodeService();
