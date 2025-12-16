/**
 * OpenCode Events API Proxy
 *
 * Provides Server-Sent Events (SSE) stream from OpenCode
 */

import { ServiceUnavailableError } from '$lib/server/shared/utils/api-errors.js';

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
 * GET /api/opencode/events - SSE stream of OpenCode events
 *
 * Proxies the OpenCode event stream to clients
 */
export async function GET({ url, locals }) {
	const baseUrl = getOpenCodeUrl(locals);
	const directory = url.searchParams.get('directory') || undefined;

	const queryParams = new URLSearchParams();
	if (directory) queryParams.set('directory', directory);

	// Create a readable stream that proxies the OpenCode event stream
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			try {
				const response = await fetch(`${baseUrl}/event?${queryParams}`, {
					method: 'GET',
					headers: { Accept: 'text/event-stream' }
				});

				if (!response.ok) {
					const error = `OpenCode events unavailable: ${response.status}`;
					controller.enqueue(
						encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`)
					);
					controller.close();
					return;
				}

				const reader = response.body?.getReader();
				if (!reader) {
					controller.enqueue(
						encoder.encode(
							`event: error\ndata: ${JSON.stringify({ error: 'No response body' })}\n\n`
						)
					);
					controller.close();
					return;
				}

				// Forward events from OpenCode
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					controller.enqueue(value);
				}

				controller.close();
			} catch (err) {
				const error = err.message || 'Unknown error';
				controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`));
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
}
