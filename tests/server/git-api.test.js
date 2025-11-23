import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { GET } from '../../src/routes/api/git/status/+server.js';
import { POST as commitPost } from '../../src/routes/api/git/commit/+server.js';
import { POST as stagePost } from '../../src/routes/api/git/stage/+server.js';
import { POST as checkoutPost } from '../../src/routes/api/git/checkout/+server.js';
import { wrapHandler } from '../helpers/api-test-helper.js';

// Mock child_process spawn
vi.mock('node:child_process', () => ({
	spawn: vi.fn()
}));

// Mock path
vi.mock('node:path', () => ({
	resolve: vi.fn((path) => path),
	normalize: vi.fn((path) => path),
	isAbsolute: vi.fn((path) => path && path.startsWith('/')),
	join: vi.fn((...paths) => paths.join('/')),
	dirname: vi.fn((path) => path.substring(0, path.lastIndexOf('/'))),
	basename: vi.fn((path) => path.substring(path.lastIndexOf('/') + 1)),
	relative: vi.fn((from, to) => to)
}));

// Mock fs
vi.mock('node:fs', () => ({
	existsSync: vi.fn(() => true),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn()
}));

describe('Git API Endpoints', () => {
	let mockSpawn;
	const statusHandler = wrapHandler(GET);
	const commitHandler = wrapHandler(commitPost);
	const stageHandler = wrapHandler(stagePost);
	const checkoutHandler = wrapHandler(checkoutPost);

	beforeEach(async () => {
		mockSpawn = spawn;
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/git/status', () => {
		it('should return git status for valid repository', async () => {
			// Mock git rev-parse success
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock git rev-parse for branch
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn((event, callback) => callback('main\n')) },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			// Mock git status
			mockSpawn.mockImplementationOnce(() => ({
				stdout: {
					on: vi.fn((event, callback) =>
						callback('## main...origin/main [ahead 1]\n M file1.js\n?? file2.js\nA  file3.js\n')
					)
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const url = new URL('http://localhost/api/git/status?path=/test/repo');
			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ url })
			);
			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await statusHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.branch).toBe('main');
			expect(data.isGitRepo).toBe(true);
			expect(data.status).toEqual({
				modified: ['file1.js'],
				staged: ['file3.js'],
				untracked: ['file2.js'],
				ahead: 1,
				behind: 0
			});
		});

		it('should return 404 for non-git repository', async () => {
			// Mock git rev-parse failure
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn((event, callback) => callback('Not a git repository')) },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(128);
				})
			}));

			const url = new URL('http://localhost/api/git/status?path=/test/repo');
			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ url })
			);
			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await statusHandler(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe('Not a git repository');
		});

		it('should return 400 for missing path parameter', async () => {
			const url = new URL('http://localhost/api/git/status');
			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ url })
			);
			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await statusHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Path parameter is required');
		});
	});

	describe('POST /api/git/commit', () => {
		it('should create commit successfully', async () => {
			// Mock successful git commit
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn((event, callback) => callback('Commit created successfully')) },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						message: 'Test commit message'
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await commitHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.message).toBe('Commit created successfully');
		});

		it('should return 400 for missing message', async () => {
			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						message: ''
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await commitHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Path and message are required');
		});

		it('should handle git commit errors', async () => {
			// Mock failed git commit
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn((event, callback) => callback('Nothing to commit')) },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(1);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						message: 'Test commit message'
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await commitHandler(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Nothing to commit');
		});
	});

	describe('POST /api/git/stage', () => {
		it('should stage files successfully', async () => {
			// Mock successful git add
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						files: ['file1.js'],
						action: 'stage'
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await stageHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.action).toBe('stage');
			expect(data.files).toEqual(['file1.js']);
		});

		it('should unstage files successfully', async () => {
			// Mock successful git reset
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						files: ['file1.js'],
						action: 'unstage'
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await stageHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.action).toBe('unstage');
			expect(data.files).toEqual(['file1.js']);
		});

		it('should return 400 for invalid action', async () => {
			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						files: ['file1.js'],
						action: 'invalid'
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await stageHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Action must be "stage" or "unstage"');
		});

		it('should return 400 for missing required parameters', async () => {
			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo'
						// missing files and action
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await stageHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Path, files array, and action are required');
		});
	});

	describe('POST /api/git/checkout', () => {
		it('should checkout branch successfully', async () => {
			// Mock successful git checkout
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn((event, callback) => callback("Switched to branch 'develop'")) },
				stderr: { on: vi.fn() },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(0);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						branch: 'develop'
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await checkoutHandler(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.branch).toBe('develop');
			expect(data.message).toBe("Switched to branch 'develop'");
		});

		it('should return 400 for missing branch', async () => {
			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo'
						// missing branch
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await checkoutHandler(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Path and branch are required');
		});

		it('should handle git checkout errors', async () => {
			// Mock failed git checkout
			mockSpawn.mockImplementationOnce(() => ({
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn((event, callback) => callback("Branch 'nonexistent' not found")) },
				on: vi.fn((event, callback) => {
					if (event === 'close') callback(1);
				})
			}));

			const request = /** @type {Request} */ (
				/** @type {any} */ ({
					json: async () => ({
						path: '/test/repo',
						branch: 'nonexistent'
					})
				})
			);

			const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
				/** @type {any} */ ({ request })
			);

			// @ts-expect-error - Test mock doesn't match exact RequestEvent type
			const response = await checkoutHandler(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe("Branch 'nonexistent' not found");
		});
	});
});
