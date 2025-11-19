/**
 * Migration: Encrypt OAuth Client Secrets
 *
 * This migration encrypts any plaintext OAuth client secrets in the database.
 * Run this after setting the ENCRYPTION_KEY environment variable.
 *
 * Usage:
 *   node src/lib/server/database/migrations/encrypt-oauth-secrets.js
 */

import { DatabaseManager } from '../DatabaseManager.js';
import { SettingsManager } from '../../settings/SettingsManager.js';
import { encryptionService } from '../../shared/EncryptionService.js';
import { logger } from '../../shared/utils/logger.js';

async function migrateOAuthSecrets() {
	logger.info('MIGRATION', 'Starting OAuth secret encryption migration...');

	if (!encryptionService.isAvailable()) {
		logger.error(
			'MIGRATION',
			'ENCRYPTION_KEY not set! Cannot encrypt secrets. Please set ENCRYPTION_KEY environment variable.'
		);
		process.exit(1);
	}

	try {
		// Initialize database
		const dbPath = process.env.DATABASE_PATH || '.testing-home/dispatch/data/workspace.db';
		const db = new DatabaseManager(dbPath);
		await db.connect();

		const settingsManager = new SettingsManager(db);

		// Get OAuth settings
		const oauthSettings = await settingsManager.getByCategory('oauth');

		if (!oauthSettings || !oauthSettings.providers) {
			logger.info('MIGRATION', 'No OAuth providers found. Nothing to migrate.');
			await db.close();
			return;
		}

		const providers = oauthSettings.providers;
		let migratedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		// Check each provider's client secret
		for (const [providerName, config] of Object.entries(providers)) {
			if (!config.clientSecret) {
				logger.info('MIGRATION', `${providerName}: No client secret found, skipping`);
				skippedCount++;
				continue;
			}

			// Check if already encrypted
			if (encryptionService.isEncrypted(config.clientSecret)) {
				logger.info('MIGRATION', `${providerName}: Already encrypted, skipping`);
				skippedCount++;
				continue;
			}

			try {
				logger.info('MIGRATION', `${providerName}: Encrypting client secret...`);

				// Encrypt the plaintext secret
				const encryptedSecret = encryptionService.encrypt(config.clientSecret);

				// Update the provider config
				config.clientSecret = encryptedSecret;
				config.migratedAt = Date.now();

				migratedCount++;
				logger.info('MIGRATION', `${providerName}: Successfully encrypted`);
			} catch (error) {
				logger.error('MIGRATION', `${providerName}: Encryption failed:`, error);
				errorCount++;
			}
		}

		// Save updated settings if any were migrated
		if (migratedCount > 0) {
			await settingsManager.setByCategory(
				'oauth',
				{ providers },
				'Encrypted OAuth client secrets (migration)'
			);

			logger.info(
				'MIGRATION',
				`Migration complete! Encrypted ${migratedCount} secret(s), skipped ${skippedCount}, errors: ${errorCount}`
			);
		} else {
			logger.info(
				'MIGRATION',
				`Migration complete! No secrets needed encryption. Skipped ${skippedCount}.`
			);
		}

		await db.close();

		// Exit with error code if any failures
		if (errorCount > 0) {
			logger.error('MIGRATION', `Migration completed with ${errorCount} error(s)`);
			process.exit(1);
		}
	} catch (error) {
		logger.error('MIGRATION', 'Migration failed:', error);
		process.exit(1);
	}
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	migrateOAuthSecrets().catch((error) => {
		logger.error('MIGRATION', 'Unhandled migration error:', error);
		process.exit(1);
	});
}

export { migrateOAuthSecrets };
