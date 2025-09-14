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

    // Always include active sessions; pinnedOnly only affects persisted entries
    const activeSessions = activeSessionsRaw;

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
            ...existing,
            ...session,
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

	// Always use the unified SessionManager
	try {
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
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
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
