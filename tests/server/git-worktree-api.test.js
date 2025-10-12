import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GET as listWorktrees } from '../../src/routes/api/git/worktree/list/+server.js';
import { POST as addWorktree } from '../../src/routes/api/git/worktree/add/+server.js';
import { POST as removeWorktree } from '../../src/routes/api/git/worktree/remove/+server.js';
import {
	GET as detectInit,
	POST as saveInit
} from '../../src/routes/api/git/worktree/init-detect/+server.js';

// Mock child_process spawn
vi.mock('node:child_process', () => ({
	spawn: vi.fn()
}));

// Mock path
vi.mock('node:path', () => ({
	resolve: vi.fn((path) => path),
	join: vi.fn((...paths) => paths.join('/')),
	normalize: vi.fn((path) => path),
	isAbsolute: vi.fn((path) => path && path.startsWith('/')),
	dirname: vi.fn((path) => path.substring(0, path.lastIndexOf('/'))),
	basename: vi.fn((path) => path.substring(path.lastIndexOf('/') + 1)),
	relative: vi.fn((from, to) => to)
}));

// Mock fs - default to paths under /test/ existing for path validation
vi.mock('node:fs', () => ({
	existsSync: vi.fn((path) => path && path.startsWith('/test/')),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn()
}));

// Type assertions for mocked functions so TypeScript knows they're vitest mocks
// @ts-ignore - Test mocks
const mockExistsSync = /** @type {import('vitest').Mock} */ (existsSync);
// @ts-ignore - Test mocks
const mockReadFileSync = /** @type {import('vitest').Mock} */ (readFileSync);
// @ts-ignore - Test mocks
const mockWriteFileSync = /** @type {import('vitest').Mock} */ (writeFileSync);

