/**
 * OpenCode Server Management API
 * Provides endpoints for controlling the OpenCode server
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import {
	UnauthorizedError,
	BadRequestError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

/**
 * GET /api/opencode/server
 * Get OpenCode server status
 */
export async function GET({ locals }) {
	try {
		// Auth must be handled in hooks only
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}

		const { opencodeServerManager } = locals.services;

		const status = opencodeServerManager.getStatus();

		return json({
			success: true,
			...status
		});
	} catch (err) {
		handleApiError(err, 'GET /api/opencode/server');
	}
}

/**
 * POST /api/opencode/server/start
 * Start the OpenCode server
 */
export async function POST({ request, locals }) {
	try {
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}

		const { opencodeServerManager } = locals.services;

		// Parse request body for optional configuration
		const body = await request.json().catch(() => ({}));
		const { hostname, port } = body;

		logger.info('OPENCODE_API', 'Starting OpenCode server', { hostname, port });

		await opencodeServerManager.start({ hostname, port });

		const status = opencodeServerManager.getStatus();

		return json({
			success: true,
			message: 'OpenCode server started successfully',
			...status
		});
	} catch (err) {
		handleApiError(err, 'POST /api/opencode/server/start');
	}
}

/**
 * DELETE /api/opencode/server/stop
 * Stop the OpenCode server
 */
export async function DELETE({ locals }) {
	try {
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}

		const { opencodeServerManager } = locals.services;

		logger.info('OPENCODE_API', 'Stopping OpenCode server');

		await opencodeServerManager.stop();

		return json({
			success: true,
			message: 'OpenCode server stopped successfully',
			...opencodeServerManager.getStatus()
		});
	} catch (err) {
		handleApiError(err, 'DELETE /api/opencode/server/stop');
	}
}

/**
 * PUT /api/opencode/server/config
 * Update OpenCode server configuration
 */
export async function PUT({ request, locals }) {
	try {
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}

		const { opencodeServerManager } = locals.services;

		const body = await request.json();

		if (!body.hostname && !body.port) {
			throw new BadRequestError(
				'At least one of hostname or port must be provided',
				'INVALID_CONFIG'
			);
		}

		logger.info('OPENCODE_API', 'Updating OpenCode server config', body);

		await opencodeServerManager.updateConfig(body);

		return json({
			success: true,
			message: 'Configuration updated successfully',
			...opencodeServerManager.getStatus()
		});
	} catch (err) {
		handleApiError(err, 'PUT /api/opencode/server/config');
	}
}

/**
 * OPTIONS /api/opencode/server
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
}
