import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Utility class for reading and normalizing Claude Code project session data
 * from the .dispatch-home/.claude/projects directory structure.
 */
export class ClaudeProjectsReader {
  constructor(projectsDir = null) {
    // Default to .dispatch-home/.claude/projects relative to current working directory
    this.projectsDir = projectsDir || path.join(process.cwd(), '.dispatch-home', '.claude', 'projects');
  }

  /**
   * Get all project directories
   * @returns {Promise<string[]>} Array of project directory names
   */
  async getProjectDirectories() {
    try {
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Decode project directory name to original workspace path
   * @param {string} dirName Encoded directory name
   * @returns {string} Original workspace path
   */
  decodeProjectPath(dirName) {
    return dirName.replace(/^-/, '/').replace(/-/g, '/');
  }

  /**
   * Get all session files for a project
   * @param {string} projectDir Project directory name
   * @returns {Promise<string[]>} Array of session file names (without .jsonl extension)
   */
  async getProjectSessions(projectDir) {
    const projectPath = path.join(this.projectsDir, projectDir);
    try {
      const files = await fs.readdir(projectPath);
      return files
        .filter(file => file.endsWith('.jsonl'))
        .map(file => file.replace('.jsonl', ''))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read and parse a session JSONL file
   * @param {string} projectDir Project directory name
   * @param {string} sessionId Session ID
   * @returns {Promise<Object[]>} Array of parsed session entries
   */
  async readSession(projectDir, sessionId) {
    const filePath = path.join(this.projectsDir, projectDir, `${sessionId}.jsonl`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      return lines.map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (parseError) {
          console.warn(`Failed to parse line ${index + 1} in ${filePath}:`, parseError.message);
          return null;
        }
      }).filter(entry => entry !== null);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get normalized session metadata
   * @param {string} projectDir Project directory name
   * @param {string} sessionId Session ID
   * @returns {Promise<Object|null>} Normalized session metadata or null if not found
   */
  async getSessionMetadata(projectDir, sessionId) {
    const entries = await this.readSession(projectDir, sessionId);
    if (entries.length === 0) return null;

    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];
    
    // Check if first entry is a summary
    const summaryEntry = entries.find(entry => entry.type === 'summary');
    
    // Find first user message to get context
    const firstUserMessage = entries.find(entry => entry.type === 'user');
    
    return {
      sessionId,
      projectDir,
      workspacePath: this.decodeProjectPath(projectDir),
      summary: summaryEntry?.summary || null,
      messageCount: entries.length,
      startTime: firstEntry?.timestamp || null,
      endTime: lastEntry?.timestamp || null,
      duration: this.calculateDuration(firstEntry?.timestamp, lastEntry?.timestamp),
      gitBranch: firstUserMessage?.gitBranch || null,
      version: firstUserMessage?.version || null,
      firstMessage: firstUserMessage?.message?.content ? 
        this.truncateText(firstUserMessage.message.content, 100) : null,
      leafUuid: summaryEntry?.leafUuid || lastEntry?.uuid || null
    };
  }

  /**
   * Get all projects with their sessions
   * @returns {Promise<Object[]>} Array of project objects with session metadata
   */
  async getAllProjects() {
    const projectDirs = await this.getProjectDirectories();
    
    const projects = await Promise.all(
      projectDirs.map(async (projectDir) => {
        const sessionIds = await this.getProjectSessions(projectDir);
        const sessions = await Promise.all(
          sessionIds.map(sessionId => this.getSessionMetadata(projectDir, sessionId))
        );
        
        return {
          projectDir,
          workspacePath: this.decodeProjectPath(projectDir),
          sessionCount: sessions.length,
          sessions: sessions.filter(session => session !== null),
          lastActivity: sessions.length > 0 ? 
            Math.max(...sessions.map(s => new Date(s.endTime || s.startTime || 0).getTime())) : null
        };
      })
    );

    // Sort by last activity (most recent first)
    return projects.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
  }

  /**
   * Search sessions by content
   * @param {string} query Search query
   * @param {Object} options Search options
   * @returns {Promise<Object[]>} Array of matching sessions with context
   */
  async searchSessions(query, options = {}) {
    const { 
      maxResults = 50, 
      includeContent = false, 
      projectFilter = null 
    } = options;
    
    const projectDirs = await this.getProjectDirectories();
    const filteredProjectDirs = projectFilter ? 
      projectDirs.filter(dir => this.decodeProjectPath(dir).includes(projectFilter)) : 
      projectDirs;
    
    const results = [];
    
    for (const projectDir of filteredProjectDirs) {
      const sessionIds = await this.getProjectSessions(projectDir);
      
      for (const sessionId of sessionIds) {
        const entries = await this.readSession(projectDir, sessionId);
        const metadata = await this.getSessionMetadata(projectDir, sessionId);
        
        const matchingEntries = entries.filter(entry => {
          const searchableText = [
            entry.message?.content,
            entry.summary,
            entry.type === 'user' ? entry.message?.role : null
          ].filter(Boolean).join(' ').toLowerCase();
          
          return searchableText.includes(query.toLowerCase());
        });
        
        if (matchingEntries.length > 0) {
          results.push({
            ...metadata,
            matchCount: matchingEntries.length,
            matches: includeContent ? matchingEntries.slice(0, 3) : null
          });
          
          if (results.length >= maxResults) break;
        }
      }
      
      if (results.length >= maxResults) break;
    }
    
    return results.sort((a, b) => b.matchCount - a.matchCount);
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getStatistics() {
    const projects = await this.getAllProjects();
    const allSessions = projects.flatMap(p => p.sessions);
    
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    return {
      totalProjects: projects.length,
      totalSessions: allSessions.length,
      sessionsToday: allSessions.filter(s => new Date(s.endTime || s.startTime) > oneDayAgo).length,
      sessionsThisWeek: allSessions.filter(s => new Date(s.endTime || s.startTime) > oneWeekAgo).length,
      averageSessionLength: this.calculateAverageSessionLength(allSessions),
      mostActiveProject: projects.reduce((max, p) => 
        p.sessionCount > (max?.sessionCount || 0) ? p : max, null)?.workspacePath || null
    };
  }

  // Helper methods

  /**
   * Calculate duration between two timestamps
   * @param {string} start Start timestamp
   * @param {string} end End timestamp
   * @returns {number|null} Duration in milliseconds
   */
  calculateDuration(start, end) {
    if (!start || !end) return null;
    return new Date(end).getTime() - new Date(start).getTime();
  }

  /**
   * Truncate text to specified length
   * @param {string} text Text to truncate
   * @param {number} maxLength Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Calculate average session length
   * @param {Object[]} sessions Array of sessions
   * @returns {number} Average session length in milliseconds
   */
  calculateAverageSessionLength(sessions) {
    const durationsWithValues = sessions
      .map(s => s.duration)
      .filter(d => d !== null && d > 0);
    
    if (durationsWithValues.length === 0) return 0;
    
    return durationsWithValues.reduce((sum, d) => sum + d, 0) / durationsWithValues.length;
  }

  /**
   * Format duration for display
   * @param {number} milliseconds Duration in milliseconds
   * @returns {string} Formatted duration string
   */
  static formatDuration(milliseconds) {
    if (!milliseconds || milliseconds < 0) return 'N/A';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format timestamp for display
   * @param {string} timestamp ISO timestamp string
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  }
}