/**
 * Shared service initialization for both SvelteKit hooks and standalone server
 */

import { logger } from './utils/logger.js';
import { DatabaseManager } from './db/DatabaseManager.js';
import { RunSessionManager } from './runtime/RunSessionManager.js';
import { TunnelManager } from './TunnelManager.js';
import { VSCodeTunnelManager } from './VSCodeTunnelManager.js';
import { AuthService } from './auth.js';
import { PtyAdapter } from '../terminal/PtyAdapter.js';
import { ClaudeAdapter } from '../claude/ClaudeAdapter.js';
import { FileEditorAdapter } from '../file-editor/FileEditorAdapter.js';
import { ClaudeAuthManager } from '../claude/ClaudeAuthManager.js';
import { MultiAuthManager, GitHubAuthProvider } from './auth/oauth.js';
import { ConfigService } from './config/ConfigService.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

// Global service instances - shared across all processes
let globalServicesInstance = null;

/**
 * Initialize all server services with unified session architecture
 * @param {object} config Service configuration
 * @returns {Promise<object>} Services object
 */
export async function initializeServices(config = {}) {
	const configService = new ConfigService({ overrides: config });

	try {
		logger.info('SERVICES', 'Initializing services...');
		const resolvedConfig = configService.load();

		// 1. Database (no dependencies)
		const database = new DatabaseManager(resolvedConfig.dbPath);
		await database.init();
		await database.sessions.markAllStopped();
		logger.info('SERVICES', 'Cleared stale running sessions on startup');

		// 2. Initialize AuthService singleton (using unified settings table)
		const authService = new AuthService({ configService });
		await authService.initialize(database);
		logger.info('SERVICES', 'AuthService initialized');

		// REMOVED: WorkspaceManager - obsolete in unified architecture

		// 4. Create RunSessionManager (no Socket.IO initially, will be set later)
		const runSessionManager = new RunSessionManager(database);

		// 5. Create and register adapters
		const ptyAdapter = new PtyAdapter({ configService });
		const claudeAdapter = new ClaudeAdapter();
		const fileEditorAdapter = new FileEditorAdapter({ configService });

		runSessionManager.registerAdapter(SESSION_TYPE.PTY, ptyAdapter);
		runSessionManager.registerAdapter(SESSION_TYPE.CLAUDE, claudeAdapter);
		runSessionManager.registerAdapter(SESSION_TYPE.FILE_EDITOR, fileEditorAdapter);

		// 6. Claude Auth Manager (for OAuth flow)
		const claudeAuthManager = new ClaudeAuthManager();

		// 6b. Multi-Auth Manager (for OAuth providers like GitHub)
		const multiAuthManager = new MultiAuthManager(database);
		await multiAuthManager.init();

		// Wire MultiAuthManager to AuthService for multi-strategy auth
		authService.setMultiAuthManager(multiAuthManager);

		// Register GitHub OAuth provider
		// Get OAuth settings from database
		const authSettingsRecord = await database.settings.getCategory('authentication');

		if (authSettingsRecord?.settings) {
			const authSettings = authSettingsRecord.settings;

			if (authSettings.oauth_client_id && authSettings.oauth_client_secret) {
				try {
					const githubProvider = new GitHubAuthProvider({
						clientId: authSettings.oauth_client_id,
						clientSecret: authSettings.oauth_client_secret,
						redirectUri:
							authSettings.oauth_redirect_uri ||
							`http://localhost:${resolvedConfig.port}/auth/callback`,
						scopes: (authSettings.oauth_scope || 'user:email').split(' ')
					});
					await multiAuthManager.registerProvider(githubProvider);
				} catch (error) {
					logger.error('SERVICES', 'Failed to register GitHub provider:', error);
				}
			} else {
				logger.info('SERVICES', 'GitHub OAuth not configured - skipping provider registration');
			}
		} else {
			logger.info(
				'SERVICES',
				'No authentication settings found - skipping OAuth provider registration'
			);
		}

		// 7. Tunnel Manager for runtime tunnel control
		const tunnelManager = new TunnelManager({
			port: resolvedConfig.port,
			subdomain: resolvedConfig.tunnelSubdomain,
			database: database
		});
		await tunnelManager.init();

		// 8. VS Code Tunnel Manager
		const vscodeManager = new VSCodeTunnelManager({
			database: database,
			configService
		});
		await vscodeManager.init();

		const services = {
			database,
			auth: authService,
			runSessionManager,
			ptyAdapter,
			claudeAdapter,
			fileEditorAdapter,
			claudeAuthManager,
			multiAuthManager,
			tunnelManager,
			vscodeManager,
			configService,
			// Convenience methods
			getAuthManager: () => multiAuthManager,
			getDatabase: () => database
		};

		// Store as global for API routes
		globalServicesInstance = services;

		logger.info('SERVICES', 'Services initialized successfully');
		logger.info('SERVICES', `RunSessionManager stats:`, runSessionManager.getStats());
		return services;
	} catch (error) {
		logger.error('SERVICES', 'Failed to initialize services:', error);
		throw error;
	}
}

/**
 * Export global services instance for API routes
 */
export const __API_SERVICES = {
	get services() {
		return globalServicesInstance;
	},
	getAuthManager() {
		return globalServicesInstance?.multiAuthManager;
	},
	getDatabase() {
		return globalServicesInstance?.database;
	},
	getRunSessionManager() {
		return globalServicesInstance?.runSessionManager;
	}
};
