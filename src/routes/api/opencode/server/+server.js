/**
 * OpenCode Server API
 * Control the OpenCode server process (start, stop, status, configuration)
 */

import { json } from '@sveltejs/kit';
import { handleApiError, BadRequestError } from '$lib/server/shared/utils/api-errors.js';

/**
 * GET /api/opencode/server - Get server status
 */
export async function GET({ locals }) {
	try {
		const status = locals.services.opencodeServerManager.getStatus();
		return json(status);
	} catch (err) {
		handleApiError(err, 'GET /api/opencode/server');
	}
}

/**
 * POST /api/opencode/server - Control server (start/stop/restart)
 */
export async function POST({ request, locals }) {
	try {
		const { action, hostname, port } = await request.json();

		const manager = locals.services.opencodeServerManager;

		switch (action) {
			case 'start': {
				const options = {};
				if (hostname) options.hostname = hostname;
				if (port) options.port = parseInt(port, 10);

				await manager.start(options);
				return json({ success: true, status: manager.getStatus() });
			}

			case 'stop': {
				await manager.stop();
				return json({ success: true, status: manager.getStatus() });
			}

			case 'restart': {
				await manager.restart();
				return json({ success: true, status: manager.getStatus() });
			}

			default:
				throw new BadRequestError(`Invalid action: ${action}. Must be 'start', 'stop', or 'restart'`);
		}
	} catch (err) {
		handleApiError(err, 'POST /api/opencode/server');
	}
}

/**
 * PUT /api/opencode/server - Update server configuration
 */
export async function PUT({ request, locals }) {
	try {
		const { hostname, port, enabled } = await request.json();

		const config = {};
		if (hostname !== undefined) config.hostname = hostname;
		if (port !== undefined) config.port = parseInt(port, 10);
		if (enabled !== undefined) config.enabled = enabled;

		await locals.services.opencodeServerManager.updateConfig(config);

		return json({
			success: true,
			status: locals.services.opencodeServerManager.getStatus()
		});
	} catch (err) {
		handleApiError(err, 'PUT /api/opencode/server');
	}
}
