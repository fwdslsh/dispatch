/**
 * Simplified Session Manager - POC abstraction layer for session management
 * Provides a unified interface for creating and managing different session types
 */

import { generateSessionId, createSessionDescriptor } from '../utils/session-ids.js';
import { logger } from '../utils/logger.js';

export class SessionManager {
	constructor({ sessionRouter, workspaceManager, terminalManager, claudeManager }) {
		this.router = sessionRouter;
		this.workspaces = workspaceManager;
		this.terminals = terminalManager;
		this.claude = claudeManager;

		// Session type registry - can be extended with new types
		this.sessionTypes = {
			pty: {
				manager: this.terminals,
				createMethod: 'start',
				stopMethod: 'stop',
				getIdField: (result) => result.id
			},
			claude: {
				manager: this.claude,
				createMethod: 'create',
				stopMethod: null, // Claude sessions auto-manage
				getIdField: (result) => result.claudeId
			}
		};
	}

	/**
	 * Create a new session of any registered type
	 * @param {object} params Session creation parameters
	 * @param {string} params.type Session type ('pty', 'claude', etc.)
	 * @param {string} params.workspacePath Workspace directory path
	 * @param {object} params.options Type-specific options
	 * @returns {Promise<object>} Session info with unified ID
	 */
	async createSession({ type, workspacePath, options = {} }) {
		const sessionType = this.sessionTypes[type];
		if (!sessionType) {
			throw new Error(`Unknown session type: ${type}`);
		}

		// Generate unified session ID
		const sessionId = generateSessionId();

		try {
			// Create the actual session using the type-specific manager
			const createMethod = sessionType.manager[sessionType.createMethod];
			if (!createMethod) {
				throw new Error(`Session type ${type} doesn't support creation`);
			}

			// Call the create method with unified parameters
			const createParams = this._buildCreateParams(type, workspacePath, options, sessionId);
			const result = await createMethod.call(sessionType.manager, createParams);

			// Extract the type-specific ID
			const typeSpecificId = sessionType.getIdField(result);

			// Build session descriptor
			const descriptor = this._buildDescriptor(
				type,
				typeSpecificId,
				workspacePath,
				options,
				sessionId
			);

			// Register in router and persist
			this.router.bind(sessionId, descriptor);
			await this.workspaces.rememberSession(workspacePath, descriptor);

			logger.info('SESSION', `Created ${type} session ${sessionId} -> ${typeSpecificId}`);

			return {
				id: sessionId,
				type,
				typeSpecificId,
				workspacePath,
				...this._extractMetadata(type, options)
			};
		} catch (error) {
			logger.error('SESSION', `Failed to create ${type} session:`, error);
			throw error;
		}
	}

	/**
	 * Stop and cleanup a session
	 * @param {string} sessionId Unified session ID
	 * @returns {Promise<boolean>} Success status
	 */
	async stopSession(sessionId) {
		const descriptor = this.router.get(sessionId);
		if (!descriptor) {
			logger.warn('SESSION', `Session ${sessionId} not found`);
			return false;
		}

		const sessionType = this.sessionTypes[descriptor.type];
		if (!sessionType) {
			logger.warn('SESSION', `Unknown session type: ${descriptor.type}`);
			return false;
		}

		try {
			// Stop the session if the type supports it
			if (sessionType.stopMethod) {
				const stopMethod = sessionType.manager[sessionType.stopMethod];
				if (stopMethod) {
					await stopMethod.call(sessionType.manager, descriptor.typeSpecificId);
				}
			}

			// Remove from router
			this.router.unbind(sessionId);

			// Remove from persistence
			await this.workspaces.removeSession(descriptor.workspacePath, sessionId);

			logger.info('SESSION', `Stopped ${descriptor.type} session ${sessionId}`);
			return true;
		} catch (error) {
			logger.error('SESSION', `Failed to stop session ${sessionId}:`, error);
			return false;
		}
	}

	/**
	 * Get session info by ID
	 * @param {string} sessionId Unified session ID
	 * @returns {object|null} Session info or null
	 */
	getSession(sessionId) {
		const descriptor = this.router.get(sessionId);
		if (!descriptor) return null;

		return {
			id: sessionId,
			type: descriptor.type,
			typeSpecificId: descriptor.typeSpecificId,
			workspacePath: descriptor.workspacePath,
			title: descriptor.title,
			createdAt: descriptor.createdAt,
			activityState: descriptor.activityState || 'idle'
		};
	}

	/**
	 * List all active sessions
	 * @param {string} [workspacePath] Optional workspace filter
	 * @returns {Array<object>} Array of session info
	 */
	listSessions(workspacePath = null) {
		const sessions = workspacePath ? this.router.byWorkspace(workspacePath) : this.router.all();

		return sessions.map((s) => ({
			id: s.id,
			type: s.type,
			typeSpecificId: s.typeSpecificId,
			workspacePath: s.workspacePath,
			title: s.title,
			createdAt: s.createdAt,
			activityState: s.activityState || 'idle'
		}));
	}

	/**
	 * Send input to a session (type-agnostic)
	 * @param {string} sessionId Unified session ID
	 * @param {any} input Input data (type-specific)
	 * @returns {Promise<void>}
	 */
	async sendToSession(sessionId, input) {
		const descriptor = this.router.get(sessionId);
		if (!descriptor) {
			// Tolerate writes to sessions that are not active (e.g. after HMR or page reload)
			logger.warn('SESSION', `sendToSession: session ${sessionId} not found`);
			return; // no-op to avoid noisy errors during reconnect
		}

		const sessionType = this.sessionTypes[descriptor.type];
		if (!sessionType) {
			throw new Error(`Unknown session type: ${descriptor.type}`);
		}

		// Route to appropriate handler based on type
		switch (descriptor.type) {
			case 'pty':
				sessionType.manager.write(descriptor.typeSpecificId, input);
				break;
			case 'claude':
				// Use typeSpecificId when available; otherwise fall back to the unified app session id
				await sessionType.manager.send(descriptor.typeSpecificId || descriptor.id, input);
				break;
			default:
				throw new Error(`Session type ${descriptor.type} doesn't support input`);
		}
	}