describe('Git Worktree API Endpoints', () => {
	let mockSpawn;

	beforeEach(async () => {
		mockSpawn = spawn;
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/git/worktree/list', () => {
		it('should list worktrees for valid repository', async () => {
			// Mock git rev-parse success
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock git worktree list --porcelain output format
			const worktreeOutput = [
				'worktree /home/user/project',
				'HEAD abcd1234',
				'branch refs/heads/main',
				'',
				'worktree /home/user/project-feature',
				'HEAD efgh5678',
				'branch refs/heads/feature-branch'
			].join('\n');

			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') callback(worktreeOutput);
					})
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const url = new URL('http://test.com?path=/test/repo');
			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ url })
			);
			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await listWorktrees(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.worktrees).toHaveLength(2);
			expect(data.worktrees[0]).toEqual({
				path: '/home/user/project',
				head: 'abcd1234',
				branch: 'main'
			});
		});

		it('should handle non-git repository', async () => {
			// Mock git rev-parse failure
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn((event, callback) => callback('Not a git repository')) },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(1);
				})
			}));

			const url = new URL('http://test.com?path=/test/not-repo');
			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ url })
			);
			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await listWorktrees(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe('Not a git repository');
		});
	});

	describe('POST /api/git/worktree/add', () => {
		it('should add worktree with new branch', async () => {
			mockExistsSync.mockReturnValue(false); // Worktree path doesn't exist

			// Mock git rev-parse success
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock git worktree add
			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') callback('Preparing worktree');
					})
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: () =>
						Promise.resolve({
							path: '/test/repo',
							worktreePath: '/test/repo-feature',
							newBranch: 'feature-branch'
						})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await addWorktree(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.branch).toBe('feature-branch');
			expect(data.worktreePath).toBe('/test/repo-feature');
		});

		it('should handle existing worktree path', async () => {
			mockExistsSync.mockImplementation((path) => {
				return path === '/test/existing'; // Only worktree path exists
			});

			// Mock git rev-parse success first
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: () =>
						Promise.resolve({
							path: '/test/repo',
							worktreePath: '/test/existing',
							newBranch: 'feature-branch'
						})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await addWorktree(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Worktree path already exists');
		});

		it('should execute .dispatchrc with original repo path parameter', async () => {
			mockExistsSync.mockImplementation((path) => {
				if (path === '/test/repo-feature') return false; // Worktree path doesn't exist
				if (path === '/test/repo/.dispatchrc') return true; // .dispatchrc exists
				return false;
			});

			// Mock git rev-parse success
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock git worktree add
			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') callback('Preparing worktree');
					})
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock .dispatchrc execution with bash
			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') callback('Script executed successfully');
					})
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: () =>
						Promise.resolve({
							path: '/test/repo',
							worktreePath: '/test/repo-feature',
							newBranch: 'feature-branch',
							runInit: true,
							initCommands: ['npm install'] // This should be ignored if .dispatchrc exists
						})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await addWorktree(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.initResults).toHaveLength(1);
			expect(data.initResults[0].command).toBe('.dispatchrc /test/repo');
			expect(data.initResults[0].success).toBe(true);

			// Verify that bash was called with the correct arguments
			expect(mockSpawn).toHaveBeenCalledWith('bash', ['/test/repo/.dispatchrc', '/test/repo'], {
				cwd: '/test/repo-feature',
				encoding: 'utf8'
			});
		});

		it('should fallback to individual commands when .dispatchrc does not exist', async () => {
			mockExistsSync.mockImplementation((path) => {
				if (path === '/test/repo-feature') return false; // Worktree path doesn't exist
				if (path === '/test/repo/.dispatchrc') return false; // .dispatchrc does not exist
				return false;
			});

			// Mock git rev-parse success
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock git worktree add
			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') callback('Preparing worktree');
					})
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock individual command execution
			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') callback('npm install completed');
					})
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: () =>
						Promise.resolve({
							path: '/test/repo',
							worktreePath: '/test/repo-feature',
							newBranch: 'feature-branch',
							runInit: true,
							initCommands: ['npm install']
						})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await addWorktree(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.initResults).toHaveLength(1);
			expect(data.initResults[0].command).toBe('npm install');
			expect(data.initResults[0].success).toBe(true);

			// Verify that sh was called for individual command execution
			expect(mockSpawn).toHaveBeenCalledWith('sh', ['-c', 'npm install'], {
				cwd: '/test/repo-feature',
				encoding: 'utf8'
			});
		});
	});

	describe('POST /api/git/worktree/remove', () => {
		it('should remove worktree', async () => {
			// Mock git rev-parse success
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock git worktree remove
			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') callback('');
					})
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: () =>
						Promise.resolve({
							path: '/test/repo',
							worktreePath: '/test/repo-feature'
						})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await removeWorktree(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.worktreePath).toBe('/test/repo-feature');
		});
	});

	describe('GET /api/git/worktree/init-detect', () => {
		it('should detect Node.js project', async () => {
			mockExistsSync.mockImplementation((path) => {
				return path.includes('package.json') || path === '/test/project';
			});

			const url = new URL('http://test.com?path=/test/project');
			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ url })
			);
			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await detectInit(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.detected).toHaveLength(1);
			expect(data.detected[0].description).toBe('Node.js project detected');
			expect(data.suggestedCommands).toContain('npm install');
		});

		it('should detect existing .dispatchrc script', async () => {
			mockExistsSync.mockImplementation((path) => {
				return path === '/test/project' || path.includes('.dispatchrc');
			});

			mockReadFileSync.mockReturnValue('#!/bin/bash\nnpm install\nnpm run build');

			const url = new URL('http://test.com?path=/test/project');
			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ url })
			);
			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await detectInit(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.hasDispatchrc).toBe(true);
			expect(data.existingScript.commands).toContain('npm install');
			expect(data.existingScript.commands).toContain('npm run build');
		});
	});

	describe('POST /api/git/worktree/init-detect', () => {
		it('should save .dispatchrc script', async () => {
			mockExistsSync.mockReturnValue(true);

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: () =>
						Promise.resolve({
							path: '/test/project',
							commands: ['npm install', 'npm run build']
						})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await saveInit(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.scriptPath).toBe('/test/project/.dispatchrc');
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				'/test/project/.dispatchrc',
				expect.stringContaining('npm install'),
				'utf8'
			);
		});
	});
});
