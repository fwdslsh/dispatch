/**
 * PersistenceService.js
 *
 * Centralized service for all persistence operations (localStorage, sessionStorage).
 * Provides a clean API for storing and retrieving data with automatic JSON serialization,
 * migration support, and storage quota management.
 */

import { STORAGE_CONFIG } from '$lib/shared/constants.js';

/**
 * @typedef {Object} PersistenceConfig
 * @property {boolean} debug - Enable debug logging
 * @property {number} maxStorageSize - Maximum storage size in bytes
 * @property {number} warnStorageSize - Warning threshold in bytes
 */

export class PersistenceService {
	/**
	 * @param {PersistenceConfig} config
	 */
	constructor(config = {}) {
		this.config = {
			debug: false,
			maxStorageSize: STORAGE_CONFIG.MAX_STORAGE_SIZE || 10 * 1024 * 1024,
			warnStorageSize: STORAGE_CONFIG.WARN_STORAGE_SIZE || 8 * 1024 * 1024,
			...config
		};

		// Map old keys to new standardized keys for migration
		this.keyMigrationMap = new Map([
			['dispatch-auth-token', STORAGE_CONFIG.AUTH_TOKEN_KEY],
			['dispatch-projects-layout', 'dispatch-layout'],
			['dispatch-projects-current-mobile', 'dispatch-mobile-index'],
			['dispatch-sidebar-collapsed', 'dispatch-sidebar-state']
		]);

		// Perform initial migration if needed
		this.migrateOldKeys();
	}

	/**
	 * Migrate old localStorage keys to new standardized keys
	 */
	migrateOldKeys() {
		if (typeof localStorage === 'undefined') return;

		let migrated = false;

		for (const [oldKey, newKey] of this.keyMigrationMap) {
			const value = localStorage.getItem(oldKey);
			if (value !== null && localStorage.getItem(newKey) === null) {
				localStorage.setItem(newKey, value);
				localStorage.removeItem(oldKey);
				migrated = true;

				if (this.config.debug) {
					console.log(`[PersistenceService] Migrated key: ${oldKey} -> ${newKey}`);
				}
			}
		}

		if (migrated) {
			this.set('dispatch-migration-complete', Date.now());
		}
	}

	/**
	 * Get a value from localStorage
	 * @param {string} key - Storage key
	 * @param {*} defaultValue - Default value if key doesn't exist
	 * @returns {*} Parsed value or defaultValue
	 */
	get(key, defaultValue = null) {
		if (typeof localStorage === 'undefined') return defaultValue;

		try {
			const value = localStorage.getItem(key);
			if (value === null) return defaultValue;

			// Try to parse as JSON, fall back to raw value
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		} catch (error) {
			if (this.config.debug) {
				console.error(`[PersistenceService] Error getting key '${key}':`, error);
			}
			return defaultValue;
		}
	}

	/**
	 * Set a value in localStorage
	 * @param {string} key - Storage key
	 * @param {*} value - Value to store (will be JSON stringified)
	 * @returns {boolean} Success status
	 */
	set(key, value) {
		if (typeof localStorage === 'undefined') return false;

		try {
			const serialized = typeof value === 'string' ? value : JSON.stringify(value);
			localStorage.setItem(key, serialized);

			// Check storage usage after write
			this.checkStorageUsage();

			return true;
		} catch (error) {
			if (this.config.debug) {
				console.error(`[PersistenceService] Error setting key '${key}':`, error);
			}

			// Handle quota exceeded error
			if (error.name === 'QuotaExceededError') {
				this.handleQuotaExceeded();
			}

			return false;
		}
	}

	/**
	 * Remove a value from localStorage
	 * @param {string} key - Storage key
	 * @returns {boolean} Success status
	 */
	remove(key) {
		if (typeof localStorage === 'undefined') return false;

		try {
			localStorage.removeItem(key);
			return true;
		} catch (error) {
			if (this.config.debug) {
				console.error(`[PersistenceService] Error removing key '${key}':`, error);
			}
			return false;
		}
	}

	/**
	 * Clear all localStorage data
	 * @param {boolean} preserveAuth - Whether to preserve auth token
	 * @returns {boolean} Success status
	 */
	clear(preserveAuth = true) {
		if (typeof localStorage === 'undefined') return false;

		try {
			const authToken = preserveAuth ? this.get(STORAGE_CONFIG.AUTH_TOKEN_KEY) : null;

			localStorage.clear();

			if (preserveAuth && authToken) {
				this.set(STORAGE_CONFIG.AUTH_TOKEN_KEY, authToken);
			}

			return true;
		} catch (error) {
			if (this.config.debug) {
				console.error('[PersistenceService] Error clearing storage:', error);
			}
			return false;
		}
	}

