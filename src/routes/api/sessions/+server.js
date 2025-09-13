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

import {
	generateSessionId,
	createSessionDescriptor,
	getTypeSpecificId,
	getSessionType
} from '../../../lib/server/utils/session-ids.js';

export async function POST({ request, locals }) {
	const { type, workspacePath, options } = await request.json();

	if (type === 'pty') {
		const { terminalId, resumeSession } = options || {};

		// Generate application-managed session ID
		const appSessionId = generateSessionId();

		// Start the terminal session with the app session ID
		const terminalResult = locals.terminals.start({
			workspacePath,
			resume: !!resumeSession,
			terminalId: resumeSession ? terminalId : null,
			appSessionId // Pass our ID to the terminal manager
		});

		const title = resumeSession ? `Shell @ ${workspacePath} (resumed)` : `Shell @ ${workspacePath}`;

		// Create simplified session descriptor
		const sessionDescriptor = createSessionDescriptor('pty', terminalResult.id, {
			id: appSessionId,
			workspacePath,
			title,
			resumeSession: !!resumeSession
		});

		locals.sessions.bind(appSessionId, sessionDescriptor);
		await locals.workspaces.rememberSession(workspacePath, sessionDescriptor);
		return new Response(
			JSON.stringify({
				id: appSessionId,
				terminalId: terminalResult.id
			})
		);
	}

	if (type === 'claude') {
		const { sessionId, projectName, resumeSession } = options || {};

		// Generate application-managed session ID
		const appSessionId = generateSessionId();

		// Create Claude session with the app session ID
		const claudeResult = await locals.claude.create({
			workspacePath,
			options,
			sessionId: resumeSession ? sessionId : null,
			appSessionId // Pass our ID to Claude manager
		});

		const title = resumeSession
			? `Claude @ ${projectName} (resumed)`
			: `Claude @ ${projectName || workspacePath}`;

		// Create simplified session descriptor
		const sessionDescriptor = createSessionDescriptor('claude', claudeResult.claudeId, {
			id: appSessionId,
			workspacePath,
			title,
			resumeSession: !!resumeSession
		});

		locals.sessions.bind(appSessionId, sessionDescriptor);
		await locals.workspaces.rememberSession(workspacePath, sessionDescriptor);
		return new Response(
			JSON.stringify({
				id: appSessionId,
				claudeId: claudeResult.claudeId
			})
		);
	}

	return new Response('Bad Request', { status: 400 });
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

	// Remove from persisted sessions (SQLite-backed)
	await locals.workspaces.removeSession(workspacePath, sessionId);

	// If session is active, stop it
	const activeSession = locals.sessions.get(sessionId);
	if (activeSession) {
		const sessionType = getSessionType(activeSession);
		const typeSpecificId = getTypeSpecificId(activeSession);

		// Stop the appropriate session type
		if (sessionType === 'claude' && locals.claude && typeSpecificId) {
			// Claude sessions are managed automatically by the ClaudeSessionManager
			// Just remove from session router
			locals.sessions.unbind(sessionId);
		} else if (sessionType === 'pty' && locals.terminals && typeSpecificId) {
			locals.terminals.stop(typeSpecificId);
			locals.sessions.unbind(sessionId);
		} else {
			// Fallback: just remove from session router
			locals.sessions.unbind(sessionId);
		}
	}

	return new Response(JSON.stringify({ success: true }));
}
