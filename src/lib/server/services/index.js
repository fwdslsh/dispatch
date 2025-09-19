/**
 * Shared service initialization for both SvelteKit hooks and standalone server
 */

import { logger } from '../utils/logger.js';
import { DatabaseManager } from '../db/DatabaseManager.js';
import { WorkspaceManager } from '../core/WorkspaceManager.js';
import { TerminalManager } from '../terminals/TerminalManager.js';
import { ClaudeSessionManager } from '../claude/ClaudeSessionManager.js';
import { ClaudeAuthManager } from '../claude/ClaudeAuthManager.js';
import { safeCallAsync } from '../utils/method-utils.js';
import path from 'node:path';
import os from 'node:os';

// Global service instances - shared across all processes
let globalServicesInstance = null;

// Resolve tilde paths
function resolveConfigPaths(config) {
	const homeDir = os.homedir();
	const resolved = { ...config };

	if (resolved.dbPath && resolved.dbPath.startsWith('~/')) {
		resolved.dbPath = path.join(homeDir, resolved.dbPath.slice(2));
	}

	if (resolved.workspacesRoot && resolved.workspacesRoot.startsWith('~/')) {
		resolved.workspacesRoot = path.join(homeDir, resolved.workspacesRoot.slice(2));
	}

	if (resolved.configDir && resolved.configDir.startsWith('~/')) {
		resolved.configDir = path.join(homeDir, resolved.configDir.slice(2));
	}

	return resolved;
}

/**
 * Initialize all server services
 * @param {object} config Service configuration
 * @returns {Promise<object>} Services object
 */
export async function initializeServices(config = {}) {
	const serviceConfig = {
		dbPath: config.dbPath || process.env.DB_PATH || '~/.dispatch/data/workspace.db',
		workspacesRoot: config.workspacesRoot || process.env.WORKSPACES_ROOT || '~/.dispatch-home/workspaces',
		configDir: config.configDir || process.env.DISPATCH_CONFIG_DIR || '~/.config/dispatch',
		debug: config.debug || process.env.DEBUG === 'true'
	};

	try {
		logger.info('SERVICES', 'Initializing server services...');
		const resolvedConfig = resolveConfigPaths(serviceConfig);

		// 1. Database (no dependencies)
		const database = new DatabaseManager(resolvedConfig.dbPath);
		await database.init();

		// 2. Workspace Manager (depends on database)
		const workspaceManager = new WorkspaceManager({
			rootDir: resolvedConfig.workspacesRoot,
			databaseManager: database
		});
		await workspaceManager.init();

		// 3. Terminal Manager (no Socket.IO initially, will be set later)
		const terminalManager = new TerminalManager({
			io: null,
			databaseManager: database
		});

		// 4. Claude Managers (no Socket.IO initially, will be set later)
		const claudeSessionManager = new ClaudeSessionManager({
			io: null,
			databaseManager: database
		});

		const claudeAuthManager = new ClaudeAuthManager();

		const services = {
			database,
			workspaceManager,
			terminalManager,
			claudeSessionManager,
			claudeAuthManager
		};

		logger.info('SERVICES', 'All services initialized successfully');
		return services;
	} catch (error) {
		logger.error('SERVICES', 'Failed to initialize server services:', error);
		throw error;
	}
}