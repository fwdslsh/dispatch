/**
 * SettingsService Svelte Context
 * Provides reactive settings service with Svelte 5 runes
 */

import { SettingsService } from './SettingsService.js';
import { getContext, setContext } from 'svelte';

const SETTINGS_CONTEXT_KEY = 'settings-service';

/**
 * Create and provide settings service context
 */
export function createSettingsService(config = {}) {
	const service = new SettingsService(config);

	// Create reactive wrapper with runes
	const reactiveService = {
		// Reactive state
		serverSettings: $state(service.serverSettings),
		clientOverrides: $state(service.clientOverrides),
		isLoaded: $state(service.isLoaded),
		isLoading: $state(service.isLoading),
		lastError: $state(service.lastError),
		lastSync: $state(service.lastSync),

		// Derived effective settings
		effectiveSettings: $derived(() => {
			const merged = { ...reactiveService.serverSettings };

			// Apply client overrides
			for (const [category, overrides] of Object.entries(reactiveService.clientOverrides)) {
				if (merged[category]) {
					merged[category] = { ...merged[category], ...overrides };
				} else {
					merged[category] = { ...overrides };
				}
			}

			return merged;
		}),

		// Delegate methods to underlying service
		async loadServerSettings() {
			await service.loadServerSettings();
			// Update reactive state
			reactiveService.serverSettings = service.serverSettings;
			reactiveService.isLoaded = service.isLoaded;
			reactiveService.isLoading = service.isLoading;
			reactiveService.lastError = service.lastError;
			reactiveService.lastSync = service.lastSync;
		},

		loadClientOverrides() {
			service.loadClientOverrides();
			reactiveService.clientOverrides = service.clientOverrides;
		},

		get(key, fallback = null) {
			const [category, setting] = key.split('.');
			if (!category || !setting) {
				console.warn('[SettingsService] Invalid setting key format:', key);
				return fallback;
			}

			const effectiveSettings = reactiveService.effectiveSettings;
			return effectiveSettings[category]?.[setting] ?? fallback;
		},

		setClientOverride(key, value) {
			service.setClientOverride(key, value);
			reactiveService.clientOverrides = service.clientOverrides;
		},

		removeClientOverride(key) {
			service.removeClientOverride(key);
			reactiveService.clientOverrides = service.clientOverrides;
		},

		resetClientOverrides() {
			service.resetClientOverrides();
			reactiveService.clientOverrides = service.clientOverrides;
		},

		resetClientOverridesForCategory(category) {
			service.resetClientOverridesForCategory(category);
			reactiveService.clientOverrides = service.clientOverrides;
		},

		async updateServerSetting(key, value, category, authKey, isSensitive = false) {
			await service.updateServerSetting(key, value, category, authKey, isSensitive);
			// Reload to sync reactive state
			await this.loadServerSettings();
		},

		async updateServerSettings(settings, authKey) {
			await service.updateServerSettings(settings, authKey);
			// Reload to sync reactive state
			await this.loadServerSettings();
		},

		exportSettings() {
			return service.exportSettings();
		},

		importSettings(backup) {
			service.importSettings(backup);
			reactiveService.clientOverrides = service.clientOverrides;
		}
	};

	setContext(SETTINGS_CONTEXT_KEY, reactiveService);
	return reactiveService;
}

/**
 * Get settings service from context
 */
export function useSettingsService() {
	const service = getContext(SETTINGS_CONTEXT_KEY);
	if (!service) {
		throw new Error(
			'Settings service not found in context. Make sure to call createSettingsService() first.'
		);
	}
	return service;
}

/**
 * Fallback service for use outside Svelte context
 */
export const settingsService = new SettingsService();
