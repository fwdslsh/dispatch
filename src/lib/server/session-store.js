// Session management using a JSON file
// File: src/lib/server/session-store.js


import fs from 'fs';
import path from 'path';

const PTY_ROOT = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
const SESSION_FILE = path.resolve(PTY_ROOT, 'sessions.json');

function readSessions() {
  // Ensure PTY_ROOT exists
  if (!fs.existsSync(PTY_ROOT)) {
    try {
      fs.mkdirSync(PTY_ROOT, { recursive: true });
    } catch (err) {
      // If we can't create the directory, rethrow a clearer error
      throw new Error(`Unable to create PTY_ROOT at ${PTY_ROOT}: ${err.message}`);
    }
  }

  if (!fs.existsSync(SESSION_FILE)) {
    const initial = { sessions: [], active: null };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  } catch (err) {
    throw new Error(`Unable to read sessions file at ${SESSION_FILE}: ${err.message}`);
  }
}

function writeSessions(data) {
  try {
    // Ensure parent dir exists
    if (!fs.existsSync(PTY_ROOT)) fs.mkdirSync(PTY_ROOT, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    throw new Error(`Unable to write sessions file at ${SESSION_FILE}: ${err.message}`);
  }
}


// session: { id, name, host, port, username, ... }
export function addSession(session) {
  if (!session.host || !session.port || !session.username) {
    throw new Error('Session must include host, port, and username');
  }
  const data = readSessions();
  data.sessions.push(session);
  writeSessions(data);
  return session;
}

export function switchSession(sessionId) {
  const data = readSessions();
  if (data.sessions.find(s => s.id === sessionId)) {
    data.active = sessionId;
    writeSessions(data);
    return sessionId;
  }
  throw new Error('Session not found');
}

export function endSession(sessionId) {
  const data = readSessions();
  data.sessions = data.sessions.filter(s => s.id !== sessionId);
  if (data.active === sessionId) data.active = null;
  writeSessions(data);
  return sessionId;
}

export function getSessions() {
  return readSessions();
}

/**
 * Update the name of an existing session
 * @param {string} sessionId - The session ID to update
 * @param {string} newName - The new name for the session
 * @returns {string} The updated session ID
 */
export function updateSessionName(sessionId, newName) {
  const data = readSessions();
  const session = data.sessions.find(s => s.id === sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  session.name = newName;
  writeSessions(data);
  return sessionId;
}

/**
 * Get all session names currently in use
 * @returns {Array<string>} Array of session names
 */
export function getAllSessionNames() {
  const data = readSessions();
  return data.sessions.map(session => session.name);
}

/**
 * Clean up sessions that have been explicitly marked for deletion
 * We no longer clean up based on directory existence since we want persistent sessions
 * @returns {number} Number of sessions cleaned up
 */
export function cleanupDeadSessions() {
  // For now, we don't auto-cleanup sessions on startup
  // Sessions persist across server restarts and can be reused
  const data = readSessions();
  
  // Clear active session since server restart means no active PTY
  if (data.active) {
    data.active = null;
    writeSessions(data);
    console.log('Cleared active session on server restart');
  }
  
  console.log(`Session store initialized with ${data.sessions.length} persistent session(s)`);
  return 0;
}

/**
 * Initialize session store and perform cleanup
 * This should be called on server startup
 */
export function initializeSessionStore() {
  console.log('Initializing session store...');
  
  // Ensure the session file exists
  readSessions();
  
  // Clean up any orphaned sessions
  const cleanedCount = cleanupDeadSessions();
  
  const data = readSessions();
  console.log(`Session store initialized with ${data.sessions.length} active session(s)`);
  
  return { activeCount: data.sessions.length, cleanedCount };
}
