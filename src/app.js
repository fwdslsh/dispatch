// src/app.js - Production server entry point
import http from 'node:http';
import { handler } from '../build/handler.js';
// Socket.IO is now handled by io-server.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = process.env.PORT || 3030;
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const LT_SUBDOMAIN = process.env.LT_SUBDOMAIN || '';

// Helper function to expand tilde in paths
const expandTilde = (filepath) => {
	if (filepath.startsWith('~/')) {
		const userName = process.env.USER || 'dispatch';
		return path.join('/home', userName, filepath.slice(2));
	}
	return filepath;
};

const getActualHome = () => {
	const homeFromEnv = process.env.HOME;
	if (homeFromEnv && homeFromEnv.startsWith('~/')) {
		const userName = process.env.USER || 'dispatch';
		return path.join('/home', userName, homeFromEnv.slice(2));
	}
	if (homeFromEnv && homeFromEnv === '~') {
		const userName = process.env.USER || 'dispatch';
		return path.join('/home', userName);
	}
	return homeFromEnv || os.homedir();
};

const actualHome = getActualHome();
const configDir = expandTilde(
	process.env.DISPATCH_CONFIG_DIR ||
		(process.platform === 'win32'
			? path.join(actualHome, 'dispatch')
			: path.join(actualHome, '.config', 'dispatch'))
);
// Note: DISPATCH_PROJECTS_DIR is legacy - workspaces can be any accessible directory

async function initializeDirectories() {
	try {
		console.log(`[DIRECTORY] Config Directory: ${configDir}`);

		fs.mkdirSync(configDir, { recursive: true });
		fs.accessSync(configDir, fs.constants.W_OK);

		console.log('Directories initialized successfully');
	} catch (err) {
		console.error(`ERROR: Directory initialization failed: ${err.message}`);
		process.exit(1);
	}
}

// Initialize directories before starting server
initializeDirectories()
	.then(async () => {
		// Note: Authentication is now handled via JWT tokens through the web interface
		// No terminal key required - use SSH keys or OAuth for authentication

		// Initialize server services
		const { initializeServices } = await import('./lib/server/shared/index.js');
		const services = await initializeServices({
			dbPath: process.env.DB_PATH || path.join(actualHome, '.dispatch', 'data', 'workspace.db'),
			workspacesRoot:
				process.env.WORKSPACES_ROOT || path.join(actualHome, '.dispatch-home', 'workspaces'),
			configDir: configDir,
			debug: process.env.DEBUG === 'true',
			port: PORT,
			tunnelSubdomain: LT_SUBDOMAIN
		});

		console.log('[APP] Server services initialized');

		// Create HTTP server with SvelteKit handler
		const server = http.createServer(handler);

		// Initialize Socket.IO with services
		const { setupSocketIO } = await import('./lib/server/shared/socket-setup.js');
		const io = setupSocketIO(server, services);

		// Set Socket.IO instance on RunSessionManager for real-time events (BEFORE any operations)
		services.runSessionManager.setSocketIO(io);

		server.listen(PORT, '0.0.0.0', () => {
			console.log(`dispatch running at http://localhost:${PORT}`);
			console.log(`Config Dir: ${configDir}`);
			console.log('Workspaces can be created anywhere accessible to the user');

			// Start tunnel if enabled by environment variable
			if (ENABLE_TUNNEL) {
				services.tunnelManager.start();
			}
		});

		// graceful shutdown
		for (const sig of ['SIGINT', 'SIGTERM']) {
			process.on(sig, () => {
				services.tunnelManager.stop();
				process.exit(0);
			});
		}
	})
	.catch((err) => {
		console.error('Failed to start server:', err);
		process.exit(1);
	});
