/**
 * SessionRegistry.js
 *
 * Simplified session management that replaces SessionManager + SessionRouter complexity.
 * Coordinates first-party session managers directly (terminal, Claude).
 *
 * ARCHITECTURAL PRINCIPLES:
 * - Single responsibility (session registration and lookup)
 * - Minimal indirection (direct manager orchestration)
 * - Simplified message coordination (no complex buffering)
 * - Clean dependency injection
 */

import { generateSessionId } from '../utils/session-ids.js';
import { logger } from '../utils/logger.js';
import { SOCKET_EVENTS } from '../../shared/socket-events.js';

export class SessionRegistry {
	constructor({ workspaceManager, messageBuffer, terminalManager, claudeSessionManager }) {
		this.workspaceManager = workspaceManager;
		this.messageBuffer = messageBuffer;
		this.terminalManager = terminalManager;
		this.claudeSessionManager = claudeSessionManager;

		this.sessions = new Map(); // sessionId -> session metadata
		this.activityStates = new Map(); // sessionId -> activity state
		this.io = null;
	}

	/**
	 * @param {string | {type: string, workspacePath: string, options?: any}} typeOrParams
	 * @param {string} [maybeWorkspacePath]
	 * @param {any} [maybeOptions]
	 */
	async createSession(typeOrParams, maybeWorkspacePath, maybeOptions = {}) {
		let type = typeOrParams;
		let workspacePath = maybeWorkspacePath;
		let options = maybeOptions;

		if (
			typeOrParams &&
			typeof typeOrParams === 'object' &&
			'type' in typeOrParams &&
			'workspacePath' in typeOrParams
		) {
			const params = /** @type {{ type: string, workspacePath: string, options?: object }} */ (
				typeOrParams
			);
			type = params.type;
			workspacePath = params.workspacePath;
			options = params.options || {};
		}

		// Ensure type is a string at this point
		if (typeof type !== 'string') {
			throw new Error('Session type must be a string');
		}

		const normalizedType = type === 'terminal' ? 'pty' : type;
		if (!['pty', 'claude'].includes(normalizedType)) {
			throw new Error(`Unsupported session type: ${type}`);
		}

		const sessionId = generateSessionId();
		const rawOptions = options || {};
		const { socket = null, ...moduleOptions } = rawOptions;

		let typeSpecificId = sessionId;
		let title;
		let resumeSession = !!moduleOptions.resumeSession;
		let metadataExtras = {};

		try {
			if (normalizedType === 'pty') {
				const startOptions = {
					workspacePath,
					shell: moduleOptions.shell,
					env: moduleOptions.env,
					resume: moduleOptions.resumeSession,
					terminalId: moduleOptions.terminalId,
					appSessionId: sessionId,
					socket
				};
				const result = await this.terminalManager.start(startOptions);
				typeSpecificId = result?.id || moduleOptions.terminalId || `pty_${sessionId}`;
				title = this.#defaultTitle('pty', workspacePath, moduleOptions);
				metadataExtras = {
					shell: moduleOptions.shell,
					resumed: resumeSession
				};
			} else {
				const result = await this.claudeSessionManager.create({
					workspacePath,
					options: moduleOptions,
					sessionId: moduleOptions.claudeSessionId || moduleOptions.sessionId,
					appSessionId: sessionId,
					socket
				});
				typeSpecificId =
					result?.typeSpecificId || moduleOptions.sessionId || moduleOptions.claudeSessionId || '';
				resumeSession = result?.resumeSession ?? resumeSession;
				title = result?.title || this.#defaultTitle('claude', workspacePath, moduleOptions);
				metadataExtras = {
					projectName: moduleOptions.projectName,
					resumed: resumeSession
				};
			}
		} catch (error) {
			logger.error('SESSION_REGISTRY', `Failed to create ${normalizedType} session:`, error);
			throw error;
		}

		const createdAt = Date.now();
		const sessionMetadata = {
			id: sessionId,
			type: normalizedType,
			typeSpecificId,
			workspacePath,
			title,
			createdAt,
			resumeSession,
			metadata: metadataExtras
		};

		this.sessions.set(sessionId, sessionMetadata);
		this.activityStates.set(sessionId, 'idle');

		await this.workspaceManager.rememberSession(workspacePath, {
			id: sessionId,
			type: normalizedType,
			typeSpecificId,
			workspacePath,
			title,
			...metadataExtras
		});

		logger.info(
			'SESSION_REGISTRY',
			`Created ${normalizedType} session ${sessionId} -> ${typeSpecificId}`
		);

		return {
			id: sessionId,
			type: normalizedType,
			typeSpecificId,
			workspacePath,
			title,
			createdAt,
			activityState: 'idle',
			resumeSession,
			...metadataExtras
		};
	}

