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
		const preferences = formData.get('preferences');

		try {
			logger.info('ONBOARDING', 'Starting onboarding process');

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

			// Create workspace if provided
			let workspace = null;
			if (workspaceName && workspacePath) {
				try {
					workspace = await services.workspaceManager.createWorkspace({
						name: workspaceName,
						path: workspacePath
					});
					logger.info('ONBOARDING', `Workspace created: ${workspace.name}`);
				} catch (err) {
					logger.warn('ONBOARDING', `Failed to create workspace: ${err.message}`);
					// Don't fail onboarding if workspace creation fails
				}
			}

			// Save preferences if provided
			if (preferences) {
				try {
					const prefs = JSON.parse(preferences);
					await services.settingsManager.updateSettings('general', prefs);
					logger.info('ONBOARDING', 'Preferences saved');
				} catch (err) {
					logger.warn('ONBOARDING', `Failed to save preferences: ${err.message}`);
					// Don't fail onboarding if preference save fails
				}
			}

			// Mark onboarding as complete
			await services.settingsManager.updateSettings('system', {
				onboarding_complete: true
			});

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
			return {
				success: false,
				error: err.message || 'Failed to complete onboarding'
			};
		}
	}
};
