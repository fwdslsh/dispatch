/**
 * Session API - transitional implementation for UI compatibility
 * Fixed to provide isActive field for proper UI filtering
 */

import { SESSION_TYPE, isValidSessionType } from '$lib/shared/session-types.js';

/**
 * Get title for session type
 * @param {string} kind Session kind
 * @returns {string} Session title
 */
function getSessionTitle(kind) {
	switch (kind) {
		case SESSION_TYPE.CLAUDE:
			return 'Claude Session';
		case SESSION_TYPE.PTY:
			return 'Terminal Session';
		case SESSION_TYPE.FILE_EDITOR:
			return 'File Editor Session';
		default:
			return `${kind} Session`;
	}
}

export async function GET({ url, locals }) {
	// Require authentication
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
		const sessions = rows.map((row) => {
			const meta = JSON.parse(row.meta_json || '{}');
			return {
				id: row.run_id,
				type: row.kind,
				title: getSessionTitle(row.kind),
				workspacePath: meta.cwd || meta.workspacePath || '',
				isActive: row.status === 'running', // KEY FIX: Add isActive field
				createdAt: row.created_at,
				lastActivity: row.updated_at,
				inLayout: !!row.tile_id, // Fix: Set based on whether tile_id exists
				tileId: row.tile_id, // Fix: Include tileId from database
				pinned: false
			};
		});

		// Filter based on includeAll parameter
		const filteredSessions = includeAll ? sessions : sessions.filter((s) => s.isActive);

		console.log(
			'[API DEBUG] Returning',
			filteredSessions.length,
			'sessions, active:',
			filteredSessions.filter((s) => s.isActive).length
		);

		return new Response(JSON.stringify({ sessions: filteredSessions }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('[API] Failed to list sessions:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}

export async function POST({ request, locals }) {
	// Require authentication
	const { kind, type, cwd, resume = false, sessionId, options = {} } = await request.json();

	const sessionKind = kind ?? type;

	try {
		if (resume && sessionId) {
			try {
				// Actually resume the session (restart the process)
				const resumeResult = await locals.services.runSessionManager.resumeRunSession(sessionId);

				return new Response(
					JSON.stringify({
						runId: resumeResult.runId,
						id: resumeResult.runId,
						success: true,
						resumed: resumeResult.resumed,
						kind: resumeResult.kind,
						type: resumeResult.kind,
						reason: resumeResult.reason
					}),
					{
						headers: { 'content-type': 'application/json' }
					}
				);
			} catch (error) {
				return new Response(JSON.stringify({ error: error.message }), { status: 404 });
			}
		}

		if (!isValidSessionType(sessionKind)) {
			return new Response(
				JSON.stringify({
					error: `Invalid or missing kind. Must be one of: ${Object.values(SESSION_TYPE).join(', ')}`
				}),
				{ status: 400 }
			);
		}

		// Get default workspace directory from settings
		let defaultWorkspaceDir = null;
		let workspaceEnvVariables = {};
		try {
			const globalSettings = await locals.services.database.settings.getCategorySettings('global');
			defaultWorkspaceDir = globalSettings?.defaultWorkspaceDirectory || null;

			// Load workspace environment variables
			const workspaceSettings =
				await locals.services.database.settings.getCategorySettings('workspace');
			workspaceEnvVariables = workspaceSettings?.envVariables || {};
		} catch (error) {
			console.warn('[Sessions API] Failed to load workspace settings:', error);
		}

		// Determine the working directory with user preference override
		const configService = locals.services.configService;
		const configWorkspaceRoot = configService?.get('workspacesRoot');
		const envHome = configService?.getEnv()?.HOME || process.env.HOME;
		const workingDirectory = cwd || defaultWorkspaceDir || configWorkspaceRoot || envHome;

		// Create run session using unified manager with workspace environment variables
		const { runId } = await locals.services.runSessionManager.createRunSession({
			kind: sessionKind,
			meta: {
				cwd: workingDirectory,
				options: {
					...options,
					workspaceEnv: workspaceEnvVariables
				}
			}
		});

		return new Response(
			JSON.stringify({
				runId,
				success: true,
				kind: sessionKind,
				type: sessionKind
			}),
			{
				headers: { 'content-type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('[API] Run session creation failed:', error);

		// Provide more specific error messages for common issues
		let errorMessage = error.message;
		let statusCode = 500;

		if (error.message?.includes('node-pty')) {
			errorMessage = `${SESSION_TYPE.PTY} functionality is temporarily unavailable. Please try again in a moment.`;
			statusCode = 503;
		} else if (error.message?.includes('claude-code')) {
			errorMessage = `${SESSION_TYPE.CLAUDE} functionality is temporarily unavailable. Please try again in a moment.`;
			statusCode = 503;
		} else if (error.message?.includes('No adapter')) {
			errorMessage = `Session type "${sessionKind || 'unknown'}" is not supported`;
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
	const { action, runId, runSessionId, clientId, tileId } = await request.json();
	const resolvedRunSessionId = runSessionId || runId;

	if (action === 'setLayout') {
		if (!resolvedRunSessionId || !clientId || !tileId) {
			return new Response(
				JSON.stringify({
					error: 'Missing required parameters: runSessionId/runId, clientId, tileId'
				}),
				{ status: 400 }
			);
		}

		try {
			// Update or create layout for this client
			await locals.services.database.setWorkspaceLayout(resolvedRunSessionId, clientId, tileId);
			return new Response(JSON.stringify({ success: true }));
		} catch (error) {
			console.error('[API] Layout update failed:', error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}

	if (action === 'removeLayout') {
		if (!resolvedRunSessionId || !clientId) {
			return new Response(
				JSON.stringify({
					error: 'Missing required parameters: runSessionId/runId, clientId'
				}),
				{ status: 400 }
			);
		}

		try {
			await locals.services.database.removeWorkspaceLayout(resolvedRunSessionId, clientId);
			return new Response(JSON.stringify({ success: true }));
		} catch (error) {
			console.error('[API] Layout removal failed:', error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}

	if (action === 'getLayout') {
		if (!clientId) {
			return new Response(
				JSON.stringify({
					error: 'Missing required parameter: clientId'
				}),
				{ status: 400 }
			);
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
