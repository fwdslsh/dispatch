import { json, error } from '@sveltejs/kit';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

export async function GET({ params }) {
	const { id } = params;

	// Get terminal history directory
	const historyDir =
		process.env.TERMINAL_HISTORY_DIR || join(os.tmpdir(), 'dispatch-terminal-history');
	const historyFile = join(historyDir, `${id}.log`);

	try {
		const history = await fs.readFile(historyFile, 'utf8');
		return json({ history });
	} catch (err) {
		if (err.code === 'ENOENT') {
			// No history file exists, return empty history
			return json({ history: '' });
		}
		console.error('Failed to read terminal history:', err);
		throw error(500, 'Failed to load terminal history');
	}
}
