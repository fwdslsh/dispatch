/**
 * Unit tests for WorkspaceRepository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceRepository } from '$lib/server/database/WorkspaceRepository.js';
import { DatabaseManager } from '$lib/server/database/DatabaseManager.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('WorkspaceRepository', () => {
	let tempDir;
	let db;
	let repository;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'dispatch-test-'));
		const dbPath = join(tempDir, 'test.db');
		db = new DatabaseManager({ dbPath });
		await db.init();
		repository = new WorkspaceRepository(db);
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
		it('should create workspace with path and name', async () => {
			const workspace = await repository.create({
				path: '/workspace/test-project',
				name: 'Test Project'
			});

			expect(workspace.id).toBe('/workspace/test-project');
			expect(workspace.path).toBe('/workspace/test-project');
			expect(workspace.name).toBe('Test Project');
			expect(workspace.themeOverride).toBeNull();
			expect(workspace.status).toBe('active');
			expect(workspace.createdAt).toBeDefined();
			expect(workspace.updatedAt).toBeDefined();
			expect(workspace.lastActive).toBeNull();
		});

		it('should derive name from path if not provided', async () => {
			const workspace = await repository.create({
				path: '/workspace/my-awesome-project'
			});

			expect(workspace.name).toBe('my-awesome-project');
		});

		it('should handle nested path for name derivation', async () => {
			const workspace = await repository.create({
				path: '/home/user/projects/deep/nested/project'
			});

			expect(workspace.name).toBe('project');
		});

		it('should handle root path', async () => {
			const workspace = await repository.create({
				path: '/'
			});

			expect(workspace.name).toBe('Root');
		});

		it('should trim whitespace from provided name', async () => {
			const workspace = await repository.create({
				path: '/workspace/test',
				name: '  Project Name  '
			});

			expect(workspace.name).toBe('Project Name');
		});

		it('should use derived name if provided name is empty after trimming', async () => {
			const workspace = await repository.create({
				path: '/workspace/fallback',
				name: '   '
			});

			expect(workspace.name).toBe('fallback');
		});

		it('should create workspace with theme override', async () => {
			const workspace = await repository.create({
				path: '/workspace/test',
				themeOverride: 'dracula'
			});

			expect(workspace.themeOverride).toBe('dracula');
		});

		it('should throw error for duplicate path', async () => {
			await repository.create({ path: '/workspace/test' });

			await expect(repository.create({ path: '/workspace/test' })).rejects.toThrow(
				'Workspace already exists: /workspace/test'
			);
		});
	});

	describe('findById', () => {
		it('should find workspace by path', async () => {
			await repository.create({
				path: '/workspace/test',
				name: 'Test Workspace'
			});

			const workspace = await repository.findById('/workspace/test');

			expect(workspace).toBeDefined();
			expect(workspace.path).toBe('/workspace/test');
			expect(workspace.name).toBe('Test Workspace');
		});

		it('should return null for non-existent workspace', async () => {
			const workspace = await repository.findById('/workspace/non-existent');

			expect(workspace).toBeNull();
		});

		it('should parse all fields correctly', async () => {
			await repository.create({
				path: '/workspace/test',
				name: 'Test',
				themeOverride: 'retro'
			});

			const workspace = await repository.findById('/workspace/test');

			expect(workspace.id).toBe('/workspace/test');
			expect(workspace.path).toBe('/workspace/test');
			expect(workspace.name).toBe('Test');
			expect(workspace.themeOverride).toBe('retro');
			expect(workspace.status).toBe('active');
			expect(workspace.createdAt).toBeDefined();
			expect(workspace.updatedAt).toBeDefined();
		});
	});

	describe('findAll', () => {
		it('should return empty array when no workspaces exist', async () => {
			const workspaces = await repository.findAll();

			expect(workspaces).toEqual([]);
		});

		it('should return all workspaces', async () => {
			await repository.create({ path: '/workspace/project1' });
			await repository.create({ path: '/workspace/project2' });
			await repository.create({ path: '/workspace/project3' });

			const workspaces = await repository.findAll();

			expect(workspaces).toHaveLength(3);
			expect(workspaces.map((w) => w.path).sort()).toEqual([
				'/workspace/project1',
				'/workspace/project2',
				'/workspace/project3'
			]);
		});

		it('should order by last_active DESC, then updated_at DESC', async () => {
			const ws1 = await repository.create({ path: '/workspace/oldest' });
			await new Promise((resolve) => setTimeout(resolve, 10));

			const ws2 = await repository.create({ path: '/workspace/middle' });
			await new Promise((resolve) => setTimeout(resolve, 10));

			const ws3 = await repository.create({ path: '/workspace/newest' });

			// Update last_active for middle workspace
			await repository.updateLastActive(ws2.path);

			const workspaces = await repository.findAll();

			// Middle should be first (has last_active set)
			// Then newest (most recent updated_at)
			// Then oldest
			expect(workspaces[0].path).toBe('/workspace/middle');
			expect(workspaces[1].path).toBe('/workspace/newest');
			expect(workspaces[2].path).toBe('/workspace/oldest');
		});
	});

	describe('update', () => {
		it('should update workspace name', async () => {
			await repository.create({
				path: '/workspace/test',
				name: 'Original Name'
			});

			await repository.update('/workspace/test', { name: 'New Name' });

			const workspace = await repository.findById('/workspace/test');

			expect(workspace.name).toBe('New Name');
		});

		it('should update theme override', async () => {
			await repository.create({ path: '/workspace/test' });

			await repository.update('/workspace/test', { themeOverride: 'dracula' });

			const workspace = await repository.findById('/workspace/test');

			expect(workspace.themeOverride).toBe('dracula');
		});

		it('should update multiple fields at once', async () => {
			await repository.create({
				path: '/workspace/test',
				name: 'Old Name'
			});

			await repository.update('/workspace/test', {
				name: 'New Name',
				themeOverride: 'retro'
			});

			const workspace = await repository.findById('/workspace/test');

			expect(workspace.name).toBe('New Name');
			expect(workspace.themeOverride).toBe('retro');
		});

		it('should update updated_at timestamp', async () => {
			const created = await repository.create({ path: '/workspace/test' });

			await new Promise((resolve) => setTimeout(resolve, 10));

			await repository.update('/workspace/test', { name: 'Updated' });

			const updated = await repository.findById('/workspace/test');

			expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
		});

		it('should throw error for non-existent workspace', async () => {
			await expect(
				repository.update('/workspace/non-existent', { name: 'New Name' })
			).rejects.toThrow('Workspace not found: /workspace/non-existent');
		});

		it('should handle empty updates object', async () => {
			await repository.create({ path: '/workspace/test', name: 'Original' });

			await repository.update('/workspace/test', {});

			const workspace = await repository.findById('/workspace/test');

			expect(workspace.name).toBe('Original');
		});

		it('should allow setting theme override to null', async () => {
			await repository.create({
				path: '/workspace/test',
				themeOverride: 'dracula'
			});

			await repository.update('/workspace/test', { themeOverride: null });

			const workspace = await repository.findById('/workspace/test');

			expect(workspace.themeOverride).toBeNull();
		});
	});

	describe('updateLastActive', () => {
		it('should update last_active timestamp', async () => {
			await repository.create({ path: '/workspace/test' });

			await repository.updateLastActive('/workspace/test');

			const workspace = await repository.findById('/workspace/test');

			expect(workspace.lastActive).toBeDefined();
			expect(workspace.lastActive).toBeGreaterThan(0);
		});

		it('should update both last_active and updated_at', async () => {
			const created = await repository.create({ path: '/workspace/test' });

			await new Promise((resolve) => setTimeout(resolve, 10));

			await repository.updateLastActive('/workspace/test');

			const updated = await repository.findById('/workspace/test');

			expect(updated.lastActive).toBeGreaterThan(created.createdAt);
			expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
		});

		it('should not throw for non-existent workspace', async () => {
			await expect(repository.updateLastActive('/workspace/non-existent')).resolves.not.toThrow();
		});

		it('should allow multiple updates', async () => {
			await repository.create({ path: '/workspace/test' });

			await repository.updateLastActive('/workspace/test');
			const first = await repository.findById('/workspace/test');

			await new Promise((resolve) => setTimeout(resolve, 10));

			await repository.updateLastActive('/workspace/test');
			const second = await repository.findById('/workspace/test');

			expect(second.lastActive).toBeGreaterThan(first.lastActive);
		});
	});

	describe('delete', () => {
		it('should delete workspace', async () => {
			await repository.create({ path: '/workspace/test' });

			await repository.delete('/workspace/test');

			const workspace = await repository.findById('/workspace/test');

			expect(workspace).toBeNull();
		});

		it('should not affect other workspaces', async () => {
			await repository.create({ path: '/workspace/keep' });
			await repository.create({ path: '/workspace/delete' });

			await repository.delete('/workspace/delete');

			const keep = await repository.findById('/workspace/keep');
			const deleted = await repository.findById('/workspace/delete');

			expect(keep).toBeDefined();
			expect(deleted).toBeNull();
		});

		it('should not throw when deleting non-existent workspace', async () => {
			await expect(repository.delete('/workspace/non-existent')).resolves.not.toThrow();
		});
	});

	describe('ensureExists', () => {
		it('should create workspace if it does not exist', async () => {
			const workspace = await repository.ensureExists('/workspace/new');

			expect(workspace).toBeDefined();
			expect(workspace.path).toBe('/workspace/new');
			expect(workspace.name).toBe('new');
		});

		it('should return existing workspace without creating duplicate', async () => {
			const created = await repository.create({
				path: '/workspace/existing',
				name: 'Original Name'
			});

			const ensured = await repository.ensureExists('/workspace/existing');

			expect(ensured.path).toBe(created.path);
			expect(ensured.name).toBe('Original Name');

			const all = await repository.findAll();
			expect(all).toHaveLength(1); // Only one workspace should exist
		});

		it('should use provided name when creating new workspace', async () => {
			const workspace = await repository.ensureExists('/workspace/test', 'Custom Name');

			expect(workspace.name).toBe('Custom Name');
		});

		it('should ignore provided name if workspace already exists', async () => {
			await repository.create({
				path: '/workspace/existing',
				name: 'Original Name'
			});

			const ensured = await repository.ensureExists('/workspace/existing', 'Ignored Name');

			expect(ensured.name).toBe('Original Name');
		});

		it('should be idempotent', async () => {
			const workspace1 = await repository.ensureExists('/workspace/test');
			const workspace2 = await repository.ensureExists('/workspace/test');
			const workspace3 = await repository.ensureExists('/workspace/test');

			expect(workspace1.path).toBe(workspace2.path);
			expect(workspace2.path).toBe(workspace3.path);

			const all = await repository.findAll();
			expect(all).toHaveLength(1);
		});
	});

	describe('name derivation edge cases', () => {
		it('should handle path with trailing slash', async () => {
			const workspace = await repository.create({
				path: '/workspace/project/'
			});

			expect(workspace.name).toBe('project');
		});

		it('should handle path with multiple trailing slashes', async () => {
			const workspace = await repository.create({
				path: '/workspace/project///'
			});

			expect(workspace.name).toBe('project');
		});

		it('should handle Windows-style paths', async () => {
			const workspace = await repository.create({
				path: 'C:/Users/Projects/MyProject'
			});

			expect(workspace.name).toBe('MyProject');
		});

		it('should handle empty string path', async () => {
			const workspace = await repository.create({
				path: ''
			});

			expect(workspace.name).toBe('Unnamed Workspace');
		});
	});

	describe('concurrent operations', () => {
		it('should handle concurrent workspace creation to different paths', async () => {
			const promises = Array.from({ length: 10 }, (_, i) =>
				repository.create({ path: `/workspace/project${i}` })
			);

			const workspaces = await Promise.all(promises);

			expect(workspaces).toHaveLength(10);
			expect(new Set(workspaces.map((w) => w.path)).size).toBe(10); // All unique
		});

		it('should prevent duplicate creation with concurrent requests', async () => {
			const promises = Array.from({ length: 5 }, () =>
				repository.create({ path: '/workspace/concurrent-test' })
			);

			const results = await Promise.allSettled(promises);

			const fulfilled = results.filter((r) => r.status === 'fulfilled');
			const rejected = results.filter((r) => r.status === 'rejected');

			expect(fulfilled).toHaveLength(1); // Only one should succeed
			expect(rejected).toHaveLength(4); // Rest should fail

			const all = await repository.findAll();
			expect(all).toHaveLength(1); // Only one workspace created
		});
	});
});
