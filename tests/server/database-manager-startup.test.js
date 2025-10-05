import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';

describe('DatabaseManager startup helpers', () => {
	let tempDir;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'dispatch-db-'));
	});

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it('marks stale running sessions as stopped', async () => {
		const dbPath = join(tempDir, 'workspace.db');
		const database = new DatabaseManager(dbPath);
		await database.init();

		await database.sessions.create({
			runSessionId: 'run-1',
			kind: 'pty',
			meta: { cwd: '/tmp' }
		});
		await database.sessions.updateStatus('run-1', 'running');

		await database.sessions.markAllStopped();

		const session = await database.sessions.findById('run-1');
		expect(session.status).toBe('stopped');
		await database.close();
	});
});
