/**
 * ServerServiceContainer.js
 *
 * Server-side dependency injection container that eliminates global state dependencies.
 * Provides clean service lifecycle management and proper dependency injection.
 *
 * ARCHITECTURAL PRINCIPLES:
 * - No global state (no globalThis.__API_SERVICES)
 * - Clean dependency injection
 * - Proper service lifecycle management
 * - Easy testability
 */

import { DatabaseManager } from '../db/DatabaseManager.js';
import { WorkspaceManager } from './WorkspaceManager.js';
import { SessionRegistry } from './SessionRegistry.js';
import { TerminalManager } from '../terminals/TerminalManager.js';
import { ClaudeSessionManager } from '../claude/ClaudeSessionManager.js';
import { ClaudeAuthManager } from '../claude/ClaudeAuthManager.js';
import { MessageBuffer } from './MessageBuffer.js';
import { logger } from '../utils/logger.js';
import path from 'node:path';
import os from 'node:os';

export class ServerServiceContainer {
	constructor() {
		this.services = new Map();
		this.config = {
			dbPath: process.env.DB_PATH || '~/.dispatch/data/workspace.db',
			workspacesRoot: process.env.WORKSPACES_ROOT || '~/.dispatch-home/workspaces',
			configDir: process.env.DISPATCH_CONFIG_DIR || '~/.config/dispatch',
			debug: process.env.DEBUG === 'true'
		};

		// Resolve tilde paths
		this._resolveConfigPaths();

		// Track initialization state
		this.initialized = false;
		this.initPromise = null;
	}

	/**
	 * Resolve tilde paths to absolute paths
	 */
	_resolveConfigPaths() {
		const homeDir = os.homedir();

		if (this.config.dbPath && this.config.dbPath.startsWith('~/')) {
			this.config.dbPath = path.join(homeDir, this.config.dbPath.slice(2));
		}

		if (this.config.workspacesRoot && this.config.workspacesRoot.startsWith('~/')) {
			this.config.workspacesRoot = path.join(homeDir, this.config.workspacesRoot.slice(2));
		}

		if (this.config.configDir && this.config.configDir.startsWith('~/')) {
			this.config.configDir = path.join(homeDir, this.config.configDir.slice(2));
		}
	}

	/**
	 * Initialize all services in the correct dependency order
	 */
	async initialize() {
		if (this.initialized) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = this._performInitialization();
		await this.initPromise;
		this.initialized = true;
	}

	async _performInitialization() {
		try {
			logger.info('SERVICE_CONTAINER', 'Initializing server services...');

			// 1. Database (no dependencies)
			const db = new DatabaseManager(this.config.dbPath);
			await db.init();
			this.services.set('database', db);

			// 2. Message Buffer (no dependencies)
			const messageBuffer = new MessageBuffer();
			this.services.set('messageBuffer', messageBuffer);

			// 3. Workspace Manager (depends on database)
			const workspaceManager = new WorkspaceManager({
				rootDir: this.config.workspacesRoot
			});
			await workspaceManager.init();
			this.services.set('workspaceManager', workspaceManager);

			// 4. Terminal Manager (no Socket.IO initially, will be set later)
			const terminalManager = new TerminalManager({ io: null, sessionRegistry: null });
			this.services.set('terminalManager', terminalManager);

			// 5. Claude Managers (no Socket.IO initially, will be set later)
			const claudeSessionManager = new ClaudeSessionManager({ io: null, sessionRegistry: null });
			this.services.set('claudeSessionManager', claudeSessionManager);

			const claudeAuthManager = new ClaudeAuthManager();
			this.services.set('claudeAuthManager', claudeAuthManager);

			// 6. Session Registry (depends on workspace and session managers)
			const sessionRegistry = new SessionRegistry({
				workspaceManager,
				messageBuffer,
				terminalManager,
				claudeSessionManager
			});

			// Provide registry back to managers for buffering/activity coordination
			if (typeof terminalManager.setSessionRegistry === 'function') {
				terminalManager.setSessionRegistry(sessionRegistry);
			}
			if (typeof claudeSessionManager.setSessionRegistry === 'function') {
				claudeSessionManager.setSessionRegistry(sessionRegistry);
			}

			this.services.set('sessionRegistry', sessionRegistry);

			logger.info('SERVICE_CONTAINER', 'All services initialized successfully');
		} catch (error) {
			logger.error('SERVICE_CONTAINER', 'Failed to initialize services:', error);
			throw error;
		}
	}

	/**
	 * Set Socket.IO instance for services that need it
	 * @param {object} io Socket.IO server instance
	 */
	setSocketIO(io) {
		// Update services that need Socket.IO
		const terminalManager = this.get('terminalManager');
		if (terminalManager && terminalManager.setSocketIO) {
			terminalManager.setSocketIO(io);
		}

		const claudeSessionManager = this.get('claudeSessionManager');
		if (claudeSessionManager && claudeSessionManager.setSocketIO) {
			claudeSessionManager.setSocketIO(io);
		}

		const sessionRegistry = this.get('sessionRegistry');
		if (sessionRegistry && sessionRegistry.setSocketIO) {
			sessionRegistry.setSocketIO(io);
		}

		// Store for potential future use
		this.io = io;

		logger.info('SERVICE_CONTAINER', 'Socket.IO instance updated for all services');
	}

