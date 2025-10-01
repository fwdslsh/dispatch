import { json, error } from '@sveltejs/kit';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { projectsRoot } from '$lib/server/claude/cc-root.js';
import { readTailLines, parseJsonlLines } from '$lib/server/shared/utils/jsonl.js';
import { createReadStream } from 'node:fs';

const MAX_BYTES = 5 * 1024 * 1024; // soft cap to keep responses reasonable

export async function GET({ params, url, request, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: \'Authentication required\' }, { status: 401 });
	}

	const { project, id } = params;
	const full = join(projectsRoot(), project, `${id}.jsonl`);

	const st = await stat(full).catch(() => null);
	if (!st?.isFile()) throw error(404, 'Session not found');

	// `full=1` can stream whole file (bounded); default returns last N lines for snappy UI
	const wantFull = url.searchParams.get('full') === '1' && st.size <= MAX_BYTES;
	let lines;

	if (wantFull) {
		const chunks = await new Promise((res, rej) => {
			const out = [];
			createReadStream(full, { start: 0, end: Math.min(st.size - 1, MAX_BYTES) })
				.on('data', (c) => out.push(c))
				.on('end', () => res(out))
				.on('error', rej);
		});
		lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
	} else {
		const n = Math.max(200, Math.min(4000, Number(url.searchParams.get('n') ?? 1000)));
		lines = await readTailLines(full, n);
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

	return json({ project, id, size: st.size, lastModified: st.mtimeMs, summary, entries });
}
