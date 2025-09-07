import { sveltekit } from '@sveltejs/kit/vite';
import { Server } from 'socket.io';
import { defineConfig } from 'vite';

const webSocketServer = {
	name: 'webSocketServer',
	configureServer(server) {
		if (!server.httpServer) return;

		const io = new Server(server.httpServer, {
			cors: { origin: '*', methods: ['GET', 'POST'] }
		});

		// Print HOME environment variable for development
		console.log(`[DEV] HOME environment variable: ${process.env.HOME || 'not set'}`);
		
		// Initialize directory manager in development
		import('./src/lib/shared/utils/directory-manager.server.js')
			.then(async (module) => {
				await module.default.initialize();
				console.log('Directory manager initialized for development');
			})
			.catch((err) => {
				console.warn('Directory manager not available during dev:', err.message);
			});

		// Import the new namespace socket handlers for development
		import('./src/lib/shared/io/NamespaceSocketHandler.server.js')
			.then(({ createNamespaceSocketHandlers, createMainNamespaceHandler }) => {
				const namespaceHandlers = createNamespaceSocketHandlers(io);
				const mainHandler = createMainNamespaceHandler(io, namespaceHandlers);

				io.on('connection', mainHandler);
			})
			.catch((err) => {
				console.warn('Namespace socket handlers not available during dev:', err.message);
			});
	}
};

export default defineConfig({
	plugins: [sveltekit(), webSocketServer],
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
