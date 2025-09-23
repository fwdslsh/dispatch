/**
 * Environment API
 * Provides server environment information to the client
 */

import { json } from '@sveltejs/kit';
import { homedir } from 'node:os';

/**
 * GET - Retrieve server environment information
 */
export async function GET() {
	try {
		// Get the actual home directory from the OS
		const homeDirectory = process.env.HOME || homedir();
		
		// In development, we might have a custom home directory
		const effectiveHome = homeDirectory;
		
		return json({
			homeDirectory: effectiveHome,
			// Could add other environment info here if needed in the future
			platform: process.platform,
			nodeVersion: process.version
		});
	} catch (error) {
		console.error('[API] Failed to get environment information:', error);
		return json({ error: 'Failed to get environment information' }, { status: 500 });
	}
}