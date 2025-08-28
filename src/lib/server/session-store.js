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
