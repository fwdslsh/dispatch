// src/app.js - Production server entry point
import http from 'node:http';
import { handler } from '../build/handler.js';
// Socket.IO is now handled by io-server.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 3030;
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const LT_SUBDOMAIN = process.env.LT_SUBDOMAIN || '';
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'testkey12345';

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
const configDir = expandTilde(process.env.DISPATCH_CONFIG_DIR || 
	(process.platform === 'win32' ? path.join(actualHome, 'dispatch') : path.join(actualHome, '.config', 'dispatch')));
const projectsDir = expandTilde(process.env.DISPATCH_PROJECTS_DIR || 
	(process.platform === 'win32' ? path.join(actualHome, 'dispatch-projects') : 
	 process.env.CONTAINER_ENV ? '/workspace' : path.join(actualHome, 'dispatch-projects')));

async function initializeDirectories() {
	try {
		console.log(`[DIRECTORY] Config Directory: ${configDir}`);
		console.log(`[DIRECTORY] Projects Directory: ${projectsDir}`);
		
		fs.mkdirSync(configDir, { recursive: true });
		fs.mkdirSync(projectsDir, { recursive: true });
		fs.accessSync(configDir, fs.constants.W_OK);
		fs.accessSync(projectsDir, fs.constants.W_OK);
		
		console.log('Directories initialized successfully');
	} catch (err) {
		console.error(`ERROR: Directory initialization failed: ${err.message}`);
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
	const TUNNEL_FILE = path.join(configDir, 'tunnel-url.txt');
	
	ltProc.stdout.on('data', (buf) => {
		const line = buf.toString().trim();
		console.log(`[LT] ${line}`);
		const url = extractLtUrl(line);
		if (url) {
			try {
				fs.writeFileSync(TUNNEL_FILE, url + os.EOL);
				console.log(`[LT] Public URL: ${url}`);
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

// Initialize directories before starting server
initializeDirectories().then(() => {
	// Security check: require proper key if tunnel is enabled
	if (ENABLE_TUNNEL && TERMINAL_KEY === 'testkey12345') {
		console.error('ERROR: Change TERMINAL_KEY from default when ENABLE_TUNNEL=true for security');
		process.exit(1);
	}

	// Create HTTP server with SvelteKit handler
	const server = http.createServer(handler);
	
	// Initialize Socket.IO with shared managers
	const { setupSocketIO } = await import('./lib/server/socket-setup.js');
	const io = setupSocketIO(server);
	
	// Store globally for API endpoints if needed
	globalThis.__DISPATCH_SOCKET_IO = io;

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