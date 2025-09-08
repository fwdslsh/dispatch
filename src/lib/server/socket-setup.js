import { Server } from 'socket.io';
import { validateKey } from './auth.js';

export function setupSocketIO(httpServer) {
	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET', 'POST'] }
	});

	// Get shared managers from hooks.server.js
	const getManagers = () => globalThis.__API_SERVICES || {};

	io.on('connection', (socket) => {
		console.log(`[SOCKET] Client connected: ${socket.id}`);

		// Terminal events
		socket.on('terminal.start', async (data, callback) => {
			console.log(`[SOCKET] terminal.start received:`, data);
			try {
				if (!validateKey(data.key)) {
					console.log(`[SOCKET] Invalid key for terminal.start`);
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				const { terminals } = getManagers();
				if (!terminals) {
					throw new Error('Terminal manager not available');
				}

				// Set the Socket.IO instance for this terminal's output
				terminals.setSocketIO(socket);
				const result = terminals.start(data);
				console.log(`[SOCKET] Terminal ${result.id} created via shared manager`);

				if (callback) callback({ success: true, ...result });
			} catch (err) {
				console.error(`[SOCKET] Terminal start error:`, err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		socket.on('terminal.write', (data) => {
			console.log(`[SOCKET] terminal.write received:`, data);
			try {
				if (!validateKey(data.key)) return;

				const { terminals } = getManagers();
				if (terminals) {
					// Update the socket reference to ensure output goes to the current connection
					terminals.setSocketIO(socket);
					terminals.write(data.id, data.data);
					console.log(`[SOCKET] Data written to terminal ${data.id} via shared manager`);
				}
			} catch (err) {
				console.error(`[SOCKET] Terminal write error:`, err);
			}
		});

		socket.on('terminal.resize', (data) => {
			console.log(`[SOCKET] terminal.resize received:`, data);
			try {
				if (!validateKey(data.key)) return;

				const { terminals } = getManagers();
				if (terminals) {
					terminals.resize(data.id, data.cols, data.rows);
				}
			} catch (err) {
				console.error(`[SOCKET] Terminal resize error:`, err);
			}
		});

		// Claude events
		socket.on('claude.send', async (data) => {
			console.log(`[SOCKET] claude.send received:`, data);
			try {
				if (!validateKey(data.key)) return;

				const { claude } = getManagers();
				if (claude) {
					claude.setSocketIO(socket);
					await claude.send(data.id, data.input);
					console.log(`[SOCKET] Claude message sent via shared manager`);
				}
			} catch (err) {
				console.error(`[SOCKET] Claude send error:`, err);
			}
		});

		socket.on('disconnect', () => {
			console.log(`[SOCKET] Client disconnected: ${socket.id}`);
		});
	});

	console.log('[SOCKET] Socket.IO server initialized with shared managers');
	return io;
}
