import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { randomUUID } from 'crypto';

/**
 * DirectoryManager handles all directory operations for Dispatch
 * including project and session management with proper isolation
 */
class DirectoryManager {
  constructor() {
    // Set directory paths from environment or defaults
    this.configDir = process.env.DISPATCH_CONFIG_DIR || 
      (process.platform === 'win32' 
        ? path.join(process.env.APPDATA || os.homedir(), 'dispatch')
        : path.join(os.homedir(), '.config', 'dispatch'));
    
    this.projectsDir = process.env.DISPATCH_PROJECTS_DIR ||
      (process.platform === 'win32'
        ? path.join(os.homedir(), 'dispatch-projects')
        : process.env.CONTAINER_ENV 
          ? '/var/lib/dispatch/projects'
          : path.join(os.homedir(), 'dispatch-projects'));
    
    // Reserved names that cannot be used for projects
    this.RESERVED_NAMES = [
      '.dispatch', 'dispatch', 'config', 'sessions', 'workspace',
      'CON', 'PRN', 'AUX', 'NUL', // Windows reserved
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    // Path limits
    this.MAX_NAME_LENGTH = 63;
    this.MAX_PATH_LENGTH = 4096;
  }
  
  /**
   * Initialize directory structure
   */
  async initialize() {
    // Create config directory
    await fs.mkdir(this.configDir, { recursive: true });
    
    // Create projects directory
    await fs.mkdir(this.projectsDir, { recursive: true });
    
    // Initialize projects registry if it doesn't exist
    const projectsRegistryPath = path.join(this.configDir, 'projects.json');
    try {
      await fs.access(projectsRegistryPath);
    } catch {
      await fs.writeFile(projectsRegistryPath, '{}', 'utf8');
    }
  }
  
  /**
   * Sanitize and validate a project name
   * @param {string} name - Raw project name
   * @returns {string} Sanitized project name
   */
  sanitizeProjectName(name) {
    // Convert to lowercase and replace invalid chars with hyphens
    let sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, this.MAX_NAME_LENGTH);
    
    // Check against reserved names
    if (this.RESERVED_NAMES.includes(sanitized.toUpperCase()) || 
        this.RESERVED_NAMES.includes(sanitized)) {
      throw new Error(`Project name "${sanitized}" is reserved`);
    }
    
    // Ensure name is not empty after sanitization
    if (!sanitized) {
      throw new Error('Project name cannot be empty after sanitization');
    }
    
    return sanitized;
  }
  
  /**
   * Validate that a path stays within boundary
   * @param {string} targetPath - Path to validate
   * @param {string} boundary - Boundary path
   */
  validatePath(targetPath, boundary) {
    // Resolve both paths to absolute
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBoundary = path.resolve(boundary);
    
    // Check for traversal attempts in the original path
    if (targetPath.includes('../') || targetPath.includes('..\\')) {
      throw new Error('Path traversal detected');
    }
    
    // Ensure target is within boundary
    if (!resolvedTarget.startsWith(resolvedBoundary)) {
      throw new Error(`Path ${targetPath} is outside boundary ${boundary}`);
    }
    
    // Check path length
    if (resolvedTarget.length > this.MAX_PATH_LENGTH) {
      throw new Error(`Path exceeds maximum length of ${this.MAX_PATH_LENGTH} characters`);
    }
  }
  
  /**
   * Create a new project
   * @param {string} name - Project name
   * @param {Object} metadata - Project metadata
   * @returns {Promise<Object>} Created project info
   */
  async createProject(name, metadata = {}) {
    const sanitizedName = this.sanitizeProjectName(name);
    const projectPath = path.join(this.projectsDir, sanitizedName);
    
    // Validate path stays within projects directory
    this.validatePath(projectPath, this.projectsDir);
    
    // Check if project already exists
    try {
      await fs.access(projectPath);
      throw new Error(`Project "${sanitizedName}" already exists`);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    
    // Create project structure
    const projectId = randomUUID();
    const now = new Date().toISOString();
    
    // Create directories
    await fs.mkdir(path.join(projectPath, '.dispatch'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'workspace'), { recursive: true });
    
    // Create workspace subdirectories
    await fs.mkdir(path.join(projectPath, 'workspace', 'repositories'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'workspace', 'documents'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'workspace', 'assets'), { recursive: true });
    
    // Create metadata
    const projectMetadata = {
      id: projectId,
      name: sanitizedName,
      displayName: metadata.displayName || name,
      description: metadata.description || '',
      owner: metadata.owner || '',
      created: now,
      modified: now,
      tags: metadata.tags || [],
      settings: metadata.settings || {
        defaultShell: '/bin/bash',
        environment: {}
      }
    };
    
    // Write metadata files
    await fs.writeFile(
      path.join(projectPath, '.dispatch', 'metadata.json'),
      JSON.stringify(projectMetadata, null, 2),
      'utf8'
    );
    
    await fs.writeFile(
      path.join(projectPath, '.dispatch', 'sessions.json'),
      '{}',
      'utf8'
    );
    
    await fs.writeFile(
      path.join(projectPath, '.dispatch', 'project.json'),
      JSON.stringify({ id: projectId, name: sanitizedName }, null, 2),
      'utf8'
    );
    
    // Update projects registry
    const registryPath = path.join(this.configDir, 'projects.json');
    const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
    registry[projectId] = {
      id: projectId,
      name: sanitizedName,
      path: projectPath,
      created: now,
      modified: now
    };
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8');
    
    return {
      id: projectId,
      name: sanitizedName,
      path: projectPath,
      ...projectMetadata
    };
  }
  
  /**
   * Generate session directory name with milliseconds and random component
   * @returns {string} Session directory name
   */
  generateSessionTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    
    // Add a small random component to prevent collisions in concurrent creation
    const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    
    return `${year}-${month}-${day}-${hours}${minutes}${seconds}-${milliseconds}${random}`;
  }
  
