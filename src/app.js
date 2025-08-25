// src/app.js - Production server entry point
import { handler } from '../build/handler.js';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { handleConnection } from './lib/server/socket-handler.js';

const PORT = process.env.PORT || 3000;
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const LT_SUBDOMAIN = process.env.LT_SUBDOMAIN || '';
const TUNNEL_FILE = '/tmp/tunnel-url.txt';

// Create Express app
const app = express();

// Use SvelteKit handler
app.use(handler);

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Handle socket connections
io.on('connection', handleConnection);

let ltProc = null;

function extractLtUrl(line) {
  const match = line.match(/your tunnel is available at:\s*(https?:\/\/[^\s]+)/i);
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
    try { fs.unlinkSync(TUNNEL_FILE); } catch {}
  });
}

function stopLocalTunnel() {
  if (ltProc && !ltProc.killed) {
    try { ltProc.kill(); } catch {}
  }
}

httpServer.listen(PORT, () => {
  console.log(`SvelteKit + PTY listening on ${PORT}`);
  startLocalTunnel();
});

// graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopLocalTunnel();
    process.exit(0);
  });
}