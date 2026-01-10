/**
 * Session API - OpenCode-first architecture
 *
 * v3.0 Architecture:
 * - AI sessions: Persisted to DB, returned from database
 * - Terminal/File windows: Ephemeral (in-memory), returned from SessionOrchestrator
 *
 * "Sessions" = AI sessions (persisted)
 * "Windows" = Terminal and File Editor (ephemeral)
 */

import {
	SESSION_TYPE,
	isValidSessionType,
	isEphemeralSessionType
} from '$lib/shared/session-types.js';
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
		case SESSION_TYPE.AI:
			return 'AI Session';
		case SESSION_TYPE.TERMINAL:
			return 'Terminal';
		case SESSION_TYPE.FILE_EDITOR:
			return 'File Editor';
		default:
			return `${kind} Session`;
	}
}

export async function GET({ url, request: _request, locals }) {
	const includeAll = url.searchParams.get('include') === 'all';
	const includeEphemeral = url.searchParams.get('ephemeral') !== 'false';

	try {
		// Get persistent sessions from database (AI sessions only now)
		const query = `
			SELECT s.run_id, s.kind, s.status, s.created_at, s.updated_at, s.meta_json,
			       wl.tile_id, wl.client_id
			FROM sessions s
			LEFT JOIN workspace_layout wl ON s.run_id = wl.run_id
			ORDER BY s.created_at DESC
		`;

		const rows = await locals.services.database.all(query);

		// Transform persistent sessions to UI format
		const persistentSessions = rows.map((row) => {
			const meta = JSON.parse(row.meta_json || '{}');
			return {
				id: row.run_id,
				type: row.kind,
				kind: row.kind,
				title: getSessionTitle(row.kind),
				workspacePath: meta.cwd || meta.workspacePath || '',
				isActive: row.status === 'running',
				isEphemeral: false,
				createdAt: row.created_at,
				lastActivity: row.updated_at,
				inLayout: !!row.tile_id,
				tileId: row.tile_id,
				pinned: false,
				metadata: meta.options || {}
			};
		});

		// Get ephemeral sessions from SessionOrchestrator
		const ephemeralSessions = includeEphemeral
			? locals.services.sessionOrchestrator.getEphemeralSessions().map((s) => ({
					id: s.id,
					type: s.kind,
					title: getSessionTitle(s.kind),
					workspacePath: s.cwd || '',
					isActive: true,
					isEphemeral: true,
					createdAt: Date.now(),
					lastActivity: Date.now(),
					inLayout: false,
					tileId: null,
					pinned: false
				}))
			: [];

		// Combine all sessions
		let allSessions = [...persistentSessions, ...ephemeralSessions];

		// Filter based on includeAll parameter
		if (!includeAll) {
			allSessions = allSessions.filter((s) => s.isActive);
		}

		return new Response(JSON.stringify({ sessions: allSessions }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'GET /api/sessions');
	}
}

export async function POST({ request, locals }) {
	const { kind, type, cwd, resume = false, sessionId, options = {} } = await request.json();

	const sessionKind = kind ?? type;

	try {
		if (resume && sessionId) {
			// Check if it's an ephemeral session (can't resume)
			if (isEphemeralSessionType(sessionKind) || sessionId.match(/^(terminal|file-editor)_/)) {
				return new Response(
					JSON.stringify({
						runId: sessionId,
						id: sessionId,
						success: false,
						resumed: false,
						reason: 'Ephemeral sessions cannot be resumed. Create a new window instead.'
					}),
					{ headers: { 'content-type': 'application/json' } }
				);
			}

			try {
				// Resume persistent session
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
					{ headers: { 'content-type': 'application/json' } }
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

		// Get OpenCode server settings for AI sessions
		let aiOptions = {};
		if (sessionKind === SESSION_TYPE.AI || sessionKind === SESSION_TYPE.OPENCODE) {
			// Check if user specified a server URL in options/metadata
			const userServerUrl = options?.serverUrl || options?.metadata?.serverUrl;
			if (userServerUrl) {
				aiOptions.baseUrl = userServerUrl;
			} else {
				// Fall back to local server manager
				const serverStatus = locals.services.opencodeServerManager.getStatus();
				if (serverStatus.running) {
					aiOptions.baseUrl = serverStatus.url;
				} else {
					// Use configured port even if server is not running
					aiOptions.baseUrl = `http://${serverStatus.hostname}:${serverStatus.port}`;
				}
			}
		}

		// Determine the working directory (cwd is the workspace)
		const workingDirectory =
			cwd || defaultWorkspaceDir || process.env.WORKSPACES_ROOT || process.env.HOME;

		// Create session using SessionOrchestrator
		// Ephemeral sessions (terminal, file-editor) won't be persisted to DB
		const session = await locals.services.sessionOrchestrator.createSession(sessionKind, {
			workspacePath: workingDirectory,
			metadata: {
				cwd: workingDirectory,
				options: {
					...options,
					...aiOptions,
					workspaceEnv: workspaceEnvVariables
				}
			}
		});

		return new Response(
			JSON.stringify({
				runId: session.id,
				id: session.id,
				success: true,
				kind: sessionKind,
				type: sessionKind,
				isEphemeral: session.isEphemeral || false
			}),
			{ headers: { 'content-type': 'application/json' } }
		);
	} catch (err) {
		// Map specific error types to appropriate HTTP errors
		if (err.message?.includes('node-pty')) {
			throw new ServiceUnavailableError(
				`${SESSION_TYPE.TERMINAL} functionality is temporarily unavailable. Please try again in a moment.`,
				'TERMINAL_UNAVAILABLE'
			);
		} else if (err.message?.includes('opencode') || err.message?.includes('OpencodeClient')) {
			throw new ServiceUnavailableError(
				`${SESSION_TYPE.AI} functionality is temporarily unavailable. Please try again in a moment.`,
				'AI_UNAVAILABLE'
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

		// Close session using SessionOrchestrator (works for both ephemeral and persistent)
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
