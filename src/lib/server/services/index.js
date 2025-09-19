/**
 * Shared service initialization for both SvelteKit hooks and standalone server
 */

import { logger } from '../utils/logger.js';
import { DatabaseManager } from '../db/DatabaseManager.js';
import { RunSessionManager } from '../runtime/RunSessionManager.js';
import { PtyAdapter } from '../adapters/PtyAdapter.js';
import { ClaudeAdapter } from '../adapters/ClaudeAdapter.js';
import { ClaudeAuthManager } from '../claude/ClaudeAuthManager.js';
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
 * Initialize all server services with unified session architecture
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
		logger.info('SERVICES', 'Initializing unified session architecture services...');
		const resolvedConfig = resolveConfigPaths(serviceConfig);

		// 1. Database (no dependencies)
		const database = new DatabaseManager(resolvedConfig.dbPath);
		await database.init();

		// REMOVED: WorkspaceManager - obsolete in unified architecture

		// 3. Create RunSessionManager (no Socket.IO initially, will be set later)
		const runSessionManager = new RunSessionManager(database, null);

		// 4. Create and register adapters
		const ptyAdapter = new PtyAdapter();
		const claudeAdapter = new ClaudeAdapter();

		runSessionManager.registerAdapter('pty', ptyAdapter);
		runSessionManager.registerAdapter('claude', claudeAdapter);

		// 5. Claude Auth Manager (for OAuth flow)
		const claudeAuthManager = new ClaudeAuthManager();

		const services = {
			database,
			runSessionManager,
			ptyAdapter,
			claudeAdapter,
			claudeAuthManager
		};

		logger.info('SERVICES', 'Unified session architecture services initialized successfully');
		logger.info('SERVICES', `RunSessionManager stats:`, runSessionManager.getStats());
		return services;
	} catch (error) {
		logger.error('SERVICES', 'Failed to initialize unified session services:', error);
		throw error;
	}
}