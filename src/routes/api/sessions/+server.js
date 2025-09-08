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
		const { id } = locals.terminals.start({ workspacePath });
		const d = { id, type, workspacePath, title: `Shell @ ${workspacePath}` };
		locals.sessions.bind(id, d);
		await locals.workspaces.rememberSession(workspacePath, d);
		return new Response(JSON.stringify({ id }));
	}
	if (type === 'claude') {
		const { id } = await locals.claude.create({ workspacePath, options });
		const d = { id, type, workspacePath, title: `Claude @ ${workspacePath}` };
		locals.sessions.bind(id, d);
		await locals.workspaces.rememberSession(workspacePath, d);
		return new Response(JSON.stringify({ id }));
	}
	return new Response('Bad Request', { status: 400 });
}
