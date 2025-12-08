/**
 * Service Registry Module (Simplified - No DI Framework)
 * @file Factory function for service initialization with explicit dependency wiring
 */

import { ConfigurationService } from './ConfigurationService.js';
import { DatabaseManager } from '../database/DatabaseManager.js';
import { SessionRepository } from '../database/SessionRepository.js';
import { EventStore } from '../database/EventStore.js';
import { SettingsRepository } from '../database/SettingsRepository.js';
import { WorkspaceRepository } from '../database/WorkspaceRepository.js';
import { AdapterRegistry } from '../sessions/AdapterRegistry.js';
import { EventRecorder } from '../sessions/EventRecorder.js';
import { SessionOrchestrator } from '../sessions/SessionOrchestrator.js';
import { AuthService } from './auth.js';
import { TunnelManager } from '../tunnels/TunnelManager.js';
import { VSCodeTunnelManager } from '../tunnels/VSCodeTunnelManager.js';
import { OpenCodeServerManager } from '../opencode/OpenCodeServerManager.js';
import { ApiKeyManager } from '../auth/ApiKeyManager.server.js';
import { SessionManager } from '../auth/SessionManager.server.js';
import { OAuthManager } from '../auth/OAuth.server.js';
import { UserManager } from '../auth/UserManager.server.js';
import { createMigrationManager } from './db/migrate.js';
import os from 'node:os';
import { logger } from './utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';
import { validateEnvironment } from './utils/env-validation.js';

// Adapters - v2.0 Simplified Architecture
import { PtyAdapter } from '../terminal/PtyAdapter.js';
import { AIAdapter } from '../ai/AIAdapter.js';
import { FileEditorAdapter } from '../file-editor/FileEditorAdapter.js';

// Cron scheduler
import { CronSchedulerService } from '../cron/CronSchedulerService.js';

/**
 * Services object containing all initialized application services
 *
 * v2.0 Hard Fork: Simplified service architecture
 * - Removed Claude-specific services (ClaudeAuthManager, ClaudeAdapter)
 * - Consolidated AI adapters into single AIAdapter (OpenCode-powered)
 *
 * @typedef {Object} Services
 * @property {ConfigurationService} config
 * @property {DatabaseManager} db
 * @property {DatabaseManager} database
 * @property {SessionRepository} sessionRepository
 * @property {EventStore} eventStore
 * @property {SettingsRepository} settingsRepository
 * @property {SettingsRepository} settingsManager - Alias for backward compatibility
 * @property {WorkspaceRepository} workspaceRepository
 * @property {WorkspaceRepository} workspaceManager - Alias for backward compatibility
 * @property {AdapterRegistry} adapterRegistry
 * @property {EventRecorder} eventRecorder
 * @property {SessionOrchestrator} sessionOrchestrator
 * @property {AuthService} auth
 * @property {ApiKeyManager} apiKeyManager
 * @property {SessionManager} sessionManager
 * @property {UserManager} userManager
 * @property {OAuthManager} oauthManager
 * @property {TunnelManager} tunnelManager
 * @property {VSCodeTunnelManager} vscodeManager
 * @property {OpenCodeServerManager} opencodeServerManager
 * @property {PtyAdapter} terminalAdapter
 * @property {AIAdapter} aiAdapter
 * @property {FileEditorAdapter} fileEditorAdapter
 * @property {CronSchedulerService} cronScheduler
 * @property {() => DatabaseManager} getDatabase
 */

/**
 * Factory function to create all services with dependencies wired
 * @param {Object} [config] - Optional configuration overrides
 * @returns {Promise<Services>} Services object containing all initialized services
 */
