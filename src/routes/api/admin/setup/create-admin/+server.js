/**
 * Create administrator account during onboarding
 */

import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { adminUser, terminalKey } = await request.json();

		// Validate input
		if (!adminUser || !adminUser.email || !adminUser.password) {
			return json({ success: false, error: 'Email and password are required' }, { status: 400 });
		}

		if (adminUser.password.length < 12) {
			return json({ success: false, error: 'Password must be at least 12 characters long' }, { status: 400 });
		}

		// Validate TERMINAL_KEY if provided (for migration)
		if (terminalKey) {
			const currentKey = process.env.TERMINAL_KEY;
			if (terminalKey !== currentKey) {
				return json({ success: false, error: 'Invalid TERMINAL_KEY' }, { status: 401 });
			}
		}

		const authManager = globalThis.__API_SERVICES?.authManager;
		if (!authManager) {
			return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
		}

		// Check if admin user already exists
		const existingUsers = await authManager.getAllUsers();
		if (existingUsers && existingUsers.length > 0) {
			return json({ success: false, error: 'Admin user already exists' }, { status: 409 });
		}

		// Create admin user
		const userData = {
			email: adminUser.email,
			displayName: adminUser.displayName || 'Administrator',
			role: 'admin',
			isActive: true
		};

		const user = await authManager.createUser(userData);

		// Set up local authentication for admin user
		const localAuthAdapter = authManager.getAdapter('local');
		if (localAuthAdapter) {
			await localAuthAdapter.setUserPassword(user.id, adminUser.password);
		}

		// Log the admin creation event
		const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
		if (authEventLogger) {
			await authEventLogger.logEvent({
				userId: user.id,
				eventType: 'admin_created',
				ipAddress: 'system',
				userAgent: 'onboarding',
				metadata: {
					email: user.email,
					migrationSource: terminalKey ? 'terminal_key' : 'fresh_install',
					createdBy: 'onboarding_flow'
				}
			});
		}

		return json({
			success: true,
			message: 'Administrator account created successfully',
			user: {
				id: user.id,
				email: user.email,
				displayName: user.displayName,
				role: user.role
			}
		});

	} catch (error) {
		console.error('Error creating admin user:', error);
		return json({
			success: false,
			error: 'Failed to create administrator account'
		}, { status: 500 });
	}
}