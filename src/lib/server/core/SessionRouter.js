import { logger } from '../utils/logger.js';

export class SessionRouter {
	constructor() {
		this.map = new Map();
		this.activityState = new Map(); // Track activity state: 'idle', 'processing', 'streaming'
		this.messageBuffers = new Map(); // Buffer messages for disconnected clients
		this.bufferMaxSize = 100; // Maximum messages to buffer per session
		this.bufferTTL = 5 * 60 * 1000; // Buffer messages for 5 minutes
		this.bufferTimestamps = new Map(); // Track when each buffer was last updated
	}

	bind(sessionId, descriptor) {
		this.map.set(sessionId, descriptor);
		// Initialize as idle when binding
		this.activityState.set(sessionId, 'idle');
	}

	get(sessionId) {
		const descriptor = this.map.get(sessionId);
		if (descriptor) {
			return {
				...descriptor,
				activityState: this.activityState.get(sessionId) || 'idle'
			};
		}
		return descriptor;
	}

	all() {
		return Array.from(this.map.entries()).map(([id, d]) => ({
			id,
			...d,
			activityState: this.activityState.get(id) || 'idle'
		}));
	}

	byWorkspace(workspacePath) {
		return this.all().filter((s) => s.workspacePath === workspacePath);
	}

	unbind(sessionId) {
		this.activityState.delete(sessionId);
		return this.map.delete(sessionId);
	}

	// New methods for activity tracking
	setActivityState(sessionId, state) {
		if (this.map.has(sessionId)) {
			this.activityState.set(sessionId, state);
			logger.info('SESSION_ROUTER', `Session ${sessionId} activity: ${state}`);
		}
	}

	getActivityState(sessionId) {
		return this.activityState.get(sessionId) || 'idle';
	}

	setProcessing(sessionId) {
		this.setActivityState(sessionId, 'processing');
	}

	setStreaming(sessionId) {
		this.setActivityState(sessionId, 'streaming');
	}

	setIdle(sessionId) {
		this.setActivityState(sessionId, 'idle');
	}

	// Update helpers
	updateTypeSpecificId(sessionId, newTypeSpecificId) {
		if (!this.map.has(sessionId)) return false;
		const existing = this.map.get(sessionId) || {};
		this.map.set(sessionId, { ...existing, typeSpecificId: newTypeSpecificId });
		return true;
	}

	updateDescriptor(sessionId, partial) {
		if (!this.map.has(sessionId)) return false;
		const existing = this.map.get(sessionId) || {};
		this.map.set(sessionId, { ...existing, ...partial });
		return true;
	}

	// Message buffering methods
	bufferMessage(sessionId, eventType, data) {
		// Initialize buffer if needed
		if (!this.messageBuffers.has(sessionId)) {
			this.messageBuffers.set(sessionId, []);
		}

		const buffer = this.messageBuffers.get(sessionId);
		const message = {
			eventType,
			data,
			timestamp: Date.now(),
			sequence: buffer.length
		};

		// Add message to buffer
		buffer.push(message);

		// Trim buffer if it exceeds max size
		if (buffer.length > this.bufferMaxSize) {
			buffer.shift(); // Remove oldest message
		}

		// Update timestamp
		this.bufferTimestamps.set(sessionId, Date.now());

		logger.debug('SESSION_ROUTER', `Buffered message for session ${sessionId}, buffer size: ${buffer.length}`);
	}

	getBufferedMessages(sessionId, sinceTimestamp = 0) {
		const buffer = this.messageBuffers.get(sessionId);
		if (!buffer || buffer.length === 0) {
			return [];
		}

		// Clean up old buffers
		const bufferTimestamp = this.bufferTimestamps.get(sessionId) || 0;
		if (Date.now() - bufferTimestamp > this.bufferTTL) {
			this.clearBuffer(sessionId);
			return [];
		}

		// Return messages since the specified timestamp
		if (sinceTimestamp > 0) {
			return buffer.filter(msg => msg.timestamp > sinceTimestamp);
		}

		return [...buffer]; // Return copy of all messages
	}

	clearBuffer(sessionId) {
		this.messageBuffers.delete(sessionId);
		this.bufferTimestamps.delete(sessionId);
		logger.debug('SESSION_ROUTER', `Cleared buffer for session ${sessionId}`);
	}

	// Clean up expired buffers
	cleanupExpiredBuffers() {
		const now = Date.now();
		for (const [sessionId, timestamp] of this.bufferTimestamps.entries()) {
			if (now - timestamp > this.bufferTTL) {
				this.clearBuffer(sessionId);
			}
		}
	}

	// Override unbind to clean up buffers
	unbind(sessionId) {
		this.activityState.delete(sessionId);
		this.clearBuffer(sessionId);
		return this.map.delete(sessionId);
	}
}
