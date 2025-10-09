/**
 * Onboarding Completion API Endpoint
 * Handles complete onboarding setup in a single atomic operation
 *
 * POST /api/settings/onboarding - Complete onboarding setup (no authentication required)
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { CookieService } from '$lib/server/auth/CookieService.server.js';

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
export async function POST({ request, cookies, locals }) {
	const { settingsRepository, workspaceRepository, apiKeyManager, sessionManager } =
		locals.services;

	try {
		// Check if onboarding already completed
		const existingOnboarding = await settingsRepository.getByCategory('onboarding');
		if (existingOnboarding?.isComplete) {
			logger.warn('ONBOARDING_API', 'Attempt to complete onboarding when already complete');
			return json({ error: 'Onboarding has already been completed' }, { status: 409 });
		}

		const body = await request.json();
		const { workspaceName, workspacePath, preferences } = body;

		// Note: No terminalKey validation - we generate an API key instead

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
		let apiKeyResult = null;

		try {
			// Step 1: Ensure default user exists in auth_users table
			const userId = 'default';
			const database = locals.services.database;
			const existingUser = await database.get(
				'SELECT user_id FROM auth_users WHERE user_id = ?',
				[userId]
			);

			if (!existingUser) {
				await database.run(
					'INSERT INTO auth_users (user_id, created_at) VALUES (?, ?)',
					[userId, Date.now()]
				);
				logger.info('ONBOARDING_API', `Created default user: ${userId}`);
			}

			// Step 2: Generate first API key for the default user
			apiKeyResult = await apiKeyManager.generateKey('default', 'First API Key');
			logger.info('ONBOARDING_API', `Generated first API key: ${apiKeyResult.id}`);

			// Step 3: Create workspace if provided
			if (workspaceName && workspacePath) {
				// Check if workspace already exists
				const existingWorkspace = await workspaceRepository.findById(workspacePath);

				if (existingWorkspace) {
					return json({ error: 'Workspace already exists at this path' }, { status: 409 });
				}

				const displayName =
					typeof workspaceName === 'string' && workspaceName.trim()
						? workspaceName.trim()
						: extractWorkspaceName(workspacePath);

				await workspaceRepository.create({
					path: workspacePath,
					name: displayName
				});
				workspaceId = workspacePath;

				logger.info('ONBOARDING_API', `Created workspace: ${workspacePath}`);
			}

			// Step 4: Save user preferences if provided
			if (preferences && typeof preferences === 'object') {
				// Save preferences by category
				for (const [category, prefs] of Object.entries(preferences)) {
					if (prefs && typeof prefs === 'object') {
						await settingsRepository.setByCategory(
							category,
							prefs,
							`User preferences for ${category} set during onboarding`
						);
					}
				}

				logger.info('ONBOARDING_API', 'User preferences saved');
			}

			// Step 5: Create session with the new API key
			const session = await sessionManager.createSession('default', 'api_key', {
				apiKeyId: apiKeyResult.id,
				label: apiKeyResult.label
			});

			// Set session cookie
			CookieService.setSessionCookie(cookies, session.sessionId);

			// Step 6: Mark onboarding as complete
			const completionTimestamp = new Date().toISOString();
			await settingsRepository.setByCategory(
				'onboarding',
				{
					isComplete: true,
					completedAt: completionTimestamp,
					firstWorkspaceId: workspaceId,
					firstApiKeyId: apiKeyResult.id
				},
				'Onboarding completed successfully'
			);

			logger.info('ONBOARDING_API', 'Onboarding completed successfully');

			// Return success response with API key (shown ONCE)
			return json(
				{
					success: true,
					onboarding: {
						isComplete: true,
						completedAt: completionTimestamp,
						firstWorkspaceId: workspaceId
					},
					apiKey: {
						id: apiKeyResult.id,
						key: apiKeyResult.key,
						label: apiKeyResult.label,
						warning: 'Save this key - it will not be shown again'
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
				await settingsRepository.deleteCategory('authentication');
				await settingsRepository.deleteCategory('onboarding');

				// Remove workspace if it was created
				if (workspaceId) {
					await workspaceRepository.delete(workspaceId);
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
