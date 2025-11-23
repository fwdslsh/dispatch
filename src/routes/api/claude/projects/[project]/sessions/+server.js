import { json } from '@sveltejs/kit';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { projectsRoot } from '$lib/server/claude/cc-root.js';
import { NotFoundError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ params, request: _request, locals: _locals }) {
	try {
		const { project } = params;
		const root = projectsRoot();
		const projectPath = join(root, project);

		let files;
		try {
			files = await readdir(projectPath, { withFileTypes: true });
		} catch {
			throw new NotFoundError('Project not found');
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
	} catch (err) {
		handleApiError(err, 'GET /api/claude/projects/[project]/sessions');
	}
}
