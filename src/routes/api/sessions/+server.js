/**
 * Session API - transitional implementation for UI compatibility
 * Fixed to provide isActive field for proper UI filtering
 */

import { SESSION_TYPE, isValidSessionType } from '$lib/shared/session-types.js';
import {
	BadRequestError,
	NotFoundError,
	ServiceUnavailableError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

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
	} catch (err) {
		handleApiError(err, 'GET /api/sessions');
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
				throw new NotFoundError(`Session not found: ${sessionId}`);
			}
		}

		if (!isValidSessionType(sessionKind)) {
			throw new BadRequestError(
				`Invalid or missing kind. Must be one of: ${Object.values(SESSION_TYPE).join(', ')}`,
				'INVALID_SESSION_TYPE'
			);
		}

		// Get default workspace directory from settings
		let defaultWorkspaceDir = null;
		let workspaceEnvVariables = {};
		try {
			const { settingsRepository } = locals.services;
			const globalSettings = await settingsRepository.getByCategory('global');
			defaultWorkspaceDir = globalSettings?.defaultWorkspaceDirectory || null;

			// Load workspace environment variables
			const workspaceSettings = await settingsRepository.getByCategory('workspace');
			workspaceEnvVariables = workspaceSettings?.envVariables || {};
		} catch (error) {
			console.warn('[Sessions API] Failed to load workspace settings:', error);
		}

		// Determine the working directory with user preference override
		const workingDirectory =
			cwd || defaultWorkspaceDir || process.env.WORKSPACES_ROOT || process.env.HOME;

		// Create session using SessionOrchestrator with workspace environment variables
		const session = await locals.services.sessionOrchestrator.createSession(sessionKind, {
			workspacePath: workingDirectory,
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
	} catch (err) {
		// Map specific error types to appropriate HTTP errors
		if (err.message?.includes('node-pty')) {
			throw new ServiceUnavailableError(
				`${SESSION_TYPE.PTY} functionality is temporarily unavailable. Please try again in a moment.`,
				'PTY_UNAVAILABLE'
			);
		} else if (err.message?.includes('claude-code')) {
			throw new ServiceUnavailableError(
				`${SESSION_TYPE.CLAUDE} functionality is temporarily unavailable. Please try again in a moment.`,
				'CLAUDE_UNAVAILABLE'
			);
		} else if (err.message?.includes('No adapter')) {
			throw new BadRequestError(
				`Session type "${sessionKind || 'unknown'}" is not supported`,
				'UNSUPPORTED_SESSION_TYPE'
			);
		}

		// Handle all errors including the ones we just threw
		handleApiError(err, 'POST /api/sessions');
	}
}

export async function DELETE({ url, locals }) {
	try {
		const runId = url.searchParams.get('runId');

		if (!runId) {
			throw new BadRequestError('Missing runId parameter', 'MISSING_RUN_ID');
		}

		// Close session using SessionOrchestrator
		await locals.services.sessionOrchestrator.closeSession(runId);

		return new Response(JSON.stringify({ success: true }));
	} catch (err) {
		handleApiError(err, 'DELETE /api/sessions');
	}
}

// Layout management API for client-specific layouts
export async function PUT({ request, locals }) {
	const { action, runId, clientId, tileId } = await request.json();

	try {
		if (action === 'setLayout') {
			if (!runId || !clientId || !tileId) {
				throw new BadRequestError(
					'Missing required parameters: runId, clientId, tileId',
					'MISSING_LAYOUT_PARAMS'
				);
			}

			// Update or create layout for this client
			await locals.services.workspaceRepository.setWorkspaceLayout(runId, clientId, tileId);
			return new Response(JSON.stringify({ success: true }));
		}

		if (action === 'removeLayout') {
			if (!runId || !clientId) {
				throw new BadRequestError(
					'Missing required parameters: runId, clientId',
					'MISSING_LAYOUT_PARAMS'
				);
			}

			await locals.services.workspaceRepository.removeWorkspaceLayout(runId, clientId);
			return new Response(JSON.stringify({ success: true }));
		}

		if (action === 'getLayout') {
			if (!clientId) {
				throw new BadRequestError('Missing required parameter: clientId', 'MISSING_CLIENT_ID');
			}

			const layout = await locals.services.workspaceRepository.getWorkspaceLayout(clientId);
			return new Response(JSON.stringify({ layout }));
		}

		throw new BadRequestError(`Invalid action: ${action}`, 'INVALID_ACTION');
	} catch (err) {
		handleApiError(err, 'PUT /api/sessions');
	}
}
