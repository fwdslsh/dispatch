import { json } from '@sveltejs/kit';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { projectsRoot } from '$lib/server/claude/cc-root.js';

export async function GET({ request, locals }) {
	// Require authentication
	const authKey = locals.services.auth.getAuthKeyFromRequest(request);
	if (!locals.services.auth.validateKey(authKey)) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const base = projectsRoot();
	const items = await readdir(base, { withFileTypes: true }).catch(() => []);
	const projects = [];

	for (const d of items) {
		if (!d.isDirectory()) continue;
		const projectPath = join(base, d.name);

		// Count .jsonl files and compute lastModified across them
		let sessionCount = 0;
		let lastModified = 0;

		const entries = await readdir(projectPath, { withFileTypes: true }).catch(() => []);
		for (const e of entries) {
			if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
			sessionCount++;
			const s = await stat(join(projectPath, e.name)).catch(() => null);
			if (s) lastModified = Math.max(lastModified, s.mtimeMs);
		}

		projects.push({
			name: d.name,
			path: projectPath,
			sessionCount,
			lastModified
		});
	}

	// Most recent first
	projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
	return json({ base, projects });
}
