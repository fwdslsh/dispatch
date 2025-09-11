export async function GET({ url, locals }) {
	const workspace = url.searchParams.get('workspace');
	
	// Get active sessions from SessionRouter
	const activeSessions = locals.sessions.all().filter((s) => !workspace || s.workspacePath === workspace);
	
	// Get persisted sessions from WorkspaceManager hub index
	const persistedSessions = await locals.workspaces.getAllSessions();
	const filteredPersisted = workspace ? 
		persistedSessions.filter(s => s.workspacePath === workspace) : 
		persistedSessions;
	
	// Merge active and persisted sessions, with active taking precedence
	const sessionMap = new Map();
	
	// First add persisted sessions
	filteredPersisted.forEach(session => {
		sessionMap.set(session.id, session);
	});
	
	// Then override with active sessions (which have current state)
	activeSessions.forEach(session => {
		const existing = sessionMap.get(session.id);
		sessionMap.set(session.id, {
			...existing, // Keep persisted data like sessionId
			...session,  // Override with active data
			isActive: true
		});
	});
	
	const allSessions = Array.from(sessionMap.values());
	
	return new Response(JSON.stringify({ sessions: allSessions }), {
		headers: { 'content-type': 'application/json' }
	});
}

export async function POST({ request, locals }) {
	const { type, workspacePath, options } = await request.json();
	if (type === 'pty') {
		const { terminalId, resumeSession } = options || {};
		const { id } = locals.terminals.start({ 
			workspacePath, 
			resume: !!resumeSession,
			terminalId: resumeSession ? terminalId : null
		});
		
		const title = resumeSession ? 
			`Shell @ ${workspacePath} (resumed)` : 
			`Shell @ ${workspacePath}`;
			
		const d = { 
			id, 
			type, 
			workspacePath, 
			title,
			resumeSession: !!resumeSession
		};
		locals.sessions.bind(id, d);
		await locals.workspaces.rememberSession(workspacePath, d);
		return new Response(JSON.stringify({ id }));
	}
	if (type === 'claude') {
		const { sessionId, projectName, resumeSession } = options || {};
		const result = await locals.claude.create({ 
			workspacePath, 
			options, 
			sessionId: resumeSession ? sessionId : null 
		});
		
		const title = resumeSession ? 
			`Claude @ ${projectName} (resumed)` : 
			`Claude @ ${projectName || workspacePath}`;
			
		const d = { 
			id: result.id, 
			type, 
			workspacePath, 
			title,
			sessionId: result.sessionId,
			resumeSession: !!resumeSession
		};
		locals.sessions.bind(result.id, d);
		await locals.workspaces.rememberSession(workspacePath, d);
		return new Response(JSON.stringify({ id: result.id, sessionId: result.sessionId }));
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
	
	// Remove from hub index
	await locals.workspaces.removeSession(workspacePath, sessionId);
	
	// If session is active, stop it
	const activeSession = locals.sessions.get(sessionId);
	if (activeSession) {
		// Stop Claude or terminal session
		if (activeSession.type === 'claude' && locals.claude) {
			// Claude sessions are managed automatically by the ClaudeSessionManager
			locals.sessions.unbind(sessionId);
		} else if (activeSession.type === 'pty' && locals.terminals) {
			locals.terminals.stop(sessionId);
			locals.sessions.unbind(sessionId);
		}
	}
	
	return new Response(JSON.stringify({ success: true }));
}
