import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

function socketIOPlugin() {
	return {
		name: 'socketio',
		async configureServer(server) {
			if (!server.httpServer) return;

			console.log('[DEV] Setting up Socket.IO...');
			const { getSocketSetup } = await import('./src/lib/server/socket-manager.js');
			const { setupSocketIO, mode } = await getSocketSetup();
			console.log('===============================================');
			console.log(`[DEV] Session Architecture: ${mode.toUpperCase()}`);
			console.log('===============================================');
			const io = setupSocketIO(server.httpServer);

			// Store globally for API endpoints if needed
			globalThis.__DISPATCH_SOCKET_IO = io;
			console.log('[DEV] Socket.IO ready');
		}
	};
}

export default defineConfig({
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
					exclude: ['tests/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
