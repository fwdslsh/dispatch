export async function GET({ locals }) {
	const list = await locals.workspaces.list();
	return new Response(JSON.stringify({ list }), {
		headers: { 'content-type': 'application/json' }
	});
}

export async function POST({ request, locals }) {
	const { action, from, to, path, isNewProject } = await request.json();
	
	if (action === 'open') return new Response(JSON.stringify(await locals.workspaces.open(path)));
	
	if (action === 'create') {
		let fullPath = path;
		if (isNewProject) {
			// For new projects, construct the full path using WORKSPACES_ROOT
			const workspaceRoot = process.env.WORKSPACES_ROOT || process.cwd();
			const pathModule = await import('path');
			fullPath = pathModule.join(workspaceRoot, path);
		}
		return new Response(JSON.stringify(await locals.workspaces.create(fullPath)));
	}
	
	if (action === 'clone')
		return new Response(JSON.stringify(await locals.workspaces.clone(from, to)));
		
	return new Response('Bad Request', { status: 400 });
}
