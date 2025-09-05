// src/app.js - Production server entry point
import { handler } from '../build/handler.js';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createModularSocketHandler } from './lib/server/handlers/ModularSocketHandler.js';
import { createNamespacedSocketHandler } from './lib/server/handlers/namespaced-socket-handler.js';
import { initializeSessionTypes } from './lib/session-types/index.js';
import storageManager from './lib/server/services/storage-manager.js';
import DirectoryManager from './lib/server/services/directory-manager.js';

const PORT = process.env.PORT || 3030;
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const LT_SUBDOMAIN = process.env.LT_SUBDOMAIN || '';
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';

// New directory management environment variables
const DISPATCH_CONFIG_DIR =
	process.env.DISPATCH_CONFIG_DIR ||
	(process.platform === 'win32'
		? path.join(process.env.APPDATA || os.homedir(), 'dispatch')
		: path.join(os.homedir(), '.config', 'dispatch'));

const DISPATCH_PROJECTS_DIR =
	process.env.DISPATCH_PROJECTS_DIR ||
	(process.platform === 'win32'
		? path.join(os.homedir(), 'dispatch-projects')
		: process.env.CONTAINER_ENV
			? '/var/lib/dispatch/projects'
			: path.join(os.homedir(), 'dispatch-projects'));

// Initialize directory management system
const directoryManager = new DirectoryManager();

async function initializeDirectories() {
	try {
		// Initialize new directory management system
		await directoryManager.initialize();
		console.log(`Initialized DirectoryManager with:`);
		console.log(`  Config Dir: ${directoryManager.configDir}`);
		console.log(`  Projects Dir: ${directoryManager.projectsDir}`);

		// Check writability
		fs.accessSync(directoryManager.configDir, fs.constants.W_OK);
		fs.accessSync(directoryManager.projectsDir, fs.constants.W_OK);

		// Initialize unified storage manager
		await storageManager.initialize();
	} catch (err) {
		console.error(`ERROR: Directory initialization failed: ${err.message}`);
		console.error(`Ensure directories are writable by the process user.`);
		console.error(`Config Dir: ${directoryManager.configDir}`);
		console.error(`Projects Dir: ${directoryManager.projectsDir}`);
		process.exit(1);
	}
}

async function startServer() {
	// Initialize directories before starting server
	await initializeDirectories();
	
	// Initialize session types registry
	initializeSessionTypes();

	// Security check: require proper key if tunnel is enabled
	if (ENABLE_TUNNEL && (TERMINAL_KEY === 'change-me' || !TERMINAL_KEY)) {
		console.error('ERROR: TERMINAL_KEY must be set when ENABLE_TUNNEL=true for security');
		console.error('Set a secure TERMINAL_KEY environment variable');
		process.exit(1);
	}

	// Create Express app
	const app = express();

	// Use SvelteKit handler
	app.use(handler);

	// Create HTTP server
	const httpServer = createServer(app);

	// Create Socket.IO server
	const io = new Server(httpServer, {
		cors: {
			origin: '*',
			methods: ['GET', 'POST']
		}
	});

	// Handle socket connections
	// Setup both main namespace and isolated session type namespaces
	const mainHandler = createModularSocketHandler(io);
	io.on('connection', mainHandler);
	
	// Setup namespaced handlers for session types
	createNamespacedSocketHandler(io);

	return { httpServer };
}

let ltProc = null;

function extractLtUrl(line) {
	const match = line.match(/your url is:\s*(https?:\/\/[^\s]+)/i);
	return match ? match[1] : null;
}

function startLocalTunnel() {
	if (!ENABLE_TUNNEL) return;

	const args = ['--port', PORT.toString()];
	if (LT_SUBDOMAIN) {
		args.push('--subdomain', LT_SUBDOMAIN);
	}

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
		// Clear the file on exit
		try {
			fs.unlinkSync(TUNNEL_FILE);
		} catch {}
	});
}

function stopLocalTunnel() {
	if (ltProc && !ltProc.killed) {
		try {
			ltProc.kill();
		} catch {}
	}
}

// Start the server
startServer()
	.then(({ httpServer }) => {
		httpServer.listen(PORT, () => {
			console.log(`dispatch running at http://localhost:${PORT}`);
			console.log(`Config Dir: ${directoryManager.configDir}`);
			console.log(`Projects Dir: ${directoryManager.projectsDir}`);

			startLocalTunnel();
		});

		// graceful shutdown
		for (const sig of ['SIGINT', 'SIGTERM']) {
			process.on(sig, () => {
				stopLocalTunnel();
				process.exit(0);
			});
		}
	})
	.catch((err) => {
		console.error('Failed to start server:', err);
		process.exit(1);
	});
