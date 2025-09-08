import { json, error } from '@sveltejs/kit';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { projectsRoot } from '$lib/server/claude/cc-root.js';

export async function GET({ params }) {
	const { project } = params;
	const root = projectsRoot();
	const projectPath = join(root, project);

	let files;
	try {
		files = await readdir(projectPath, { withFileTypes: true });
	} catch {
		throw error(404, 'Project not found');
	}

	const sessions = [];
	for (const f of files) {
		if (!f.isFile() || !f.name.endsWith('.jsonl')) continue;
		const full = join(projectPath, f.name);
		const st = await stat(full).catch(() => null);
		sessions.push({
			id: f.name.replace(/\.jsonl$/i, ''),
			file: f.name,
			size: st?.size ?? 0,
			lastModified: st?.mtimeMs ?? 0
		});
	}
	sessions.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
	return json({ project, sessions });
}