	/**
	 * Get all keys matching a prefix
	 * @param {string} prefix - Key prefix
	 * @returns {Array<{key: string, value: any}>}
	 */
	getByPrefix(prefix) {
		if (typeof localStorage === 'undefined') return [];

		const results = [];

		try {
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.startsWith(prefix)) {
					results.push({
						key,
						value: this.get(key)
					});
				}
			}
		} catch (error) {
			if (this.config.debug) {
				console.error(`[PersistenceService] Error getting keys with prefix '${prefix}':`, error);
			}
		}

		return results;
	}

	/**
	 * Remove all keys matching a prefix
	 * @param {string} prefix - Key prefix
	 * @returns {number} Number of keys removed
	 */
	removeByPrefix(prefix) {
		if (typeof localStorage === 'undefined') return 0;

		let count = 0;
		const keysToRemove = [];

		try {
			// Collect keys first to avoid mutation during iteration
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.startsWith(prefix)) {
					keysToRemove.push(key);
				}
			}

			// Remove collected keys
			for (const key of keysToRemove) {
				if (this.remove(key)) {
					count++;
				}
			}
		} catch (error) {
			if (this.config.debug) {
				console.error(`[PersistenceService] Error removing keys with prefix '${prefix}':`, error);
			}
		}

		return count;
	}

	/**
	 * Get the current storage usage
	 * @returns {{used: number, available: number, percentage: number}}
	 */
	getStorageUsage() {
		if (typeof localStorage === 'undefined') {
			return { used: 0, available: 0, percentage: 0 };
		}

		let used = 0;

		try {
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					const value = localStorage.getItem(key);
					if (value) {
						// Estimate bytes (UTF-16 in JavaScript)
						used += (key.length + value.length) * 2;
					}
				}
			}
		} catch (error) {
			if (this.config.debug) {
				console.error('[PersistenceService] Error calculating storage usage:', error);
			}
		}

		const available = this.config.maxStorageSize - used;
		const percentage = (used / this.config.maxStorageSize) * 100;

		return {
			used,
			available: Math.max(0, available),
			percentage: Math.min(100, percentage)
		};
	}

	/**
	 * Check storage usage and warn if needed
	 */
	checkStorageUsage() {
		const { used, percentage } = this.getStorageUsage();

		if (used > this.config.warnStorageSize) {
			console.warn(
				`[PersistenceService] Storage usage warning: ${(used / 1024 / 1024).toFixed(2)}MB used (${percentage.toFixed(1)}%)`
			);
		}
	}

	/**
	 * Handle quota exceeded error
	 */
	handleQuotaExceeded() {
		console.error('[PersistenceService] Storage quota exceeded!');

		// Try to clean up old data
		this.cleanupOldData();
	}

	/**
	 * Clean up old cached data
	 * @returns {number} Number of items cleaned
	 */
	cleanupOldData() {
		let cleaned = 0;

		// Clean up old Claude commands cache
		const claudeCommands = this.getByPrefix('claude-commands-');
		const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

		for (const { key, value } of claudeCommands) {
			if (value && value.timestamp && value.timestamp < oneWeekAgo) {
				if (this.remove(key)) {
					cleaned++;
				}
			}
		}

		// Clean up old command cache
		const commandCache = this.getByPrefix('command-cache-');
		const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

		for (const { key, value } of commandCache) {
			if (value && value.timestamp && value.timestamp < oneDayAgo) {
				if (this.remove(key)) {
					cleaned++;
				}
			}
		}

		// Clean up old session history
		const sessionHistory = this.getByPrefix('dispatch-session-history-');
		const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

		for (const { key, value } of sessionHistory) {
			if (Array.isArray(value)) {
				const filtered = value.filter(
					item => item.timestamp && item.timestamp > oneMonthAgo
				);
				if (filtered.length < value.length) {
					this.set(key, filtered);
					cleaned++;
				}
			}
		}

		if (this.config.debug && cleaned > 0) {
			console.log(`[PersistenceService] Cleaned up ${cleaned} old items`);
		}

		return cleaned;
	}

	/**
	 * Export all data for backup
	 * @returns {Object} All stored data
	 */
	export() {
		const data = {};

		if (typeof localStorage === 'undefined') return data;

		try {
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					data[key] = this.get(key);
				}
			}
		} catch (error) {
			if (this.config.debug) {
				console.error('[PersistenceService] Error exporting data:', error);
			}
		}

		return data;
	}

	/**
	 * Import data from backup
	 * @param {Object} data - Data to import
	 * @param {boolean} merge - Whether to merge with existing data
	 * @returns {boolean} Success status
	 */
	import(data, merge = false) {
		if (!data || typeof data !== 'object') return false;

		try {
			if (!merge) {
				this.clear(true); // Preserve auth
			}

			for (const [key, value] of Object.entries(data)) {
				this.set(key, value);
			}

			return true;
		} catch (error) {
			if (this.config.debug) {
				console.error('[PersistenceService] Error importing data:', error);
			}
			return false;
		}
	}

	/**
	 * Session storage operations (temporary storage)
	 */
	session = {
		get: (key, defaultValue = null) => {
			if (typeof sessionStorage === 'undefined') return defaultValue;

			try {
				const value = sessionStorage.getItem(key);
				if (value === null) return defaultValue;

				try {
					return JSON.parse(value);
				} catch {
					return value;
				}
			} catch (error) {
				if (this.config.debug) {
					console.error(`[PersistenceService] Error getting session key '${key}':`, error);
				}
				return defaultValue;
			}
		},

		set: (key, value) => {
			if (typeof sessionStorage === 'undefined') return false;

			try {
				const serialized = typeof value === 'string' ? value : JSON.stringify(value);
				sessionStorage.setItem(key, serialized);
				return true;
			} catch (error) {
				if (this.config.debug) {
					console.error(`[PersistenceService] Error setting session key '${key}':`, error);
				}
				return false;
			}
		},

		remove: (key) => {
			if (typeof sessionStorage === 'undefined') return false;

			try {
				sessionStorage.removeItem(key);
				return true;
			} catch (error) {
				if (this.config.debug) {
					console.error(`[PersistenceService] Error removing session key '${key}':`, error);
				}
				return false;
			}
		},

		clear: () => {
			if (typeof sessionStorage === 'undefined') return false;

			try {
				sessionStorage.clear();
				return true;
			} catch (error) {
				if (this.config.debug) {
					console.error('[PersistenceService] Error clearing session storage:', error);
				}
				return false;
			}
		}
	};

	/**
	 * Dispose of resources
	 */
	dispose() {
		// No resources to clean up, but keeping for interface consistency
	}
}