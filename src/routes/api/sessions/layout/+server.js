/**
 * Session Layout API
 * Manages session-to-tile mappings for persistent window layouts
 */

export async function GET({ url, request: _request, locals }) {
	// Require authentication
	try {
		const clientId = url.searchParams.get('clientId') || 'default';
		const layout = await locals.services.workspaceRepository.getWorkspaceLayout(clientId);
		return new Response(JSON.stringify({ layout }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('[API] Layout fetch failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}

export async function POST({ request, locals }) {
	// Require authentication
	try {
		const { runId, sessionId, tileId, clientId = 'default' } = await request.json();

		// Accept both runId and sessionId for backward compatibility
		const actualRunId = runId || sessionId;

		if (!actualRunId || !tileId) {
			return new Response(
				JSON.stringify({
					error: 'Missing required parameters: runId, tileId'
				}),
				{ status: 400 }
			);
		}

		await locals.services.workspaceRepository.setWorkspaceLayout(actualRunId, clientId, tileId);
		return new Response(JSON.stringify({ success: true }));
	} catch (error) {
		console.error('[API] Layout update failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}

export async function DELETE({ url, request: _request, locals }) {
	// Require authentication
	try {
		const runId = url.searchParams.get('runId');
		const sessionId = url.searchParams.get('sessionId');
		const _tileId = url.searchParams.get('tileId');

		// Accept both runId and sessionId for backward compatibility
		const actualRunId = runId || sessionId;
		const clientId = url.searchParams.get('clientId') || 'default';

		if (actualRunId) {
			// Remove specific session from layout
			await locals.services.workspaceRepository.removeWorkspaceLayout(actualRunId, clientId);
		} else {
			return new Response(
				JSON.stringify({
					error: 'Missing runId parameter'
				}),
				{ status: 400 }
			);
		}

		return new Response(JSON.stringify({ success: true }));
	} catch (error) {
		console.error('[API] Layout removal failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}
