import { json, error } from '@sveltejs/kit';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { projectsRoot } from '$lib/server/claude/cc-root.js';
import { readTailLines } from '$lib/server/shared/utils/jsonl.js';
import { createReadStream } from 'node:fs';

export async function GET({ params, url, request: _request, locals: _locals }) {
	const { project, id } = params;
	const n = Math.max(1, Math.min(300, Number(url.searchParams.get('n') ?? 40)));
	const tail = url.searchParams.get('tail') === '1';

	const file = join(projectsRoot(), project, `${id}.jsonl`);
	const st = await stat(file).catch(() => null);
	if (!st?.isFile()) throw error(404, 'Session not found');

	if (tail) {
		const lines = await readTailLines(file, n);
		return json({ lines, tail: true });
	} else {
		const chunks = await new Promise((res, rej) => {
			const out = [];
			createReadStream(file, { start: 0, end: Math.min(st.size - 1, 256 * 1024) })
				.on('data', (c) => out.push(c))
				.on('end', () => res(out))
				.on('error', rej);
		});
		const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean).slice(0, n);
		return json({ lines, tail: false });
	}
}
