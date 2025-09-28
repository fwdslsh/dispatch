import { logger } from '../utils/logger.js';

/**
 * WorkspaceService - Centralized workspace management service
 *
 * Extracts workspace logic from DatabaseManager and API endpoints for better organization.
 * Provides workspace lifecycle management, validation, and business logic.
 */
export class WorkspaceService {
	constructor(database) {
		this.db = database;
	}

	/**
	 * Create a new workspace with validation
	 * @param {Object} options - Workspace creation options
	 * @param {string} options.path - Workspace path
	 * @param {string} [options.name] - Optional workspace name (defaults to path basename)
	 * @param {string} [options.description] - Optional workspace description
	 * @returns {Promise<Object>} Created workspace data
	 */
	async createWorkspace({ path, name, description }) {
		if (!path) {
			throw new Error('Workspace path is required');
		}

		// Validate path format and constraints
		this.validateWorkspacePath(path);

		await this.db.init();

		// Check if workspace already exists
		const existing = await this.db.get('SELECT path FROM workspaces WHERE path = ?', [path]);
		if (existing) {
			throw new Error(`Workspace already exists at path: ${path}`);
		}

		// Create workspace entry
		await this.db.createWorkspace(path);

		// Get the created workspace with enhanced metadata
		const workspace = await this.getWorkspaceByPath(path);

		logger.info('WORKSPACE_SERVICE', `Created workspace: ${path}`);
		return workspace;
	}

	/**
	 * Get workspace by path with enhanced metadata
	 * @param {string} path - Workspace path
	 * @returns {Promise<Object|null>} Workspace data with session counts and status
	 */
	async getWorkspaceByPath(path) {
		await this.db.init();

		const workspace = await this.db.get('SELECT * FROM workspaces WHERE path = ?', [path]);
		if (!workspace) {
			return null;
		}

		// Enhance with session counts and computed status
		return await this.enhanceWorkspaceWithMetadata(workspace);
	}

	/**
	 * List all workspaces with filtering and pagination
	 * @param {Object} options - Query options
	 * @param {string} [options.status] - Filter by status
	 * @param {number} [options.limit=50] - Page size
	 * @param {number} [options.offset=0] - Page offset
	 * @returns {Promise<Object>} Paginated workspace list with metadata
	 */
	async listWorkspaces({ status, limit = 50, offset = 0 } = {}) {
		await this.db.init();

		// Get all workspaces
		let workspaces = await this.db.listWorkspaces();

		// Enhance each workspace with metadata
		workspaces = await Promise.all(
			workspaces.map((workspace) => this.enhanceWorkspaceWithMetadata(workspace))
		);

		// Filter by status if specified
		if (status && ['active', 'inactive', 'archived', 'new'].includes(status)) {
			workspaces = workspaces.filter((w) => w.status === status);
		}

		// Apply pagination
		const total = workspaces.length;
		const paginatedWorkspaces = workspaces.slice(offset, offset + limit);

		return {
			workspaces: paginatedWorkspaces.map((w) => this.formatWorkspaceForAPI(w)),
			pagination: {
				total,
				limit,
				offset,
				hasMore: offset + limit < total
			}
		};
	}

	/**
	 * Update workspace metadata
	 * @param {string} path - Workspace path
	 * @param {Object} updates - Fields to update
	 * @param {string} [updates.name] - New workspace name
	 * @param {string} [updates.status] - New workspace status
	 * @param {string} [updates.description] - New workspace description
	 * @returns {Promise<Object>} Updated workspace data
	 */
	async updateWorkspace(path, updates) {
		await this.db.init();

		const workspace = await this.getWorkspaceByPath(path);
		if (!workspace) {
			throw new Error(`Workspace not found: ${path}`);
		}

		// Validate status change if provided
		if (updates.status && !['new', 'active', 'inactive', 'archived'].includes(updates.status)) {
			throw new Error(`Invalid workspace status: ${updates.status}`);
		}

		// Update workspace metadata in enhanced workspaces table
		// Note: Current schema only supports path-based metadata
		// For now, we'll update the updated_at timestamp
		const now = Date.now();
		await this.db.run('UPDATE workspaces SET updated_at = ? WHERE path = ?', [now, path]);

		// Return updated workspace
		const updatedWorkspace = await this.getWorkspaceByPath(path);

		logger.info('WORKSPACE_SERVICE', `Updated workspace: ${path}`);
		return updatedWorkspace;
	}

