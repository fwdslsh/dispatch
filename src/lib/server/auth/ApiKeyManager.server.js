import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { logger } from '../shared/utils/logger.js';

/**
 * API Key Manager - Handles API key generation, validation, and management
 *
 * Security features:
 * - bcrypt hashing with cost factor 12 (~100-150ms per validation)
 * - Constant-time comparison via bcrypt
 * - 256-bit (32-byte) cryptographically secure random keys
 * - Base64url encoding for display (43-44 characters)
 * - Secrets shown EXACTLY ONCE on creation
 */
export class ApiKeyManager {
	constructor(database) {
		this.db = database;
		this.BCRYPT_COST_FACTOR = 12;
		this.KEY_BYTES = 32; // 256 bits
	}

	/**
	 * Generate a new API key for a user
	 * @param {string} userId - User ID (default: 'default')
	 * @param {string} label - User-friendly label for the key
	 * @returns {Promise<Object>} Object with {id, key, label} - key shown ONCE
	 */
	async generateKey(userId, label) {
		// Validate inputs
		if (!label || typeof label !== 'string' || label.trim().length === 0) {
			throw new Error('API key label is required');
		}
		if (label.length > 100) {
			throw new Error('API key label must be 100 characters or less');
		}

		// Generate cryptographically secure random key (32 bytes = 256 bits)
		const keyBuffer = randomBytes(this.KEY_BYTES);

		// Base64url encode for display (URL-safe, no padding)
		const plainKey = keyBuffer
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');

		// Hash the key with bcrypt cost factor 12
		const keyHash = await bcrypt.hash(plainKey, this.BCRYPT_COST_FACTOR);

		// Generate UUID for key ID
		const keyId = randomUUID();
		const now = Date.now();

		// Store in database (only the hash, never the plaintext)
		await this.db.run(
			`INSERT INTO auth_api_keys (id, user_id, key_hash, label, created_at, last_used_at, disabled)
			 VALUES (?, ?, ?, ?, ?, NULL, 0)`,
			[keyId, userId, keyHash, label.trim(), now]
		);

		logger.info('API_KEY', `Generated new API key for user ${userId}: ${keyId} (label: ${label})`);

		// Return plaintext key ONCE (never stored, never retrievable)
		return {
			id: keyId,
			key: plainKey,
			label: label.trim()
		};
	}

	/**
	 * Verify an API key against stored hash
	 * @param {string} key - Plaintext API key to verify
	 * @returns {Promise<Object|null>} API key metadata if valid, null if invalid
	 */
	async verify(key) {
		if (!key || typeof key !== 'string') {
			return null;
		}

		// Get all active (non-disabled) API keys
		// Note: We check all keys because we don't know which one matches until we compare hashes
		const keys = await this.db.all(
			`SELECT id, user_id, key_hash, label, created_at, last_used_at, disabled
			 FROM auth_api_keys
			 WHERE disabled = 0`
		);

		// Try to find matching key using constant-time bcrypt comparison
		for (const storedKey of keys) {
			try {
				const match = await bcrypt.compare(key, storedKey.key_hash);

				if (match) {
					// Update last_used_at asynchronously (don't block validation)
					this._updateLastUsed(storedKey.id, Date.now()).catch((err) => {
						logger.error('API_KEY', `Failed to update last_used_at for key ${storedKey.id}:`, err);
					});

					logger.debug('API_KEY', `Valid API key: ${storedKey.id} (label: ${storedKey.label})`);

					// Return key metadata (without hash)
					return {
						id: storedKey.id,
						userId: storedKey.user_id,
						label: storedKey.label,
						createdAt: storedKey.created_at,
						lastUsedAt: storedKey.last_used_at
					};
				}
			} catch (err) {
				// bcrypt comparison failed, continue to next key
				logger.debug('API_KEY', `bcrypt comparison error for key ${storedKey.id}:`, err);
				continue;
			}
		}

		// No matching key found
		logger.debug('API_KEY', 'Invalid API key provided (no match)');
		return null;
	}

	/**
	 * List all API keys for a user (metadata only, no secrets)
	 * @param {string} userId - User ID
	 * @returns {Promise<Array>} Array of API key metadata objects
	 */
	async listKeys(userId) {
		const keys = await this.db.all(
			`SELECT id, label, created_at, last_used_at, disabled
			 FROM auth_api_keys
			 WHERE user_id = ?
			 ORDER BY created_at DESC`,
			[userId]
		);

		return keys.map((key) => ({
			id: key.id,
			label: key.label,
			created_at: key.created_at,
			last_used_at: key.last_used_at,
			disabled: key.disabled
		}));
	}

	/**
	 * Disable an API key (soft delete)
	 * @param {string} keyId - API key ID
	 * @param {string} userId - User ID (for ownership verification)
	 * @returns {Promise<boolean>} True if disabled, false if not found
	 */
	async disableKey(keyId, userId) {
		const result = await this.db.run(
			`UPDATE auth_api_keys
			 SET disabled = 1
			 WHERE id = ? AND user_id = ?`,
			[keyId, userId]
		);

		if (result.changes > 0) {
			logger.info('API_KEY', `Disabled API key ${keyId} for user ${userId}`);
			return true;
		}

		logger.warn(
			'API_KEY',
			`Failed to disable key ${keyId}: not found or not owned by user ${userId}`
		);
		return false;
	}

	/**
	 * Enable a previously disabled API key
	 * @param {string} keyId - API key ID
	 * @param {string} userId - User ID (for ownership verification)
	 * @returns {Promise<boolean>} True if enabled, false if not found
	 */
	async enableKey(keyId, userId) {
		const result = await this.db.run(
			`UPDATE auth_api_keys
			 SET disabled = 0
			 WHERE id = ? AND user_id = ?`,
			[keyId, userId]
		);

		if (result.changes > 0) {
			logger.info('API_KEY', `Enabled API key ${keyId} for user ${userId}`);
			return true;
		}

		logger.warn(
			'API_KEY',
			`Failed to enable key ${keyId}: not found or not owned by user ${userId}`
		);
		return false;
	}

	/**
	 * Delete an API key permanently (hard delete)
	 * @param {string} keyId - API key ID
	 * @param {string} userId - User ID (for ownership verification)
	 * @returns {Promise<boolean>} True if deleted, false if not found
	 */
	async deleteKey(keyId, userId) {
		const result = await this.db.run(
			`DELETE FROM auth_api_keys
			 WHERE id = ? AND user_id = ?`,
			[keyId, userId]
		);

		if (result.changes > 0) {
			logger.info('API_KEY', `Deleted API key ${keyId} for user ${userId}`);
			return true;
		}

		logger.warn(
			'API_KEY',
			`Failed to delete key ${keyId}: not found or not owned by user ${userId}`
		);
		return false;
	}

	/**
	 * Update last_used_at timestamp (internal helper, non-blocking)
	 * @private
	 */
	async _updateLastUsed(keyId, timestamp) {
		await this.db.run(
			`UPDATE auth_api_keys
			 SET last_used_at = ?
			 WHERE id = ?`,
			[timestamp, keyId]
		);
	}
}