  /**
   * Create a new session within a project
   * @param {string} projectId - Project ID
   * @param {Object} metadata - Session metadata
   * @returns {Promise<Object>} Created session info
   */
  async createSession(projectId, metadata = {}) {
    // Get project info
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const sessionId = randomUUID();
    const timestamp = this.generateSessionTimestamp();
    const sessionPath = path.join(project.path, 'sessions', timestamp);
    
    // Validate path
    this.validatePath(sessionPath, project.path);
    
    // Create session directory
    await fs.mkdir(sessionPath, { recursive: true });
    
    // Create session metadata
    const now = new Date().toISOString();
    const sessionData = {
      id: sessionId,
      directory: timestamp,
      projectId: projectId,
      created: now,
      lastAccessed: now,
      status: 'active',
      pid: null,
      mode: metadata.mode || 'shell',
      metadata: metadata
    };
    
    // Update sessions registry
    const sessionsPath = path.join(project.path, '.dispatch', 'sessions.json');
    let sessions;
    try {
      const content = await fs.readFile(sessionsPath, 'utf8');
      sessions = content.trim() ? JSON.parse(content) : {};
    } catch (err) {
      // If file doesn't exist or is invalid, start with empty object
      sessions = {};
    }
    sessions[sessionId] = sessionData;
    await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');
    
    return {
      ...sessionData,
      path: sessionPath
    };
  }
  
  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object|null>} Project info or null if not found
   */
  async getProject(projectId) {
    const registryPath = path.join(this.configDir, 'projects.json');
    try {
      const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
      const projectEntry = registry[projectId];
      
      if (!projectEntry) return null;
      
      // Load full metadata
      const metadataPath = path.join(projectEntry.path, '.dispatch', 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      return {
        ...metadata,
        path: projectEntry.path
      };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }
  
  /**
   * List all projects with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of projects
   */
  async listProjects(options = {}) {
    const registryPath = path.join(this.configDir, 'projects.json');
    const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
    
    const projects = [];
    for (const projectId of Object.keys(registry)) {
      const project = await this.getProject(projectId);
      if (project) {
        // Apply tag filter if specified
        if (options.tags && options.tags.length > 0) {
          const hasTag = options.tags.some(tag => project.tags.includes(tag));
          if (!hasTag) continue;
        }
        
        projects.push(project);
      }
    }
    
    // Sort by modified date (most recent first)
    projects.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    
    return projects;
  }
  
  /**
   * Get sessions for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Sessions map
   */
  async getProjectSessions(projectId) {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const sessionsPath = path.join(project.path, '.dispatch', 'sessions.json');
    try {
      const content = await fs.readFile(sessionsPath, 'utf8');
      return content.trim() ? JSON.parse(content) : {};
    } catch (err) {
      // If file doesn't exist or is invalid, return empty object
      return {};
    }
  }
  
  /**
   * Update session status
   * @param {string} projectId - Project ID
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated session object
   */
  async updateSession(projectId, sessionId, updates) {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const sessionsPath = path.join(project.path, '.dispatch', 'sessions.json');
    let sessions;
    try {
      const content = await fs.readFile(sessionsPath, 'utf8');
      sessions = content.trim() ? JSON.parse(content) : {};
    } catch (err) {
      // If file doesn't exist or is invalid, start with empty object
      sessions = {};
    }
    
    if (!sessions[sessionId]) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    sessions[sessionId] = {
      ...sessions[sessionId],
      ...updates,
      lastAccessed: new Date().toISOString()
    };
    
    await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');
    
    return sessions[sessionId];
  }
}

export default DirectoryManager;