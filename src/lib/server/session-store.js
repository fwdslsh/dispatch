// Session management using a JSON file
// File: src/lib/server/session-store.js

import fs from 'fs';
import path from 'path';
import os from 'os';
import DirectoryManager from './directory-manager.js';

// Initialize DirectoryManager instance
const directoryManager = new DirectoryManager();
directoryManager.initialize().catch(err => {
  console.error('Failed to initialize DirectoryManager in session-store:', err);
});

// Get session file path from DirectoryManager
let SESSION_FILE;
directoryManager.initialize().then(() => {
  SESSION_FILE = path.join(directoryManager.configDir, 'sessions.json');
});

function readSessions() {
  // Use the global SESSION_FILE path, fallback if not initialized yet
  const sessionFile = SESSION_FILE || path.join(directoryManager.configDir || os.tmpdir(), 'sessions.json');
  
  if (!fs.existsSync(sessionFile)) {
    const initial = { sessions: [], active: null, projects: {} };
    // Ensure directory exists
    const dir = path.dirname(sessionFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(sessionFile, JSON.stringify(initial, null, 2));
    return initial;
  }

  try {
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    // Ensure projects field exists for backward compatibility
    if (!data.projects) {
      data.projects = {};
    }
    return data;
  } catch (err) {
    throw new Error(`Unable to read sessions file at ${sessionFile}: ${err.message}`);
  }
}

function writeSessions(data) {
  try {
    const sessionFile = SESSION_FILE || path.join(directoryManager.configDir || os.tmpdir(), 'sessions.json');
    // Ensure parent dir exists
    const dir = path.dirname(sessionFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
  } catch (err) {
    const sessionFile = SESSION_FILE || path.join(directoryManager.configDir || os.tmpdir(), 'sessions.json');
    throw new Error(`Unable to write sessions file at ${sessionFile}: ${err.message}`);
  }
}


// session: { id, name, projectId?, mode, created, ... }
export function addSession(session) {
  if (!session.id || !session.name) {
    throw new Error('Session must include id and name');
  }
  const data = readSessions();
  
  // Add project association if provided
  if (session.projectId && !data.projects[session.projectId]) {
    data.projects[session.projectId] = [];
  }
  
  data.sessions.push({
    ...session,
    created: session.created || new Date().toISOString(),
    lastAccessed: session.lastAccessed || new Date().toISOString(),
    status: session.status || 'active'
  });
  
  // Also add to project sessions if project specified
  if (session.projectId) {
    data.projects[session.projectId].push(session.id);
  }
  
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
  const session = data.sessions.find(s => s.id === sessionId);
  
  // Remove from sessions array
  data.sessions = data.sessions.filter(s => s.id !== sessionId);
  
  // Remove from project sessions if it was associated with a project
  if (session && session.projectId && data.projects[session.projectId]) {
    data.projects[session.projectId] = data.projects[session.projectId]
      .filter(id => id !== sessionId);
  }
  
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
  
  // Clean up empty project arrays
  for (const projectId in data.projects) {
    if (data.projects[projectId].length === 0) {
      delete data.projects[projectId];
    }
  }
  
  writeSessions(data);
  console.log(`Session store initialized with ${data.sessions.length} persistent session(s)`);
  return 0;
}

/**
 * Get sessions for a specific project
 * @param {string} projectId - The project ID
 * @returns {Array} Array of session objects for the project
 */
export function getProjectSessions(projectId) {
  const data = readSessions();
  return data.sessions.filter(session => session.projectId === projectId);
}

/**
 * Get all projects with their session counts
 * @returns {Object} Object mapping project IDs to session counts
 */
export function getProjectSessionCounts() {
  const data = readSessions();
  const counts = {};
  
  for (const session of data.sessions) {
    if (session.projectId) {
      counts[session.projectId] = (counts[session.projectId] || 0) + 1;
    }
  }
  
  return counts;
}

/**
 * Update session metadata
 * @param {string} sessionId - Session ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated session object
 */
export function updateSession(sessionId, updates) {
  const data = readSessions();
  const sessionIndex = data.sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    throw new Error('Session not found');
  }
  
  data.sessions[sessionIndex] = {
    ...data.sessions[sessionIndex],
    ...updates,
    lastAccessed: new Date().toISOString()
  };
  
  writeSessions(data);
  return data.sessions[sessionIndex];
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

/**
 * Get DirectoryManager instance for advanced operations
 * @returns {DirectoryManager} DirectoryManager instance
 */
export function getDirectoryManager() {
  return directoryManager;
}
