/**
 * EncryptionService
 * Handles encryption and decryption of sensitive data using AES-256-GCM
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from './utils/logger.js';

export class EncryptionService {
	/**
	 * Initialize encryption service with a master key
	 * @param {string} masterKey - Base64-encoded master encryption key from environment
	 */
	constructor(masterKey = null) {
		this.masterKey = masterKey || process.env.ENCRYPTION_KEY;

		if (!this.masterKey) {
			logger.warn(
				'ENCRYPTION',
				'No ENCRYPTION_KEY environment variable set. Encryption disabled. THIS IS INSECURE FOR PRODUCTION!'
			);
		}

		// Algorithm configuration
		this.algorithm = 'aes-256-gcm';
		this.keyLength = 32; // 256 bits
		this.ivLength = 16; // 128 bits
		this.saltLength = 32;
		this.tagLength = 16; // 128 bits
	}

	/**
	 * Check if encryption is available
	 * @returns {boolean}
	 */
	isAvailable() {
		return !!this.masterKey;
	}

	/**
	 * Generate a new encryption key
	 * This should be run once and stored in environment variables
	 * @returns {string} Base64-encoded encryption key
	 */
	static generateKey() {
		return randomBytes(32).toString('base64');
	}

	/**
	 * Derive encryption key from master key using scrypt
	 * @param {Buffer} salt - Salt for key derivation
	 * @returns {Buffer} Derived key
	 * @private
	 */
	_deriveKey(salt) {
		if (!this.masterKey) {
			throw new Error('Encryption key not configured');
		}

		// Derive key from master key using scrypt (CPU/memory hard)
		return scryptSync(this.masterKey, salt, this.keyLength);
	}

	/**
	 * Encrypt a string value
	 * @param {string} plaintext - Value to encrypt
	 * @returns {string|null} Encrypted value in format: salt:iv:ciphertext:authTag (hex-encoded) or null if encryption unavailable
	 */
	encrypt(plaintext) {
		if (!this.isAvailable()) {
			logger.warn('ENCRYPTION', 'Encryption not available, storing value in plaintext');
			return null;
		}

		if (!plaintext || typeof plaintext !== 'string') {
			throw new Error('Plaintext must be a non-empty string');
		}

		try {
			// Generate random salt and IV
			const salt = randomBytes(this.saltLength);
			const iv = randomBytes(this.ivLength);

			// Derive encryption key
			const key = this._deriveKey(salt);

			// Create cipher
			const cipher = createCipheriv(this.algorithm, key, iv);

			// Encrypt
			let encrypted = cipher.update(plaintext, 'utf8', 'hex');
			encrypted += cipher.final('hex');

			// Get authentication tag
			const authTag = cipher.getAuthTag();

			// Combine salt:iv:ciphertext:authTag
			const result = [
				salt.toString('hex'),
				iv.toString('hex'),
				encrypted,
				authTag.toString('hex')
			].join(':');

			logger.debug('ENCRYPTION', 'Successfully encrypted value');
			return result;
		} catch (error) {
			logger.error('ENCRYPTION', 'Encryption failed:', error);
			throw new Error(`Encryption failed: ${error.message}`);
		}
	}

	/**
	 * Decrypt an encrypted string value
	 * @param {string|null} ciphertext - Encrypted value from encrypt()
	 * @returns {string|null} Decrypted plaintext or null if input was null
	 */
	decrypt(ciphertext) {
		// Handle null/undefined (unencrypted legacy data)
		if (!ciphertext) {
			return null;
		}

		if (!this.isAvailable()) {
			logger.warn(
				'ENCRYPTION',
				'Encryption not available, cannot decrypt. Returning ciphertext as-is.'
			);
			// Return as-is (assume it's plaintext from before encryption was enabled)
			return ciphertext;
		}

		try {
			// Parse components
			const parts = ciphertext.split(':');
			if (parts.length !== 4) {
				logger.warn(
					'ENCRYPTION',
					'Invalid encrypted format, assuming plaintext (migration needed)'
				);
				return ciphertext; // Assume plaintext (needs migration)
			}

			const [saltHex, ivHex, encrypted, authTagHex] = parts;

			// Convert from hex
			const salt = Buffer.from(saltHex, 'hex');
			const iv = Buffer.from(ivHex, 'hex');
			const authTag = Buffer.from(authTagHex, 'hex');

			// Derive key
			const key = this._deriveKey(salt);

			// Create decipher
			const decipher = createDecipheriv(this.algorithm, key, iv);
			decipher.setAuthTag(authTag);

			// Decrypt
			let decrypted = decipher.update(encrypted, 'hex', 'utf8');
			decrypted += decipher.final('utf8');

			logger.debug('ENCRYPTION', 'Successfully decrypted value');
			return decrypted;
		} catch (error) {
			logger.error('ENCRYPTION', 'Decryption failed:', error);
			throw new Error(`Decryption failed: ${error.message}`);
		}
	}

	/**
	 * Encrypt an object's sensitive fields
	 * @param {Object} obj - Object containing sensitive data
	 * @param {string[]} sensitiveFields - Array of field names to encrypt
	 * @returns {Object} Object with encrypted fields
	 */
	encryptFields(obj, sensitiveFields) {
		if (!obj || typeof obj !== 'object') {
			throw new Error('Input must be an object');
		}

		const result = { ...obj };

		for (const field of sensitiveFields) {
			if (result[field]) {
				result[field] = this.encrypt(result[field]);
			}
		}

		return result;
	}

	/**
	 * Decrypt an object's sensitive fields
	 * @param {Object} obj - Object containing encrypted data
	 * @param {string[]} sensitiveFields - Array of field names to decrypt
	 * @returns {Object} Object with decrypted fields
	 */
	decryptFields(obj, sensitiveFields) {
		if (!obj || typeof obj !== 'object') {
			throw new Error('Input must be an object');
		}

		const result = { ...obj };

		for (const field of sensitiveFields) {
			if (result[field]) {
				result[field] = this.decrypt(result[field]);
			}
		}

		return result;
	}

	/**
	 * Check if a value appears to be encrypted
	 * @param {string} value - Value to check
	 * @returns {boolean}
	 */
	isEncrypted(value) {
		if (!value || typeof value !== 'string') {
			return false;
		}

		// Encrypted format: salt:iv:ciphertext:authTag (all hex)
		const parts = value.split(':');
		if (parts.length !== 4) {
			return false;
		}

		// Check if all parts are valid hex
		const hexPattern = /^[0-9a-f]+$/i;
		return parts.every((part) => hexPattern.test(part));
	}
}

// Export singleton instance
export const encryptionService = new EncryptionService();
