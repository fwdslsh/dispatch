export async function GET({ url, locals }) {
	const workspace = url.searchParams.get('workspace');

	// Get active sessions from SessionRouter
	const activeSessions = locals.sessions
		.all()
		.filter((s) => !workspace || s.workspacePath === workspace);

	// Get persisted sessions from WorkspaceManager (SQLite-backed)
	const persistedSessions = await locals.workspaces.getAllSessions();
	const filteredPersisted = workspace
		? persistedSessions.filter((s) => s.workspacePath === workspace)
		: persistedSessions;

	// Merge active and persisted sessions, with active taking precedence
	const sessionMap = new Map();

	// First add persisted sessions
	filteredPersisted.forEach((session) => {
		sessionMap.set(session.id, session);
	});

	// Then override with active sessions (which have current state)
	activeSessions.forEach((session) => {
		const existing = sessionMap.get(session.id);
		sessionMap.set(session.id, {
			...existing, // Keep persisted data like sessionId
			...session, // Override with active data
			isActive: true
		});
	});

	const allSessions = Array.from(sessionMap.values());

	return new Response(JSON.stringify({ sessions: allSessions }), {
		headers: { 'content-type': 'application/json' }
	});
}

import { getTypeSpecificId, getSessionType } from '../../../lib/server/utils/session-ids.js';

export async function POST({ request, locals }) {
	const { type, workspacePath, options } = await request.json();

	// Use the unified SessionManager if available, fallback to old approach
	if (locals.sessionManager) {
		try {
			const session = await locals.sessionManager.createSession({
				type,
				workspacePath,
				options
			});

			return new Response(
				JSON.stringify({
					id: session.id,
					[type === 'pty' ? 'terminalId' : 'claudeId']: session.typeSpecificId
				})
			);
		} catch (error) {
			console.error('[API] Session creation failed:', error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}

	// Fallback to legacy implementation (shouldn't happen in normal operation)
	return new Response('Session manager not available', { status: 503 });
}

export async function PUT({ request, locals }) {
	const { action, sessionId, workspacePath, newTitle } = await request.json();

	if (action === 'rename') {
		await locals.workspaces.renameSession(workspacePath, sessionId, newTitle);
		return new Response(JSON.stringify({ success: true }));
	}

	return new Response('Bad Request', { status: 400 });
}

export async function DELETE({ url, locals }) {
	const sessionId = url.searchParams.get('sessionId');
	const workspacePath = url.searchParams.get('workspacePath');

	if (!sessionId || !workspacePath) {
		return new Response('Missing sessionId or workspacePath', { status: 400 });
	}

	// Use the unified SessionManager if available
	if (locals.sessionManager) {
		try {
			const success = await locals.sessionManager.stopSession(sessionId);
			return new Response(JSON.stringify({ success }));
		} catch (error) {
			console.error('[API] Session deletion failed:', error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}

	// Fallback to legacy implementation
	await locals.workspaces.removeSession(workspacePath, sessionId);
	const activeSession = locals.sessions.get(sessionId);
	if (activeSession) {
		locals.sessions.unbind(sessionId);
	}

	return new Response(JSON.stringify({ success: true }));
}
