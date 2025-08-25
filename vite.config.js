import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const devMode = process.env.NODE_ENV !== 'production';

export default defineConfig({
	plugins: [
		sveltekit(),
		...(devMode ? [{
			name: 'webSocketServer',
			configureServer: (server) => {
				if (!server.httpServer) return;

				// Use dynamic imports to avoid loading these modules during build
				Promise.all([
					import('socket.io'),
					import('./src/lib/server/socket-handler.js')
				]).then(([{ Server }, { handleConnection }]) => {
					const io = new Server(server.httpServer, {
						cors: {
							origin: "*",
							methods: ["GET", "POST"]
						}
					});

					io.on('connection', handleConnection);
				}).catch((err) => {
					console.warn('Socket.IO setup failed during dev:', err.message);
				});
			}
		}] : [])
	]
});