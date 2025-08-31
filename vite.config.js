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

		// Initialize session store in development
		import('./src/lib/server/session-store.js').then(({ initializeSessionStore }) => {
			initializeSessionStore();
		}).catch((err) => {
			console.warn('Session store not available during dev:', err.message);
		});

		// Import the socket handler for development
		import('./src/lib/server/socket-handler.js').then(({ handleConnection }) => {
			io.on('connection', handleConnection);
		}).catch((err) => {
			console.warn('Socket handler not available during dev:', err.message);
		});
	}
};

export default defineConfig({
	plugins: [sveltekit(), webSocketServer]
});