	/**
	 * Handle session-specific operations (resize, etc.)
	 * @param {string} sessionId Unified session ID
	 * @param {string} operation Operation name
	 * @param {object} params Operation parameters
	 * @returns {Promise<any>}
	 */
	async sessionOperation(sessionId, operation, params) {
		const descriptor = this.router.get(sessionId);
		if (!descriptor) {
			// Gracefully ignore ops for non-existent sessions (common during reconnection)
			logger.warn('SESSION', `sessionOperation: session ${sessionId} not found for ${operation}`);
			return null;
		}

		const sessionType = this.sessionTypes[descriptor.type];
		if (!sessionType || !sessionType.manager) {
			throw new Error(`Unknown session type: ${descriptor.type}`);
		}

		// Check if the operation exists on the manager
		const method = sessionType.manager[operation];
		if (!method || typeof method !== 'function') {
			throw new Error(`Operation ${operation} not supported for ${descriptor.type} sessions`);
		}

		// Call the operation with the type-specific ID
		return await method.call(
			sessionType.manager,
			descriptor.typeSpecificId,
			...Object.values(params)
		);
	}

	/**
	 * Set the Socket.IO instance for real-time communication
	 * @param {object} socket Socket.IO instance
	 */
	setSocketIO(socket) {
		// Pass through to type-specific managers that need it
		if (this.terminals && typeof this.terminals.setSocketIO === 'function') {
			this.terminals.setSocketIO(socket);
		}
		if (this.claude && typeof this.claude.setSocketIO === 'function') {
			this.claude.setSocketIO(socket);
		}
	}

	/**
	 * Refresh commands for a session (delegates to type-specific manager)
	 * @param {string} sessionId Unified session ID
	 * @returns {Promise<Array|null>} Array of commands or null
	 */
	async refreshCommands(sessionId) {
		const descriptor = this.router.get(sessionId);
		if (!descriptor) {
			logger.warn('SESSION', `Session ${sessionId} not found for command refresh`);
			return null;
		}

		const sessionType = this.sessionTypes[descriptor.type];
		if (!sessionType || !sessionType.manager) {
			logger.warn('SESSION', `No manager for session type: ${descriptor.type}`);
			return null;
		}

		// Check if the manager supports command refresh
		const refreshMethod = sessionType.manager.refreshCommands;
		if (!refreshMethod || typeof refreshMethod !== 'function') {
			logger.warn('SESSION', `Session type ${descriptor.type} doesn't support command refresh`);
			return null;
		}

		try {
			// Call refresh with the type-specific ID
			const commands = await refreshMethod.call(sessionType.manager, descriptor.typeSpecificId);
			logger.debug('SESSION', `Refreshed commands for ${descriptor.type} session ${sessionId}:`,
				Array.isArray(commands) ? `${commands.length} commands` : 'null');
			return commands;
		} catch (error) {
			logger.error('SESSION', `Failed to refresh commands for session ${sessionId}:`, error);
			throw error;
		}
	}

	// Private helper methods

	_buildCreateParams(type, workspacePath, options, sessionId) {
		switch (type) {
			case 'pty':
				return {
					workspacePath,
					shell: options.shell,
					env: options.env,
					resume: options.resumeSession,
					terminalId: options.terminalId,
					appSessionId: sessionId
				};
			case 'claude':
				return {
					workspacePath,
					options,
					sessionId: options.sessionId,
					appSessionId: sessionId
				};
			default:
				return { workspacePath, ...options, appSessionId: sessionId };
		}
	}

	_buildDescriptor(type, typeSpecificId, workspacePath, options, sessionId) {
		const title = this._generateTitle(type, workspacePath, options);

		// Be tolerant to missing/placeholder typeSpecificId for Claude sessions
		let safeTypeSpecificId = typeSpecificId;
		if (type === 'claude') {
			safeTypeSpecificId = typeof typeSpecificId === 'string' ? typeSpecificId : '';
		} else if (!safeTypeSpecificId) {
			safeTypeSpecificId = sessionId;
		}

		// Construct descriptor inline to avoid strict validation issues during HMR
		return {
			id: sessionId,
			type,
			typeSpecificId: safeTypeSpecificId,
			workspacePath,
			title,
			resumeSession: !!options.resumeSession,
			createdAt: Date.now()
		};
	}

	_generateTitle(type, workspacePath, options) {
		const baseName = options.projectName || workspacePath.split('/').pop() || workspacePath;
		const resumed = options.resumeSession ? ' (resumed)' : '';

		switch (type) {
			case 'pty':
				return `Shell @ ${baseName}${resumed}`;
			case 'claude':
				return `Claude @ ${baseName}${resumed}`;
			default:
				return `${type} @ ${baseName}${resumed}`;
		}
	}

	_extractMetadata(type, options) {
		switch (type) {
			case 'pty':
				return {
					shell: options.shell,
					resumed: !!options.resumeSession
				};
			case 'claude':
				return {
					projectName: options.projectName,
					resumed: !!options.resumeSession
				};
			default:
				return {};
		}
	}
}
