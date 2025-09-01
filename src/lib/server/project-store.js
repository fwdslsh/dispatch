// Project management with session hierarchy
// File: src/lib/server/project-store.js

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { PROJECT_CONFIG } from '../config/constants.js';

const PTY_ROOT = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
const PROJECT_FILE = path.resolve(PTY_ROOT, 'projects.json');

function readProjects() {
  // Ensure PTY_ROOT exists
  if (!fs.existsSync(PTY_ROOT)) {
    try {
      fs.mkdirSync(PTY_ROOT, { recursive: true });
    } catch (err) {
      throw new Error(`Unable to create PTY_ROOT at ${PTY_ROOT}: ${err.message}`);
    }
  }

  if (!fs.existsSync(PROJECT_FILE)) {
    const initial = { projects: [], activeProject: null };
    fs.writeFileSync(PROJECT_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  try {
    return JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf-8'));
  } catch (err) {
    throw new Error(`Unable to read projects file at ${PROJECT_FILE}: ${err.message}`);
  }
}

function writeProjects(data) {
  try {
    // Ensure parent dir exists
    if (!fs.existsSync(PTY_ROOT)) fs.mkdirSync(PTY_ROOT, { recursive: true });
    fs.writeFileSync(PROJECT_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    throw new Error(`Unable to write projects file at ${PROJECT_FILE}: ${err.message}`);
  }
}

/**
 * Initialize project sandbox environment by copying configuration files
 * @param {string} projectDir - The project directory path
 * @param {string} hostHomeDir - The host home directory to copy configs from
 */
function initializeProjectSandbox(projectDir, hostHomeDir = PROJECT_CONFIG.HOST_HOME_DIR) {
  // Check if sandboxing is enabled
  const sandboxEnabled = process.env.PROJECT_SANDBOX_ENABLED !== 'false';
  if (!sandboxEnabled) {
    console.log('Project sandboxing disabled, skipping config initialization');
    return;
  }

  // Use environment variable for host home directory if available
  const sourceHomeDir = process.env.HOST_HOME_DIR || hostHomeDir;
  
  try {
    console.log(`Initializing project sandbox at ${projectDir} from host home ${sourceHomeDir}`);
    
    // Copy configuration directories
    for (const configDir of PROJECT_CONFIG.CONFIG_DIRS_TO_COPY) {
      const sourcePath = path.join(sourceHomeDir, configDir);
      const targetPath = path.join(projectDir, configDir);
      
      if (fs.existsSync(sourcePath)) {
        try {
          // Create target directory structure
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          
          // Copy directory recursively
          copyDirectoryRecursive(sourcePath, targetPath);
          console.log(`Copied config directory: ${configDir}`);
        } catch (err) {
          console.warn(`Failed to copy config directory ${configDir}: ${err.message}`);
        }
      }
    }
    
    // Copy configuration files
    for (const configFile of PROJECT_CONFIG.CONFIG_FILES_TO_COPY) {
      const sourcePath = path.join(sourceHomeDir, configFile);
      const targetPath = path.join(projectDir, configFile);
      
      if (fs.existsSync(sourcePath)) {
        try {
          // Ensure target directory exists
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          
          // Copy file
          fs.copyFileSync(sourcePath, targetPath);
          fs.chmodSync(targetPath, PROJECT_CONFIG.CONFIG_FILE_MODE);
          console.log(`Copied config file: ${configFile}`);
        } catch (err) {
          console.warn(`Failed to copy config file ${configFile}: ${err.message}`);
        }
      }
    }
    
    // Create .bash_history file if it doesn't exist
    const bashHistoryPath = path.join(projectDir, '.bash_history');
    if (!fs.existsSync(bashHistoryPath)) {
      try {
        fs.writeFileSync(bashHistoryPath, '', { mode: PROJECT_CONFIG.CONFIG_FILE_MODE });
        console.log('Created .bash_history file');
      } catch (err) {
        console.warn(`Failed to create .bash_history: ${err.message}`);
      }
    }
    
  } catch (err) {
    console.warn(`Failed to initialize project sandbox: ${err.message}`);
  }
}

/**
 * Recursively copy a directory
 * @param {string} source - Source directory path
 * @param {string} target - Target directory path
 */
function copyDirectoryRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
      // Preserve file permissions but ensure they're not too restrictive
      const sourceMode = stat.mode;
      fs.chmodSync(targetPath, sourceMode);
    }
  }
}

/**
 * Create a new project
 * @param {Object} projectData - Project data { name, description }
 * @returns {Object} Created project
 */
export function createProject(projectData) {
  const { name, description = '' } = projectData;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Project name is required');
  }

  const data = readProjects();
  
  // Check for duplicate names
  if (data.projects.some(p => p.name === name.trim())) {
    throw new Error('Project name already exists');
  }

  const project = {
    id: randomUUID(),
    name: name.trim(),
    description: description.trim(),
    createdAt: new Date().toISOString(),
    sessions: []
  };

  // Create the project directory
  const projectDir = path.join(PTY_ROOT, project.id);
  try {
    fs.mkdirSync(projectDir, { recursive: true });
    console.log(`Created project directory: ${projectDir}`);
  } catch (err) {
    throw new Error(`Failed to create project directory: ${err.message}`);
  }

  // Initialize project sandbox with configuration files
  initializeProjectSandbox(projectDir);

  // Create sessions subdirectory within the project
  const sessionsDir = path.join(projectDir, 'sessions');
  try {
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log(`Created sessions directory: ${sessionsDir}`);
  } catch (err) {
    console.warn(`Failed to create sessions directory: ${err.message}`);
    // Don't fail project creation if sessions dir creation fails
  }

  data.projects.push(project);
  writeProjects(data);
  return project;
}

