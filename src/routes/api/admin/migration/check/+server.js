/**
 * Check for existing TERMINAL_KEY configuration
 */

import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	try {
		// Check if authentication system is already set up
		const authManager = globalThis.__API_SERVICES?.authManager;
		if (!authManager) {
			return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
		}

		// Check if there are any existing users (indicating setup is complete)
		const existingUsers = await authManager.getAllUsers();
		const hasExistingUsers = existingUsers && existingUsers.length > 0;

		// Check for TERMINAL_KEY environment variable
		const hasTerminalKey = !!process.env.TERMINAL_KEY && process.env.TERMINAL_KEY !== 'change-me';

		// If users exist, setup is already complete
		if (hasExistingUsers) {
			return json({
				success: true,
				hasExistingKey: false,
				setupComplete: true,
				message: 'Authentication system is already configured'
			});
		}

		return json({
			success: true,
			hasExistingKey: hasTerminalKey,
			setupComplete: false,
			message: hasTerminalKey
				? 'TERMINAL_KEY found, ready for migration'
				: 'No existing configuration found'
		});
	} catch (error) {
		console.error('Error checking migration status:', error);
		return json(
			{
				success: false,
				error: 'Failed to check migration status'
			},
			{ status: 500 }
		);
	}
}
