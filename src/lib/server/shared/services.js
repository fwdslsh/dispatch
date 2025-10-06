/**
 * Service Registry Module (Simplified - No DI Framework)
 * @file Factory function for service initialization with explicit dependency wiring
 */

import { ConfigurationService } from './ConfigurationService.js';
import { JWTService } from '../auth/JWTService.js';
import { DatabaseManager } from '../database/DatabaseManager.js';
import { SessionRepository } from '../database/SessionRepository.js';
import { EventStore } from '../database/EventStore.js';
import { SettingsRepository } from '../database/SettingsRepository.js';
import { WorkspaceRepository } from '../database/WorkspaceRepository.js';
import { AdapterRegistry } from '../sessions/AdapterRegistry.js';
import { EventRecorder } from '../sessions/EventRecorder.js';
import { SessionOrchestrator } from '../sessions/SessionOrchestrator.js';

// Adapters
import { PtyAdapter } from '../terminal/PtyAdapter.js';
import { ClaudeAdapter } from '../claude/ClaudeAdapter.js';
import { FileEditorAdapter } from '../file-editor/FileEditorAdapter.js';

/**
 * Factory function to create all services with dependencies wired
 * @param {Object} [config] - Optional configuration overrides
 * @returns {Object} Services object containing all initialized services
 */
export function createServices(config = {}) {
	// Layer 1: Configuration
	const configService = new ConfigurationService(config);

	// Layer 2: Core infrastructure
	const jwtService = new JWTService(configService.get('TERMINAL_KEY'));
	const db = new DatabaseManager({
		dbPath: config.dbPath,
		HOME: configService.get('HOME')
	});

	// Layer 3: Repositories (depend on db)
	const sessionRepository = new SessionRepository(db);
	const eventStore = new EventStore(db);
	const settingsRepository = new SettingsRepository(db);
	const workspaceRepository = new WorkspaceRepository(db);

	// Layer 4: Session components
	const adapterRegistry = new AdapterRegistry();
	const eventRecorder = new EventRecorder(eventStore);

	// Layer 5: Orchestrators (depend on repositories + services)
	const sessionOrchestrator = new SessionOrchestrator(
		sessionRepository,
		eventRecorder,
		adapterRegistry
	);

	// Register adapters
	adapterRegistry.register('pty', new PtyAdapter());
	adapterRegistry.register('claude', new ClaudeAdapter());
	adapterRegistry.register('file-editor', new FileEditorAdapter());

	return {
		config: configService,
		jwt: jwtService,
		db,
		sessionRepository,
		eventStore,
		settingsRepository,
		workspaceRepository,
		adapterRegistry,
		eventRecorder,
		sessionOrchestrator
	};
}

/**
 * Singleton for app lifecycle
 */
export let services = null;

/**
 * Initialize services (called once at app startup)
 * @param {Object} [config] - Optional configuration overrides
 * @returns {Object} Initialized services
 */
export async function initializeServices(config = {}) {
	if (services) {
		return services;
	}

	services = createServices(config);

	// Initialize database
	await services.db.init();

	// Initialize default settings
	await services.settingsRepository.initializeDefaults();

	// Mark all sessions as stopped (cleanup from previous run)
	await services.sessionRepository.markAllStopped();

	return services;
}

/**
 * Reset services (useful for testing)
 * @returns {void}
 */
export function resetServices() {
	services = null;
}
