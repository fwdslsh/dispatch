/**
 * Unit tests for SessionRepository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionRepository } from '$lib/server/database/SessionRepository.js';
import { DatabaseManager } from '$lib/server/database/DatabaseManager.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SessionRepository', () => {
	let tempDir;
	let db;
	let repository;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'dispatch-test-'));
		const dbPath = join(tempDir, 'test.db');
		db = new DatabaseManager({ dbPath });
		await db.init();
		repository = new SessionRepository(db);
	});

	afterEach(async () => {
		if (db) {
			await db.close();
		}
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	describe('create', () => {
		it('should create a new session with required fields', async () => {
			const session = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			expect(session).toBeDefined();
			expect(session.id).toBeDefined();
			expect(session.runId).toBe(session.id);
			expect(session.kind).toBe('pty');
			expect(session.status).toBe('starting');
			expect(session.meta.workspacePath).toBe('/workspace/test');
			expect(session.createdAt).toBeDefined();
			expect(session.updatedAt).toBeDefined();
		});

		it('should create session with metadata', async () => {
			const session = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test',
				metadata: {
					model: 'claude-3-5-sonnet-20241022',
					maxTokens: 4096
				}
			});

			expect(session.meta.model).toBe('claude-3-5-sonnet-20241022');
			expect(session.meta.maxTokens).toBe(4096);
			expect(session.meta.workspacePath).toBe('/workspace/test');
		});

		it('should create session with owner user ID', async () => {
			const session = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test',
				ownerUserId: 'user-123'
			});

			expect(session.ownerUserId).toBe('user-123');
		});

		it('should generate unique run IDs', async () => {
			const session1 = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			const session2 = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			expect(session1.id).not.toBe(session2.id);
		});

		it('should include kind in run ID', async () => {
			const ptySession = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			const claudeSession = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test'
			});

			expect(ptySession.id).toContain('pty-');
			expect(claudeSession.id).toContain('claude-');
		});
	});

	describe('findById', () => {
		it('should find existing session by ID', async () => {
			const created = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			const found = await repository.findById(created.id);

			expect(found).toBeDefined();
			expect(found.id).toBe(created.id);
			expect(found.kind).toBe(created.kind);
			expect(found.meta.workspacePath).toBe('/workspace/test');
		});

		it('should return null for non-existent session', async () => {
			const found = await repository.findById('non-existent-id');

			expect(found).toBeNull();
		});

		it('should parse metadata correctly', async () => {
			const created = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test',
				metadata: {
					model: 'claude-3-5-sonnet-20241022',
					nested: { key: 'value' }
				}
			});

			const found = await repository.findById(created.id);

			expect(found.meta.model).toBe('claude-3-5-sonnet-20241022');
			expect(found.meta.nested).toEqual({ key: 'value' });
		});
	});

	describe('findByWorkspace', () => {
		it('should find sessions by workspace path', async () => {
			await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/project1'
			});

			await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/project1'
			});

			await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/project2'
			});

			const sessions = await repository.findByWorkspace('/workspace/project1');

			expect(sessions).toHaveLength(2);
			expect(sessions.every((s) => s.meta.workspacePath === '/workspace/project1')).toBe(true);
		});

		it('should return empty array when no sessions in workspace', async () => {
			const sessions = await repository.findByWorkspace('/workspace/empty');

			expect(sessions).toEqual([]);
		});

		it('should return sessions ordered by updated_at DESC', async () => {
			const session1 = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			// Wait a bit to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 10));

			const session2 = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test'
			});

			const sessions = await repository.findByWorkspace('/workspace/test');

			expect(sessions[0].id).toBe(session2.id);
			expect(sessions[1].id).toBe(session1.id);
		});
	});

	describe('findByKind', () => {
		it('should find sessions by kind', async () => {
			await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });
			await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });
			await repository.create({ kind: 'claude', workspacePath: '/workspace/test' });

			const ptySessions = await repository.findByKind('pty');
			const claudeSessions = await repository.findByKind('claude');

			expect(ptySessions).toHaveLength(2);
			expect(claudeSessions).toHaveLength(1);
			expect(ptySessions.every((s) => s.kind === 'pty')).toBe(true);
			expect(claudeSessions.every((s) => s.kind === 'claude')).toBe(true);
		});

		it('should return empty array when no sessions of kind', async () => {
			const sessions = await repository.findByKind('file-editor');

			expect(sessions).toEqual([]);
		});
	});

	describe('findAll', () => {
		it('should return all sessions', async () => {
			await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });
			await repository.create({ kind: 'claude', workspacePath: '/workspace/test' });
			await repository.create({ kind: 'file-editor', workspacePath: '/workspace/test' });

			const sessions = await repository.findAll();

			expect(sessions).toHaveLength(3);
		});

		it('should return empty array when no sessions', async () => {
			const sessions = await repository.findAll();

			expect(sessions).toEqual([]);
		});

		it('should order by updated_at DESC', async () => {
			const session1 = await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });
			await new Promise((resolve) => setTimeout(resolve, 10));
			const session2 = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test'
			});

			const sessions = await repository.findAll();

			expect(sessions[0].id).toBe(session2.id);
			expect(sessions[1].id).toBe(session1.id);
		});
	});

	describe('updateStatus', () => {
		it('should update session status', async () => {
			const session = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			expect(session.status).toBe('starting');

			await repository.updateStatus(session.id, 'running');

			const updated = await repository.findById(session.id);
			expect(updated.status).toBe('running');
		});

		it('should update updatedAt timestamp', async () => {
			const session = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			const originalUpdatedAt = session.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));
			await repository.updateStatus(session.id, 'running');

			const updated = await repository.findById(session.id);
			expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
		});

		it('should handle status transitions', async () => {
			const session = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			await repository.updateStatus(session.id, 'running');
			let found = await repository.findById(session.id);
			expect(found.status).toBe('running');

			await repository.updateStatus(session.id, 'stopped');
			found = await repository.findById(session.id);
			expect(found.status).toBe('stopped');

			await repository.updateStatus(session.id, 'error');
			found = await repository.findById(session.id);
			expect(found.status).toBe('error');
		});
	});

	describe('updateMetadata', () => {
		it('should update session metadata', async () => {
			const session = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test',
				metadata: {
					model: 'claude-3-5-sonnet-20241022'
				}
			});

			await repository.updateMetadata(session.id, {
				maxTokens: 8192,
				temperature: 0.7
			});

			const updated = await repository.findById(session.id);
			expect(updated.meta.model).toBe('claude-3-5-sonnet-20241022');
			expect(updated.meta.maxTokens).toBe(8192);
			expect(updated.meta.temperature).toBe(0.7);
		});

		it('should merge metadata with existing values', async () => {
			const session = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test',
				metadata: {
					shell: '/bin/bash',
					env: { PATH: '/usr/bin' }
				}
			});

			await repository.updateMetadata(session.id, {
				columns: 80,
				rows: 24
			});

			const updated = await repository.findById(session.id);
			expect(updated.meta.shell).toBe('/bin/bash');
			expect(updated.meta.env).toEqual({ PATH: '/usr/bin' });
			expect(updated.meta.columns).toBe(80);
			expect(updated.meta.rows).toBe(24);
		});

		it('should throw error for non-existent session', async () => {
			await expect(repository.updateMetadata('non-existent-id', { key: 'value' })).rejects.toThrow(
				'Session not found: non-existent-id'
			);
		});

		it('should update updatedAt timestamp', async () => {
			const session = await repository.create({
				kind: 'pty',
				workspacePath: '/workspace/test'
			});

			const originalUpdatedAt = session.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));
			await repository.updateMetadata(session.id, { key: 'value' });

			const updated = await repository.findById(session.id);
			expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
		});
	});

	describe('markAllStopped', () => {
		it('should mark all running sessions as stopped', async () => {
			const session1 = await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });
			const session2 = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test'
			});
			const session3 = await repository.create({
				kind: 'file-editor',
				workspacePath: '/workspace/test'
			});

			await repository.updateStatus(session1.id, 'running');
			await repository.updateStatus(session2.id, 'running');
			await repository.updateStatus(session3.id, 'stopped');

			await repository.markAllStopped();

			const updated1 = await repository.findById(session1.id);
			const updated2 = await repository.findById(session2.id);
			const updated3 = await repository.findById(session3.id);

			expect(updated1.status).toBe('stopped');
			expect(updated2.status).toBe('stopped');
			expect(updated3.status).toBe('stopped');
		});

		it('should mark starting sessions as stopped', async () => {
			const session = await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });

			expect(session.status).toBe('starting');

			await repository.markAllStopped();

			const updated = await repository.findById(session.id);
			expect(updated.status).toBe('stopped');
		});

		it('should not affect already stopped sessions', async () => {
			const session = await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });
			await repository.updateStatus(session.id, 'stopped');

			const beforeUpdatedAt = (await repository.findById(session.id)).updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));
			await repository.markAllStopped();

			const after = await repository.findById(session.id);
			expect(after.status).toBe('stopped');
			expect(after.updatedAt).toBe(beforeUpdatedAt);
		});

		it('should handle empty database', async () => {
			await expect(repository.markAllStopped()).resolves.not.toThrow();
		});
	});

	describe('delete', () => {
		it('should delete session', async () => {
			const session = await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });

			await repository.delete(session.id);

			const found = await repository.findById(session.id);
			expect(found).toBeNull();
		});

		it('should not throw when deleting non-existent session', async () => {
			await expect(repository.delete('non-existent-id')).resolves.not.toThrow();
		});

		it('should not affect other sessions', async () => {
			const session1 = await repository.create({ kind: 'pty', workspacePath: '/workspace/test' });
			const session2 = await repository.create({
				kind: 'claude',
				workspacePath: '/workspace/test'
			});

			await repository.delete(session1.id);

			const found1 = await repository.findById(session1.id);
			const found2 = await repository.findById(session2.id);

			expect(found1).toBeNull();
			expect(found2).toBeDefined();
			expect(found2.id).toBe(session2.id);
		});
	});
});
