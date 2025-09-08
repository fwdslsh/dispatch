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

function socketIOPlugin() {
	return {
		name: 'socketio',
		configureServer(server) {
			// Skip Socket.IO setup for Vitest
			if (!server.httpServer) return;
			
			// Wait a bit to ensure hooks.server.js is loaded, then attach Socket.IO
			setTimeout(async () => {
				try {
					console.log('Setting up Socket.IO server...');
					const hooksModule = await import('./src/hooks.server.js');
					const { ioServer, terminals, claude } = hooksModule;
					
					// Check if we have the required instances
					if (!ioServer) {
						console.error('ioServer not available from hooks.server.js');
						return;
					}
					
					// Only attach if not already attached
					if (!ioServer.io) {
						console.log('Attaching Socket.IO to HTTP server');
						const io = ioServer.attachTo(server.httpServer);
						
						// Handle Socket.IO events
						io.on('connection', (socket) => {
							console.log('Socket.IO client connected:', socket.id);
							
							// Authentication is handled by the SocketIOServer class itself
							// The ioServer.io instance will have auth handlers built-in
							
							// Terminal events (authenticated by SocketIOServer)
							if (terminals) {
								socket.on('terminal.write', (data) => {
									if (ioServer.isAuthenticated(socket.id)) {
										terminals.write(data.id, data.data);
									} else {
										console.log(`Socket ${socket.id} not authenticated for terminal.write`);
									}
								});
								
								socket.on('terminal.resize', (data) => {
									if (ioServer.isAuthenticated(socket.id)) {
										terminals.resize(data.id, data.cols, data.rows);
									} else {
										console.log(`Socket ${socket.id} not authenticated for terminal.resize`);
									}
								});
							}
							
							// Claude events (authenticated by SocketIOServer)
							if (claude) {
								socket.on('claude.send', (data) => {
									if (ioServer.isAuthenticated(socket.id)) {
										console.log('Claude message received:', data);
										claude.send(data.id, data.input);
									} else {
										console.log(`Socket ${socket.id} not authenticated for claude.send`);
									}
								});
							}
							
							socket.on('disconnect', () => {
								console.log('Socket.IO client disconnected:', socket.id);
							});
						});
					} else {
						console.log('Socket.IO server already attached');
					}
				} catch (err) {
					console.error('Failed to setup Socket.IO:', err);
				}
			}, 100);
		}
	};
}
export default defineConfig({
	plugins: [sveltekit(), socketIOPlugin()],
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
