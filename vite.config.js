import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import {
	getViteSSLConfig,
	printSSLInstructions
} from './src/lib/server/shared/utils/ssl-certificates.js';
import { buildMetricsPlugin } from './src/lib/server/shared/utils/build-metrics.js';

/**
 * @returns {import('vite').Plugin}
 */
function socketIOPlugin() {
	return {
		name: 'socketio',
		async configureServer(server) {
			if (!server.httpServer) return;

			console.log('[DEV] Setting up Socket.IO with shared services...');

			// Import the shared services from hooks.server.js
			const { getGlobalServices } = await import('./src/hooks.server.js');
			const services = await getGlobalServices();

			console.log('[DEV] Using shared services from hooks.server.js');

			const { setupSocketIO } = await import('./src/lib/server/shared/socket-setup.js');
			setupSocketIO(server.httpServer, services);

			console.log('[DEV] Socket.IO ready with shared services');
		}
	};
}

export default defineConfig(async () => {
	// Get SSL configuration for development
	const sslConfig = await getViteSSLConfig();

	// Print SSL instructions if SSL is enabled
	if (sslConfig) {
		printSSLInstructions();
	}

	/** @type {import('vite').UserConfig} */
	const config = {
		resolve: {
			alias: {
				$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
			}
		},
		plugins: [sveltekit(), socketIOPlugin(), devtoolsJson(), buildMetricsPlugin()],
		build: {
			rollupOptions: {
				output: {
					manualChunks(id) {
						// Only apply manual chunking to client-side bundles
						// Terminal vendor chunk - Terminal-related libraries
						if (
							id.includes('node_modules/@xterm/xterm') ||
							id.includes('node_modules/@xterm/addon-fit') ||
							id.includes('node_modules/@battlefieldduck/xterm-svelte') ||
							id.includes('node_modules/ansi_up')
						) {
							return 'vendor-terminal';
						}
						// Socket vendor chunk - Real-time communication
						if (id.includes('node_modules/socket.io-client')) {
							return 'vendor-socket';
						}
						// Markdown vendor chunk - Markdown processing
						if (
							id.includes('node_modules/markdown-it') ||
							id.includes('node_modules/marked') ||
							id.includes('node_modules/prismjs')
						) {
							return 'vendor-markdown';
						}
						// UI vendor chunk - Svelte UI components and utilities
						if (
							id.includes('node_modules/svelte') ||
							id.includes('node_modules/@floating-ui/dom') ||
							id.includes('node_modules/augmented-ui') ||
							id.includes('node_modules/hammerjs') ||
							id.includes('node_modules/sv-window-manager') ||
							id.includes('node_modules/svelte-virtual-list')
						) {
							return 'vendor-ui';
						}
						// Let other packages be handled automatically
						return undefined;
					}
				},
				onwarn(warning, warn) {
					// Suppress warning about unused default export from node:path
					// We correctly use only named imports (join, resolve, etc.)
					// This warning is a Rollup quirk about node:path having both default and named exports
					if (
						warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
						warning.message?.includes('"default"') &&
						warning.message?.includes('"node:path"')
					) {
						return;
					}
					// Use default warning handling for all other warnings
					warn(warning);
				}
			}
		},
		server: {
			https: sslConfig || undefined,
			host: true
		},
		test: {
			expect: { requireAssertions: true },
			coverage: {
				provider: 'v8',
				reporter: ['text', 'json', 'html', 'lcov'],
				reportsDirectory: './coverage',
				exclude: [
					'node_modules/**',
					'tests/**',
					'e2e/**',
					'**/*.spec.{js,ts}',
					'**/*.test.{js,ts}',
					'**/test-*.{js,ts}',
					'**/*.config.{js,ts}',
					'.svelte-kit/**',
					'build/**',
					'dist/**'
				],
				include: ['src/**/*.{js,ts,svelte}'],
				all: true,
				clean: true,
				lines: 70,
				functions: 70,
				branches: 70,
				statements: 70
			},
			projects: [
				{
					extends: './vite.config.js',
					test: {
						name: 'client',
						environment: 'browser',
						browser: {
							enabled: true,
							provider: 'playwright',
							instances: [{ browser: 'chromium' }]
						},
						include: [
							'tests/client/**/*.{test,spec}.{js,ts}',
							'tests/**/*.svelte.{test,spec}.{js,ts}'
						],
						exclude: ['tests/server/**', 'tests/unit/server/**', 'tests/e2e/**'],
						setupFiles: ['./tests/helpers/vitest-setup-client.js']
					}
				},
				{
					extends: './vite.config.js',
					test: {
						name: 'server',
						environment: 'node',
						include: [
							'tests/server/**/*.{test,spec}.{js,ts}',
							'tests/unit/server/**/*.{test,spec}.{js,ts}',
							'tests/shared/**/*.{test,spec}.{js,ts}',
							'tests/performance/**/*.{test,spec}.{js,ts}',
							'tests/integration/**/*.{test,spec}.{js,ts}',
							'tests/docker/**/*.{test,spec}.{js,ts}'
						],
						exclude: ['tests/client/**', 'tests/**/*.svelte.{test,spec}.{js,ts}', 'tests/e2e/**'],
						setupFiles: ['./tests/helpers/vitest-setup-server.js']
					}
				}
			]
		}
	};

	return config;
});