	getSocketIO() {
		return this.io;
	}

	/**
	 * Get a service instance
	 * @param {string} name Service name
	 * @returns {*} Service instance
	 */
	get(name) {
		if (!this.initialized) {
			throw new Error(`ServerServiceContainer not initialized. Call initialize() first.`);
		}

		const service = this.services.get(name);
		if (!service) {
			throw new Error(`Service '${name}' not found`);
		}

		return service;
	}

	/**
	 * Get multiple services at once
	 * @param {...string} names Service names
	 * @returns {object} Object with service instances
	 */
	getServices(...names) {
		const result = {};
		for (const name of names) {
			result[name] = this.get(name);
		}
		return result;
	}

	/**
	 * Check if a service exists
	 * @param {string} name Service name
	 * @returns {boolean}
	 */
	has(name) {
		return this.services.has(name);
	}

	/**
	 * Update configuration
	 * @param {object} updates Configuration updates
	 */
	configure(updates) {
		Object.assign(this.config, updates);
		this._resolveConfigPaths();
	}

	/**
	 * Dispose of a specific service
	 * @param {string} name Service name
	 */
	async dispose(name) {
		const service = this.services.get(name);
		if (service) {
			if (typeof service.dispose === 'function') {
				await service.dispose();
			} else if (typeof service.cleanup === 'function') {
				await service.cleanup();
			} else if (typeof service.close === 'function') {
				await service.close();
			}
			this.services.delete(name);
			logger.info('SERVICE_CONTAINER', `Service '${name}' disposed`);
		}
	}

	/**
	 * Dispose of all services
	 */
	async disposeAll() {
		logger.info('SERVICE_CONTAINER', 'Disposing all services...');

		// Dispose in reverse order of initialization
		const disposeOrder = [
			'sessionRegistry',
			'claudeAuthManager',
			'claudeSessionManager',
			'terminalManager',
			'workspaceManager',
			'messageBuffer',
			'database'
		];

		for (const name of disposeOrder) {
			await this.dispose(name);
		}

		this.services.clear();
		this.initialized = false;
		this.initPromise = null;

		logger.info('SERVICE_CONTAINER', 'All services disposed');
	}

	/**
	 * Get service status for debugging
	 * @returns {object} Service status information
	 */
	getStatus() {
		const status = {
			initialized: this.initialized,
			services: {},
			config: this.config
		};

		for (const [name, service] of this.services) {
			status.services[name] = {
				exists: true,
				hasSocketIO: !!(service.io || service.socket),
				type: service.constructor.name
			};

			// Include service-specific status if available
			if (typeof service.getStatus === 'function') {
				status.services[name].status = service.getStatus();
			}
		}

		return status;
	}

	/**
	 * Create a test container with mock services
	 * @param {object} mockServices Mock service implementations
	 * @returns {ServerServiceContainer}
	 */
	static createTestContainer(mockServices = {}) {
		const container = new ServerServiceContainer();

		// Mark as initialized for testing
		container.initialized = true;

		// Add mock services
		for (const [name, service] of Object.entries(mockServices)) {
			container.services.set(name, service);
		}

		// Add default mocks for common services if not provided
		const defaults = {
			database: { init: async () => {}, query: async () => [] },
			workspaceManager: { init: async () => {}, list: async () => [] },
			sessionRegistry: {
				createSession: async () => ({ id: 'test-session' }),
				sessions: new Map()
			},
			messageBuffer: {
				addMessage: () => {},
				getMessages: () => [],
				clear: () => {}
			}
		};

		for (const [name, mock] of Object.entries(defaults)) {
			if (!container.services.has(name)) {
				container.services.set(name, mock);
			}
		}

		return container;
	}
}

// Export a factory function for creating containers
export function createServerServiceContainer(config = {}) {
	const container = new ServerServiceContainer();
	if (config) {
		container.configure(config);
	}
	return container;
}


const GLOBAL_CONTAINER_KEY = Symbol.for('dispatch.server.container');
const GLOBAL_CONFIG_KEY = Symbol.for('dispatch.server.container.config');

export function getServerServiceContainer(config = {}) {
	const scope = globalThis;
	let container = scope[GLOBAL_CONTAINER_KEY];
	if (!container) {
		container = new ServerServiceContainer();
		scope[GLOBAL_CONTAINER_KEY] = container;
	}

	if (config && Object.keys(config).length > 0) {
		const previous = scope[GLOBAL_CONFIG_KEY] || {};
		container.configure({ ...previous, ...config });
		scope[GLOBAL_CONFIG_KEY] = { ...previous, ...config };
	}

	return container;
}

export function resetServerServiceContainer() {
	const scope = globalThis;
	delete scope[GLOBAL_CONTAINER_KEY];
	delete scope[GLOBAL_CONFIG_KEY];
}
