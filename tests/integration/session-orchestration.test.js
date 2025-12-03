/**
 * Session Orchestration Integration Tests
 *
 * Tests the full session lifecycle integration:
 * - Session creation through SessionOrchestrator
 * - Event persistence through EventRecorder
 * - Real-time event emission
 * - Multi-client synchronization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionOrchestrator } from '$lib/server/sessions/SessionOrchestrator.js';
import { SessionRepository } from '$lib/server/database/SessionRepository.js';
import { EventRecorder } from '$lib/server/sessions/EventRecorder.js';
import { EventStore } from '$lib/server/database/EventStore.js';
import { AdapterRegistry } from '$lib/server/sessions/AdapterRegistry.js';
import { SessionId } from '$lib/server/shared/utils/session-ids.js';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Database wrapper to convert better-sqlite3 sync API to async DatabaseManager interface
 */
class TestDatabaseWrapper {
	constructor(betterSqliteDb) {
		this.#betterDb = betterSqliteDb;
	}

	#betterDb;

	async run(sql, params = []) {
		try {
			const stmt = this.#betterDb.prepare(sql);
			const result = stmt.run(...params);
			return {
				lastID: result.lastInsertRowid,
				changes: result.changes
			};
		} catch (error) {
			throw error;
		}
	}

	async get(sql, params = []) {
		try {
			const stmt = this.#betterDb.prepare(sql);
			return stmt.get(...params);
		} catch (error) {
			throw error;
		}
	}

	async all(sql, params = []) {
		try {
			const stmt = this.#betterDb.prepare(sql);
			return stmt.all(...params);
		} catch (error) {
			throw error;
		}
	}
}

