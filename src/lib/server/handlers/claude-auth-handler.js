/**
 * ClaudeAuthHandler - Manages Claude AI authentication workflow
 *
 * Handles Claude authentication, token submission, and Claude query operations
 * that was previously mixed with other responsibilities in socket-handler.js
 */

import { ClaudeCodeService } from '../../services/claude-code-service.js';
import { createErrorResponse, ErrorHandler } from '../../utils/error-handling.js';
import { TUNNEL_CONFIG } from '../../config/constants.js';
import fs from 'node:fs';

/**
 * Claude authentication handler for socket events
 */
export class ClaudeAuthHandler {
	/**
	 * @param {Object} dependencies Injected dependencies
	 * @param {ClaudeCodeService} dependencies.claudeService Claude service instance
	 */
	constructor({ claudeService }) {
		this.claudeService = claudeService || new ClaudeCodeService();
		this.TUNNEL_FILE = TUNNEL_CONFIG.TUNNEL_URL_FILE;
	}

	/**
	 * Check Claude authentication status
	 * @param {Socket} socket Socket.IO socket
	 * @param {Object} opts Check options
	 * @param {Function} callback Response callback
	 */
	async 'check-claude-auth'(socket, opts, callback) {
		try {
			// Check if Claude CLI is authenticated
			const isAuthenticated = await this.claudeService.isAuthenticated();

			if (callback)
				callback({
					authenticated: isAuthenticated,
					message: isAuthenticated ? 'Claude is authenticated' : 'Claude authentication required'
				});
		} catch (error) {
			console.error('Error checking Claude auth:', error);
			if (callback)
				callback({
					authenticated: false,
					error: 'Failed to check authentication status'
				});
		}
	}

	/**
	 * Start Claude authentication workflow
	 * @param {Socket} socket Socket.IO socket
	 * @param {Object} opts Authentication options
	 * @param {Function} callback Response callback
	 */
	async 'start-claude-auth'(socket, opts, callback) {
		try {
			const { sessionId } = opts || {};

			// Check current auth status first
			const isAuthenticated = await this.claudeService.isAuthenticated();

			if (isAuthenticated) {
				if (callback)
					callback({
						authenticated: true,
						message: 'Claude is already authenticated'
					});
				return;
			}

			// Check if we have a tunnel URL for the OAuth flow
			let tunnelUrl = null;
			if (fs.existsSync(this.TUNNEL_FILE)) {
				try {
					tunnelUrl = fs.readFileSync(this.TUNNEL_FILE, 'utf-8').trim();
				} catch (err) {
					console.warn('Could not read tunnel URL:', err.message);
				}
			}

			try {
				// Attempt to start Claude authentication
				const authResult = await this.claudeService.startAuth({
					sessionId,
					tunnelUrl
				});

				if (authResult.requiresWebAuth) {
					// Web-based OAuth flow required
					if (callback)
						callback({
							authenticated: false,
							requiresWebAuth: true,
							authUrl: authResult.authUrl,
							message: 'Please complete authentication in your browser',
							tunnelUrl: tunnelUrl
						});
				} else if (authResult.requiresToken) {
					// Token input required
					if (callback)
						callback({
							authenticated: false,
							requiresToken: true,
							message: 'Please provide your Claude authentication token'
						});
				} else {
					// Authentication successful
					if (callback)
						callback({
							authenticated: true,
							message: 'Claude authentication successful'
						});
				}
			} catch (authError) {
				console.error('Claude auth start error:', authError);

				// Fallback to token input method
				if (callback)
					callback({
						authenticated: false,
						requiresToken: true,
						message: 'Please provide your Claude authentication token',
						error: authError.message
					});
			}
		} catch (error) {
			console.error('Error starting Claude auth:', error);
			const errorResponse = ErrorHandler.handle(error.message, 'socket.start-claude-auth', false);
			if (callback) callback(createErrorResponse(errorResponse.error));
		}
	}

