/**
 * Vite Plugin: Build Performance Metrics
 * Tracks and reports build performance metrics
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Format duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
	if (ms < 1000) return `${ms.toFixed(0)}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
	return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

/**
 * Create build metrics plugin for Vite
 * @param {Object} [options] - Plugin options
 * @param {boolean} [options.enabled=true] - Enable metrics tracking
 * @param {boolean} [options.saveToFile=false] - Save metrics to file
 * @param {string} [options.metricsDir='.metrics'] - Directory to save metrics
 * @returns {import('vite').Plugin}
 */
export function buildMetricsPlugin(options = {}) {
	const {
		enabled = true,
		saveToFile = process.env.CI === 'true' || process.env.SAVE_BUILD_METRICS === 'true',
		metricsDir = '.metrics'
	} = options;

	if (!enabled) {
		return {
			name: 'build-metrics',
			apply: 'build'
		};
	}

	let buildStartTime = 0;
	let buildEndTime = 0;
	let metrics = {
		timestamp: '',
		duration: 0,
		env: {},
		chunks: {}
	};

	return {
		name: 'build-metrics',
		apply: 'build',

		buildStart() {
			buildStartTime = Date.now();
			metrics.timestamp = new Date().toISOString();
			metrics.env = {
				nodeVersion: process.version,
				platform: process.platform,
				arch: process.arch,
				ci: process.env.CI === 'true'
			};

			console.log('\n🔨 Build started at', new Date(buildStartTime).toLocaleTimeString());
		},

		renderChunk(_code, chunk) {
			// Track chunk sizes
			if (!metrics.chunks[chunk.fileName]) {
				metrics.chunks[chunk.fileName] = {
					size: 0,
					modules: chunk.moduleIds?.length || 0
				};
			}
		},

		async closeBundle() {
			buildEndTime = Date.now();
			const duration = buildEndTime - buildStartTime;
			metrics.duration = duration;

			// Log metrics
			console.log('\n✅ Build completed!');
			console.log(`⏱️  Total time: ${formatDuration(duration)}`);
			console.log(`📦 Chunks generated: ${Object.keys(metrics.chunks).length}`);

			// Save metrics to file if enabled
			if (saveToFile) {
				try {
					await mkdir(metricsDir, { recursive: true });
					const metricsFile = join(metricsDir, `build-${Date.now()}.json`);
					await writeFile(metricsFile, JSON.stringify(metrics, null, 2));
					console.log(`📊 Metrics saved to: ${metricsFile}`);

					// Also update latest metrics
					const latestFile = join(metricsDir, 'latest.json');
					await writeFile(latestFile, JSON.stringify(metrics, null, 2));
				} catch (error) {
					console.warn('Failed to save build metrics:', error.message);
				}
			}
		},

		buildEnd(error) {
			if (error) {
				const duration = Date.now() - buildStartTime;
				console.log(`\n❌ Build failed after ${formatDuration(duration)}`);
			}
		}
	};
}
