import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { CookieService } from '$lib/server/auth/CookieService.server.js';

/**
 * Onboarding page server-side actions and load function
 * Handles first-time setup with API key generation and session creation
 */

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	const services = locals.services;

	// Check if onboarding is already complete
	const status = await services.settingsManager.getSystemStatus();

	if (status.onboarding.isComplete) {
		// Already onboarded - redirect to main app
		throw redirect(303, '/');
	}

	return {
		onboardingStatus: status.onboarding
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * Complete onboarding process
	 * Creates first API key, sets up session, and marks onboarding as complete
	 */
	submit: async ({ request, cookies, locals }) => {
		const services = locals.services;
		const formData = await request.formData();

		// Extract form data
		const workspaceName = formData.get('workspaceName');
		const workspacePath = formData.get('workspacePath');
		const selectedTheme = formData.get('selectedTheme');
		const preferences = formData.get('preferences');

		try {
			logger.info('ONBOARDING', 'Starting onboarding process');

			// Validate database schema exists
			try {
				const tableCheck = await services.database.get(
					`SELECT name FROM sqlite_master WHERE type='table' AND name='auth_users'`
				);
				if (!tableCheck) {
					throw new Error('Database schema not initialized: auth_users table missing');
				}
			} catch (schemaErr) {
				logger.error('ONBOARDING', `Database schema validation failed: ${schemaErr.message}`);
				throw new Error('Database not properly initialized. Please restart the application');
			}

			// Create default user first (required for foreign key constraints)
			const now = Date.now();
			await services.database.run(
				`INSERT OR IGNORE INTO auth_users (user_id, email, name, created_at, last_login)
				 VALUES (?, NULL, ?, ?, ?)`,
				['default', 'Default User', now, now]
			);

			// Generate first API key for the default user
			// This is the ONLY time we show the plaintext key
			const apiKey = await services.apiKeyManager.generateKey('default', 'First API Key');

			if (!apiKey) {
				return {
					success: false,
					error: 'Failed to generate API key'
				};
			}

			// Create session with the new API key
			const session = await services.sessionManager.createSession('default', 'api_key', {
				apiKeyId: apiKey.id,
				label: apiKey.label
			});

			// Set session cookie
			CookieService.setSessionCookie(cookies, session.sessionId);

			// Workspace creation removed - layouts are stored in localStorage

			// Save preferences if provided
			if (preferences) {
				// Type validation for FormDataEntryValue
				if (typeof preferences !== 'string') {
					logger.warn('ONBOARDING', 'Invalid preferences data type');
				} else {
					try {
						const prefs = JSON.parse(preferences);
						await services.settingsManager.updateSettings('general', prefs);
						logger.info('ONBOARDING', 'Preferences saved');
					} catch (err) {
						logger.warn('ONBOARDING', `Failed to save preferences: ${err.message}`);
						// Don't fail onboarding if preference save fails
					}
				}
			}

			// Apply selected theme if provided
			if (selectedTheme) {
				// Type validation for FormDataEntryValue
				if (typeof selectedTheme !== 'string') {
					logger.warn('ONBOARDING', 'Invalid theme data type');
				} else {
					try {
						// Set theme as global default via settings
						await services.settingsManager.updateSettings('themes', {
							globalDefault: selectedTheme
						});
						logger.info('ONBOARDING', `Theme applied: ${selectedTheme}`);
					} catch (err) {
						logger.warn('ONBOARDING', `Failed to apply theme: ${err.message}`);
						// Don't fail onboarding if theme application fails
					}
				}
			}

			// Mark onboarding as complete
			await services.settingsManager.updateSettings('system', {
				onboarding_complete: true
			});

			// Verify the setting was actually written to database
			const verifyStatus = await services.settingsManager.getSystemStatus();
			if (!verifyStatus.onboarding.isComplete) {
				logger.error('ONBOARDING', 'Failed to mark onboarding as complete - verification failed');
				throw new Error('Failed to mark onboarding as complete');
			}

			logger.info('ONBOARDING', 'Onboarding completed successfully');

			// Return the API key to display (shown ONCE)
			return {
				success: true,
				apiKey: {
					id: apiKey.id,
					key: apiKey.key, // Plaintext key - shown ONCE
					label: apiKey.label
				},
				workspace: workspace
					? {
							id: workspace.id,
							name: workspace.name,
							path: workspace.path
						}
					: null
			};
		} catch (err) {
			logger.error('ONBOARDING', `Failed to complete onboarding: ${err.message}`);

			// Provide specific error messages based on error type
			let userMessage = 'Failed to complete onboarding';

			if (err.message?.includes('FOREIGN KEY constraint')) {
				userMessage = 'Database constraint error: Please ensure all required data is valid';
			} else if (err.message?.includes('UNIQUE constraint')) {
				userMessage = 'An account already exists. Please contact support if this persists';
			} else if (err.message?.includes('bcrypt') || err.message?.includes('hash')) {
				userMessage = 'Failed to secure authentication credentials. Please try again';
			} else if (err.message?.includes('SQLITE_') || err.message?.includes('database')) {
				userMessage = 'Database connection error. Please try again later';
			} else if (err.message?.includes('API key')) {
				userMessage = 'Failed to generate API key. Please try again';
			} else if (err.message?.includes('workspace')) {
				userMessage = 'Workspace setup failed. You can create a workspace later';
			} else if (err.message) {
				// Use the error message if it's descriptive enough
				userMessage = err.message;
			}

			return {
				success: false,
				error: userMessage
			};
		}
	}
};
