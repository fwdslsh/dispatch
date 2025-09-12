import pathModule from 'node:path';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';

export async function GET({ locals }) {
	const list = await locals.workspaces.list();
	return new Response(JSON.stringify({ list }), {
		headers: { 'content-type': 'application/json' }
	});
}

function _sanitizeRequestedPath(rawPath) {
	// Ensure we have a string
	if (typeof rawPath !== 'string' || rawPath.trim() === '') throw new Error('Invalid workspace path');
	// Trim surrounding whitespace
	let p = rawPath.trim();
	// If the client accidentally sent an encoded absolute path with leading hyphens
	// (e.g. "-home-user-project") treat it as a project name by stripping leading hyphens.
	if (p.startsWith('-')) p = p.replace(/^-+/, '');
	return p;
}

export async function POST({ request, locals }) {
	const { action, from, to, path: rawPath, isNewProject } = await request.json();
	const workspaceRoot = process.env.WORKSPACES_ROOT || process.cwd();

	try {
		if (action === 'open') {
			const p = _sanitizeRequestedPath(rawPath);
			// If the client provided an absolute path, validate it and return directly without persisting
			if (pathModule.isAbsolute(p)) {
				const fullAbs = pathModule.resolve(p);
				const st = await fs.stat(fullAbs).catch(() => null);
				if (st && st.isDirectory()) {
					// Do NOT persist absolute paths outside WORKSPACES_ROOT; just return the path
					return new Response(JSON.stringify({ path: fullAbs }), { headers: { 'content-type': 'application/json' } });
				}
				// If absolute path doesn't exist, fall through to project lookup below
			}

			// For relative paths, resolve against WORKSPACES_ROOT and persist via WorkspaceManager
			const fullPath = pathModule.join(workspaceRoot, p);
			try {
				const st = await fs.stat(fullPath);
				if (st.isDirectory()) {
					return new Response(JSON.stringify(await locals.workspaces.open(fullPath)), { headers: { 'content-type': 'application/json' } });
				}
			} catch (e) {
				// not found under WORKSPACES_ROOT - fall through to try resolving as a Claude project name
			}

			// Try to resolve as a Claude project name by searching known projects directories
			const candidates = [
				process.env.CLAUDE_PROJECTS_DIR,
				pathModule.join(process.env.HOME || homedir(), '.claude', 'projects'),
				pathModule.join(process.cwd(), '.dispatch-home', '.claude', 'projects'),
				pathModule.join(process.cwd(), '.claude', 'projects')
			].filter(Boolean);

			for (const projectsDir of candidates) {
				try {
					// If the client sent a full path that happens to live under a known projects dir,
					// honor it as-is; otherwise treat `p` as a project name under that dir
					const candidatePath = pathModule.isAbsolute(p)
						? pathModule.resolve(p)
						: pathModule.join(projectsDir, p);
					const st = await fs.stat(candidatePath);
					if (st.isDirectory()) {
						// Return the actual project folder path directly (do not persist in workspaces index)
						return new Response(JSON.stringify({ path: candidatePath }), { headers: { 'content-type': 'application/json' } });
					}
				} catch (e) {
					// ignore and try next candidate
				}
			}

			throw new Error('Workspace not found');
		}

		if (action === 'create') {
			let projectName = _sanitizeRequestedPath(rawPath);
			// For new projects, construct the full path using WORKSPACES_ROOT
			const fullPath = pathModule.join(workspaceRoot, projectName);
			// Prevent escapes outside the root
			const rel = pathModule.relative(workspaceRoot, fullPath);
			if (rel.startsWith('..')) throw new Error('Invalid project name');
			return new Response(JSON.stringify(await locals.workspaces.create(fullPath)));
		}

		if (action === 'clone') {
			// sanitize inputs for clone as well
			const fromPath = pathModule.isAbsolute(from) ? pathModule.resolve(from) : pathModule.join(workspaceRoot, _sanitizeRequestedPath(from));
			const toPath = pathModule.isAbsolute(to) ? pathModule.resolve(to) : pathModule.join(workspaceRoot, _sanitizeRequestedPath(to));
			return new Response(JSON.stringify(await locals.workspaces.clone(fromPath, toPath)));
		}

		return new Response('Bad Request', { status: 400 });
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), { status: 400, headers: { 'content-type': 'application/json' } });
	}
}