/**
 * Get all projects
 * @returns {Object} Projects data
 */
export function getProjects() {
  return readProjects();
}

/**
 * Get a specific project by ID
 * @param {string} projectId - Project ID
 * @returns {Object|null} Project or null if not found
 */
export function getProject(projectId) {
  const data = readProjects();
  return data.projects.find(p => p.id === projectId) || null;
}

/**
 * Update project metadata
 * @param {string} projectId - Project ID
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated project
 */
export function updateProject(projectId, updates) {
  const data = readProjects();
  const project = data.projects.find(p => p.id === projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }

  // Apply allowed updates
  if (updates.name !== undefined) {
    if (!updates.name || typeof updates.name !== 'string' || updates.name.trim().length === 0) {
      throw new Error('Project name is required');
    }
    // Check for duplicate names (excluding current project)
    if (data.projects.some(p => p.id !== projectId && p.name === updates.name.trim())) {
      throw new Error('Project name already exists');
    }
    project.name = updates.name.trim();
  }
  
  if (updates.description !== undefined) {
    project.description = (updates.description || '').trim();
  }

  writeProjects(data);
  return project;
}

/**
 * Delete a project and all its sessions
 * @param {string} projectId - Project ID
 * @returns {boolean} Success
 */
export function deleteProject(projectId) {
  const data = readProjects();
  const index = data.projects.findIndex(p => p.id === projectId);
  
  if (index === -1) {
    throw new Error('Project not found');
  }

  // Remove project directory if it exists
  const projectDir = path.join(PTY_ROOT, projectId);
  try {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      console.log(`Removed project directory: ${projectDir}`);
    }
  } catch (err) {
    console.warn(`Failed to remove project directory: ${err.message}`);
    // Don't fail project deletion if directory removal fails
  }

  data.projects.splice(index, 1);
  
  // Clear active project if it was the deleted one
  if (data.activeProject === projectId) {
    data.activeProject = null;
  }

  writeProjects(data);
  return true;
}

/**
 * Add a session to a project
 * @param {string} projectId - Project ID
 * @param {Object} sessionData - Session data { id, name, type, status }
 * @returns {Object} Added session
 */
export function addSessionToProject(projectId, sessionData) {
  const data = readProjects();
  const project = data.projects.find(p => p.id === projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }

  const { id, name, type = 'pty', status = 'active' } = sessionData;
  
  if (!id || !name) {
    throw new Error('Session ID and name are required');
  }

  // Check for duplicate session ID within project
  if (project.sessions.some(s => s.id === id)) {
    throw new Error('Session ID already exists in project');
  }

  const session = {
    id,
    name: name.trim(),
    type,
    status,
    createdAt: new Date().toISOString()
  };

  project.sessions.push(session);
  writeProjects(data);
  return session;
}

/**
 * Update a session within a project
 * @param {string} projectId - Project ID
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated session
 */
export function updateSessionInProject(projectId, sessionId, updates) {
  const data = readProjects();
  const project = data.projects.find(p => p.id === projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }

  const session = project.sessions.find(s => s.id === sessionId);
  
  if (!session) {
    throw new Error('Session not found in project');
  }

  // Apply allowed updates
  if (updates.name !== undefined) {
    if (!updates.name || typeof updates.name !== 'string' || updates.name.trim().length === 0) {
      throw new Error('Session name is required');
    }
    session.name = updates.name.trim();
  }
  
  if (updates.status !== undefined) {
    session.status = updates.status;
  }
  
  if (updates.type !== undefined) {
    session.type = updates.type;
  }

  writeProjects(data);
  return session;
}

/**
 * Remove a session from a project
 * @param {string} projectId - Project ID
 * @param {string} sessionId - Session ID
 * @returns {boolean} Success
 */
export function removeSessionFromProject(projectId, sessionId) {
  const data = readProjects();
  const project = data.projects.find(p => p.id === projectId);
  
  console.log('Removing session:', sessionId, 'from project:', projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const index = project.sessions.findIndex(s => s.id === sessionId);
  
  if (index === -1) {
    throw new Error('Session not found in project');
  }

  project.sessions.splice(index, 1);
  writeProjects(data);
  return true;
}

/**
 * Set active project
 * @param {string} projectId - Project ID (null to clear)
 * @returns {string|null} Active project ID
 */
export function setActiveProject(projectId) {
  const data = readProjects();
  
  if (projectId && !data.projects.some(p => p.id === projectId)) {
    throw new Error('Project not found');
  }

  data.activeProject = projectId;
  writeProjects(data);
  return projectId;
}

/**
 * Get all project names currently in use
 * @returns {Array<string>} Array of project names
 */
export function getAllProjectNames() {
  const data = readProjects();
  return data.projects.map(project => project.name);
}

/**
 * Initialize project store and perform cleanup
 * This should be called on server startup
 */
export function initializeProjectStore() {
  console.log('Initializing project store...');
  
  // Ensure the project file exists
  readProjects();
  
  const data = readProjects();
  console.log(`Project store initialized with ${data.projects.length} project(s)`);
  
  return { projectCount: data.projects.length };
}

