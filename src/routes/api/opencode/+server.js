/**
 * OpenCode API Proxy - Status and configuration endpoint
 *
 * Returns OpenCode server connection status and allows configuration updates.
 */

import { handleApiError, BadRequestError } from '$lib/server/shared/utils/api-errors.js';

/**
 * GET /api/opencode - Get OpenCode server status
 */
export async function GET({ locals }) {
	try {
		const { opencodeServerManager } = locals.services;
		const status = opencodeServerManager.getStatus();

		return new Response(JSON.stringify(status), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'GET /api/opencode');
	}
}

/**
 * POST /api/opencode - Control OpenCode server
 * Actions: start, stop, restart, test
 */
export async function POST({ request, locals }) {
	try {
		const { action, hostname, port } = await request.json();
		const { opencodeServerManager } = locals.services;

		switch (action) {
			case 'start': {
				const options = {};
				if (hostname) options.hostname = hostname;
				if (port) options.port = port;
				await opencodeServerManager.start(options);
				return new Response(
					JSON.stringify({ success: true, status: opencodeServerManager.getStatus() }),
					{ headers: { 'content-type': 'application/json' } }
				);
			}

			case 'stop': {
				await opencodeServerManager.stop();
				return new Response(
					JSON.stringify({ success: true, status: opencodeServerManager.getStatus() }),
					{ headers: { 'content-type': 'application/json' } }
				);
			}

			case 'restart': {
				await opencodeServerManager.restart();
				return new Response(
					JSON.stringify({ success: true, status: opencodeServerManager.getStatus() }),
					{ headers: { 'content-type': 'application/json' } }
				);
			}

			case 'test': {
				// Test connection to OpenCode server
				const status = opencodeServerManager.getStatus();
				if (!status.url) {
					return new Response(JSON.stringify({ success: false, error: 'Server not running' }), {
						headers: { 'content-type': 'application/json' }
					});
				}

				try {
					const testUrl = hostname && port ? `http://${hostname}:${port}` : status.url;
					const response = await fetch(`${testUrl}/config`, {
						method: 'GET',
						headers: { Accept: 'application/json' },
						signal: AbortSignal.timeout(5000)
					});

					if (response.ok) {
						const config = await response.json();
						return new Response(JSON.stringify({ success: true, connected: true, config }), {
							headers: { 'content-type': 'application/json' }
						});
					} else {
						return new Response(
							JSON.stringify({
								success: false,
								connected: false,
								error: `HTTP ${response.status}`
							}),
							{ headers: { 'content-type': 'application/json' } }
						);
					}
				} catch (err) {
					return new Response(
						JSON.stringify({ success: false, connected: false, error: err.message }),
						{ headers: { 'content-type': 'application/json' } }
					);
				}
			}

			default:
				throw new BadRequestError(`Invalid action: ${action}`, 'INVALID_ACTION');
		}
	} catch (err) {
		handleApiError(err, 'POST /api/opencode');
	}
}

/**
 * PUT /api/opencode - Update OpenCode server configuration
 */
export async function PUT({ request, locals }) {
	try {
		const { hostname, port, enabled } = await request.json();
		const { opencodeServerManager } = locals.services;

		await opencodeServerManager.updateConfig({ hostname, port, enabled });

		return new Response(
			JSON.stringify({ success: true, status: opencodeServerManager.getStatus() }),
			{ headers: { 'content-type': 'application/json' } }
		);
	} catch (err) {
		handleApiError(err, 'PUT /api/opencode');
	}
}
