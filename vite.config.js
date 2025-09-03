import { sveltekit } from '@sveltejs/kit/vite';
import { Server } from 'socket.io';
import { defineConfig } from 'vite';

const webSocketServer = {
	name: 'webSocketServer',
	configureServer(server) {
		if (!server.httpServer) return;

		const io = new Server(server.httpServer, {
			cors: {
				origin: "*",
				methods: ["GET", "POST"]
			}
		});

		// Initialize storage manager in development
		import('./src/lib/server/storage-manager.js').then((module) => {
			module.default.initialize();
		}).catch((err) => {
			console.warn('Storage manager not available during dev:', err.message);
		});

		// Import the working socket handler for development
		import('./src/lib/server/socket-handler.js').then(({ createSocketHandler }) => {
			const handler = createSocketHandler(io);
			io.on('connection', handler);
		}).catch((err) => {
			console.warn('Socket handler not available during dev:', err.message);
		});
	}
};

export default defineConfig({
	plugins: [sveltekit(), webSocketServer]
});