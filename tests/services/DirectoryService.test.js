/**
 * DirectoryService Unit Tests
 * Tests directory listing, path validation, navigation logic, and caching
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DirectoryService } from '../../src/lib/shared/services/DirectoryService.js';

describe('DirectoryService', () => {
	let directoryService;
	let mockSocket;

	beforeEach(() => {
		// Mock socket instance
		mockSocket = {
			emit: vi.fn()
		};

		// Create service instance
		directoryService = new DirectoryService({
			maxPathLength: 500,
			cacheTimeout: 1000, // Short timeout for testing
			maxCacheSize: 5
		});

		directoryService.setSocket(mockSocket);
	});

	afterEach(() => {
		if (directoryService && !directoryService.isDisposed) {
			directoryService.dispose();
		}
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with default options', () => {
			const service = new DirectoryService();
			
			expect(service.options.maxPathLength).toBe(1024);
			expect(service.options.restrictToProject).toBe(true);
			expect(service.isDisposed).toBe(false);
		});

		it('should initialize with custom options', () => {
			const customOptions = {
				maxPathLength: 200,
				cacheTimeout: 5000,
				restrictToProject: false
			};

			const service = new DirectoryService(customOptions);

			expect(service.options.maxPathLength).toBe(200);
			expect(service.options.cacheTimeout).toBe(5000);
			expect(service.options.restrictToProject).toBe(false);
		});

		it('should initialize empty cache', () => {
			expect(directoryService.cache.size).toBe(0);
		});
	});

	describe('Directory Listing', () => {
		beforeEach(() => {
			// Mock successful socket response
			mockSocket.emit.mockImplementation((event, data, callback) => {
				setTimeout(() => {
					callback({
						success: true,
						directories: [
							{ name: 'src', type: 'directory' },
							{ name: 'docs', type: 'directory' },
							{ name: 'tests', type: 'directory' }
						]
					});
				}, 0);
			});
		});

		it('should list directories successfully', async () => {
			const result = await directoryService.listDirectories({
				projectId: 'test-project',
				relativePath: 'src'
			});

			expect(result.success).toBe(true);
			expect(result.directories).toHaveLength(3);
			expect(result.directories[0].name).toBe('docs'); // Sorted alphabetically
			expect(mockSocket.emit).toHaveBeenCalledWith(
				'list-project-directories',
				{
					projectId: 'test-project',
					relativePath: 'src',
					options: {
						includeHidden: false,
						sortBy: 'name',
						sortOrder: 'asc'
					}
				},
				expect.any(Function)
			);
		});

		it('should normalize directory results', async () => {
			mockSocket.emit.mockImplementation((event, data, callback) => {
				callback({
					success: true,
					directories: [
						{ name: 'test-dir' }, // Missing type
						{ name: 'complete-dir', type: 'directory', size: 1024 }
					]
				});
			});

			const result = await directoryService.listDirectories({
				projectId: 'test-project'
			});

			expect(result.directories[1].type).toBe('directory'); // Default type
			expect(result.directories[0].type).toBe('directory');
			expect(result.directories[0].path).toBe('test-dir'); // Default path
			expect(result.directories[0].permissions).toBe('readable'); // Default permissions
		});

		it('should handle socket errors', async () => {
			mockSocket.emit.mockImplementation((event, data, callback) => {
				throw new Error('Socket connection failed');
			});

			const result = await directoryService.listDirectories({
				projectId: 'test-project'
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Socket connection failed');
			expect(result.directories).toEqual([]);
		});

		it('should handle service error responses', async () => {
			mockSocket.emit.mockImplementation((event, data, callback) => {
				callback({
					success: false,
					error: 'Permission denied'
				});
			});

			const result = await directoryService.listDirectories({
				projectId: 'test-project',
				relativePath: 'restricted'
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Permission denied');
		});

		it('should require project ID', async () => {
			const result = await directoryService.listDirectories({
				relativePath: 'src'
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Project ID is required for directory listing');
		});

		it('should handle malformed responses', async () => {
			mockSocket.emit.mockImplementation((event, data, callback) => {
				callback(null); // Invalid response
			});

			const result = await directoryService.listDirectories({
				projectId: 'test-project'
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid response from directory service');
		});

		it('should handle socket timeout', async () => {
			mockSocket.emit.mockImplementation(() => {
				// Don't call callback - simulate timeout
			});

			const result = await directoryService.listDirectories({
				projectId: 'test-project'
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Request timeout');
		});
	});

	describe('Path Validation', () => {
		it('should validate normal paths', () => {
			const validPaths = [
				'',
				'src',
				'src/components',
				'docs/api/v1',
				'test_folder',
				'folder-with-dashes'
			];

			validPaths.forEach(path => {
				const result = directoryService.validatePath(path);
				expect(result.isValid).toBe(true);
				expect(result.normalizedPath).toBeDefined();
			});
		});

		it('should reject dangerous paths', () => {
			const dangerousPaths = [
				'../parent',
				'src/../../../etc',
				'/absolute/path',
				'folder<script>',
				'folder>output',
				'folder|pipe',
				'folder?query',
				'folder*wildcard',
				'folder"quote',
				'folder:colon',
				'folder\0null'
			];

			dangerousPaths.forEach(path => {
				const result = directoryService.validatePath(path);
				expect(result.isValid).toBe(false);
				expect(result.error).toContain('invalid or dangerous characters');
			});
		});

		it('should reject non-string paths', () => {
			const invalidTypes = [null, undefined, 123, {}, [], true];

			invalidTypes.forEach(path => {
				const result = directoryService.validatePath(path);
				expect(result.isValid).toBe(false);
				expect(result.error).toBe('Path must be a string');
			});
		});

		it('should reject paths that are too long', () => {
			const longPath = 'a'.repeat(501); // Exceeds maxPathLength of 500

			const result = directoryService.validatePath(longPath);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Path too long');
		});

		it('should normalize valid paths', () => {
			const pathTests = [
				{ input: '', expected: '' },
				{ input: 'src', expected: 'src' },
				{ input: 'src/', expected: 'src' },
				{ input: 'src//components', expected: 'src/components' },
				{ input: './src', expected: 'src' },
				{ input: 'src/./components', expected: 'src/components' }
			];

			pathTests.forEach(({ input, expected }) => {
				const result = directoryService.validatePath(input);
				expect(result.isValid).toBe(true);
				expect(result.normalizedPath).toBe(expected);
			});
		});
	});

	describe('Path Operations', () => {
		describe('resolvePath', () => {
			it('should resolve relative paths correctly', () => {
				const testCases = [
					{ base: 'src', relative: 'components', expected: 'src/components' },
					{ base: '', relative: 'src', expected: 'src' },
					{ base: 'src/components', relative: '../utils', expected: 'src/utils' },
					{ base: 'src', relative: '../docs', expected: 'docs' },
					{ base: 'deep/nested/folder', relative: '../../other', expected: 'deep/other' },
					{ base: 'src', relative: '', expected: 'src' },
					{ base: '', relative: '', expected: '' }
				];

				testCases.forEach(({ base, relative, expected }) => {
					const result = directoryService.resolvePath(base, relative);
					expect(result).toBe(expected);
				});
			});

			it('should handle absolute-style relative paths', () => {
				const result = directoryService.resolvePath('src/components', '/docs');
				expect(result).toBe('docs');
			});

			it('should handle excessive parent directory navigation', () => {
				const result = directoryService.resolvePath('src', '../../../etc');
				expect(result).toBe('');
			});
		});

		describe('getParentPath', () => {
			it('should get parent paths correctly', () => {
				const testCases = [
					{ input: 'src/components/ui', expected: 'src/components' },
					{ input: 'src/components', expected: 'src' },
					{ input: 'src', expected: '' },
					{ input: '', expected: '' }
				];

				testCases.forEach(({ input, expected }) => {
					const result = directoryService.getParentPath(input);
					expect(result).toBe(expected);
				});
			});
		});

		describe('generateBreadcrumbs', () => {
			it('should generate breadcrumbs correctly', () => {
				const testCases = [
					{ input: '', expected: ['/'] },
					{ input: 'src', expected: ['/', 'src'] },
					{ input: 'src/components', expected: ['/', 'src', 'components'] },
					{ input: 'deep/nested/path', expected: ['/', 'deep', 'nested', 'path'] }
				];

				testCases.forEach(({ input, expected }) => {
					const result = directoryService.generateBreadcrumbs(input);
					expect(result).toEqual(expected);
				});
			});
		});

		describe('joinPath', () => {
			it('should join path segments correctly', () => {
				const testCases = [
					{ segments: ['src', 'components'], expected: 'src/components' },
					{ segments: ['src', '', 'components'], expected: 'src/components' },
					{ segments: ['', 'src'], expected: 'src' },
					{ segments: ['src/', '/components'], expected: 'src//components' },
					{ segments: [], expected: '' }
				];

				testCases.forEach(({ segments, expected }) => {
					const result = directoryService.joinPath(...segments);
					expect(result.replace(/\/+/g, '/')).toBe(expected.replace(/\/+/g, '/'));
				});
			});
		});
	});

	describe('Cache Management', () => {
		beforeEach(() => {
			mockSocket.emit.mockImplementation((event, data, callback) => {
				callback({
					success: true,
					directories: [{ name: 'cached-dir' }]
				});
			});
		});

		it('should cache directory results', async () => {
			await directoryService.listDirectories({
				projectId: 'test-project',
				relativePath: 'src'
			});

			expect(directoryService.cache.size).toBe(1);

			// Second call should use cache
			await directoryService.listDirectories({
				projectId: 'test-project',
				relativePath: 'src'
			});

			expect(mockSocket.emit).toHaveBeenCalledTimes(1); // Only first call hits socket
		});

		it('should expire cache entries', async () => {
			// First call
			await directoryService.listDirectories({
				projectId: 'test-project',
				relativePath: 'src'
			});

			// Wait for cache to expire
			await new Promise(resolve => setTimeout(resolve, 1100));

			// Second call should not use expired cache
			await directoryService.listDirectories({
				projectId: 'test-project',
				relativePath: 'src'
			});

			expect(mockSocket.emit).toHaveBeenCalledTimes(2);
		});

		it('should limit cache size', async () => {
			// Fill cache beyond limit
			for (let i = 0; i < 10; i++) {
				await directoryService.listDirectories({
					projectId: 'test-project',
					relativePath: `path-${i}`
				});
			}

			expect(directoryService.cache.size).toBeLessThanOrEqual(5); // maxCacheSize
		});

		it('should clear cache', async () => {
			await directoryService.listDirectories({
				projectId: 'test-project',
				relativePath: 'src'
			});

			expect(directoryService.cache.size).toBe(1);

			directoryService.clearCache();

			expect(directoryService.cache.size).toBe(0);
		});

		it('should clear cache by pattern', async () => {
			await directoryService.listDirectories({
				projectId: 'project-1',
				relativePath: 'src'
			});
			await directoryService.listDirectories({
				projectId: 'project-2',
				relativePath: 'src'
			});

			expect(directoryService.cache.size).toBe(2);

			directoryService.clearCache('project-1:.*');

			expect(directoryService.cache.size).toBe(1);
		});

		it('should provide cache statistics', () => {
			const stats = directoryService.getCacheStats();

			expect(stats).toHaveProperty('size');
			expect(stats).toHaveProperty('maxSize');
			expect(stats).toHaveProperty('timeout');
			expect(stats).toHaveProperty('entries');
			expect(Array.isArray(stats.entries)).toBe(true);
		});
	});

	describe('Configuration', () => {
		it('should set socket instance', () => {
			const newSocket = { emit: vi.fn() };

			directoryService.setSocket(newSocket);

			expect(directoryService.socket).toBe(newSocket);
		});

		it('should update options', () => {
			directoryService.updateOptions({
				maxPathLength: 2000,
				cacheTimeout: 60000
			});

			expect(directoryService.options.maxPathLength).toBe(2000);
			expect(directoryService.options.cacheTimeout).toBe(60000);
		});

		it('should clear cache when timeout option changes', () => {
			directoryService.cache.set('test-key', { data: {}, timestamp: Date.now() });
			expect(directoryService.cache.size).toBe(1);

			directoryService.updateOptions({ cacheTimeout: 5000 });

			expect(directoryService.cache.size).toBe(0);
		});

		it('should add cleanup callbacks', () => {
			const cleanup1 = vi.fn();
			const cleanup2 = vi.fn();

			directoryService.addCleanup(cleanup1);
			directoryService.addCleanup(cleanup2);

			expect(directoryService.cleanupCallbacks).toContain(cleanup1);
			expect(directoryService.cleanupCallbacks).toContain(cleanup2);
		});
	});

	describe('Service Disposal', () => {
		it('should dispose properly', () => {
			const cleanup1 = vi.fn();
			const cleanup2 = vi.fn();

			directoryService.addCleanup(cleanup1);
			directoryService.addCleanup(cleanup2);
			directoryService.cache.set('test', { data: {} });

			expect(directoryService.isDisposed).toBe(false);

			directoryService.dispose();

			expect(directoryService.isDisposed).toBe(true);
			expect(cleanup1).toHaveBeenCalled();
			expect(cleanup2).toHaveBeenCalled();
			expect(directoryService.cache.size).toBe(0);
			expect(directoryService.socket).toBe(null);
		});

		it('should handle operations after disposal', () => {
			directoryService.dispose();

			expect(() => {
				directoryService.validatePath('test');
				directoryService.resolvePath('a', 'b');
				directoryService.clearCache();
			}).not.toThrow();

			// These should throw
			expect(async () => {
				await directoryService.listDirectories({ projectId: 'test' });
			}).rejects.toThrow('DirectoryService has been disposed');
		});

		it('should handle cleanup callback errors', () => {
			const goodCleanup = vi.fn();
			const badCleanup = vi.fn(() => {
				throw new Error('Cleanup failed');
			});
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

			directoryService.addCleanup(goodCleanup);
			directoryService.addCleanup(badCleanup);

			directoryService.dispose();

			expect(goodCleanup).toHaveBeenCalled();
			expect(badCleanup).toHaveBeenCalled();
			expect(consoleError).toHaveBeenCalledWith(
				'Directory service cleanup callback failed:',
				expect.any(Error)
			);

			consoleError.mockRestore();
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid path validation gracefully', () => {
			const result = directoryService.validatePath('../../../etc');
			
			expect(result.isValid).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should handle missing socket gracefully', async () => {
			directoryService.setSocket(null);

			const result = await directoryService.listDirectories({
				projectId: 'test-project'
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe('No socket connection available');
		});

		it('should handle socket emit errors', async () => {
			mockSocket.emit.mockImplementation(() => {
				throw new Error('Socket emit failed');
			});

			const result = await directoryService.listDirectories({
				projectId: 'test-project'
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Socket emit failed');
		});
	});
});