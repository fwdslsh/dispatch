/**
 * ServiceContainer.svelte.js
 *
 * Central dependency injection container for the application.
 * Provides singleton services that can be injected into ViewModels and components.
 *
 * Uses Svelte context API for proper scoping and lifecycle management.
 * All services are lazily instantiated and cached for performance.
 */

import { getContext, setContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

const SERVICE_CONTAINER_KEY = Symbol('service-container');

/**
 * Service configuration and factory definitions
 */
class ServiceContainer {
	constructor() {
		// Service instances cache
		this.services = new SvelteMap();

		// Service factories
		this.factories = new SvelteMap();

		// Track which services are currently loading
		this.loading = $state(new SvelteSet());

		// Store pending promises for services being loaded
		this.loadingPromises = new SvelteMap();

		// Service configuration
		// Phase 6: Use new unified auth token key
		this.config = $state({
			apiBaseUrl: '',
			socketUrl: '',
			authTokenKey: 'dispatch-auth-token',
			debug: false
		});

		// Register core service factories
		this.registerCoreServices();
	}

	/**
	 * Register core service factories
	 * These are lazy-loaded when first requested
	 */
	registerCoreServices() {
		// Central State Manager (Singleton)
		this.registerFactory('appStateManager', async () => {
			const { AppState } = await import('../state/AppState.svelte.js');
			return new AppState();
		});

		// API Clients

		this.registerFactory('sessionApi', async () => {
			const { SessionApiClient } = await import('./SessionApiClient.js');
			return new SessionApiClient(this.config);
		});

		// Alias for compatibility
		this.registerFactory('apiClient', async () => {
			return await this.get('sessionApi');
		});

		// Core Services
		this.registerFactory('socket', async () => {
			const { SocketService } = await import('./SocketService.svelte.js');
			return new SocketService(this.config);
		});

		this.registerFactory('environment', async () => {
			const { EnvironmentService } = await import('./EnvironmentService.js');
			return new EnvironmentService(this.config);
		});

		this.registerFactory('settingsService', async () => {
			const { SettingsService } = await import('./SettingsService.svelte.js');
			// Auth handled via session cookies - no need to pass auth key
			return new SettingsService(this.config);
		});

		this.registerFactory('themeState', async () => {
			const { ThemeState } = await import('../state/ThemeState.svelte.js');
			return new ThemeState(this.config);
		});

		// ViewModels
		this.registerFactory('sessionViewModel', async () => {
			const { SessionViewModel } = await import('../state/SessionViewModel.svelte.js');
			const appStateManager = await this.get('appStateManager');
			const sessionApi = await this.get('sessionApi');
			const settingsService = await this.get('settingsService');
			return new SessionViewModel(appStateManager, sessionApi, settingsService);
		});
	}

	/**
	 * Register a service factory
	 * @param {string} name - Service name
	 * @param {Function} factory - Factory function that creates the service
	 */
	registerFactory(name, factory) {
		this.factories.set(name, factory);
	}

	assertInstance(name, instance) {
		if (!instance) {
			throw new Error(`[ServiceContainer] Factory for "${name}" returned an invalid instance`);
		}
		return instance;
	}

	/**
	 * Register a singleton service instance
	 * @param {string} name - Service name
	 * @param {*} instance - Service instance
	 */
	registerInstance(name, instance) {
		this.services.set(name, instance);
	}

	/**
	 * Get or create a service instance
	 * @param {string} name - Service name
	 * @returns {Promise<*>} Service instance
	 */
	async get(name) {
		// Return cached instance if available
		if (this.services.has(name)) {
			return this.services.get(name);
		}

		// If service is already being loaded, wait for the existing promise
		if (this.loadingPromises.has(name)) {
			return this.loadingPromises.get(name);
		}

		// Create instance using factory
		if (this.factories.has(name)) {
			// Mark service as loading
			this.loading.add(name);

			try {
				const factory = this.factories.get(name);

				// Create the loading promise and store it
				const loadingPromise = factory().then((instance) => {
					const validInstance = this.assertInstance(name, instance);
					this.services.set(name, validInstance);
					return validInstance;
				});

				// Store the promise so concurrent calls can await it
				this.loadingPromises.set(name, loadingPromise);

				const instance = await loadingPromise;
				return instance;
			} finally {
				// Remove from loading state and pending promises
				this.loading.delete(name);
				this.loadingPromises.delete(name);
			}
		}

		throw new Error(`Service '${name}' not registered`);
	}

	/**
	 * Get a service synchronously (must already be instantiated)
	 * @param {string} name - Service name
	 * @returns {*} Service instance
	 */
	getSync(name) {
		if (this.services.has(name)) {
			return this.services.get(name);
		}
		throw new Error(`Service '${name}' not instantiated. Use get() for lazy loading.`);
	}

	/**
	 * Check if a service is registered
	 * @param {string} name - Service name
	 * @returns {boolean}
	 */
	has(name) {
		return this.factories.has(name) || this.services.has(name);
	}

	/**
	 * Check if a service is instantiated
	 * @param {string} name - Service name
	 * @returns {boolean}
	 */
	isInstantiated(name) {
		return this.services.has(name);
	}

	/**
	 * Check if a service is currently loading
	 * @param {string} name - Service name
	 * @returns {boolean}
	 */
	isLoading(name) {
		return this.loading.has(name);
	}

	/**
	 * Update configuration
	 * @param {Object} updates - Configuration updates
	 */
	configure(updates) {
		Object.assign(this.config, updates);
	}

	/**
	 * Reset a service (remove from cache)
	 * @param {string} name - Service name
	 */
	reset(name) {
		this.services.delete(name);
		this.loading.delete(name);
		this.loadingPromises.delete(name);
	}

	/**
	 * Reset all services
	 */
	resetAll() {
		this.services.clear();
		this.loading.clear();
		this.loadingPromises.clear();
	}

	/**
	 * Dispose of a service (call cleanup if available)
	 * @param {string} name - Service name
	 */
	async dispose(name) {
		const service = this.services.get(name);
		if (service && typeof service.dispose === 'function') {
			await service.dispose();
		}
		this.services.delete(name);
		this.loading.delete(name);
		this.loadingPromises.delete(name);
	}

	/**
	 * Dispose of all services
	 */
	async disposeAll() {
		for (const [_name, service] of this.services) {
			if (typeof service.dispose === 'function') {
				await service.dispose();
			}
		}
		this.services.clear();
		this.loading.clear();
		this.loadingPromises.clear();
	}
}

/**
 * Create and provide a service container in the component tree
 * @param {Object} config - Initial configuration
 * @returns {ServiceContainer}
 */
export function provideServiceContainer(config = {}) {
	const container = new ServiceContainer();
	container.configure(config);
	setContext(SERVICE_CONTAINER_KEY, container);
	return container;
}

/**
 * Get the service container from context
 * @returns {ServiceContainer}
 */
export function useServiceContainer() {
	const container = getContext(SERVICE_CONTAINER_KEY);
	if (!container) {
		throw new Error(
			'ServiceContainer not found in context. ' +
				'Make sure to call provideServiceContainer() in a parent component.'
		);
	}
	return container;
}

/**
 * Hook to get a specific service
 * @param {string} name - Service name
 * @returns {Promise<*>} Service instance
 */
export async function useService(name) {
	const container = useServiceContainer();
	return container.get(name);
}

/**
 * Hook to get a specific service synchronously
 * @param {string} name - Service name
 * @returns {*} Service instance
 */
export function useServiceSync(name) {
	const container = useServiceContainer();
	return container.getSync(name);
}

/**
 * Create a standalone container for testing
 * @param {Object} config - Configuration
 * @returns {ServiceContainer}
 */
export function createTestContainer(config = {}) {
	const container = new ServiceContainer();
	container.configure({
		...config,
		debug: true
	});
	return container;
}

// Export the class for type definitions
export { ServiceContainer };
