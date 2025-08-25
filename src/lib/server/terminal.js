// src/lib/server/terminal.js
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node-pty';

/**
 * @typedef {Object} SessionOpts
 * @property {number} [cols]
 * @property {number} [rows]
 * @property {"claude"|"shell"} [mode]
 */

export class TerminalManager {
  constructor() {
    /** @type {Map<string, import('node-pty').IPty>} */
    this.sessions = new Map();
    /** @type {Map<string, string[]>} */
    this.buffers = new Map();
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();
    this.ptyRoot = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
    this.defaultMode = process.env.PTY_MODE || 'claude';
    this.maxBufferSize = 5000; // Keep last 5000 characters per session
    
    // Ensure sessions directory exists
    try {
      fs.mkdirSync(this.ptyRoot, { recursive: true });
    } catch (err) {
      console.warn(`Could not create PTY root ${this.ptyRoot}:`, err.message);
    }
  }

  /**
   * Create a new PTY session
   * @param {SessionOpts} opts
   * @returns {{ sessionId: string, pty: import('node-pty').IPty }}
   */
  createSession(opts = {}) {
    const sessionId = randomUUID();
    const sessionDir = path.join(this.ptyRoot, sessionId);
    
    // Create session directory
    try {
      fs.mkdirSync(sessionDir, { recursive: true });
    } catch (err) {
      console.error(`Failed to create session dir ${sessionDir}:`, err.message);
      throw new Error(`Could not create session directory: ${err.message}`);
    }

    const mode = opts.mode || this.defaultMode;
    const cols = opts.cols || 80;
    const rows = opts.rows || 24;

    let command, args;
    
    if (mode === 'claude') {
      // Start Claude Code
      command = 'claude';
      args = [];
    } else {
      // Start shell
      command = process.env.SHELL || '/bin/bash';
      args = [];
    }

    const pty = spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: sessionDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: sessionDir
      }
    });

    this.sessions.set(sessionId, pty);
    this.buffers.set(sessionId, []);
    this.subscribers.set(sessionId, new Set());
    
    // Set up data handling
    pty.onData((data) => {
      // Buffer the data
      this.appendToBuffer(sessionId, data);
      
      // Notify all subscribers
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        subs.forEach(callback => {
          try {
            callback(data);
          } catch (err) {
            console.error('Error in subscriber callback:', err);
          }
        });
      }
    });
    
    // Clean up on exit
    pty.onExit(() => {
      this.sessions.delete(sessionId);
      this.buffers.delete(sessionId);
      this.subscribers.delete(sessionId);
      console.log(`Session ${sessionId} ended`);
    });

    console.log(`Created ${mode} session ${sessionId} in ${sessionDir}`);
    return { sessionId, pty };
  }

  /**
   * Get an existing session
   * @param {string} sessionId
   * @returns {import('node-pty').IPty | null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Resize a session
   * @param {string} sessionId
   * @param {number} cols
   * @param {number} rows
   */
  resizeSession(sessionId, cols, rows) {
    const pty = this.getSession(sessionId);
    if (pty) {
      try {
        pty.resize(cols, rows);
      } catch (err) {
        console.error(`Failed to resize session ${sessionId}:`, err.message);
      }
    }
  }

  /**
   * End a session
   * @param {string} sessionId
   */
  endSession(sessionId) {
    const pty = this.getSession(sessionId);
    if (pty) {
      try {
        pty.kill();
      } catch (err) {
        console.error(`Failed to kill session ${sessionId}:`, err.message);
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Write data to a session
   * @param {string} sessionId
   * @param {string} data
   */
  writeToSession(sessionId, data) {
    const pty = this.getSession(sessionId);
    if (pty) {
      try {
        pty.write(data);
      } catch (err) {
        console.error(`Failed to write to session ${sessionId}:`, err.message);
      }
    }
  }

  /**
   * Append data to session buffer
   * @param {string} sessionId
   * @param {string} data
   */
  appendToBuffer(sessionId, data) {
    const buffer = this.buffers.get(sessionId);
    if (buffer) {
      buffer.push(data);
      
      // Trim buffer if it gets too large
      const totalSize = buffer.reduce((sum, chunk) => sum + chunk.length, 0);
      if (totalSize > this.maxBufferSize) {
        // Remove oldest chunks until we're under the limit
        while (buffer.length > 0 && buffer.reduce((sum, chunk) => sum + chunk.length, 0) > this.maxBufferSize * 0.8) {
          buffer.shift();
        }
      }
    }
  }

  /**
   * Get buffered data for a session
   * @param {string} sessionId
   * @returns {string}
   */
  getBufferedData(sessionId) {
    const buffer = this.buffers.get(sessionId);
    return buffer ? buffer.join('') : '';
  }

  /**
   * Subscribe to session data
   * @param {string} sessionId
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribeToSession(sessionId, callback) {
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      subs.add(callback);
      return () => subs.delete(callback);
    }
    return () => {};
  }

  /**
   * Unsubscribe from session data
   * @param {string} sessionId
   * @param {Function} callback
   */
  unsubscribeFromSession(sessionId, callback) {
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      subs.delete(callback);
    }
  }
}