	/**
	 * Delete workspace and associated sessions
	 * @param {string} path - Workspace path
	 * @param {boolean} [force=false] - Force deletion even with active sessions
	 * @returns {Promise<Object>} Deletion result with cleanup stats
	 */
	async deleteWorkspace(path, force = false) {
		await this.db.init();

		const workspace = await this.getWorkspaceByPath(path);
		if (!workspace) {
			throw new Error(`Workspace not found: ${path}`);
		}

		// Check for active sessions unless force is true
		if (!force && workspace.sessionCounts.running > 0) {
			throw new Error(
				`Cannot delete workspace with ${workspace.sessionCounts.running} active sessions. ` +
					'Stop all sessions first or use force=true.'
			);
		}

		// Get all sessions in this workspace
		const sessions = await this.db.all(
			`SELECT run_id FROM sessions WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?`,
			[path]
		);

		// Delete all session data
		let deletedSessions = 0;
		for (const session of sessions) {
			try {
				// Delete session events first (foreign key constraint)
				await this.db.run('DELETE FROM session_events WHERE run_id = ?', [session.run_id]);
				// Delete workspace layout entries
				await this.db.run('DELETE FROM workspace_layout WHERE run_id = ?', [session.run_id]);
				// Delete session
				await this.db.run('DELETE FROM sessions WHERE run_id = ?', [session.run_id]);
				deletedSessions++;
			} catch (error) {
				logger.warn('WORKSPACE_SERVICE', `Failed to delete session ${session.run_id}:`, error);
			}
		}

		// Delete workspace entry
		await this.db.run('DELETE FROM workspaces WHERE path = ?', [path]);

		const result = {
			path,
			deletedSessions,
			message: `Workspace deleted successfully`
		};

		logger.info('WORKSPACE_SERVICE', `Deleted workspace ${path} with ${deletedSessions} sessions`);
		return result;
	}

	/**
	 * Update workspace activity timestamp
	 * @param {string} path - Workspace path
	 */
	async updateWorkspaceActivity(path) {
		await this.db.init();
		await this.db.updateWorkspaceActivity(path);
		logger.debug('WORKSPACE_SERVICE', `Updated activity for workspace: ${path}`);
	}

	/**
	 * Get workspace session statistics
	 * @param {string} path - Workspace path
	 * @returns {Promise<Object>} Session statistics
	 */
	async getWorkspaceSessionStats(path) {
		await this.db.init();

		const sessions = await this.db.all(
			`SELECT run_id, kind, status, created_at, updated_at
			 FROM sessions
			 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
			 ORDER BY updated_at DESC`,
			[path]
		);

		const stats = {
			total: sessions.length,
			byStatus: {},
			byType: {},
			activeSessions: []
		};

		for (const session of sessions) {
			// Count by status
			stats.byStatus[session.status] = (stats.byStatus[session.status] || 0) + 1;

			// Count by type
			stats.byType[session.kind] = (stats.byType[session.kind] || 0) + 1;

			// Track active sessions
			if (session.status === 'running') {
				stats.activeSessions.push({
					id: session.run_id,
					type: session.kind,
					status: session.status,
					createdAt: new Date(session.created_at).toISOString(),
					lastActivity: new Date(session.updated_at).toISOString()
				});
			}
		}

		return stats;
	}

	/**
	 * Validate workspace path format and constraints
	 * @param {string} path - Path to validate
	 * @throws {Error} If path is invalid
	 */
	validateWorkspacePath(path) {
		if (!path || typeof path !== 'string') {
			throw new Error('Workspace path must be a non-empty string');
		}

		// Must be absolute path
		if (!path.startsWith('/')) {
			throw new Error('Workspace path must be absolute');
		}

		// Prevent directory traversal
		if (path.includes('..') || path.includes('~')) {
			throw new Error('Workspace path cannot contain ".." or "~" for security');
		}

		// Path length limit
		if (path.length > 500) {
			throw new Error('Workspace path too long (max 500 characters)');
		}

		// Basic path structure validation
		if (path.includes('//') || path.endsWith('/..')) {
			throw new Error('Invalid path structure');
		}

		// Check workspace root constraint (if configured)
		const workspaceRoot = process.env.WORKSPACES_ROOT;
		if (workspaceRoot && !path.startsWith(workspaceRoot)) {
			throw new Error(`Workspace path must be within configured root: ${workspaceRoot}`);
		}
	}

