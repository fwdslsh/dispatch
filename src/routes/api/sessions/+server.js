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

export async function GET({ url, request: _request, locals }) {
	// Require authentication
	try {
		console.log('[API DEBUG] Sessions GET request');

		// Query sessions - no layout JOIN needed
		const query = `
			SELECT run_id, kind, status, created_at, updated_at, meta_json
			FROM sessions
			ORDER BY created_at DESC
		`;

		const rows = await locals.services.database.all(query);
		console.log('[API DEBUG] Found', rows.length, 'sessions in database');

		// Transform to UI-compatible format
		// Sessions are self-contained - they don't need workspace coupling
		const sessions = rows.map((row) => {
			const meta = JSON.parse(row.meta_json || '{}');
			return {
				id: row.run_id,
				type: row.kind,
				title: getSessionTitle(row.kind),
				cwd: meta.cwd || '',
				isActive: row.status === 'running',
				createdAt: row.created_at,
				lastActivity: row.updated_at
			};
		});

		console.log(
			'[API DEBUG] Returning',
			sessions.length,
			'sessions, active:',
			sessions.filter((s) => s.isActive).length
		);

		return new Response(JSON.stringify({ sessions }), {
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
				const resumeResult = await locals.services.sessionOrchestrator.resumeSession(sessionId);

				return new Response(
					JSON.stringify({
						runId: resumeResult.sessionId,
						id: resumeResult.sessionId,
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

		// Get default working directory from settings
		let defaultCwd = null;
		let workspaceEnvVariables = {};
		try {
			const { settingsRepository } = locals.services;
			const globalSettings = await settingsRepository.getByCategory('global');
			defaultCwd = globalSettings?.defaultWorkspaceDirectory || null;

			// Load workspace environment variables
			const workspaceSettings = await settingsRepository.getByCategory('workspace');
			workspaceEnvVariables = workspaceSettings?.envVariables || {};
		} catch (error) {
			console.warn('[Sessions API] Failed to load settings:', error);
		}

		// Determine the working directory - where the session will run
		const workingDirectory = cwd || defaultCwd || process.env.WORKSPACES_ROOT || process.env.HOME;

		// Create session using SessionOrchestrator
		// Sessions are self-contained - they just need a cwd (current working directory)
		const session = await locals.services.sessionOrchestrator.createSession(sessionKind, {
			metadata: {
				cwd: workingDirectory,
				options: {
					...options,
					workspaceEnv: workspaceEnvVariables
				}
			}
		});

		return new Response(
			JSON.stringify({
				runId: session.id,
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
		// Close session using SessionOrchestrator
		await locals.services.sessionOrchestrator.closeSession(runId);

		return new Response(JSON.stringify({ success: true }));
	} catch (error) {
		console.error('[API] Run session deletion failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}
