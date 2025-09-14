import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

/** Read up to `limitBytes` from file tail, split into non-empty lines */
export async function readTailLines(file, limitLines = 200, limitBytes = 512 * 1024) {
	const st = await stat(file).catch(() => null);
	if (!st?.isFile()) return [];
	const start = Math.max(0, st.size - limitBytes);
	const chunks = await new Promise((res, rej) => {
		const out = [];
		createReadStream(file, { start, end: st.size - 1 })
			.on('data', (c) => out.push(c))
			.on('end', () => res(out))
			.on('error', rej);
	});
	const text = Buffer.concat(chunks).toString('utf8');
	const lines = text.split(/\r?\n/).filter(Boolean);
	return lines.slice(-limitLines);
}

export function parseJsonlLines(lines) {
	const items = [];
	for (const ln of lines) {
		try {
			items.push(JSON.parse(ln));
		} catch {
			/* skip bad row */
		}
	}
	return items;
}