	/**
	 * Extract workspace name from path (last directory segment)
	 * @param {string} path - Workspace path
	 * @returns {string} Workspace name
	 */
	extractWorkspaceName(path) {
		if (!path) return 'Unnamed Workspace';
		const segments = path.split('/').filter(Boolean);
		return segments[segments.length - 1] || 'Root';
	}

	/**
	 * Enhance workspace with metadata (session counts, status)
	 * @param {Object} workspace - Base workspace data
	 * @returns {Promise<Object>} Enhanced workspace data
	 */
	async enhanceWorkspaceWithMetadata(workspace) {
		// Get session counts for this workspace
		const sessions = await this.db.all(
			`SELECT COUNT(*) as count, status
			 FROM sessions
			 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
			 GROUP BY status`,
			[workspace.path]
		);

		const sessionCounts = {
			total: sessions.reduce((sum, s) => sum + s.count, 0),
			running: sessions.find((s) => s.status === 'running')?.count || 0,
			stopped: sessions.find((s) => s.status === 'stopped')?.count || 0,
			error: sessions.find((s) => s.status === 'error')?.count || 0,
			starting: sessions.find((s) => s.status === 'starting')?.count || 0
		};

		// Compute workspace status based on activity and session state
		let status;
		if (sessionCounts.running > 0) {
			status = 'active';
		} else if (workspace.last_active) {
			const daysSinceActivity = (Date.now() - workspace.last_active) / (1000 * 60 * 60 * 24);
			status = daysSinceActivity > 30 ? 'archived' : 'inactive';
		} else {
			status = 'new';
		}

		return {
			...workspace,
			sessionCounts,
			status,
			name: this.extractWorkspaceName(workspace.path)
		};
	}

	/**
	 * Format workspace data for API response
	 * @param {Object} workspace - Enhanced workspace data
	 * @returns {Object} API-formatted workspace data
	 */
	formatWorkspaceForAPI(workspace) {
		return {
			id: workspace.path, // Use path as ID for simplicity
			name: workspace.name,
			path: workspace.path,
			status: workspace.status,
			createdAt: new Date(workspace.created_at || Date.now()).toISOString(),
			lastActive: workspace.last_active ? new Date(workspace.last_active).toISOString() : null,
			updatedAt: new Date(workspace.updated_at || workspace.created_at || Date.now()).toISOString(),
			sessionCounts: workspace.sessionCounts
		};
	}

	/**
	 * Get detailed workspace information including session statistics
	 * @param {string} path - Workspace path
	 * @returns {Promise<Object|null>} Detailed workspace information
	 */
	async getWorkspaceDetails(path) {
		const workspace = await this.getWorkspaceByPath(path);
		if (!workspace) {
			return null;
		}

		const sessionStats = await this.getWorkspaceSessionStats(path);

		return {
			...this.formatWorkspaceForAPI(workspace),
			sessionStats: {
				total: sessionStats.total,
				byStatus: sessionStats.byStatus,
				byType: sessionStats.byType
			},
			activeSessions: sessionStats.activeSessions
		};
	}

	/**
	 * Archive old inactive workspaces
	 * @param {number} [daysSinceActivity=30] - Days since last activity to consider for archiving
	 * @returns {Promise<Object>} Archiving results
	 */
	async archiveInactiveWorkspaces(daysSinceActivity = 30) {
		await this.db.init();

		const cutoffTime = Date.now() - daysSinceActivity * 24 * 60 * 60 * 1000;

		const inactiveWorkspaces = await this.db.all(
			`SELECT path FROM workspaces
			 WHERE last_active < ? OR last_active IS NULL`,
			[cutoffTime]
		);

		let archivedCount = 0;
		for (const workspace of inactiveWorkspaces) {
			try {
				// Only archive if no active sessions
				const workspaceData = await this.getWorkspaceByPath(workspace.path);
				if (workspaceData && workspaceData.sessionCounts.running === 0) {
					await this.updateWorkspace(workspace.path, { status: 'archived' });
					archivedCount++;
				}
			} catch (error) {
				logger.warn('WORKSPACE_SERVICE', `Failed to archive workspace ${workspace.path}:`, error);
			}
		}

		logger.info('WORKSPACE_SERVICE', `Archived ${archivedCount} inactive workspaces`);
		return { archivedCount, totalChecked: inactiveWorkspaces.length };
	}
}
