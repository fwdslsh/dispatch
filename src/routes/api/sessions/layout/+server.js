/**
 * Session Layout API
 * Manages session-to-tile mappings for persistent window layouts
 */

export async function GET({ locals }) {
	try {
		const layout = await locals.services.database.getCurrentLayout();
		return new Response(JSON.stringify({ layout }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('[API] Layout fetch failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}

export async function POST({ request, locals }) {
	try {
		const { sessionId, tileId, position = 0 } = await request.json();

		if (!sessionId || !tileId) {
			return new Response('Missing sessionId or tileId', { status: 400 });
		}

		await locals.services.database.setSessionLayout(sessionId, tileId, position);
		return new Response(JSON.stringify({ success: true }));
	} catch (error) {
		console.error('[API] Layout update failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}

export async function DELETE({ url, locals }) {
	try {
		const sessionId = url.searchParams.get('sessionId');
		const tileId = url.searchParams.get('tileId');

		if (sessionId) {
			// Remove specific session from layout
			await locals.services.database.removeSessionLayout(sessionId);
		} else if (tileId) {
			// Remove all sessions from specific tile
			const sessions = await locals.services.database.getSessionsForTile(tileId);
			for (const session of sessions) {
				await locals.services.database.removeSessionLayout(session.id);
			}
		} else {
			return new Response('Missing sessionId or tileId', { status: 400 });
		}

		return new Response(JSON.stringify({ success: true }));
	} catch (error) {
		console.error('[API] Layout removal failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}