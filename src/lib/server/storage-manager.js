// Unified storage manager combining project-store and session-store functionality
// File: src/lib/server/storage-manager.js

import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'node:crypto';
import DirectoryManager from './directory-manager.js';

class StorageManager {
  constructor() {
    // Initialize DirectoryManager for validation methods
    this.directoryManager = new DirectoryManager();
    
    // Use DirectoryManager's config directory for projects registry
    this.projectsFile = null; // Will be set after DirectoryManager initialization
    
    // Initialize on construction
    this.initialize();
  }

  async initialize() {
    try {
      await this.directoryManager.initialize();
      
      // Set projects file path after DirectoryManager is initialized
      this.projectsFile = path.join(this.directoryManager.configDir, 'projects.json');
      
      this.ensureDirectoryStructure();
    } catch (err) {
      console.error('Failed to initialize StorageManager:', err);
    }
  }

  /**
   * Ensure the config directory and projects.json exist
   */
  ensureDirectoryStructure() {
    // DirectoryManager already ensures config directory exists
    
    if (!fs.existsSync(this.projectsFile)) {
      const initial = { projects: [], activeProject: null };
      fs.writeFileSync(this.projectsFile, JSON.stringify(initial, null, 2));
    }
  }

  /**
   * Read projects from projects.json
   * @returns {Object} Projects data
   */
  readProjects() {
    this.ensureDirectoryStructure();
    
    try {
      const data = JSON.parse(fs.readFileSync(this.projectsFile, 'utf-8'));
      // Ensure projects field exists for backward compatibility
      if (!data.projects) {
        data.projects = [];
      }
      return data;
    } catch (err) {
      throw new Error(`Unable to read projects file at ${this.projectsFile}: ${err.message}`);
    }
  }

  /**
   * Write projects to projects.json
   * @param {Object} data - Projects data
   */
  writeProjects(data) {
    try {
      this.ensureDirectoryStructure();
      fs.writeFileSync(this.projectsFile, JSON.stringify(data, null, 2));
    } catch (err) {
      throw new Error(`Unable to write projects file at ${this.projectsFile}: ${err.message}`);
    }
  }

  // PROJECT MANAGEMENT METHODS

  /**
   * Create a new project
   * @param {Object} options - Project options with name and description
   * @returns {Object} Created project info
   */
  createProject(options) {
    const { name, description } = options;
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Project name is required');
    }

    const projectId = randomUUID();
    const sanitizedName = name.trim();
    const now = new Date().toISOString();
    
    // Create project directory using DirectoryManager
    const projectPath = path.join(this.directoryManager.projectsDir, projectId);
    if (fs.existsSync(projectPath)) {
      throw new Error(`Project directory already exists`);
    }
    fs.mkdirSync(projectPath, { recursive: true });
    
    const projectData = {
      id: projectId,
      name: sanitizedName,
      description: description || '',
      createdAt: now,
      sessions: []
    };

    // Add to projects registry
    const data = this.readProjects();
    data.projects.push(projectData);
    this.writeProjects(data);
    
