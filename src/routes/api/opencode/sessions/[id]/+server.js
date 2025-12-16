/**
 * OpenCode Session Detail API Proxy
 *
 * Handles individual session operations: get, update, delete
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
 * GET /api/opencode/sessions/[id] - Get session details
 */
export async function GET({ params, url, locals }) {
	try {
		const baseUrl = getOpenCodeUrl(locals);
		const { id } = params;
		const directory = url.searchParams.get('directory') || undefined;

		const queryParams = new URLSearchParams();
		if (directory) queryParams.set('directory', directory);

		const response = await fetch(`${baseUrl}/session/${id}?${queryParams}`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenCode API error: ${response.status} - ${error}`);
		}

		const session = await response.json();

		return new Response(JSON.stringify({ session }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'GET /api/opencode/sessions/[id]');
	}
}

/**
 * PUT /api/opencode/sessions/[id] - Update session
 */
export async function PUT({ params, request, url, locals }) {
	try {
		const baseUrl = getOpenCodeUrl(locals);
		const { id } = params;
		const body = await request.json();
		const directory = url.searchParams.get('directory') || undefined;

		const queryParams = new URLSearchParams();
		if (directory) queryParams.set('directory', directory);

		const response = await fetch(`${baseUrl}/session/${id}?${queryParams}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(10000)
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
		handleApiError(err, 'PUT /api/opencode/sessions/[id]');
	}
}

/**
 * DELETE /api/opencode/sessions/[id] - Delete session
 */
export async function DELETE({ params, url, locals }) {
	try {
		const baseUrl = getOpenCodeUrl(locals);
		const { id } = params;
		const directory = url.searchParams.get('directory') || undefined;

		const queryParams = new URLSearchParams();
		if (directory) queryParams.set('directory', directory);

		const response = await fetch(`${baseUrl}/session/${id}?${queryParams}`, {
			method: 'DELETE',
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenCode API error: ${response.status} - ${error}`);
		}

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'DELETE /api/opencode/sessions/[id]');
	}
}
