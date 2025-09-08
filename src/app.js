// src/app.js - Production server entry point
import http from 'node:http';
import { handler } from '../build/handler.js';
import { SocketIOServer } from './lib/server/io/SocketIOServer.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 3030;
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const LT_SUBDOMAIN = process.env.LT_SUBDOMAIN || '';
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
// Helper function to expand tilde in paths
const expandTilde = (filepath) => {
	if (filepath.startsWith('~/')) {
		// Use the same logic as getActualHome for consistent path resolution
		const userName = process.env.USER || 'dispatch';
		return path.join('/home', userName, filepath.slice(2));
	}
	return filepath;
};

// Get actual home directory, resolving tilde if needed
const getActualHome = () => {
	const homeFromEnv = process.env.HOME;

	// If HOME starts with tilde, we need to expand it properly
	if (homeFromEnv && homeFromEnv.startsWith('~/')) {
		// For development, the tilde should be expanded relative to the real user home
		// Use process.env.USER or fall back to getting the actual system user directory
		const userName = process.env.USER || 'dispatch'; // Default to dispatch for this system
		return path.join('/home', userName, homeFromEnv.slice(2)); // Remove '~/' and join with /home/username
	}

	// If HOME itself is the tilde literal, expand from system directories
	if (homeFromEnv && homeFromEnv === '~') {
		const userName = process.env.USER || 'dispatch';
		return path.join('/home', userName);
	}

	return homeFromEnv || os.homedir();
};

const actualHome = getActualHome();
// Set directory paths from environment or defaults
const baseConfigDir =
	process.env.DISPATCH_CONFIG_DIR ||
	(process.platform === 'win32'
		? path.join(actualHome, 'dispatch')
		: path.join(actualHome, '.config', 'dispatch'));

const configDir = expandTilde(baseConfigDir);

const baseProjectsDir =
	process.env.DISPATCH_PROJECTS_DIR ||
	(process.platform === 'win32'
		? path.join(actualHome, 'dispatch-projects')
		: process.env.CONTAINER_ENV
			? '/workspace'
			: path.join(actualHome, 'dispatch-projects'));

const projectsDir = expandTilde(baseProjectsDir);

async function initializeDirectories() {
	try {
		// Initialize new directory management system
		// Log environment configuration
		console.log('[DIRECTORY] Environment Configuration:');
		console.log(`[DIRECTORY]   HOME: ${process.env.HOME || 'undefined'}`);
		console.log(
			`[DIRECTORY]   DISPATCH_CONFIG_DIR: ${process.env.DISPATCH_CONFIG_DIR || 'undefined (using default)'}`
		);
		console.log(
			`[DIRECTORY]   DISPATCH_PROJECTS_DIR: ${process.env.DISPATCH_PROJECTS_DIR || 'undefined (using default)'}`
		);
		console.log(`[DIRECTORY] Resolved Paths:`);
		console.log(`[DIRECTORY]   Config Directory: ${configDir}`);
		console.log(`[DIRECTORY]   Projects Directory: ${projectsDir}`);

		// Create config directory
		fs.mkdirSync(configDir, { recursive: true });

		// Create projects directory
		fs.mkdirSync(projectsDir, { recursive: true });

		console.log(`Initialized DirectoryManager with:`);
		console.log(`  Config Dir: ${configDir}`);
		console.log(`  Projects Dir: ${projectsDir}`);

		// Check writability
		fs.accessSync(configDir, fs.constants.W_OK);
		fs.accessSync(projectsDir, fs.constants.W_OK);

		// DirectoryManager already initialized above
	} catch (err) {
		console.error(`ERROR: Directory initialization failed: ${err.message}`);
		console.error(`Ensure directories are writable by the process user.`);
		console.error(`Config Dir: ${configDir}`);
		console.error(`Projects Dir: ${projectsDir}`);
		process.exit(1);
	}
}




let ltProc = null;
function extractLtUrl(line) {
	const match = line.match(/your url is:\s*(https?:\/\/[^\s]+)/i);
	return match ? match[1] : null;
}
function startLocalTunnel() {
	if (!ENABLE_TUNNEL) return;
	const args = ['--port', PORT.toString()];
	if (LT_SUBDOMAIN) args.push('--subdomain', LT_SUBDOMAIN);
	console.log(`[LT] Starting LocalTunnel on port ${PORT}...`);
	ltProc = spawn('npx', ['localtunnel', ...args], { stdio: 'pipe' });
	const TUNNEL_FILE = path.join(directoryManager.configDir, 'tunnel-url.txt');
	ltProc.stdout.on('data', (buf) => {
		const line = buf.toString().trim();
		console.log(`[LT] ${line}`);
		const url = extractLtUrl(line);
		if (url) {
			try {
				fs.writeFileSync(TUNNEL_FILE, url + os.EOL);
				console.log(`[LT] Public URL written to ${TUNNEL_FILE}: ${url}`);
			} catch (err) {
				console.error(`[LT] Failed to write tunnel URL: ${err.message}`);
			}
		}
	});
	ltProc.stderr.on('data', (buf) => {
		process.stderr.write(`[LT-err] ${buf.toString()}`);
	});
	ltProc.on('exit', (code, sig) => {
		console.log(`[LT] exited code=${code} sig=${sig}`);
		try { fs.unlinkSync(TUNNEL_FILE); } catch { }
	});
}
function stopLocalTunnel() {
	if (ltProc && !ltProc.killed) {
		try { ltProc.kill(); } catch { }
	}
}


// Print HOME environment variable
console.log(`HOME environment variable: ${process.env.HOME || 'not set'}`);

// Initialize directories before starting server
initializeDirectories().then(() => {
	// Security check: require proper key if tunnel is enabled
	if (ENABLE_TUNNEL && (TERMINAL_KEY === 'change-me' || !TERMINAL_KEY)) {
		console.error('ERROR: TERMINAL_KEY must be set when ENABLE_TUNNEL=true for security');
		console.error('Set a secure TERMINAL_KEY environment variable');
		process.exit(1);
	}

	// Create HTTP server with SvelteKit handler
	const server = http.createServer(handler);
	// Attach Socket.IO server
	const ioServer = new SocketIOServer();
	ioServer.attachTo(server);

	server.listen(PORT, () => {
		console.log(`dispatch running at http://localhost:${PORT}`);
		console.log(`Config Dir: ${configDir}`);
		console.log(`Projects Dir: ${projectsDir}`);
		startLocalTunnel();
	});

	// graceful shutdown
	for (const sig of ['SIGINT', 'SIGTERM']) {
		process.on(sig, () => {
			stopLocalTunnel();
			process.exit(0);
		});
	}
}).catch((err) => {
	console.error('Failed to start server:', err);
	process.exit(1);
});
