/**
 * Performance validation tests for settings system
 * Targets: GET /api/settings <25ms, PUT /api/settings/{category} <50ms, UI state updates <10ms
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SettingsManager } from '../../src/lib/server/settings/SettingsManager.js';
import { SettingsValidator } from '../../src/lib/server/settings/SettingsValidator.js';
import { ValueResolver } from '../../src/lib/server/settings/ValueResolver.js';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

describe('Settings Performance Validation', () => {
	let settingsManager;
	let settingsValidator;
	let valueResolver;
	const testDbPath = './test-performance.db';

	beforeAll(async () => {
		// Clean up any existing test database
		if (fs.existsSync(testDbPath)) {
			fs.unlinkSync(testDbPath);
		}

		// Initialize settings manager
		settingsManager = new SettingsManager(testDbPath);
		await settingsManager.initialize();

		settingsValidator = new SettingsValidator();
		valueResolver = new ValueResolver(settingsManager);
	});

	afterAll(() => {
		// Clean up test database
		if (fs.existsSync(testDbPath)) {
			fs.unlinkSync(testDbPath);
		}
	});

	describe('GET /api/settings performance', () => {
		it('should retrieve all settings in less than 25ms', async () => {
			const iterations = 10;
			const times = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();

				await settingsManager.getSettingsByCategory();

				const end = performance.now();
				times.push(end - start);
			}

			const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
			const maxTime = Math.max(...times);

			console.log(`GET settings - Average: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

			// Target: <25ms average
			expect(avgTime).toBeLessThan(25);
		});

		it('should retrieve category settings in less than 20ms', async () => {
			const iterations = 10;
			const times = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();

				await settingsManager.getSettings('authentication');

				const end = performance.now();
				times.push(end - start);
			}

			const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

			console.log(`GET category settings - Average: ${avgTime.toFixed(2)}ms`);

			// Category queries should be even faster
			expect(avgTime).toBeLessThan(20);
		});

		it('should use cache effectively on repeated queries', async () => {
			// First query (cold cache)
			const start1 = performance.now();
			await settingsManager.getSettings('authentication');
			const time1 = performance.now() - start1;

			// Second query (warm cache)
			const start2 = performance.now();
			await settingsManager.getSettings('authentication');
			const time2 = performance.now() - start2;

			console.log(`Cache performance - Cold: ${time1.toFixed(2)}ms, Warm: ${time2.toFixed(2)}ms`);

			// Cached query should be significantly faster
			expect(time2).toBeLessThan(time1 * 0.5);
		});
	});

	describe('PUT /api/settings/{category} performance', () => {
		it('should update settings in less than 50ms', async () => {
			const iterations = 10;
			const times = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();

				await settingsManager.updateCategorySettings('authentication', {
					terminal_key: `testkey${i}123456789`
				});

				const end = performance.now();
				times.push(end - start);
			}

			const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
			const maxTime = Math.max(...times);

			console.log(`PUT settings - Average: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

			// Target: <50ms average
			expect(avgTime).toBeLessThan(50);
		});

		it('should handle batch updates efficiently', async () => {
			const start = performance.now();

			await settingsManager.updateCategorySettings('authentication', {
				terminal_key: 'batchupdate12345',
				oauth_client_id: 'batch-client-id',
				oauth_redirect_uri: 'https://example.com/callback'
			});

			const duration = performance.now() - start;

			console.log(`Batch update (3 settings): ${duration.toFixed(2)}ms`);

			// Batch update should still be fast
			expect(duration).toBeLessThan(60);
		});
	});

	describe('Validation performance', () => {
		it('should validate settings quickly', async () => {
			const settings = await settingsManager.getSettings('authentication');
			const iterations = 100;

			const start = performance.now();

			for (let i = 0; i < iterations; i++) {
				for (const setting of settings) {
					settingsValidator.validateSetting(setting, setting.current_value);
				}
			}

			const duration = performance.now() - start;
			const avgPerValidation = duration / (iterations * settings.length);

			console.log(
				`Validation performance - ${iterations * settings.length} validations in ${duration.toFixed(2)}ms (${avgPerValidation.toFixed(3)}ms per validation)`
			);

			// Each validation should be extremely fast
			expect(avgPerValidation).toBeLessThan(1);
		});
	});

	describe('Value resolution performance', () => {
		it('should resolve values quickly', async () => {
			const iterations = 100;

			const start = performance.now();

			for (let i = 0; i < iterations; i++) {
				await valueResolver.resolveSettingValue('terminal_key');
			}

			const duration = performance.now() - start;
			const avgTime = duration / iterations;

			console.log(
				`Value resolution - ${iterations} resolutions in ${duration.toFixed(2)}ms (${avgTime.toFixed(3)}ms per resolution)`
			);

			// Value resolution should be very fast with caching
			expect(avgTime).toBeLessThan(5);
		});

		it('should cache resolution results effectively', async () => {
			valueResolver.clearCache();

			// First resolution (cold cache)
			const start1 = performance.now();
			await valueResolver.resolveSettingValue('terminal_key');
			const time1 = performance.now() - start1;

			// Subsequent resolutions (warm cache)
			const start2 = performance.now();
			for (let i = 0; i < 100; i++) {
				await valueResolver.resolveSettingValue('terminal_key');
			}
			const time2 = performance.now() - start2;
			const avgCached = time2 / 100;

			console.log(
				`Cache effectiveness - First: ${time1.toFixed(3)}ms, Cached avg: ${avgCached.toFixed(3)}ms`
			);

			// Cached resolutions should be much faster
			expect(avgCached).toBeLessThan(time1 * 0.1);
		});
	});

	describe('Database query performance', () => {
		it('should perform category queries efficiently', async () => {
			const iterations = 50;

			const start = performance.now();

			for (let i = 0; i < iterations; i++) {
				await settingsManager.getCategory('authentication');
			}

			const duration = performance.now() - start;
			const avgTime = duration / iterations;

			console.log(
				`Category queries - ${iterations} queries in ${duration.toFixed(2)}ms (${avgTime.toFixed(3)}ms per query)`
			);

			expect(avgTime).toBeLessThan(10);
		});

		it('should perform setting lookups efficiently', async () => {
			const iterations = 50;

			const start = performance.now();

			for (let i = 0; i < iterations; i++) {
				await settingsManager.getSetting('terminal_key');
			}

			const duration = performance.now() - start;
			const avgTime = duration / iterations;

			console.log(
				`Setting lookups - ${iterations} lookups in ${duration.toFixed(2)}ms (${avgTime.toFixed(3)}ms per lookup)`
			);

			expect(avgTime).toBeLessThan(10);
		});
	});

	describe('Concurrent operations', () => {
		it('should handle concurrent reads efficiently', async () => {
			const concurrentReads = 10;

			const start = performance.now();

			const promises = [];
			for (let i = 0; i < concurrentReads; i++) {
				promises.push(settingsManager.getSettings('authentication'));
			}

			await Promise.all(promises);

			const duration = performance.now() - start;

			console.log(`${concurrentReads} concurrent reads: ${duration.toFixed(2)}ms`);

			// Concurrent reads should benefit from caching
			expect(duration).toBeLessThan(50);
		});

		it('should handle mixed read/write operations', async () => {
			const operations = 20;

			const start = performance.now();

			const promises = [];
			for (let i = 0; i < operations; i++) {
				if (i % 2 === 0) {
					// Read operation
					promises.push(settingsManager.getSettings('authentication'));
				} else {
					// Write operation
					promises.push(
						settingsManager.updateCategorySettings('authentication', {
							terminal_key: `concurrent${i}12345`
						})
					);
				}
			}

			await Promise.allSettled(promises);

			const duration = performance.now() - start;

			console.log(`${operations} mixed operations: ${duration.toFixed(2)}ms`);

			// Mixed operations should complete reasonably fast
			expect(duration).toBeLessThan(500);
		});
	});

	describe('Memory usage', () => {
		it('should not create memory leaks during repeated operations', async () => {
			const iterations = 100;

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const memBefore = process.memoryUsage().heapUsed;

			for (let i = 0; i < iterations; i++) {
				await settingsManager.getSettings('authentication');
				await settingsManager.updateCategorySettings('authentication', {
					terminal_key: `memtest${i}12345`
				});
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const memAfter = process.memoryUsage().heapUsed;
			const memDiff = (memAfter - memBefore) / 1024 / 1024;

			console.log(
				`Memory usage after ${iterations} operations: ${memDiff > 0 ? '+' : ''}${memDiff.toFixed(2)}MB`
			);

			// Memory increase should be minimal (< 5MB for 100 operations)
			expect(Math.abs(memDiff)).toBeLessThan(5);
		});
	});

	describe('Overall performance summary', () => {
		it('should generate performance report', async () => {
			console.log('\n========== PERFORMANCE SUMMARY ==========');

			const operations = [
				{
					name: 'GET all settings',
					fn: () => settingsManager.getSettingsByCategory(),
					target: 25
				},
				{
					name: 'GET category settings',
					fn: () => settingsManager.getSettings('authentication'),
					target: 20
				},
				{
					name: 'PUT settings update',
					fn: () =>
						settingsManager.updateCategorySettings('authentication', {
							terminal_key: 'perftest123456'
						}),
					target: 50
				},
				{
					name: 'Value resolution',
					fn: () => valueResolver.resolveSettingValue('terminal_key'),
					target: 5
				},
				{
					name: 'Setting validation',
					fn: async () => {
						const settings = await settingsManager.getSettings('authentication');
						settingsValidator.validateSetting(settings[0], settings[0].current_value);
					},
					target: 1
				}
			];

			const results = [];

			for (const op of operations) {
				const times = [];
				for (let i = 0; i < 10; i++) {
					const start = performance.now();
					await op.fn();
					times.push(performance.now() - start);
				}

				const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
				const passed = avgTime < op.target;

				results.push({
					operation: op.name,
					avgTime: avgTime.toFixed(2),
					target: op.target,
					status: passed ? '✓ PASS' : '✗ FAIL'
				});

				console.log(
					`${op.name.padEnd(25)} ${avgTime.toFixed(2)}ms (target: <${op.target}ms) ${passed ? '✓' : '✗'}`
				);
			}

			console.log('========================================\n');

			// All operations should meet their targets
			const allPassed = results.every((r) => r.status.includes('PASS'));
			expect(allPassed).toBe(true);
		});
	});
});
