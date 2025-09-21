import { json, error } from '@sveltejs/kit';
import { projectsRoot } from '$lib/server/claude/cc-root.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { readTailLines, parseJsonlLines } from '$lib/server/shared/utils/jsonl.js';
import { createReadStream } from 'node:fs';

const MAX_BYTES = 5 * 1024 * 1024; // soft cap to keep responses reasonable

export async function GET({ params, url }) {
	const { id } = params;
	const wantFull = url.searchParams.get('full') === '1';

	try {
		const root = projectsRoot();

		const projects = await readdir(root);

		// Search all projects for the session file
		for (const projectName of projects) {
			const projectPath = join(root, projectName);
			const sessionFile = join(projectPath, `${id}.jsonl`);

			try {
				const st = await stat(sessionFile);
				if (st?.isFile()) {
					// Found the session file, return its contents
					let lines;

					if (wantFull && st.size <= MAX_BYTES) {
						const chunks = await new Promise((res, rej) => {
							const out = [];
							createReadStream(sessionFile, { start: 0, end: Math.min(st.size - 1, MAX_BYTES) })
								.on('data', (c) => out.push(c))
								.on('end', () => res(out))
								.on('error', rej);
						});
						lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
					} else {
						const n = Math.max(200, Math.min(4000, Number(url.searchParams.get('n') ?? 1000)));
						lines = await readTailLines(sessionFile, n);
					}

					const entries = parseJsonlLines(lines);

					// Derive tiny summary
					const summary = entries.reduce(
						(acc, e) => {
							const role = e.role || e.type || 'unknown';
							acc.roles[role] = (acc.roles[role] || 0) + 1;
							acc.count++;
							acc.lastAt = e.timestamp || acc.lastAt;
							return acc;
						},
						{ count: 0, roles: {}, lastAt: null }
					);

					return json({
						project: projectName,
						id,
						size: st.size,
						lastModified: st.mtimeMs,
						summary,
						entries
					});
				}
			} catch (e) {
				// File doesn't exist in this project, continue searching
				continue;
			}
		}

		// Session not found - return empty result for new sessions
		return json({
			project: null,
			id,
			size: 0,
			lastModified: null,
			summary: { count: 0, roles: {}, lastAt: null },
			entries: []
		});
	} catch (err) {
		console.error('Error looking up Claude session:', err);
		throw error(500, 'Failed to look up session');
	}
}