export async function createServices(config = {}) {
	// Resolve tilde paths
	const homeDir = config.HOME || process.env.HOME || os.homedir();
	const resolvedConfig = {
		dbPath: (config.dbPath || process.env.DB_PATH || '~/.dispatch/data/workspace.db').replace(
			/^~\//,
			`${homeDir}/`
		),
		workspacesRoot: (
			config.workspacesRoot ||
			process.env.WORKSPACES_ROOT ||
			'~/.dispatch-home/workspaces'
		).replace(/^~\//, `${homeDir}/`),
		configDir: (
			config.configDir ||
			process.env.DISPATCH_CONFIG_DIR ||
			'~/.config/dispatch'
		).replace(/^~\//, `${homeDir}/`),
		port: config.port || process.env.PORT || 3030,
		tunnelSubdomain: config.tunnelSubdomain || process.env.LT_SUBDOMAIN || '',
		debug: config.debug || process.env.DEBUG === 'true'
	};

	// Layer 1: Configuration
	const configService = new ConfigurationService({
		...config,
		...resolvedConfig
	});

	// Layer 2: Core infrastructure
	const db = new DatabaseManager(resolvedConfig.dbPath);

	// Layer 3: Repositories (depend on db)
	const sessionRepository = new SessionRepository(db);
	const eventStore = new EventStore(db);
	const settingsRepository = new SettingsRepository(db);
	const workspaceRepository = new WorkspaceRepository(db);

	// Layer 4: Session components
	const adapterRegistry = new AdapterRegistry();
	const eventRecorder = new EventRecorder(eventStore);
	const sessionOrchestrator = new SessionOrchestrator(
		sessionRepository,
		eventRecorder,
		adapterRegistry
	);

	// Layer 5: Auth services
	const apiKeyManager = new ApiKeyManager(db);
	const sessionManager = new SessionManager(db);
	const userManager = new UserManager(db);
	const oauthManager = new OAuthManager(db, settingsRepository);
	const authService = new AuthService(apiKeyManager);

	// Layer 6: Tunnel services and OpenCode server
	const tunnelManager = new TunnelManager({
		port: resolvedConfig.port,
		subdomain: resolvedConfig.tunnelSubdomain,
		settingsRepository
	});
	const vscodeManager = new VSCodeTunnelManager({ settingsRepository });
	const opencodeServerManager = new OpenCodeServerManager({ settingsRepository });

	// Layer 7: Register adapters - v2.0 Simplified Architecture
	const terminalAdapter = new PtyAdapter();
	const aiAdapter = new AIAdapter();
	const fileEditorAdapter = new FileEditorAdapter();

	// Register canonical session types
	adapterRegistry.register(SESSION_TYPE.TERMINAL, terminalAdapter);
	adapterRegistry.register(SESSION_TYPE.AI, aiAdapter);
	adapterRegistry.register(SESSION_TYPE.FILE_EDITOR, fileEditorAdapter);

	// Register legacy aliases for backward compatibility (point to same adapters)
	// These will be removed in a future version
	adapterRegistry.register('pty', terminalAdapter);
	adapterRegistry.register('claude', aiAdapter);
	adapterRegistry.register('opencode', aiAdapter);
	adapterRegistry.register('opencode-tui', aiAdapter);

	// Layer 8: Cron scheduler (needs db, will get io instance later)
	const cronScheduler = new CronSchedulerService(db, null);

	return {
		// Core
		config: configService,
		db,
		database: db, // Alias for backward compatibility

		// Repositories
		sessionRepository,
		eventStore,
		settingsRepository,
		settingsManager: settingsRepository, // Alias for backward compatibility
		workspaceRepository,
		workspaceManager: workspaceRepository, // Alias for backward compatibility

		// Session management
		adapterRegistry,
		eventRecorder,
		sessionOrchestrator,

		// Auth
		auth: authService,
		apiKeyManager,
		sessionManager,
		userManager,
		oauthManager,

		// Tunnels
		tunnelManager,
		vscodeManager,

		// OpenCode server
		opencodeServerManager,

		// Adapters - v2.0 Simplified (direct access)
		terminalAdapter,
		aiAdapter,
		fileEditorAdapter,

		// Cron scheduler
		cronScheduler,

		// Convenience methods
		getDatabase: () => db
	};
}

/**
 * Singleton for app lifecycle
 * @type {Services | null}
 */
export let services = null;

/**
 * Initialize services (called once at app startup)
 * @param {Object} [config] - Optional configuration overrides
 * @returns {Promise<Object>} Initialized services
 */
export async function initializeServices(config = {}) {
	if (services) {
		return services;
	}

	try {
		// Validate environment variables before initializing services
		const envValidation = await validateEnvironment();
		if (!envValidation.valid) {
			// Log errors and exit - critical configuration issues prevent startup
			logger.error('SERVICES', 'Environment validation failed. Cannot start server.');
			throw new Error(
				'Environment validation failed:\n' + envValidation.errors.map((e) => `  - ${e}`).join('\n')
			);
		}

		logger.info('SERVICES', 'Initializing services...');

		services = await createServices(config);

		// Initialize database
		await services.db.init();

		// Run database migrations
		const migrationManager = createMigrationManager(services.db);
		await migrationManager.migrate();
		logger.info('SERVICES', 'Database migrations completed');

		// Mark all sessions as stopped (cleanup from previous run)
		await services.sessionRepository.markAllStopped();
		logger.info('SERVICES', 'Cleared stale running sessions on startup');

		// Initialize tunnel managers
		await services.tunnelManager.init();
		await services.vscodeManager.init();

		// Initialize OpenCode server manager
		await services.opencodeServerManager.init();
		logger.info('SERVICES', 'OpenCode server manager initialized');

		// Initialize cron scheduler
		await services.cronScheduler.init();
		logger.info('SERVICES', 'Cron scheduler initialized');

		logger.info('SERVICES', 'Services initialized successfully');
		logger.info('SERVICES', `SessionOrchestrator stats:`, services.sessionOrchestrator.getStats());

		return services;
	} catch (error) {
		logger.error('SERVICES', 'Failed to initialize services:', error);
		throw error;
	}
}

/**
 * Reset services (useful for testing)
 * @returns {void}
 */
export function resetServices() {
	services = null;
}
