/**
 * API endpoint for workspace environment variables management
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import {
	UnauthorizedError,
	BadRequestError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

export async function GET({ locals }) {
	try {
		const { settingsRepository } = locals.services;
		const workspaceSettings = await settingsRepository.getByCategory('workspace');

		return json({
			envVariables: workspaceSettings?.envVariables || {}
		});
	} catch (err) {
		handleApiError(err, 'GET /api/settings/workspace');
	}
}

export async function POST({ request, locals }) {
	try {
		// Require authentication
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}
		const { envVariables } = await request.json();

		// Validate the input
		if (!envVariables || typeof envVariables !== 'object') {
			throw new BadRequestError('Invalid environment variables format', 'INVALID_ENV_FORMAT');
		}

		// Validate environment variable names
		for (const [key, value] of Object.entries(envVariables)) {
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
				throw new BadRequestError(
					`Invalid environment variable name: ${key}`,
					'INVALID_ENV_NAME'
				);
			}
			if (typeof value !== 'string') {
				throw new BadRequestError(
					`Environment variable values must be strings: ${key}`,
					'INVALID_ENV_VALUE'
				);
			}
		}

		// Get current workspace settings
		const { settingsRepository } = locals.services;
		const currentSettings = await settingsRepository.getByCategory('workspace');

		// Update environment variables
		const updatedSettings = {
			...currentSettings,
			envVariables
		};

		// Save to database
		await settingsRepository.setByCategory(
			'workspace',
			updatedSettings,
			'Workspace-level environment variables for all sessions'
		);

		return json({
			success: true,
			envVariables
		});
	} catch (err) {
		handleApiError(err, 'POST /api/settings/workspace');
	}
}

export async function DELETE({ locals }) {
	try {
		// Require authentication
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}
		// Get current workspace settings
		const { settingsRepository } = locals.services;
		const currentSettings = await settingsRepository.getByCategory('workspace');

		// Clear environment variables
		const updatedSettings = {
			...currentSettings,
			envVariables: {}
		};

		// Save to database
		await settingsRepository.setByCategory(
			'workspace',
			updatedSettings,
			'Workspace-level environment variables for all sessions'
		);

		return json({
			success: true,
			envVariables: {}
		});
	} catch (err) {
		handleApiError(err, 'DELETE /api/settings/workspace');
	}
}
