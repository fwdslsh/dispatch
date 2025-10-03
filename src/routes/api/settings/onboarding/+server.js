/**
 * Onboarding Completion API Endpoint
 * Handles complete onboarding setup in a single atomic operation
 *
 * POST /api/settings/onboarding - Complete onboarding setup (no authentication required)
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * Validate workspace path format and constraints
 */
function isValidWorkspacePath(path) {
	if (!path || typeof path !== 'string') return false;

	// Basic path validation
	if (path.includes('..') || path.includes('~')) return false;
	if (path.length > 500) return false;

	// Must be absolute path
	if (!path.startsWith('/')) return false;

	return true;
}

/**
 * Extract workspace name from path (last directory segment)
 */
function extractWorkspaceName(path) {
	if (!path) return 'Unnamed Workspace';
	const segments = path.split('/').filter(Boolean);
	return segments[segments.length - 1] || 'Root';
}

/**
 * POST /api/settings/onboarding
 * Complete onboarding setup with terminal key, workspace creation, and preferences
 *
 * This is an atomic operation - all steps must succeed or the entire operation fails.
 * No authentication required as this is the initial setup endpoint.
 *
 * Request body:
 * {
 *   terminalKey: string (required, min 8 characters)
 *   workspaceName?: string (optional)
 *   workspacePath?: string (optional, required if workspaceName provided)
 *   preferences?: object (optional settings)
 * }
 */
export async function POST({ request, locals }) {
	const dbManager = locals.services.database;

	try {
		await dbManager.init();

		// Check if onboarding already completed
		const existingOnboarding = await dbManager.getSettingsByCategory('onboarding');
		if (existingOnboarding?.isComplete) {
			logger.warn('ONBOARDING_API', 'Attempt to complete onboarding when already complete');
			return json({ error: 'Onboarding has already been completed' }, { status: 409 });
		}

		const body = await request.json();
		const { terminalKey, workspaceName, workspacePath, preferences } = body;

		// Validate terminal key
		if (!terminalKey || typeof terminalKey !== 'string') {
			return json({ error: 'Terminal key is required' }, { status: 400 });
		}

		if (terminalKey.length < 8) {
			return json({ error: 'Terminal key must be at least 8 characters long' }, { status: 400 });
		}

		// Validate workspace parameters if provided
		if ((workspaceName && !workspacePath) || (!workspaceName && workspacePath)) {
			return json(
				{ error: 'Both workspaceName and workspacePath must be provided together' },
				{ status: 400 }
			);
		}

		if (workspacePath && !isValidWorkspacePath(workspacePath)) {
			return json({ error: 'Invalid workspace path format' }, { status: 400 });
		}

		// Begin atomic operation
		let workspaceId = null;

		try {
			// Step 1: Store terminal key in authentication settings
			await dbManager.setSettingsForCategory(
				'authentication',
				{ terminal_key: terminalKey },
				'Authentication settings configured during onboarding'
			);

			// Update the cached terminal key for immediate use
			if (locals.services.auth && typeof locals.services.auth.updateCachedKey === 'function') {
				locals.services.auth.updateCachedKey(terminalKey);
			}

			logger.info('ONBOARDING_API', 'Terminal key configured successfully');

			// Step 2: Create workspace if provided
			if (workspaceName && workspacePath) {
				// Check if workspace already exists
				const existingWorkspace = await dbManager.get(
					'SELECT path FROM workspaces WHERE path = ?',
					[workspacePath]
				);

				if (existingWorkspace) {
					return json(
						{ error: 'Workspace already exists at this path' },
						{ status: 409 }
					);
				}

				const displayName =
					typeof workspaceName === 'string' && workspaceName.trim()
						? workspaceName.trim()
						: extractWorkspaceName(workspacePath);

				await dbManager.createWorkspace(workspacePath, displayName);
				workspaceId = workspacePath;

				logger.info('ONBOARDING_API', `Created workspace: ${workspacePath}`);
			}

			// Step 3: Save user preferences if provided
			if (preferences && typeof preferences === 'object') {
				// Save preferences by category
				for (const [category, prefs] of Object.entries(preferences)) {
					if (prefs && typeof prefs === 'object') {
						await dbManager.setPreferencesForCategory(
							category,
							prefs,
							`User preferences for ${category} set during onboarding`
						);
					}
				}

				logger.info('ONBOARDING_API', 'User preferences saved');
			}

			// Step 4: Mark onboarding as complete
			const completionTimestamp = new Date().toISOString();
			await dbManager.setSettingsForCategory(
				'onboarding',
				{
					isComplete: true,
					completedAt: completionTimestamp,
					firstWorkspaceId: workspaceId
				},
				'Onboarding completed successfully'
			);

			logger.info('ONBOARDING_API', 'Onboarding completed successfully');

			// Return success response
			return json(
				{
					success: true,
					onboarding: {
						isComplete: true,
						completedAt: completionTimestamp,
						firstWorkspaceId: workspaceId
					},
					workspace: workspaceId
						? {
								id: workspaceId,
								name: workspaceName,
								path: workspacePath
							}
						: null
				},
				{
					status: 201,
					headers: {
						'Cache-Control': 'no-cache, no-store, must-revalidate'
					}
				}
			);
		} catch (operationError) {
			// Rollback: Attempt to clean up partial state
			logger.error(
				'ONBOARDING_API',
				'Onboarding operation failed, attempting rollback:',
				operationError
			);

			try {
				// Remove any settings that may have been created
				await dbManager.run('DELETE FROM settings WHERE category IN (?, ?)', [
					'authentication',
					'onboarding'
				]);

				// Remove workspace if it was created
				if (workspaceId) {
					await dbManager.run('DELETE FROM workspaces WHERE path = ?', [workspaceId]);
				}

				logger.info('ONBOARDING_API', 'Rollback completed successfully');
			} catch (rollbackError) {
				logger.error('ONBOARDING_API', 'Rollback failed:', rollbackError);
			}

			// Return appropriate error
			if (operationError?.code === 'SQLITE_CONSTRAINT') {
				return json({ error: 'Database constraint violation' }, { status: 409 });
			}

			throw operationError;
		}
	} catch (error) {
		logger.error('ONBOARDING_API', 'Failed to complete onboarding:', error);
		return json({ error: 'Failed to complete onboarding setup' }, { status: 500 });
	}
}

/**
 * OPTIONS /api/settings/onboarding
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}
