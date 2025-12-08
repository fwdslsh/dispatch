/**
 * WorkspaceRepository - Workspace metadata CRUD operations
 * @file Handles workspace metadata persistence
 */

/**
 * @typedef {import('./DatabaseManager.js').DatabaseManager} DatabaseManager
 */

/**
 * Derive workspace name from path
 * @param {string} path - Workspace path
 * @returns {string} Derived name
 */
function deriveWorkspaceName(path) {
	if (!path) return 'Unnamed Workspace';
	const segments = path.split('/').filter(Boolean);
	return segments[segments.length - 1] || 'Root';
}

export class WorkspaceRepository {
	#db;

	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {
		this.#db = db;
	}

	/**
	 * Create workspace
	 * @param {Object} workspaceData - Workspace creation data
	 * @param {string} workspaceData.path - Absolute workspace path
	 * @param {string} [workspaceData.name] - Display name
	 * @param {string} [workspaceData.themeOverride] - Theme override
	 * @returns {Promise<Object>} Created workspace
	 */
	async create(workspaceData) {
		const { path, name, themeOverride = null } = workspaceData;
		const now = Date.now();

		const finalName =
			typeof name === 'string' && name.trim() ? name.trim() : deriveWorkspaceName(path);

		try {
			await this.#db.run(
				`INSERT INTO workspaces (path, name, theme_override, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?)`,
				[path, finalName, themeOverride, now, now]
			);

			return {
				id: path,
				path,
				name: finalName,
				themeOverride,
				lastActive: null,
				createdAt: now,
				updatedAt: now,
				status: 'active'
			};
		} catch (error) {
			if (error.code === 'SQLITE_CONSTRAINT') {
				throw new Error(`Workspace already exists: ${path}`);
			}
			throw error;
		}
	}

	/**
	 * Find workspace by path (ID)
	 * @param {string} path - Workspace path
	 * @returns {Promise<Object|null>} Workspace or null if not found
	 */
	async findById(path) {
		const row = await this.#db.get('SELECT * FROM workspaces WHERE path = ?', [path]);
		if (!row) return null;

		return this.#parseWorkspace(row);
	}

	/**
	 * List all workspaces
	 * @returns {Promise<Array>} All workspaces
	 */
	async findAll() {
		const rows = await this.#db.all(
			'SELECT * FROM workspaces ORDER BY last_active DESC, updated_at DESC'
		);

		return rows.map((row) => this.#parseWorkspace(row));
	}

	/**
	 * Update workspace metadata
	 * @param {string} path - Workspace path
	 * @param {Object} updates - Fields to update
	 * @param {string} [updates.name] - New name
	 * @param {string} [updates.themeOverride] - New theme override
	 * @returns {Promise<void>}
	 */
	async update(path, updates) {
		const workspace = await this.findById(path);
		if (!workspace) {
			throw new Error(`Workspace not found: ${path}`);
		}

		const sets = [];
		const params = [];

		if (updates.name !== undefined) {
			sets.push('name = ?');
			params.push(updates.name);
		}

		if (updates.themeOverride !== undefined) {
			sets.push('theme_override = ?');
			params.push(updates.themeOverride);
		}

		if (sets.length === 0) {
			return; // No updates
		}

		sets.push('updated_at = ?');
		params.push(Date.now());
		params.push(path);

		await this.#db.run(`UPDATE workspaces SET ${sets.join(', ')} WHERE path = ?`, params);
	}

	/**
	 * Update last active timestamp
	 * @param {string} path - Workspace path
	 * @returns {Promise<void>}
	 */
	async updateLastActive(path) {
		const now = Date.now();
		await this.#db.run('UPDATE workspaces SET last_active = ?, updated_at = ? WHERE path = ?', [
			now,
			now,
			path
		]);
	}

	/**
	 * Delete workspace
	 * @param {string} path - Workspace path
	 * @returns {Promise<void>}
	 */
	async delete(path) {
		await this.#db.run('DELETE FROM workspaces WHERE path = ?', [path]);
	}

	/**
	 * Ensure workspace exists (create if missing)
	 * @param {string} path - Workspace path
	 * @param {string} [name] - Optional workspace name
	 * @returns {Promise<Object>} Workspace
	 */
	async ensureExists(path, name = null) {
		let workspace = await this.findById(path);

		if (!workspace) {
			workspace = await this.create({ path, name });
		}

		return workspace;
	}

	/**
	 * Set workspace layout for a client
	 * @param {string} runId - Session run ID
	 * @param {string} clientId - Client identifier
	 * @param {string} tileId - Tile identifier
	 * @returns {Promise<void>}
	 */
	async setWorkspaceLayout(runId, clientId, tileId) {
		await this.#db.run(
			`INSERT OR REPLACE INTO workspace_layout (run_id, client_id, tile_id)
			 VALUES (?, ?, ?)`,
			[runId, clientId, tileId]
		);
	}

	/**
	 * Remove workspace layout for a client
	 * @param {string} runId - Session run ID
	 * @param {string} clientId - Client identifier
	 * @returns {Promise<void>}
	 */
	async removeWorkspaceLayout(runId, clientId) {
		await this.#db.run(`DELETE FROM workspace_layout WHERE run_id = ? AND client_id = ?`, [
			runId,
			clientId
		]);
	}

	/**
	 * Get workspace layout for a client
	 * @param {string} clientId - Client identifier
	 * @returns {Promise<Object|null>} Layout object or null
	 */
	async getWorkspaceLayout(clientId) {
		const row = await this.#db.get(
			`SELECT run_id, client_id, tile_id FROM workspace_layout WHERE client_id = ?`,
			[clientId]
		);

		return row
			? {
					runId: row.run_id,
					clientId: row.client_id,
					tileId: row.tile_id
				}
			: null;
	}

	/**
	 * Parse database row into workspace object
	 * @param {Object} row - Database row
	 * @returns {Object} Workspace object
	 */
	#parseWorkspace(row) {
		return {
			id: row.path,
			path: row.path,
			name: row.name || deriveWorkspaceName(row.path),
			themeOverride: row.theme_override,
			lastActive: row.last_active,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			status: 'active' // Workspaces don't have explicit status in schema yet
		};
	}

	/**
	 * Save pane configuration for a workspace
	 * @param {string} workspacePath - Workspace path
	 * @param {string} sessionId - Session/pane ID
	 * @param {string} sessionType - Session type (pty, claude, file-editor)
	 * @param {Object} paneConfig - Pane configuration object
	 * @param {number} paneOrder - Order in which pane was added
	 * @returns {Promise<void>}
	 */
	async savePaneConfig(workspacePath, sessionId, sessionType, paneConfig, paneOrder = 0) {
		const now = Date.now();
		const paneConfigJson = JSON.stringify(paneConfig || {});

		await this.#db.run(
			`INSERT OR REPLACE INTO workspace_panes
			 (workspace_path, session_id, session_type, pane_config_json, pane_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[workspacePath, sessionId, sessionType, paneConfigJson, paneOrder, now, now]
		);
	}

	/**
	 * Get all pane configurations for a workspace
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Array>} Array of pane configurations
	 */
	async getPaneConfigs(workspacePath) {
		const rows = await this.#db.all(
			`SELECT session_id, session_type, pane_config_json, pane_order
			 FROM workspace_panes
			 WHERE workspace_path = ?
			 ORDER BY pane_order ASC`,
			[workspacePath]
		);

		return rows.map((row) => ({
			sessionId: row.session_id,
			sessionType: row.session_type,
			paneConfig: JSON.parse(row.pane_config_json || '{}'),
			paneOrder: row.pane_order
		}));
	}

	/**
	 * Remove pane configuration
	 * @param {string} workspacePath - Workspace path
	 * @param {string} sessionId - Session/pane ID
	 * @returns {Promise<void>}
	 */
	async removePaneConfig(workspacePath, sessionId) {
		await this.#db.run(`DELETE FROM workspace_panes WHERE workspace_path = ? AND session_id = ?`, [
			workspacePath,
			sessionId
		]);
	}

	/**
	 * Clear all pane configurations for a workspace
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<void>}
	 */
	async clearPaneConfigs(workspacePath) {
		await this.#db.run(`DELETE FROM workspace_panes WHERE workspace_path = ?`, [workspacePath]);
	}

	/**
	 * Save complete window state for a workspace
	 * @param {string} workspacePath - Workspace path
	 * @param {Object} windowState - Complete BwinHost state from getInfo()
	 * @returns {Promise<void>}
	 */
	async saveWindowState(workspacePath, windowState) {
		const now = Date.now();
		const windowStateJson = JSON.stringify(windowState || {});

		await this.#db.run(
			`INSERT OR REPLACE INTO workspace_window_state
			 (workspace_path, window_state_json, created_at, updated_at)
			 VALUES (?, ?, ?, ?)`,
			[workspacePath, windowStateJson, now, now]
		);
	}

	/**
	 * Get window state for a workspace
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Object|null>} Window state object or null
	 */
	async getWindowState(workspacePath) {
		const row = await this.#db.get(
			`SELECT window_state_json FROM workspace_window_state WHERE workspace_path = ?`,
			[workspacePath]
		);

		return row ? JSON.parse(row.window_state_json) : null;
	}

	/**
	 * Clear window state for a workspace
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<void>}
	 */
	async clearWindowState(workspacePath) {
		await this.#db.run(`DELETE FROM workspace_window_state WHERE workspace_path = ?`, [
			workspacePath
		]);
	}
}
