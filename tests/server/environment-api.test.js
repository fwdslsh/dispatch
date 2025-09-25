import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { GET } from '../../src/routes/api/environment/+server.js';

// Mock fs module
vi.mock('node:fs', () => ({
	readFileSync: vi.fn()
}));

// Mock os module
vi.mock('node:os', () => ({
	homedir: vi.fn(() => '/mock/home')
}));

// Mock path module
vi.mock('node:path', () => ({
	dirname: vi.fn(() => '/mock/dirname'),
	join: vi.fn((...parts) => parts.join('/'))
}));

// Mock url module
vi.mock('node:url', () => ({
	fileURLToPath: vi.fn(() => '/mock/filename')
}));

describe('Environment API', () => {
	let mockReadFileSync;

	beforeEach(() => {
		mockReadFileSync = readFileSync;
		vi.resetAllMocks();
		// Mock process.env and process.platform
		global.process = {
			...global.process,
			env: { HOME: '/test/home' },
			platform: 'linux',
			version: 'v20.0.0'
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/environment', () => {
		it('should return environment information including appVersion', async () => {
			// Mock package.json reading
			const mockPackageJson = JSON.stringify({
				name: '@fwdslsh/dispatch',
				version: '0.2.1'
			});
			mockReadFileSync.mockReturnValue(mockPackageJson);

			const response = await GET();
			const data = await response.json();

			expect(data).toEqual({
				homeDirectory: '/test/home',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '0.2.1'
			});
		});

		it('should handle package.json read errors gracefully', async () => {
			// Mock package.json read failure
			mockReadFileSync.mockImplementation(() => {
				throw new Error('File not found');
			});

			const response = await GET();
			const data = await response.json();

			expect(data).toEqual({
				homeDirectory: '/test/home',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: 'unknown'
			});
		});

		it('should handle invalid JSON in package.json', async () => {
			// Mock invalid JSON
			mockReadFileSync.mockReturnValue('invalid json content');

			const response = await GET();
			const data = await response.json();

			expect(data).toEqual({
				homeDirectory: '/test/home',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: 'unknown'
			});
		});

		it('should use OS homedir as fallback when HOME env var is not set', async () => {
			// Mock environment without HOME
			global.process = {
				...global.process,
				env: {},
				platform: 'linux',
				version: 'v20.0.0'
			};

			const mockPackageJson = JSON.stringify({
				version: '1.0.0'
			});
			mockReadFileSync.mockReturnValue(mockPackageJson);

			const response = await GET();
			const data = await response.json();

			expect(data.homeDirectory).toBe('/mock/home');
			expect(data.appVersion).toBe('1.0.0');
		});

		it('should handle errors when process properties are undefined', async () => {
			// Mock environment with undefined process properties
			const originalProcess = global.process;
			global.process = {
				...originalProcess,
				env: undefined,
				platform: undefined,
				version: undefined
			};

			const mockPackageJson = JSON.stringify({
				version: '1.0.0'
			});
			mockReadFileSync.mockReturnValue(mockPackageJson);

			const response = await GET();
			const data = await response.json();

			// When process.env is undefined, the function should return an error
			expect(response.status).toBe(500);
			expect(data).toEqual({
				error: 'Failed to get environment information'
			});

			// Restore original process
			global.process = originalProcess;
		});
	});
});