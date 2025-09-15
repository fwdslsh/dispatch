export async function GET({ url, locals }) {
	const workspace = url.searchParams.get('workspace');
	const include = url.searchParams.get('include'); // 'all' to include unpinned

	// Determine pinnedOnly flag
	const pinnedOnly = include === 'all' ? false : true;

	// Get persisted sessions (pinned by default)
	const persistedSessions = await locals.workspaces.getAllSessions(pinnedOnly);
	const filteredPersisted = workspace
		? persistedSessions.filter((s) => s.workspacePath === workspace)
		: persistedSessions;

	// Build a set of pinned IDs when pinnedOnly requested
	const pinnedIds = new Set(filteredPersisted.map((s) => s.id));

	// Get active sessions from SessionRouter and filter by workspace
	const activeSessionsRaw = locals.sessions
		.all()
		.filter((s) => !workspace || s.workspacePath === workspace);

	// Merge active and persisted sessions, with active taking precedence
	const sessionMap = new Map();

	// First add persisted sessions
	filteredPersisted.forEach((session) => {
		sessionMap.set(session.id, session);
	});

	// Then add active sessions
	// For active sessions, check if they exist in persisted sessions to get their pinned state
	activeSessionsRaw.forEach((session) => {
		const existing = sessionMap.get(session.id);

		// If pinnedOnly is true and this session exists in persisted but is unpinned, skip it
		if (pinnedOnly && existing && !existing.pinned) {
			return; // Skip unpinned sessions when pinnedOnly is true
		}

		// If pinnedOnly is true and this session doesn't exist in persisted sessions yet,
		// include it (new sessions should be visible)
		sessionMap.set(session.id, {
			...existing,
			...session,
			isActive: true,
			pinned: existing ? existing.pinned : true // Default to pinned for new sessions
		});
	});

	const allSessions = Array.from(sessionMap.values());

	return new Response(JSON.stringify({ sessions: allSessions }), {
		headers: { 'content-type': 'application/json' }
	});
}

import { getTypeSpecificId, getSessionType } from '../../../lib/server/utils/session-ids.js';

export async function POST({ request, locals }) {
	const { type, workspacePath, options, resume, sessionId } = await request.json();

	try {
		// If resuming a session, handle it differently
		if (resume && sessionId) {
			// Check if session is already active
			const existingActiveSession = locals.sessions.get(sessionId);
			if (existingActiveSession) {
				// Session is already active, just return its info
				return new Response(
					JSON.stringify({
						id: existingActiveSession.id,
						typeSpecificId: existingActiveSession.typeSpecificId,
						resumed: true
					})
				);
			}

			// Get session details from database
			const persistedSession = await locals.workspaces.getSession(workspacePath, sessionId);
			if (persistedSession) {
				// Create a new session with resume options
				const session = await locals.sessionManager.createSession({
					type: persistedSession.sessionType,
					workspacePath: persistedSession.workspacePath,
					options: {
						...options,
						resume: true,
						terminalId: persistedSession.typeSpecificId, // For terminal sessions
						claudeSessionId: persistedSession.typeSpecificId // For Claude sessions
					}
				});

				return new Response(
					JSON.stringify({
						id: session.id,
						typeSpecificId: session.typeSpecificId,
						resumed: true
					})
				);
			} else {
				return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
			}
		}

		// Always use the unified SessionManager for new sessions
		const session = await locals.sessionManager.createSession({
			type,
			workspacePath,
			options
		});

		// Guard against placeholder/invalid Claude IDs; allow UI to fall back to unified sessionId
		let mappedId = session.typeSpecificId;
		if (type === 'claude') {
			try {
				const v = String(mappedId || '').trim();
				const looksUUID = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(v);
				const looksLong = v.length >= 16; // Claude Code JSONL filenames are long-ish
				const hasAlpha = /[a-z]/i.test(v);
				const isOnlyDigits = /^\d+$/.test(v);
				if (!v || isOnlyDigits || (!looksUUID && !looksLong && !hasAlpha)) {
					mappedId = null;
				}
			} catch {
				mappedId = null;
			}
		}

		return new Response(
			JSON.stringify({
				id: session.id,
				typeSpecificId: mappedId || null
			})
		);
	} catch (error) {
		console.error('[API] Session creation failed:', error);

		// Provide more specific error messages for common issues
		let errorMessage = error.message;
		let statusCode = 500;

		if (error.message?.includes('node-pty failed to load')) {
			errorMessage =
				'Terminal functionality is temporarily unavailable. Please try again in a moment.';
			statusCode = 503; // Service Unavailable
		} else if (error.message?.includes('Vite module runner has been closed')) {
			errorMessage = 'Development server is restarting. Please try again in a moment.';
			statusCode = 503; // Service Unavailable
		}

		return new Response(JSON.stringify({ error: errorMessage }), { status: statusCode });
	}
}

export async function PUT({ request, locals }) {
	const { action, sessionId, workspacePath, newTitle } = await request.json();

	if (action === 'rename') {
		await locals.workspaces.renameSession(workspacePath, sessionId, newTitle);
		return new Response(JSON.stringify({ success: true }));
	}

	if (action === 'unpin') {
		await locals.workspaces.setPinned(workspacePath, sessionId, false);
		return new Response(JSON.stringify({ success: true }));
	}

	if (action === 'pin') {
		await locals.workspaces.setPinned(workspacePath, sessionId, true);
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

	// Always use the unified SessionManager
	try {
		const success = await locals.sessionManager.stopSession(sessionId);
		return new Response(JSON.stringify({ success }));
	} catch (error) {
		console.error('[API] Session deletion failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}