	getSession(sessionId) {
		const metadata = this.sessions.get(sessionId);
		if (!metadata) return null;

		return {
			id: sessionId,
			type: metadata.type,
			typeSpecificId: metadata.typeSpecificId,
			workspacePath: metadata.workspacePath,
			title: metadata.title,
			createdAt: metadata.createdAt,
			activityState: this.activityStates.get(sessionId) || 'idle',
			resumeSession: metadata.resumeSession,
			...metadata.metadata
		};
	}

	listSessions(workspacePath = null) {
		const sessions = Array.from(this.sessions.values());
		const filtered = workspacePath
			? sessions.filter((s) => s.workspacePath === workspacePath)
			: sessions;

		return filtered.map((metadata) => ({
			id: metadata.id,
			type: metadata.type,
			typeSpecificId: metadata.typeSpecificId,
			workspacePath: metadata.workspacePath,
			title: metadata.title,
			createdAt: metadata.createdAt,
			activityState: this.activityStates.get(metadata.id) || 'idle',
			resumeSession: metadata.resumeSession,
			...metadata.metadata
		}));
	}

	async sendToSession(sessionId, input) {
		const metadata = this.sessions.get(sessionId);
		if (!metadata) {
			logger.warn('SESSION_REGISTRY', `Session ${sessionId} not found for input`);
			return;
		}

		if (metadata.type === 'pty') {
			this.terminalManager.write(metadata.typeSpecificId, input);
			return;
		}

		if (metadata.type === 'claude') {
			await this.claudeSessionManager.send(metadata.typeSpecificId || sessionId, input);
			return;
		}

		throw new Error(`Session type ${metadata.type} doesn't support input`);
	}

	updateTypeSpecificId(sessionId, newTypeSpecificId) {
		if (!this.sessions.has(sessionId)) {
			logger.warn(
				'SESSION_REGISTRY',
				`Cannot update type-specific ID for unknown session ${sessionId}`
			);
			return false;
		}
		const metadata = this.sessions.get(sessionId);
		metadata.typeSpecificId = newTypeSpecificId;
		logger.info(
			'SESSION_REGISTRY',
			`Session ${sessionId} type-specific ID updated to ${newTypeSpecificId}`
		);
		return true;
	}

	async performOperation(sessionId, operation, params) {
		const metadata = this.sessions.get(sessionId);
		if (!metadata) {
			logger.warn('SESSION_REGISTRY', `Session ${sessionId} not found for operation ${operation}`);
			return null;
		}

		if (metadata.type === 'pty') {
			const handler = this.terminalManager?.[operation];
			if (typeof handler !== 'function') {
				throw new Error(`Operation ${operation} not supported for pty sessions`);
			}
			const args = params ? Object.values(params) : [];
			return await handler.call(this.terminalManager, metadata.typeSpecificId, ...args);
		}

		throw new Error(`Operation ${operation} not supported for ${metadata.type} sessions`);
	}

	async terminateSession(sessionId) {
		const metadata = this.sessions.get(sessionId);
		if (!metadata) {
			logger.warn('SESSION_REGISTRY', `Session ${sessionId} not found for termination`);
			return false;
		}

		try {
			if (metadata.type === 'pty' && typeof this.terminalManager.stop === 'function') {
				await this.terminalManager.stop(metadata.typeSpecificId);
			}

			this.sessions.delete(sessionId);
			this.activityStates.delete(sessionId);

			if (this.messageBuffer) {
				this.messageBuffer.clearBuffer(sessionId);
			}

			await this.workspaceManager.removeSession(metadata.workspacePath, sessionId);

			logger.info('SESSION_REGISTRY', `Terminated ${metadata.type} session ${sessionId}`);
			return true;
		} catch (error) {
			logger.error('SESSION_REGISTRY', `Failed to terminate session ${sessionId}:`, error);
			return false;
		}
	}

	setActivityState(sessionId, state) {
		if (this.sessions.has(sessionId)) {
			this.activityStates.set(sessionId, state);
			logger.debug('SESSION_REGISTRY', `Session ${sessionId} activity: ${state}`);
		}
	}

	setIdle(sessionId) {
		this.setActivityState(sessionId, 'idle');
	}

	setProcessing(sessionId) {
		this.setActivityState(sessionId, 'processing');
	}

	setStreaming(sessionId) {
		this.setActivityState(sessionId, 'streaming');
	}

