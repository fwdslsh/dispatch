/**
 * OpenCode Providers API Proxy
 *
 * Lists available AI providers and models
 */

import { handleApiError, ServiceUnavailableError } from '$lib/server/shared/utils/api-errors.js';

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
 * GET /api/opencode/providers - List available providers
 */
export async function GET({ url, locals }) {
	try {
		const baseUrl = getOpenCodeUrl(locals);
		const directory = url.searchParams.get('directory') || undefined;

		const queryParams = new URLSearchParams();
		if (directory) queryParams.set('directory', directory);

		const response = await fetch(`${baseUrl}/provider?${queryParams}`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenCode API error: ${response.status} - ${error}`);
		}

		const providers = await response.json();

		return new Response(JSON.stringify({ providers }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'GET /api/opencode/providers');
	}
}
