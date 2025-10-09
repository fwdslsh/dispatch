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
import { ClaudeAuthManager } from '../claude/ClaudeAuthManager.js';
import { MultiAuthManager, GitHubAuthProvider } from './auth/oauth.js';
import { TunnelManager } from '../tunnels/TunnelManager.js';
import { VSCodeTunnelManager } from '../tunnels/VSCodeTunnelManager.js';
import { ApiKeyManager } from '../auth/ApiKeyManager.server.js';
import { SessionManager } from '../auth/SessionManager.server.js';
import { OAuthManager } from '../auth/OAuth.server.js';
import { createMigrationManager } from './db/migrate.js';
import path from 'node:path';
import os from 'node:os';
import { logger } from './utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

// Adapters
import { PtyAdapter } from '../terminal/PtyAdapter.js';
import { ClaudeAdapter } from '../claude/ClaudeAdapter.js';
import { FileEditorAdapter } from '../file-editor/FileEditorAdapter.js';

/**
 * Services object containing all initialized application services
 *
 * @typedef {Object} Services
 * @property {ConfigurationService} config
 * @property {DatabaseManager} db
 * @property {DatabaseManager} database
 * @property {SessionRepository} sessionRepository
 * @property {EventStore} eventStore
 * @property {SettingsRepository} settingsRepository
 * @property {WorkspaceRepository} workspaceRepository
 * @property {AdapterRegistry} adapterRegistry
 * @property {EventRecorder} eventRecorder
 * @property {SessionOrchestrator} sessionOrchestrator
 * @property {AuthService} auth
 * @property {ApiKeyManager} apiKeyManager
 * @property {SessionManager} sessionManager
 * @property {OAuthManager} oauthManager
 * @property {ClaudeAuthManager} claudeAuthManager
 * @property {MultiAuthManager} multiAuthManager
 * @property {TunnelManager} tunnelManager
 * @property {VSCodeTunnelManager} vscodeManager
 * @property {PtyAdapter} ptyAdapter
 * @property {ClaudeAdapter} claudeAdapter
 * @property {FileEditorAdapter} fileEditorAdapter
 * @property {() => MultiAuthManager} getAuthManager
 * @property {() => DatabaseManager} getDatabase
 */

/**
 * Factory function to create all services with dependencies wired
 * @param {Object} [config] - Optional configuration overrides
 * @returns {Services} Services object containing all initialized services
 */
export function createServices(config = {}) {
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
	const oauthManager = new OAuthManager(db, settingsRepository);
	const authService = new AuthService(apiKeyManager);
	const claudeAuthManager = new ClaudeAuthManager();
	const multiAuthManager = new MultiAuthManager(db);

	// Layer 6: Tunnel services
	const tunnelManager = new TunnelManager({
		port: resolvedConfig.port,
		subdomain: resolvedConfig.tunnelSubdomain,
		settingsRepository
	});
	const vscodeManager = new VSCodeTunnelManager({ settingsRepository });

	// Layer 7: Register adapters
	const ptyAdapter = new PtyAdapter();
	const claudeAdapter = new ClaudeAdapter();
	const fileEditorAdapter = new FileEditorAdapter();

	adapterRegistry.register(SESSION_TYPE.PTY, ptyAdapter);
	adapterRegistry.register(SESSION_TYPE.CLAUDE, claudeAdapter);
	adapterRegistry.register(SESSION_TYPE.FILE_EDITOR, fileEditorAdapter);

	return {
		// Core
		config: configService,
		db,
		database: db, // Alias for backward compatibility

		// Repositories
		sessionRepository,
		eventStore,
		settingsRepository,
		workspaceRepository,

		// Session management
		adapterRegistry,
		eventRecorder,
		sessionOrchestrator,

		// Auth
		auth: authService,
		apiKeyManager,
		sessionManager,
		oauthManager,
		claudeAuthManager,
		multiAuthManager,

		// Tunnels
		tunnelManager,
		vscodeManager,

		// Adapters (direct access)
		ptyAdapter,
		claudeAdapter,
		fileEditorAdapter,

		// Convenience methods
		getAuthManager: () => multiAuthManager,
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
		logger.info('SERVICES', 'Initializing services...');

		services = createServices(config);

		// Initialize database
		await services.db.init();

		// Run database migrations
		const migrationManager = createMigrationManager(services.db);
		await migrationManager.migrate();
		logger.info('SERVICES', 'Database migrations completed');

		// Mark all sessions as stopped (cleanup from previous run)
		await services.sessionRepository.markAllStopped();
		logger.info('SERVICES', 'Cleared stale running sessions on startup');

		// Initialize MultiAuthManager
		await services.multiAuthManager.init();

		// Wire MultiAuthManager to AuthService
		services.auth.setMultiAuthManager(services.multiAuthManager);

		// Register OAuth providers from settings
		const authSettingsRow = await services.db.get(
			"SELECT * FROM settings WHERE category = 'authentication'"
		);

		if (authSettingsRow && authSettingsRow.settings_json) {
			try {
				const authSettings = JSON.parse(authSettingsRow.settings_json);

				if (authSettings.oauth_client_id && authSettings.oauth_client_secret) {
					const githubProvider = new GitHubAuthProvider({
						clientId: authSettings.oauth_client_id,
						clientSecret: authSettings.oauth_client_secret,
						redirectUri:
							authSettings.oauth_redirect_uri ||
							`http://localhost:${services.config.get('PORT')}/api/auth/callback`,
						scopes: (authSettings.oauth_scope || 'user:email').split(' ')
					});
					await services.multiAuthManager.registerProvider(githubProvider);
					logger.info('SERVICES', 'GitHub OAuth provider registered');
				} else {
					logger.info('SERVICES', 'GitHub OAuth not configured - skipping provider registration');
				}
			} catch (error) {
				logger.error('SERVICES', 'Failed to parse authentication settings:', error);
			}
		} else {
			logger.info(
				'SERVICES',
				'No authentication settings found - skipping OAuth provider registration'
			);
		}

		// Initialize tunnel managers
		await services.tunnelManager.init();
		await services.vscodeManager.init();

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