	getActivityState(sessionId) {
		return this.activityStates.get(sessionId) || 'idle';
	}

	async refreshCommands(sessionId) {
		const metadata = this.sessions.get(sessionId);
		if (!metadata) {
			logger.warn('SESSION_REGISTRY', `Session ${sessionId} not found for command refresh`);
			return null;
		}

		if (
			metadata.type !== 'claude' ||
			typeof this.claudeSessionManager.refreshCommands !== 'function'
		) {
			logger.warn(
				'SESSION_REGISTRY',
				`Session type ${metadata.type} doesn't support command refresh`
			);
			return null;
		}

		try {
			const commands = await this.claudeSessionManager.refreshCommands(metadata.typeSpecificId);
			logger.debug('SESSION_REGISTRY', `Refreshed commands for session ${sessionId}`);
			return commands;
		} catch (error) {
			logger.error(
				'SESSION_REGISTRY',
				`Failed to refresh commands for session ${sessionId}:`,
				error
			);
			throw error;
		}
	}

	getCachedCommands(sessionId) {
		const metadata = this.sessions.get(sessionId);
		if (!metadata || metadata.type !== 'claude') {
			return null;
		}

		try {
			return this.claudeSessionManager.getCachedCommands(metadata.typeSpecificId);
		} catch (error) {
			logger.warn('SESSION_REGISTRY', `getCachedCommands failed for ${sessionId}:`, error);
			return null;
		}
	}

	setSocketIO(io) {
		this.io = io;

		if (this.terminalManager && typeof this.terminalManager.setSocketIO === 'function') {
			this.terminalManager.setSocketIO(io);
		}

		if (this.claudeSessionManager && typeof this.claudeSessionManager.setSocketIO === 'function') {
			this.claudeSessionManager.setSocketIO(io);
		}

		logger.info('SESSION_REGISTRY', 'Socket.IO instance updated for session managers');
	}

	bufferMessage(sessionId, eventType, data, options = {}) {
		if (!sessionId || !eventType || !this.messageBuffer) return;
		this.messageBuffer.addMessage(sessionId, eventType, data, options);
	}

	emitToSocket(sessionId, socket, eventType, data, options = {}) {
		this.bufferMessage(sessionId, eventType, data, options);

		if (!socket) {
			logger.debug(
				'SESSION_REGISTRY',
				`Socket not available for ${eventType}, buffered for session ${sessionId}`
			);
			return;
		}

		try {
			socket.emit(eventType, data);
		} catch (error) {
			logger.warn(
				'SESSION_REGISTRY',
				`Failed to emit ${eventType} for session ${sessionId}: ${error?.message || error}`
			);
		}
	}

	replayBufferedMessages(socket, sessionId, sinceTimestamp = 0) {
		if (!this.messageBuffer || !socket) return;
		const messages = this.messageBuffer.getMessages(sessionId, sinceTimestamp);

		if (messages.length > 0) {
			this.messageBuffer.replayMessages(socket, sessionId, sinceTimestamp);
		}

		try {
			socket.emit(SOCKET_EVENTS.SESSION_CATCHUP_COMPLETE, {
				sessionId,
				messageCount: messages.length,
				lastTimestamp: messages[messages.length - 1]?.timestamp ?? Date.now()
			});
		} catch (error) {
			logger.warn('SESSION_REGISTRY', `Failed to emit catchup completion for ${sessionId}:`, error);
		}
	}

	getBufferedMessages(sessionId, sinceTimestamp = 0, maxMessages = null) {
		if (!this.messageBuffer) return [];
		return this.messageBuffer.getMessages(sessionId, sinceTimestamp, maxMessages);
	}

	hasBufferedMessages(sessionId) {
		if (!this.messageBuffer) return false;
		return this.messageBuffer.hasMessages(sessionId);
	}

	clearMessageBuffer(sessionId) {
		if (!this.messageBuffer) return;
		this.messageBuffer.clearBuffer(sessionId);
	}

	cleanupExpiredBuffers() {
		if (!this.messageBuffer) return;
		this.messageBuffer.cleanupExpiredBuffers();
	}

	#defaultTitle(type, workspacePath, options = {}) {
		const baseName = options.projectName || workspacePath?.split('/')?.pop() || workspacePath;
		const resumed = options.resumeSession ? ' (resumed)' : '';

		switch (type) {
			case 'claude':
				return `Claude @ ${baseName}${resumed}`;
			case 'pty':
			default:
				return `Shell @ ${baseName}${resumed}`;
		}
	}
}
