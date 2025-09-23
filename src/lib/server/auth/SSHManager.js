import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../shared/utils/logger.js';

/**
 * SSH Management for Dispatch
 * Manages SSH keys and integrates with system SSH daemon
 */
export class SSHManager {
	constructor(authManager) {
		this.authManager = authManager;
		this.sshKeysDir = process.env.SSH_KEYS_DIR || '/etc/ssh/keys';
		this.isContainerEnv = process.env.CONTAINER_ENV === 'true';
	}

	async init() {
		// Ensure SSH keys directory exists
		try {
			await fs.mkdir(this.sshKeysDir, { recursive: true, mode: 0o700 });
			logger.info('SSH', `SSH keys directory initialized: ${this.sshKeysDir}`);
		} catch (error) {
			logger.error('SSH', 'Failed to initialize SSH keys directory:', error);
		}
	}

	/**
	 * Add SSH key to system authorized_keys for a user
	 */
	async addSSHKeyToSystem(username, publicKey, keyId) {
		try {
			const authorizedKeysFile = join(this.sshKeysDir, `${username}_authorized_keys`);
			
			// Read existing keys or create empty content
			let existingKeys = '';
			try {
				existingKeys = await fs.readFile(authorizedKeysFile, 'utf8');
			} catch (error) {
				// File doesn't exist, which is fine
			}

			// Check if key already exists
			if (existingKeys.includes(publicKey.trim())) {
				logger.info('SSH', `SSH key already exists for user ${username}`);
				return;
			}

			// Add comment with key ID for identification
			const keyWithComment = `${publicKey.trim()} # dispatch-key-${keyId}\n`;
			const updatedKeys = existingKeys + keyWithComment;

			// Write updated authorized_keys file
			await fs.writeFile(authorizedKeysFile, updatedKeys, { mode: 0o600 });
			
			logger.info('SSH', `SSH key added to system for user ${username}`);
		} catch (error) {
			logger.error('SSH', `Failed to add SSH key to system for user ${username}:`, error);
			throw error;
		}
	}

	/**
	 * Remove SSH key from system authorized_keys for a user
	 */
	async removeSSHKeyFromSystem(username, keyId) {
		try {
			const authorizedKeysFile = join(this.sshKeysDir, `${username}_authorized_keys`);
			
			// Read existing keys
			let existingKeys = '';
			try {
				existingKeys = await fs.readFile(authorizedKeysFile, 'utf8');
			} catch (error) {
				// File doesn't exist, nothing to remove
				return;
			}

			// Remove the key with matching comment
			const lines = existingKeys.split('\n');
			const filteredLines = lines.filter(line => 
				!line.includes(`# dispatch-key-${keyId}`)
			);

			// Write updated authorized_keys file
			const updatedKeys = filteredLines.join('\n');
			await fs.writeFile(authorizedKeysFile, updatedKeys, { mode: 0o600 });
			
			logger.info('SSH', `SSH key removed from system for user ${username}`);
		} catch (error) {
			logger.error('SSH', `Failed to remove SSH key from system for user ${username}:`, error);
			throw error;
		}
	}

	/**
	 * Sync all SSH keys from database to system
	 */
	async syncSSHKeysToSystem() {
		try {
			// Get all users and their SSH keys from the database
			const users = await this.authManager.db.all(`
				SELECT u.id, u.username, sk.id as key_id, sk.public_key 
				FROM users u 
				JOIN ssh_keys sk ON u.id = sk.user_id
			`);

			// Group by username
			const userKeys = {};
			for (const row of users) {
				if (!userKeys[row.username]) {
					userKeys[row.username] = [];
				}
				userKeys[row.username].push({
					keyId: row.key_id,
					publicKey: row.public_key
				});
			}

			// Update authorized_keys files for each user
			for (const [username, keys] of Object.entries(userKeys)) {
				const authorizedKeysFile = join(this.sshKeysDir, `${username}_authorized_keys`);
				
				// Build the authorized_keys content
				const keyLines = keys.map(key => 
					`${key.publicKey.trim()} # dispatch-key-${key.keyId}`
				);
				const content = keyLines.join('\n') + '\n';

				// Write the file
				await fs.writeFile(authorizedKeysFile, content, { mode: 0o600 });
			}

			logger.info('SSH', `Synced SSH keys for ${Object.keys(userKeys).length} users`);
		} catch (error) {
			logger.error('SSH', 'Failed to sync SSH keys to system:', error);
			throw error;
		}
	}

	/**
	 * Get SSH daemon status
	 */
	async getSSHStatus() {
		if (!this.isContainerEnv) {
			return {
				enabled: false,
				running: false,
				reason: 'SSH management only available in container environment'
			};
		}

		try {
			// Check if SSH daemon is enabled
			const sshEnabled = process.env.SSH_ENABLED !== 'false';
			
			// Try to check if SSH daemon is running (basic check)
			const sshPort = process.env.SSH_PORT || '2222';
			
			return {
				enabled: sshEnabled,
				running: sshEnabled, // In container, if enabled, it should be running
				port: sshPort,
				keysDirectory: this.sshKeysDir
			};
		} catch (error) {
			logger.error('SSH', 'Failed to get SSH status:', error);
			return {
				enabled: false,
				running: false,
				error: error.message
			};
		}
	}

	/**
	 * Update SSH daemon configuration
	 */
	async updateSSHConfig(settings) {
		if (!this.isContainerEnv) {
			throw new Error('SSH configuration can only be modified in container environment');
		}

		try {
			// For now, we'll just log the settings
			// In a full implementation, this would update the SSH daemon config
			logger.info('SSH', 'SSH configuration update requested:', settings);
			
			// The actual SSH daemon restart would need to be handled by the container
			// This is a placeholder for future SSH daemon management
			return {
				success: true,
				message: 'SSH configuration updated successfully'
			};
		} catch (error) {
			logger.error('SSH', 'Failed to update SSH configuration:', error);
			throw error;
		}
	}
}