    return projectData;
  }

  /**
   * Get all projects
   * @returns {Object} Projects data
   */
  getProjects() {
    return this.readProjects();
  }

  /**
   * Get a specific project by ID
   * @param {string} projectId - Project ID
   * @returns {Object|null} Project or null if not found
   */
  getProject(projectId) {
    const data = this.readProjects();
    return data.projects.find(p => p.id === projectId) || null;
  }

  /**
   * Update project metadata
   * @param {string} projectId - Project ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated project
   */
  updateProject(projectId, updates) {
    const data = this.readProjects();
    const project = data.projects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    Object.assign(project, updates);
    this.writeProjects(data);
    
    return project;
  }

  /**
   * Delete a project
   * @param {string} projectId - Project ID
   */
  deleteProject(projectId) {
    const data = this.readProjects();
    const projectIndex = data.projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Remove project directory
    const projectPath = path.join(this.directoryManager.projectsDir, projectId);
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }

    // Remove from registry
    data.projects.splice(projectIndex, 1);
    this.writeProjects(data);
  }

  /**
   * Add session to project
   * @param {string} projectId - Project ID
   * @param {Object} sessionData - Session data
   * @returns {Object} Updated project
   */
  addSessionToProject(projectId, sessionData) {
    const data = this.readProjects();
    const project = data.projects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (!project.sessions) {
      project.sessions = [];
    }

    project.sessions.push(sessionData);
    this.writeProjects(data);
    
    return project;
  }

  /**
   * Update session in project
   * @param {string} projectId - Project ID
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated session
   */
  updateSessionInProject(projectId, sessionId, updates) {
    const data = this.readProjects();
    const project = data.projects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (!project.sessions) {
      project.sessions = [];
    }

    const session = project.sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found in project ${projectId}`);
    }

    Object.assign(session, updates);
    this.writeProjects(data);
    
    return session;
  }

  /**
   * Remove session from project
   * @param {string} projectId - Project ID  
   * @param {string} sessionId - Session ID
   */
  removeSessionFromProject(projectId, sessionId) {
    const data = this.readProjects();
    const project = data.projects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    if (!project.sessions) {
      project.sessions = [];
    }

    const sessionIndex = project.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      throw new Error(`Session ${sessionId} not found in project ${projectId}`);
    }

    project.sessions.splice(sessionIndex, 1);
    this.writeProjects(data);
  }

  /**
   * Set active project
   * @param {string|null} projectId - Project ID to set as active, or null to clear
   * @returns {string|null} Active project ID
   */
  setActiveProject(projectId) {
    const data = this.readProjects();
    
    if (projectId && !data.projects.find(p => p.id === projectId)) {
      throw new Error(`Project ${projectId} not found`);
    }

    data.activeProject = projectId;
    this.writeProjects(data);
    
    return projectId;
  }

  // SESSION STORE COMPATIBILITY METHODS

  /**
   * Get sessions from the DirectoryManager session store
   * @returns {Object} Sessions data
   */
  getSessions() {
    const sessionFile = path.join(this.directoryManager.configDir || os.tmpdir(), 'sessions.json');
    
    if (!fs.existsSync(sessionFile)) {
      const initial = { sessions: [], active: null, projects: {} };
      const dir = path.dirname(sessionFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(sessionFile, JSON.stringify(initial, null, 2));
      return initial;
    }

    try {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      if (!data.projects) {
        data.projects = {};
      }
      return data;
    } catch (err) {
      throw new Error(`Unable to read sessions file at ${sessionFile}: ${err.message}`);
    }
  }

  /**
   * Get all session names (for name conflict resolution)
   * @returns {Array<string>} Array of session names
   */
  getAllSessionNames() {
    // Get names from both old session store and project sessions
    const names = new Set();
    
    try {
      const sessions = this.getSessions();
      sessions.sessions.forEach(session => {
        if (session.name) names.add(session.name);
      });
    } catch (err) {
      // Ignore errors from session store
    }

    try {
      const projects = this.getProjects();
      projects.projects.forEach(project => {
        if (project.sessions) {
          project.sessions.forEach(session => {
            if (session.name) names.add(session.name);
          });
        }
      });
    } catch (err) {
      // Ignore errors from project store
    }

    return Array.from(names);
  }

  // NAME VALIDATION METHODS (delegated to DirectoryManager)

  /**
   * Validates if a session name meets requirements
   * @param {string} name - The session name to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateSessionName(name) {
    return this.directoryManager.validateSessionName(name);
  }

  /**
   * Sanitizes a session name for filesystem use
   * @param {string} name - The session name to sanitize
   * @returns {string} Sanitized name safe for filesystem use
   */
  sanitizeSessionName(name) {
    return this.directoryManager.sanitizeSessionName(name);
  }

  /**
   * Generates a fallback name using session ID
   * @param {string} sessionId - The session UUID
   * @returns {string} Fallback session name
   */
  generateFallbackName(sessionId) {
    return this.directoryManager.generateFallbackName(sessionId);
  }

  /**
   * Resolves name conflicts by adding incremental suffix
   * @param {string} desiredName - The desired session name
   * @param {Array<string>} existingNames - Array of existing session names
   * @returns {string} Unique session name
   */
  resolveNameConflict(desiredName, existingNames) {
    return this.directoryManager.resolveNameConflict(desiredName, existingNames);
  }
}

// Export a singleton instance
const storageManager = new StorageManager();
export default storageManager;

// Export named functions for backward compatibility
export const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  addSessionToProject,
  updateSessionInProject,
  removeSessionFromProject,
  setActiveProject,
  getSessions,
  getAllSessionNames,
  validateSessionName,
  sanitizeSessionName,
  generateFallbackName,
  resolveNameConflict
} = storageManager;