	/**
	 * Submit Claude authentication token
	 * @param {Socket} socket Socket.IO socket
	 * @param {Object} opts Token submission options
	 * @param {Function} callback Response callback
	 */
	async 'submit-auth-token'(socket, opts, callback) {
		try {
			const { token } = opts || {};

			if (!token || typeof token !== 'string' || token.trim().length === 0) {
				if (callback) callback(createErrorResponse('Authentication token is required'));
				return;
			}

			// Submit token to Claude service
			const result = await this.claudeService.submitToken(token.trim());

			if (result.success) {
				if (callback)
					callback({
						authenticated: true,
						message: 'Claude authentication successful'
					});
			} else {
				if (callback)
					callback({
						authenticated: false,
						error: result.error || 'Token authentication failed'
					});
			}
		} catch (error) {
			console.error('Error submitting Claude token:', error);
			if (callback)
				callback({
					authenticated: false,
					error: 'Failed to authenticate with provided token'
				});
		}
	}

	/**
	 * Execute Claude query
	 * @param {Socket} socket Socket.IO socket
	 * @param {Object} opts Query options
	 * @param {Function} callback Response callback
	 */
	async 'claude-query'(socket, opts, callback) {
		try {
			const { query, sessionId } = opts || {};

			if (!query || typeof query !== 'string' || query.trim().length === 0) {
				if (callback) callback(createErrorResponse('Query is required'));
				return;
			}

			// Check authentication first
			const isAuthenticated = await this.claudeService.isAuthenticated();
			if (!isAuthenticated) {
				if (callback) callback(createErrorResponse('Claude authentication required'));
				return;
			}

			// Execute query
			const result = await this.claudeService.query(query.trim(), { sessionId });

			if (result.success) {
				if (callback)
					callback({
						success: true,
						response: result.response,
						usage: result.usage
					});
			} else {
				if (callback) callback(createErrorResponse(result.error || 'Query failed'));
			}
		} catch (error) {
			console.error('Error executing Claude query:', error);
			const errorResponse = ErrorHandler.handle(error.message, 'socket.claude-query', false);
			if (callback) callback(createErrorResponse(errorResponse.error));
		}
	}

	/**
	 * Get public URL for OAuth callback
	 * @param {Socket} socket Socket.IO socket
	 * @param {Function} callback Response callback
	 */
	async 'get-public-url'(socket, callback) {
		try {
			let publicUrl = null;

			if (fs.existsSync(this.TUNNEL_FILE)) {
				try {
					publicUrl = fs.readFileSync(this.TUNNEL_FILE, 'utf-8').trim();
				} catch (err) {
					console.warn('Could not read tunnel URL:', err.message);
				}
			}

			if (callback)
				callback({
					success: true,
					publicUrl: publicUrl,
					available: !!publicUrl
				});
		} catch (error) {
			console.error('Error getting public URL:', error);
			if (callback) callback(createErrorResponse('Failed to get public URL'));
		}
	}

	/**
	 * Handle authentication completion callback
	 * @param {Object} authData Authentication callback data
	 * @returns {Object} Result of authentication completion
	 */
	async handleAuthCallback(authData) {
		try {
			return await this.claudeService.completeAuth(authData);
		} catch (error) {
			console.error('Error handling auth callback:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get Claude authentication status summary
	 * @returns {Object} Authentication status summary
	 */
	async getAuthStatus() {
		try {
			const isAuthenticated = await this.claudeService.isAuthenticated();
			const hasPublicUrl = fs.existsSync(this.TUNNEL_FILE);

			return {
				authenticated: isAuthenticated,
				hasPublicUrl,
				publicUrl: hasPublicUrl ? fs.readFileSync(this.TUNNEL_FILE, 'utf-8').trim() : null
			};
		} catch (error) {
			console.error('Error getting auth status:', error);
			return {
				authenticated: false,
				hasPublicUrl: false,
				publicUrl: null,
				error: error.message
			};
		}
	}

	/**
	 * Clean up Claude auth resources
	 */
	cleanup() {
		// Cleanup any pending auth operations
		if (this.claudeService && typeof this.claudeService.cleanup === 'function') {
			this.claudeService.cleanup();
		}
	}

	/**
	 * Create ClaudeAuthHandler with default dependencies
	 * @returns {ClaudeAuthHandler} Configured ClaudeAuthHandler
	 */
	static create() {
		return new ClaudeAuthHandler({
			claudeService: new ClaudeCodeService()
		});
	}
}
