/**
 * OpenCode Sessions API Proxy
 *
 * Proxies session requests to OpenCode server for Portal-style UX.
 * This replaces direct session management with OpenCode's session system.
 */

import {
	handleApiError,
	BadRequestError,
	ServiceUnavailableError
} from '$lib/server/shared/utils/api-errors.js';

/**
 * Get OpenCode server URL from manager
 * @param {Object} locals
 * @returns {string}
 */
function getOpenCodeUrl(locals) {
	const status = locals.services.opencodeServerManager.getStatus();
	if (!status.url) {
		throw new ServiceUnavailableError('OpenCode server is not running', 'OPENCODE_UNAVAILABLE');
	}
	return status.url;
}

/**
 * GET /api/opencode/sessions - List all OpenCode sessions
 */
export async function GET({ url, locals }) {
	try {
		const baseUrl = getOpenCodeUrl(locals);
		const directory = url.searchParams.get('directory') || undefined;

		const params = new URLSearchParams();
		if (directory) params.set('directory', directory);

		const response = await fetch(`${baseUrl}/session?${params}`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenCode API error: ${response.status} - ${error}`);
		}

		const sessions = await response.json();

		return new Response(JSON.stringify({ sessions }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'GET /api/opencode/sessions');
	}
}

/**
 * POST /api/opencode/sessions - Create a new OpenCode session
 */
export async function POST({ request, locals }) {
	try {
		const baseUrl = getOpenCodeUrl(locals);
		const body = await request.json();

		const { projectPath, model, provider, directory } = body;

		const params = new URLSearchParams();
		if (directory) params.set('directory', directory);

		const response = await fetch(`${baseUrl}/session?${params}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				projectPath,
				model,
				provider
			}),
			signal: AbortSignal.timeout(30000)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenCode API error: ${response.status} - ${error}`);
		}

		const session = await response.json();

		return new Response(JSON.stringify({ success: true, session }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'POST /api/opencode/sessions');
	}
}
