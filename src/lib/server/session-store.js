// Session management using a JSON file
// File: src/lib/server/session-store.js

import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.resolve(process.cwd(), 'src/lib/server/sessions.json');

function readSessions() {
  if (!fs.existsSync(SESSION_FILE)) return { sessions: [], active: null };
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
}

function writeSessions(data) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
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
