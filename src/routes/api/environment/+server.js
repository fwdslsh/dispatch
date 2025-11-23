/**
 * Environment API
 * Provides server environment information to the client
 */

import { json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '$lib/server/shared/utils/logger.js';
import { handleApiError } from '$lib/server/shared/utils/api-errors.js';

/**
 * GET - Retrieve server environment information
 */
export async function GET() {
	try {
		// Get the actual home directory from the OS
		const homeDirectory = process.env.HOME || homedir();

		// In development, we might have a custom home directory
		const effectiveHome = homeDirectory;

		// Get app version from package.json
		let appVersion = 'unknown';
		try {
			const __filename = fileURLToPath(import.meta.url);
			const __dirname = dirname(__filename);
			const packageJsonPath = join(__dirname, '../../../..', 'package.json');
			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
			appVersion = packageJson.version;
		} catch (error) {
			logger.warn('ENVIRONMENT_API', 'Failed to read app version from package.json', { error: error.message });
		}

		return json({
			homeDirectory: effectiveHome,
			// Could add other environment info here if needed in the future
			platform: process.platform,
			nodeVersion: process.version,
			appVersion
		});
	} catch (err) {
		handleApiError(err, 'GET /api/environment');
	}
}
