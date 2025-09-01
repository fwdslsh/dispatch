import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import DirectoryManager from '../src/lib/server/directory-manager.js';

describe('DirectoryManager', () => {
  let tempDir;
  let dm;
  
  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dispatch-test-'));
    
    // Set test environment variables
    process.env.DISPATCH_CONFIG_DIR = path.join(tempDir, 'config');
    process.env.DISPATCH_PROJECTS_DIR = path.join(tempDir, 'projects');
    
    dm = new DirectoryManager();
    await dm.initialize();
  });
  
  afterEach(async () => {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.DISPATCH_CONFIG_DIR;
    delete process.env.DISPATCH_PROJECTS_DIR;
  });
  
  describe('initialization', () => {
    it('should create config and projects directories', async () => {
      const configExists = await fs.access(dm.configDir).then(() => true).catch(() => false);
      const projectsExists = await fs.access(dm.projectsDir).then(() => true).catch(() => false);
      
      expect(configExists).toBe(true);
      expect(projectsExists).toBe(true);
    });
    
    it('should use default paths when environment variables are not set', () => {
      delete process.env.DISPATCH_CONFIG_DIR;
      delete process.env.DISPATCH_PROJECTS_DIR;
      
      const dm2 = new DirectoryManager();
      
      expect(dm2.configDir).toMatch(/\.config\/dispatch$/);
      expect(dm2.projectsDir).toMatch(/dispatch-projects$/);
    });
  });
  
  describe('sanitizeProjectName', () => {
    it('should normalize project names correctly', () => {
      expect(dm.sanitizeProjectName('My Project!')).toBe('my-project');
      expect(dm.sanitizeProjectName('test@#$%project')).toBe('test-project');
      expect(dm.sanitizeProjectName('UPPERCASE')).toBe('uppercase');
      expect(dm.sanitizeProjectName('multiple---dashes')).toBe('multiple-dashes');
    });
    
    it('should truncate long names to 63 characters', () => {
      const longName = 'a'.repeat(100);
      const sanitized = dm.sanitizeProjectName(longName);
      expect(sanitized.length).toBe(63);
    });
    
    it('should reject reserved names', () => {
      expect(() => dm.sanitizeProjectName('.dispatch')).toThrow('reserved');
      expect(() => dm.sanitizeProjectName('CON')).toThrow('reserved');
      expect(() => dm.sanitizeProjectName('PRN')).toThrow('reserved');
    });
  });
  
  describe('validatePath', () => {
    it('should allow paths within boundary', () => {
      const boundary = '/home/user/projects';
      expect(() => dm.validatePath('/home/user/projects/myapp', boundary)).not.toThrow();
      expect(() => dm.validatePath('/home/user/projects/sub/dir', boundary)).not.toThrow();
    });
    
    it('should reject paths outside boundary', () => {
      const boundary = '/home/user/projects';
      expect(() => dm.validatePath('/home/user/other', boundary)).toThrow('outside');
      expect(() => dm.validatePath('/etc/passwd', boundary)).toThrow('outside');
    });
    
    it('should reject paths with traversal attempts', () => {
      const boundary = '/home/user/projects';
      expect(() => dm.validatePath('/home/user/projects/../other', boundary)).toThrow();
      expect(() => dm.validatePath('/home/user/projects/../../etc', boundary)).toThrow();
    });
  });
  
  describe('createProject', () => {
    it('should create project with correct structure', async () => {
      const project = await dm.createProject('test-project', {
        description: 'Test project',
        owner: 'test@example.com',
        tags: ['test']
      });
      
      expect(project.name).toBe('test-project');
      expect(project.id).toBeDefined();
      expect(project.path).toContain('test-project');
      
      // Check directory structure
      const dirs = [
        path.join(project.path, '.dispatch'),
        path.join(project.path, 'sessions'),
        path.join(project.path, 'workspace')
      ];
      
      for (const dir of dirs) {
        const exists = await fs.access(dir).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
      
      // Check metadata file
      const metadataPath = path.join(project.path, '.dispatch', 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      expect(metadata.name).toBe('test-project');
      expect(metadata.description).toBe('Test project');
      expect(metadata.owner).toBe('test@example.com');
    });
    
    it('should sanitize project names', async () => {
      const project = await dm.createProject('Test Project!', {});
      expect(project.name).toBe('test-project');
    });
    
    it('should prevent duplicate projects', async () => {
      await dm.createProject('test-project', {});
      await expect(dm.createProject('test-project', {})).rejects.toThrow('exists');
    });
  });
  
  describe('createSession', () => {
    let project;
    
    beforeEach(async () => {
      project = await dm.createProject('test-project', {});
    });
    
    it('should create session with millisecond timestamp', async () => {
      const session = await dm.createSession(project.id, {
        purpose: 'Testing',
        mode: 'claude'
      });
      
      expect(session.id).toBeDefined();
      expect(session.directory).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-\d{5}$/);
      expect(session.projectId).toBe(project.id);
      
      // Check directory exists
      const sessionPath = path.join(project.path, 'sessions', session.directory);
      const exists = await fs.access(sessionPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
    
    it('should handle concurrent session creation', async () => {
      // Create multiple sessions concurrently
      const promises = Array(5).fill(null).map(() => 
        dm.createSession(project.id, { purpose: 'Concurrent test' })
      );
      
      const sessions = await Promise.all(promises);
      const directories = sessions.map(s => s.directory);
      
      // All directories should be unique
      expect(new Set(directories).size).toBe(directories.length);
    });
    
    it('should update sessions registry', async () => {
      const session = await dm.createSession(project.id, {
        purpose: 'Test session'
      });
      
      const sessionsPath = path.join(project.path, '.dispatch', 'sessions.json');
      const sessions = JSON.parse(await fs.readFile(sessionsPath, 'utf8'));
      
      expect(sessions[session.id]).toBeDefined();
      expect(sessions[session.id].directory).toBe(session.directory);
      expect(sessions[session.id].metadata.purpose).toBe('Test session');
    });
  });
  
  describe('getProject', () => {
    it('should retrieve project by ID', async () => {
      const created = await dm.createProject('test-project', {
        description: 'Test'
      });
      
      const retrieved = await dm.getProject(created.id);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('test-project');
      expect(retrieved.description).toBe('Test');
    });
    
    it('should return null for non-existent project', async () => {
      const project = await dm.getProject('non-existent');
      expect(project).toBeNull();
    });
  });
  
  describe('listProjects', () => {
    it('should list all projects', async () => {
      await dm.createProject('project-1', { tags: ['tag1'] });
      await dm.createProject('project-2', { tags: ['tag2'] });
      await dm.createProject('project-3', { tags: ['tag1', 'tag2'] });
      
      const projects = await dm.listProjects();
      expect(projects.length).toBe(3);
      expect(projects.map(p => p.name).sort()).toEqual(['project-1', 'project-2', 'project-3']);
    });
    
    it('should filter projects by tags', async () => {
      await dm.createProject('project-1', { tags: ['tag1'] });
      await dm.createProject('project-2', { tags: ['tag2'] });
      await dm.createProject('project-3', { tags: ['tag1', 'tag2'] });
      
      const tag1Projects = await dm.listProjects({ tags: ['tag1'] });
      expect(tag1Projects.length).toBe(2);
      expect(tag1Projects.map(p => p.name).sort()).toEqual(['project-1', 'project-3']);
    });
  });
});