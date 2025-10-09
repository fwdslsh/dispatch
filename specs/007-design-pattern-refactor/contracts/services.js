/**
 * Service Registry Contract (Simplified - No DI Framework)
 * @file Interface for service initialization and access
 */

/**
 * Services Object (returned by createServices)
 * @typedef {Object} Services
 * @property {DatabaseManager} db - Database connection manager
 * @property {SessionRepository} sessionRepository - Session CRUD
 * @property {EventStore} eventStore - Event log management
 * @property {SettingsRepository} settingsRepository - Settings management
 * @property {WorkspaceRepository} workspaceRepository - Workspace management
 * @property {JWTService} jwtService - JWT token operations
 * @property {AdapterRegistry} adapterRegistry - Session adapter registry
 * @property {EventRecorder} eventRecorder - Event persistence + emission
 * @property {SessionOrchestrator} sessionOrchestrator - Session lifecycle
 */

/**
 * Configuration Object
 * @typedef {Object} Config
 * @property {string} TERMINAL_KEY - JWT signing secret
 * @property {number} [PORT] - Server port (default: 3030)
 * @property {string} [WORKSPACES_ROOT] - Workspace root (default: /workspace)
 * @property {boolean} [ENABLE_TUNNEL] - Enable tunneling
 */

/**
 * Factory function to create all services with dependencies wired
 * @param {Config} config - Configuration object
 * @returns {Services} Object containing all initialized services
 */

/**
 * Example Usage:
 *
 * // Initialize once at app startup
 * import { initializeServices } from '$lib/server/shared/services';
 * const config = { TERMINAL_KEY: process.env.TERMINAL_KEY };
 * initializeServices(config);
 *
 * // Use in API routes
 * import { services } from '$lib/server/shared/services';
 * const session = await services.sessionOrchestrator.createSession(data);
 *
 * // Mock in tests
 * vi.mock('$lib/server/shared/services', () => ({
 *   services: {
 *     sessionOrchestrator: { createSession: vi.fn() }
 *   }
 * }));
 */
