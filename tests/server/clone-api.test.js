import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { POST } from '../../src/routes/api/browse/clone/+server.js';

describe('Directory Clone API', () => {
	const testDir = resolve('./test-clone-workspace');
	const sourceDir = join(testDir, 'source');
	const targetDir = join(testDir, 'target');

	beforeEach(async () => {
		// Create test directories
		await mkdir(testDir, { recursive: true });
		await mkdir(sourceDir, { recursive: true });

		// Create test files in source directory
		await writeFile(join(sourceDir, 'file1.txt'), 'Hello World');
		await writeFile(join(sourceDir, 'file2.js'), 'console.log("test");');

		// Create subdirectory with files
		const subDir = join(sourceDir, 'subdir');
		await mkdir(subDir, { recursive: true });
		await writeFile(join(subDir, 'nested.txt'), 'Nested content');
	});

	afterEach(async () => {
		// Cleanup test directories
		try {
			await rm(testDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it('should clone a directory successfully', async () => {
		// Type assertion needed because mock only implements json() method
		// Full Request interface has 20+ properties we don't need for testing
		const request = /** @type {Request} */ (
			/** @type {any} */ ({
				json: async () => ({
					sourcePath: sourceDir,
					targetPath: targetDir
				})
			})
		);

		// Type assertion for RequestEvent - test only needs request property
		const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
			/** @type {any} */ ({ request })
		);

		// @ts-expect-error - Test mock doesn't match exact RequestEvent type
		const response = await POST(event);
		const result = await response.json();

		expect(response.status).toBe(200);
		expect(result.success).toBe(true);
		expect(result.sourcePath).toBe(resolve(sourceDir));
		expect(result.targetPath).toBe(resolve(targetDir));

		// Verify files were copied
		const targetFiles = await readdir(targetDir);
		expect(targetFiles).toContain('file1.txt');
		expect(targetFiles).toContain('file2.js');
		expect(targetFiles).toContain('subdir');

		// Verify subdirectory was copied
		const subDirFiles = await readdir(join(targetDir, 'subdir'));
		expect(subDirFiles).toContain('nested.txt');
	});

	it('should return error if source directory does not exist', async () => {
		const request = /** @type {Request} */ (
			/** @type {any} */ ({
				json: async () => ({
					sourcePath: join(testDir, 'nonexistent'),
					targetPath: targetDir
				})
			})
		);

		const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
			/** @type {any} */ ({ request })
		);

		// @ts-expect-error - Test mock doesn't match exact RequestEvent type
		const response = await POST(event);
		const result = await response.json();

		expect(response.status).toBe(404);
		expect(result.error).toBe('Source directory does not exist');
	});

	it('should return error if target already exists and overwrite is false', async () => {
		// Create target directory
		await mkdir(targetDir, { recursive: true });

		const request = /** @type {Request} */ (
			/** @type {any} */ ({
				json: async () => ({
					sourcePath: sourceDir,
					targetPath: targetDir,
					overwrite: false
				})
			})
		);

		const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
			/** @type {any} */ ({ request })
		);

		// @ts-expect-error - Test mock doesn't match exact RequestEvent type
		const response = await POST(event);
		const result = await response.json();

		expect(response.status).toBe(409);
		expect(result.error).toBe('Target directory already exists');
	});

	it('should validate required parameters', async () => {
		const request = /** @type {Request} */ (
			/** @type {any} */ ({
				json: async () => ({
					sourcePath: '',
					targetPath: targetDir
				})
			})
		);

		const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
			/** @type {any} */ ({ request })
		);

		// @ts-expect-error - Test mock doesn't match exact RequestEvent type
		const response = await POST(event);
		const result = await response.json();

		expect(response.status).toBe(400);
		expect(result.error).toBe('Source path is required');
	});

	it('should prevent copying directory into itself', async () => {
		const request = /** @type {Request} */ (
			/** @type {any} */ ({
				json: async () => ({
					sourcePath: sourceDir,
					targetPath: join(sourceDir, 'subfolder')
				})
			})
		);

		const event = /** @type {import('@sveltejs/kit').RequestEvent} */ (
			/** @type {any} */ ({ request })
		);

		// @ts-expect-error - Test mock doesn't match exact RequestEvent type
		const response = await POST(event);
		const result = await response.json();

		expect(response.status).toBe(400);
		expect(result.error).toBe('Cannot copy directory into itself or its subdirectory');
	});
});
