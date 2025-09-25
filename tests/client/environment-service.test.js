import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnvironmentService } from '../../src/lib/client/shared/services/EnvironmentService.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EnvironmentService', () => {
	let service;
	let config;

	beforeEach(() => {
		config = {
			apiBaseUrl: 'http://localhost:3000'
		};
		service = new EnvironmentService(config);
		vi.clearAllMocks();
		// Reset Date.now for each test
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		service.dispose();
	});

	describe('getEnvironment', () => {
		it('should fetch environment information successfully', async () => {
			const mockEnvironmentData = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '1.2.3'
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvironmentData
			});

			const result = await service.getEnvironment();

			expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/environment');
			expect(result).toEqual(mockEnvironmentData);
		});

		it('should cache environment data and not refetch within cache timeout', async () => {
			const mockEnvironmentData = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '1.2.3'
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvironmentData
			});

			// First call
			const result1 = await service.getEnvironment();
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Advance time by 10 seconds (within cache timeout)
			vi.advanceTimersByTime(10000);

			// Second call should use cache
			const result2 = await service.getEnvironment();
			expect(mockFetch).toHaveBeenCalledTimes(1); // Still only called once
			expect(result1).toEqual(result2);
		});

		it('should refetch after cache timeout expires', async () => {
			const mockEnvironmentData1 = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '1.2.3'
			};

			const mockEnvironmentData2 = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '1.2.4'
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockEnvironmentData1
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => mockEnvironmentData2
				});

			// First call
			const result1 = await service.getEnvironment();
			expect(result1.appVersion).toBe('1.2.3');

			// Advance time beyond cache timeout (30 seconds)
			vi.advanceTimersByTime(31000);

			// Second call should refetch
			const result2 = await service.getEnvironment();
			expect(mockFetch).toHaveBeenCalledTimes(2);
			expect(result2.appVersion).toBe('1.2.4');
		});

		it('should return fallback data when fetch fails and no cache exists', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await service.getEnvironment();

			expect(result).toEqual({
				homeDirectory: 'unknown',
				platform: 'unknown',
				nodeVersion: 'unknown',
				appVersion: 'unknown'
			});
		});

		it('should return stale cache when fetch fails but cache exists', async () => {
			const mockEnvironmentData = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '1.2.3'
			};

			// First successful call
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvironmentData
			});

			const result1 = await service.getEnvironment();
			expect(result1).toEqual(mockEnvironmentData);

			// Advance time beyond cache timeout
			vi.advanceTimersByTime(31000);

			// Second call fails
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result2 = await service.getEnvironment();
			expect(result2).toEqual(mockEnvironmentData); // Should return stale cache
		});

		it('should handle non-ok response status', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});

			const result = await service.getEnvironment();

			expect(result).toEqual({
				homeDirectory: 'unknown',
				platform: 'unknown',
				nodeVersion: 'unknown',
				appVersion: 'unknown'
			});
		});
	});

	describe('getAppVersion', () => {
		it('should return app version from environment data', async () => {
			const mockEnvironmentData = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '1.2.3'
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvironmentData
			});

			const version = await service.getAppVersion();
			expect(version).toBe('1.2.3');
		});

		it('should return "unknown" when environment fetch fails', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const version = await service.getAppVersion();
			expect(version).toBe('unknown');
		});

		it('should return "unknown" when appVersion is missing from response', async () => {
			const mockEnvironmentData = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0'
				// appVersion missing
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockEnvironmentData
			});

			const version = await service.getAppVersion();
			expect(version).toBe('unknown');
		});
	});

	describe('clearCache', () => {
		it('should clear cached data', async () => {
			const mockEnvironmentData = {
				homeDirectory: '/home/user',
				platform: 'linux',
				nodeVersion: 'v20.0.0',
				appVersion: '1.2.3'
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => mockEnvironmentData
			});

			// First call
			await service.getEnvironment();
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Clear cache
			service.clearCache();

			// Next call should refetch
			await service.getEnvironment();
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});
});
