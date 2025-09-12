import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

class HistoryManager {
	constructor() {
		// Use $HOME/.dispatch/history as the storage directory
		this.historyDir = join(process.env.HOME || homedir(), '.dispatch', 'history');
		this.socketHistories = new Map(); // In-memory cache for active sockets
		this.initializeHistoryDir();
	}

	async initializeHistoryDir() {
		try {
			await fs.mkdir(this.historyDir, { recursive: true });
		} catch (error) {
			console.error('[HISTORY] Failed to create history directory:', error);
		}
	}

	/**
	 * Initialize history tracking for a new socket
	 */
	async initializeSocket(socketId, metadata = {}) {
		const historyEntry = {
			socketId,
			metadata: {
				connectedAt: Date.now(),
				ip: metadata.ip || 'Unknown',
				userAgent: metadata.userAgent || 'Unknown',
				sessionType: null,
				sessionName: null,
				cwd: null,
				...metadata
			},
			events: []
		};

		this.socketHistories.set(socketId, historyEntry);
		await this.saveSocketHistory(socketId);
	}

	/**
	 * Add an event to socket history
	 */
	async addEvent(socketId, eventType, direction = 'unknown', data = null) {
		let historyEntry = this.socketHistories.get(socketId);
		
		// If socket not initialized, create minimal entry
		if (!historyEntry) {
			await this.initializeSocket(socketId, {});
			historyEntry = this.socketHistories.get(socketId);
		}

		const event = {
			timestamp: Date.now(),
			type: eventType,
			direction, // 'in', 'out', 'system'
			data: data ? this.sanitizeData(data) : null
		};

		historyEntry.events.push(event);

		// Update metadata based on event type
		this.updateMetadataFromEvent(historyEntry, eventType, data);

		// Save to disk (async, don't block)
		setImmediate(() => this.saveSocketHistory(socketId));
	}

	/**
	 * Update socket metadata based on events
	 */
	updateMetadataFromEvent(historyEntry, eventType, data) {
		if (eventType === 'terminal.start' && data) {
			historyEntry.metadata.sessionType = 'terminal';
			if (data.cwd) historyEntry.metadata.cwd = data.cwd;
			if (data.name) historyEntry.metadata.sessionName = data.name;
		} else if (eventType === 'claude.send') {
			historyEntry.metadata.sessionType = 'claude';
			if (data && data.cwd) historyEntry.metadata.cwd = data.cwd;
		} else if (eventType.startsWith('terminal.')) {
			historyEntry.metadata.sessionType = 'terminal';
		} else if (eventType.startsWith('claude.')) {
			historyEntry.metadata.sessionType = 'claude';
		}
	}

	/**
	 * Sanitize sensitive data before storing
	 */
	sanitizeData(data) {
		if (!data) return null;
		
		// Deep clone to avoid modifying original
		const sanitized = JSON.parse(JSON.stringify(data));
		
		// Remove or redact sensitive fields
		if (sanitized.key) sanitized.key = '[REDACTED]';
		if (sanitized.password) sanitized.password = '[REDACTED]';
		if (sanitized.token) sanitized.token = '[REDACTED]';
		
		return sanitized;
	}

	/**
	 * Save socket history to disk
	 */
	async saveSocketHistory(socketId) {
		try {
			const historyEntry = this.socketHistories.get(socketId);
			if (!historyEntry) return;

			const filePath = join(this.historyDir, `${socketId}.json`);
			await fs.writeFile(filePath, JSON.stringify(historyEntry, null, 2));
		} catch (error) {
			console.error(`[HISTORY] Failed to save history for socket ${socketId}:`, error);
		}
	}

	/**
	 * Clean up history for disconnected socket
	 */
	async finalizeSocket(socketId) {
		await this.addEvent(socketId, 'disconnect', 'system');
		
		// Keep the history in memory for a short time in case of reconnection
		setTimeout(() => {
			this.socketHistories.delete(socketId);
		}, 60000); // 1 minute
	}

	/**
	 * Get history for a specific socket
	 */
	async getSocketHistory(socketId) {
		// Try memory first
		const memoryHistory = this.socketHistories.get(socketId);
		if (memoryHistory) {
			return memoryHistory;
		}

		// Try disk
		try {
			const filePath = join(this.historyDir, `${socketId}.json`);
			const content = await fs.readFile(filePath, 'utf-8');
			return JSON.parse(content);
		} catch (error) {
			return null;
		}
	}

	/**
	 * List all available socket histories
	 */
	async listSocketHistories() {
		try {
			const files = await fs.readdir(this.historyDir);
			const histories = [];

			for (const file of files) {
				if (file.endsWith('.json')) {
					const socketId = file.replace('.json', '');
					try {
						const filePath = join(this.historyDir, file);
						const stats = await fs.stat(filePath);
						const content = await fs.readFile(filePath, 'utf-8');
						const history = JSON.parse(content);
						
						histories.push({
							socketId,
							lastModified: stats.mtime,
							size: stats.size,
							eventCount: history.events?.length || 0,
							metadata: history.metadata || {},
							isActive: this.socketHistories.has(socketId)
						});
					} catch (error) {
						console.error(`[HISTORY] Failed to read history file ${file}:`, error);
					}
				}
			}

			// Sort by last modified, newest first
			return histories.sort((a, b) => b.lastModified - a.lastModified);
		} catch (error) {
			console.error('[HISTORY] Failed to list socket histories:', error);
			return [];
		}
	}

	/**
	 * Delete old history files (cleanup)
	 */
	async cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days default
		try {
			const files = await fs.readdir(this.historyDir);
			const now = Date.now();

			for (const file of files) {
				if (file.endsWith('.json')) {
					const filePath = join(this.historyDir, file);
					const stats = await fs.stat(filePath);
					
					if (now - stats.mtime.getTime() > maxAgeMs) {
						await fs.unlink(filePath);
						console.log(`[HISTORY] Cleaned up old history file: ${file}`);
					}
				}
			}
		} catch (error) {
			console.error('[HISTORY] Failed to cleanup old histories:', error);
		}
	}
}

// Export singleton instance
export const historyManager = new HistoryManager();