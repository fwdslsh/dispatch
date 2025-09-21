import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

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

			const { setupSocketIO } = await import('./src/lib/server/socket-setup.js');
			const io = setupSocketIO(server.httpServer, services);

			console.log('[DEV] Socket.IO ready with shared services');
		}
	};
}

export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	plugins: [sveltekit(), socketIOPlugin(), devtoolsJson()],
	test: {
		expect: { requireAssertions: true },
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
					include: ['tests/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['tests/lib/server/**'],
					setupFiles: ['./vitest-setup-client.js']
				}
			},
			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['tests/**/*.{test,spec}.{js,ts}'],
					exclude: ['tests/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./vitest-setup-server.js']
				}
			}
		]
	}
});