describe('Session Orchestration Integration', () => {
	let db;
	let dbWrapper;
	let sessionRepository;
	let eventStore;
	let eventRecorder;
	let adapterRegistry;
	let testDbPath;

	beforeEach(() => {
		testDbPath = join(__dirname, `test-integration-${Math.random()}.db`);
		db = new Database(testDbPath);

		db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				run_id TEXT PRIMARY KEY,
				owner_user_id TEXT,
				kind TEXT NOT NULL,
				status TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				meta_json TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS session_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				seq INTEGER NOT NULL,
				channel TEXT NOT NULL,
				type TEXT NOT NULL,
				payload BLOB NOT NULL,
				ts INTEGER NOT NULL,
				FOREIGN KEY (run_id) REFERENCES sessions(run_id)
			);
		`);

		dbWrapper = new TestDatabaseWrapper(db);
		sessionRepository = new SessionRepository(dbWrapper);
		eventStore = new EventStore(dbWrapper);
		eventRecorder = new EventRecorder(eventStore);
		adapterRegistry = new AdapterRegistry();
	});

	afterEach(() => {
		if (db) {
			db.close();
		}
		if (fs.existsSync(testDbPath)) {
			fs.unlinkSync(testDbPath);
		}
	});

	it('should create session and persist metadata', async () => {
		const session = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace',
			metadata: { cwd: '/workspace' }
		});

		const fetched = await sessionRepository.findById(session.id);

		expect(fetched).toBeTruthy();
		expect(fetched.kind).toBe('pty');
		expect(fetched.status).toBe('starting');
		expect(fetched.meta.workspacePath).toBe('/workspace');
		expect(fetched.meta.cwd).toBe('/workspace');
	});

	it('should persist session events with sequence numbers', async () => {
		const session = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});
		const sessionId = session.id;

		await eventRecorder.recordEvent(sessionId, {
			channel: 'pty:stdout',
			type: 'chunk',
			payload: Buffer.from('output 1')
		});

		await eventRecorder.recordEvent(sessionId, {
			channel: 'pty:stdout',
			type: 'chunk',
			payload: Buffer.from('output 2')
		});

		await eventRecorder.recordEvent(sessionId, {
			channel: 'system:status',
			type: 'closed',
			payload: { exitCode: 0 }
		});

		const events = await eventStore.getEvents(sessionId, -1);

		expect(events).toHaveLength(3);
		expect(events[0].seq).toBe(0);
		expect(events[1].seq).toBe(1);
		expect(events[2].seq).toBe(2);
		expect(events[0].channel).toBe('pty:stdout');
		expect(events[2].channel).toBe('system:status');
	});

	it('should support event replay from specific sequence', async () => {
		const session = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});
		const sessionId = session.id;

		for (let i = 1; i <= 5; i++) {
			await eventRecorder.recordEvent(sessionId, {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: Buffer.from(`output ${i}`)
			});
		}

		const events = await eventStore.getEvents(sessionId, 2);

		expect(events).toHaveLength(2);
		expect(events[0].seq).toBe(3);
		expect(events[1].seq).toBe(4);
	});

	it('should handle session status transitions', async () => {
		const session = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});
		const sessionId = session.id;

		let fetched = await sessionRepository.findById(sessionId);
		expect(fetched.status).toBe('starting');

		await sessionRepository.updateStatus(sessionId, 'running');
		fetched = await sessionRepository.findById(sessionId);
		expect(fetched.status).toBe('running');

		await sessionRepository.updateStatus(sessionId, 'stopped');
		fetched = await sessionRepository.findById(sessionId);
		expect(fetched.status).toBe('stopped');
	});

	it('should support concurrent event recording', async () => {
		const session = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});
		const sessionId = session.id;

		await Promise.all([
			eventRecorder.recordEvent(sessionId, {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: Buffer.from('concurrent 1')
			}),
			eventRecorder.recordEvent(sessionId, {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: Buffer.from('concurrent 2')
			}),
			eventRecorder.recordEvent(sessionId, {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: Buffer.from('concurrent 3')
			})
		]);

		const events = await eventStore.getEvents(sessionId, -1);

		expect(events).toHaveLength(3);
		expect(events[0].seq).toBe(0);
		expect(events[1].seq).toBe(1);
		expect(events[2].seq).toBe(2);
	});

	it('should list sessions by status', async () => {
		const session1 = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});

		const session2 = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});

		const session3 = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});

		await sessionRepository.updateStatus(session1.id, 'running');
		await sessionRepository.updateStatus(session2.id, 'running');
		await sessionRepository.updateStatus(session3.id, 'stopped');

		const sessions = await sessionRepository.findAll();

		expect(sessions).toHaveLength(3);

		const running = sessions.filter((s) => s.status === 'running');
		const stopped = sessions.filter((s) => s.status === 'stopped');

		expect(running).toHaveLength(2);
		expect(stopped).toHaveLength(1);
	});

	it('should handle session with large event history', { timeout: 30000 }, async () => {
		const session = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});
		const sessionId = session.id;

		for (let i = 1; i <= 1000; i++) {
			await eventRecorder.recordEvent(sessionId, {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: Buffer.from(`line ${i}\n`)
			});
		}

		const allEvents = await eventStore.getEvents(sessionId, -1);
		expect(allEvents).toHaveLength(1000);

		const recentEvents = await eventStore.getEvents(sessionId, 989);
		expect(recentEvents).toHaveLength(10);
		expect(recentEvents[0].seq).toBe(990);
	});
});

describe('Session Orchestration - Error Handling', () => {
	let db;
	let dbWrapper;
	let sessionRepository;
	let eventStore;
	let eventRecorder;
	let testDbPath;

	beforeEach(() => {
		testDbPath = join(__dirname, `test-integration-${Math.random()}.db`);
		db = new Database(testDbPath);

		db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				run_id TEXT PRIMARY KEY,
				owner_user_id TEXT,
				kind TEXT NOT NULL,
				status TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				meta_json TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS session_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				seq INTEGER NOT NULL,
				channel TEXT NOT NULL,
				type TEXT NOT NULL,
				payload BLOB NOT NULL,
				ts INTEGER NOT NULL,
				FOREIGN KEY (run_id) REFERENCES sessions(run_id)
			);
		`);

		dbWrapper = new TestDatabaseWrapper(db);
		sessionRepository = new SessionRepository(dbWrapper);
		eventStore = new EventStore(dbWrapper);
		eventRecorder = new EventRecorder(eventStore);
	});

	afterEach(() => {
		if (db) {
			db.close();
		}
		if (fs.existsSync(testDbPath)) {
			fs.unlinkSync(testDbPath);
		}
	});

	it('should reject duplicate session IDs', async () => {
		const session = await sessionRepository.create({
			kind: 'pty',
			workspacePath: '/workspace'
		});

		await expect(
			dbWrapper.run(
				`INSERT INTO sessions (run_id, owner_user_id, kind, status, created_at, updated_at, meta_json)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[session.id, null, 'pty', 'starting', Date.now(), Date.now(), '{}']
			)
		).rejects.toThrow();
	});

	it('should handle missing session for event recording', async () => {
		const nonExistentId = SessionId.create('pty').toString();

		await expect(
			eventRecorder.recordEvent(nonExistentId, {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: Buffer.from('orphan event')
			})
		).rejects.toThrow(/FOREIGN KEY/);
	});

	it('should handle invalid session ID format', async () => {
		const invalidId = 'not-a-valid-session-id';

		const session = await sessionRepository.findById(invalidId);
		expect(session).toBeNull();
	});
});
