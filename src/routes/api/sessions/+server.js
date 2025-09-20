/**
 * Session API - transitional implementation for UI compatibility
 * Fixed to provide isActive field for proper UI filtering
 */

import { normalizeSessionKind } from '$lib/shared/session-kind.js';

export async function GET({ url, locals }) {
	const includeAll = url.searchParams.get('include') === 'all';

	try {
		console.log('[API DEBUG] Sessions GET request, includeAll:', includeAll);

		// Query sessions with layout information joined
		const query = `
			SELECT s.run_id, s.kind, s.status, s.created_at, s.updated_at, s.meta_json,
			       wl.tile_id, wl.client_id
			FROM sessions s
			LEFT JOIN workspace_layout wl ON s.run_id = wl.run_id
			ORDER BY s.created_at DESC
		`;

		const rows = await locals.services.database.all(query);
		console.log('[API DEBUG] Found', rows.length, 'sessions in database');

		// Transform to UI-compatible format with isActive field and tile information
		const sessions = rows.map(row => {
			const meta = JSON.parse(row.meta_json || '{}');
			return {
				id: row.run_id,
				type: row.kind,
				title: `${row.kind === 'pty' ? 'Terminal' : row.kind === 'claude' ? 'Claude' : row.kind === 'file-editor' ? 'File Editor' : row.kind} Session`,
				workspacePath: meta.cwd || meta.workspacePath || '',
				isActive: row.status === 'running',  // KEY FIX: Add isActive field
				createdAt: row.created_at,
				lastActivity: row.updated_at,
				inLayout: !!row.tile_id,  // Fix: Set based on whether tile_id exists
				tileId: row.tile_id,      // Fix: Include tileId from database
				pinned: false
			};
		});

		// Filter based on includeAll parameter
		const filteredSessions = includeAll ? sessions : sessions.filter(s => s.isActive);

		console.log('[API DEBUG] Returning', filteredSessions.length, 'sessions, active:', filteredSessions.filter(s => s.isActive).length);

		return new Response(JSON.stringify({ sessions: filteredSessions }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('[API] Failed to list sessions:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}

export async function POST({ request, locals }) {
	const { kind, type, cwd, resume = false, sessionId, options = {} } = await request.json();

	const rawKind = kind ?? type;
	const normalizedKind = normalizeSessionKind(rawKind);

	try {
		if (resume && sessionId) {
			try {
				// Actually resume the session (restart the process)
				const resumeResult = await locals.services.runSessionManager.resumeRunSession(sessionId);

				return new Response(JSON.stringify({
					runId: resumeResult.runId,
					id: resumeResult.runId,
					success: true,
					resumed: resumeResult.resumed,
					kind: resumeResult.kind,
					type: resumeResult.kind,
					reason: resumeResult.reason
				}), {
					headers: { 'content-type': 'application/json' }
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: error.message }), { status: 404 });
			}
		}

		if (!normalizedKind) {
			return new Response(JSON.stringify({
				error: 'Invalid or missing kind. Must be "pty", "claude", or "file-editor"'
			}), { status: 400 });
		}

		// Create run session using unified manager
		const { runId } = await locals.services.runSessionManager.createRunSession({
			kind: normalizedKind,
			meta: {
				cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
				options
			}
		});

		return new Response(JSON.stringify({
			runId,
			success: true,
			kind: normalizedKind,
			type: normalizedKind
		}), {
			headers: { 'content-type': 'application/json' }
		});

	} catch (error) {
		console.error('[API] Run session creation failed:', error);

		// Provide more specific error messages for common issues
		let errorMessage = error.message;
		let statusCode = 500;

		if (error.message?.includes('node-pty')) {
			errorMessage = 'Terminal functionality is temporarily unavailable. Please try again in a moment.';
			statusCode = 503;
		} else if (error.message?.includes('claude-code')) {
			errorMessage = 'Claude Code functionality is temporarily unavailable. Please try again in a moment.';
			statusCode = 503;
		} else if (error.message?.includes('No adapter')) {
			const errorKind = normalizeSessionKind(kind) || normalizeSessionKind(type) || rawKind;
			errorMessage = `Session type "${errorKind || 'unknown'}" is not supported`;
			statusCode = 400;
		}

		return new Response(JSON.stringify({ error: errorMessage }), { status: statusCode });
	}
}

export async function DELETE({ url, locals }) {
	const runId = url.searchParams.get('runId');

	if (!runId) {
		return new Response(JSON.stringify({ error: 'Missing runId parameter' }), { status: 400 });
	}

	try {
		// Close run session using unified manager
		await locals.services.runSessionManager.closeRunSession(runId);

		return new Response(JSON.stringify({ success: true }));
	} catch (error) {
		console.error('[API] Run session deletion failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}

// Layout management API for client-specific layouts
export async function PUT({ request, locals }) {
	const { action, runId, clientId, tileId } = await request.json();

	if (action === 'setLayout') {
		if (!runId || !clientId || !tileId) {
			return new Response(JSON.stringify({
				error: 'Missing required parameters: runId, clientId, tileId'
			}), { status: 400 });
		}

		try {
			// Update or create layout for this client
			await locals.services.database.setWorkspaceLayout(runId, clientId, tileId);
			return new Response(JSON.stringify({ success: true }));
		} catch (error) {
			console.error('[API] Layout update failed:', error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}

	if (action === 'removeLayout') {
		if (!runId || !clientId) {
			return new Response(JSON.stringify({
				error: 'Missing required parameters: runId, clientId'
			}), { status: 400 });
		}

		try {
			await locals.services.database.removeWorkspaceLayout(runId, clientId);
			return new Response(JSON.stringify({ success: true }));
		} catch (error) {
			console.error('[API] Layout removal failed:', error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}

	if (action === 'getLayout') {
		if (!clientId) {
			return new Response(JSON.stringify({
				error: 'Missing required parameter: clientId'
			}), { status: 400 });
		}

		try {
			const layout = await locals.services.database.getWorkspaceLayout(clientId);
			return new Response(JSON.stringify({ layout }));
		} catch (error) {
			console.error('[API] Layout retrieval failed:', error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}

	return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
}
