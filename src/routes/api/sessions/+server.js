export async function GET({ url, locals }) {
	const workspace = url.searchParams.get('workspace');
	const all = locals.sessions.all().filter((s) => !workspace || s.workspacePath === workspace);
	return new Response(JSON.stringify({ sessions: all }), {
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
