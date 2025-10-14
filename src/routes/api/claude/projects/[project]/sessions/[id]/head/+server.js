import { error, json } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { projectsRoot } from '$lib/server/claude/cc-root.js';

const MAX_BYTES = 512 * 1024; // cap to keep responses snappy

export async function GET({ params, url, request: _request, locals: _locals }) {
	const { project, id } = params;
	const n = Math.max(1, Math.min(200, Number(url.searchParams.get('n') ?? 40)));
	const tail = url.searchParams.get('tail') === '1';

	const root = projectsRoot();
	const file = join(root, project, `${id}.jsonl`);

	const st = await stat(file).catch(() => null);
	if (!st?.isFile()) throw error(404, 'Session not found');

	// Stream a slice; keep simple (naive line slicing in-memory within MAX_BYTES)
	const start = Math.max(0, st.size - MAX_BYTES);
	const chunks = await new Promise((res, rej) => {
		const out = [];
		createReadStream(file, { start, end: st.size - 1 })
			.on('data', (c) => out.push(c))
			.on('end', () => res(out))
			.on('error', rej);
	});
	const text = Buffer.concat(chunks).toString('utf8');
	const lines = text.split(/\r?\n/).filter(Boolean);
	const picked = tail ? lines.slice(-n) : lines.slice(0, n);
	return json({ project, id, lines: picked });
}
