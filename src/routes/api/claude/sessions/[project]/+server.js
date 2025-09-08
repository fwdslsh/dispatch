import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { projectsRoot } from '$lib/server/claude/cc-root.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ params }) {
	const { project } = params;
	const base = projectsRoot();
	const dir = join(base, project);

	let files;
	try {
		files = await readdir(dir, { withFileTypes: true });
	} catch {
		throw error(404, 'Project not found');
	}

	const sessions = [];
	for (const f of files) {
		if (!f.isFile() || !f.name.endsWith('.jsonl')) continue;
		const full = join(dir, f.name);
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
