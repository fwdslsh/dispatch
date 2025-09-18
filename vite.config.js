import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

function socketIOPlugin() {
	return {
		name: 'socketio',
		async configureServer(server) {
			if (!server.httpServer) return;

			console.log('[DEV] Setting up Socket.IO with dependency injection...');

			// Initialize server services with dependency injection
			const { getServerServiceContainer } = await import('./src/lib/server/core/ServerServiceContainer.js');
			const serverContainer = getServerServiceContainer({
				dbPath: process.env.DB_PATH || '~/.dispatch/data/workspace.db',
				workspacesRoot: process.env.WORKSPACES_ROOT || '~/.dispatch-home/workspaces',
				configDir: process.env.DISPATCH_CONFIG_DIR || '~/.config/dispatch',
				debug: process.env.DEBUG === 'true'
			});

			// Initialize all services
			await serverContainer.initialize();
			console.log('[DEV] Server services initialized');

			const { getSocketSetup } = await import('./src/lib/server/socket-manager.js');
			const { setupSocketIO, mode } = await getSocketSetup();
			console.log('===============================================');
			console.log(`[DEV] Session Architecture: ${mode.toUpperCase()}`);
			console.log('===============================================');
			const io = setupSocketIO(server.httpServer, serverContainer);

			// Update services with Socket.IO instance for real-time communication
			serverContainer.setSocketIO(io);
			console.log('[DEV] Socket.IO ready with dependency injection');
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
