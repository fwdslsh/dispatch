/**
 * TabApiClient.js
 *
 * API client for tab-related operations.
 * Provides a clean interface using mental model terminology (tabs, projects)
 * while delegating to SessionApiClient for actual API calls.
 *
 * Mental Model Terminology:
 * - Tab: A visual container for a running process (terminal, AI, file-editor)
 * - Project: User-facing term for workspace
 * - Panel: The visual area where a tab is displayed
 *
 * @file src/lib/client/shared/services/TabApiClient.js
 */

import { TAB_TYPE, isValidTabType, getTabTypeDisplayName } from '$lib/shared/tab-types.js';
import { SessionApiClient } from './SessionApiClient.js';

/**
 * @typedef {Object} Tab
 * @property {string} id - Tab ID
 * @property {string} tabType - Tab type (terminal, ai, file-editor)
 * @property {string} projectPath - Associated project path
 * @property {boolean} isActive - Whether tab is currently active
 * @property {boolean} inLayout - Whether tab is displayed in layout
 * @property {string} panelId - Panel ID when placed in layout
 * @property {string} title - Tab title
 * @property {string|number|Date} createdAt - Creation timestamp
 * @property {string|number|Date} lastActivity - Last activity timestamp
 */

/**
 * @typedef {Object} CreateTabOptions
 * @property {string} tabType - Tab type (terminal, ai, file-editor)
 * @property {string} projectPath - Project path for the tab
 * @property {Object} [options] - Type-specific options
 * @property {boolean} [resume] - Whether to resume existing tab
 * @property {string} [tabId] - Tab ID when resuming
 */

/**
 * TabApiClient - Clean API interface using mental model terminology
 */
export class TabApiClient {
	/**
	 * @param {Object} config - Configuration
	 */
	constructor(config) {
		this.config = config;
		// Delegate to SessionApiClient for actual API calls
		this._sessionApi = new SessionApiClient(config);
	}

	/**
	 * Normalize a session object to tab terminology
	 * @private
	 * @param {Object} session - Session object from API
	 * @returns {Tab} Tab object
	 */
	_toTab(session) {
		if (!session) return null;
		return {
			id: session.id,
			tabType: session.type,
			projectPath: session.workspacePath,
			isActive: session.isActive,
			inLayout: session.inLayout,
			panelId: session.tileId,
			title: session.title,
			createdAt: session.createdAt,
			lastActivity: session.lastActivity,
			// Keep raw for debugging
			_raw: session._raw
		};
	}

	/**
	 * List tabs with optional filtering
	 * @param {Object} [options] - List options
	 * @param {string} [options.project] - Filter by project path
	 * @param {boolean} [options.includeAll=false] - Include tabs not in layout
	 * @returns {Promise<{tabs: Tab[]}>}
	 */
	async listTabs({ project, includeAll = false } = {}) {
		const result = await this._sessionApi.list({
			workspace: project,
			includeAll
		});

		return {
			tabs: (result.sessions || []).map((s) => this._toTab(s))
		};
	}

	/**
	 * Create a new tab
	 * @param {CreateTabOptions} options
	 * @returns {Promise<Tab>}
	 */
	async createTab({ tabType, projectPath, options = {}, resume = false, tabId = null }) {
		// Validate tab type
		if (!isValidTabType(tabType)) {
			throw new Error(
				`Invalid tab type: ${tabType}. Must be one of: ${Object.values(TAB_TYPE).join(', ')}`
			);
		}

		// Map tab type to session type for API
		const sessionType = this._mapTabTypeToSessionType(tabType);

		const result = await this._sessionApi.create({
			type: sessionType,
			workspacePath: projectPath,
			options,
			resume,
			sessionId: tabId
		});

		return {
			id: result.id,
			tabType,
			projectPath,
			isActive: result.isActive,
			inLayout: result.inLayout,
			panelId: null,
			title: result.title || getTabTypeDisplayName(tabType),
			createdAt: result.createdAt,
			lastActivity: result.lastActivity,
			resumed: result.resumed,
			activityState: result.activityState,
			_raw: result._raw
		};
	}

	/**
	 * Map tab type to session type for API calls
	 * @private
	 * @param {string} tabType
	 * @returns {string}
	 */
	_mapTabTypeToSessionType(tabType) {
		// Map canonical tab types to session types expected by API
		const mapping = {
			[TAB_TYPE.TERMINAL]: 'pty',
			[TAB_TYPE.AI]: 'claude',
			[TAB_TYPE.FILE_EDITOR]: 'file-editor'
		};
		return mapping[tabType] || tabType;
	}

	/**
	 * Update a tab (rename, set panel, remove from panel)
	 * @param {Object} options
	 * @param {'rename'|'setPanel'|'removePanel'} options.action - Update action
	 * @param {string} options.tabId - Tab ID
	 * @param {string} [options.newTitle] - New title (for rename)
	 * @param {string} [options.panelId] - Panel ID (for panel actions)
	 * @param {number} [options.position] - Position (for panel actions)
	 * @param {string} [options.clientId] - Client ID (for panel actions)
	 * @returns {Promise<{success: boolean}>}
	 */
	async updateTab({ action, tabId, newTitle, panelId, position, clientId }) {
		// Map action names from mental model to API
		const actionMap = {
			setPanel: 'setLayout',
			removePanel: 'removeLayout',
			rename: 'rename'
		};

		return this._sessionApi.update({
			action: actionMap[action] || action,
			sessionId: tabId,
			newTitle,
			tileId: panelId,
			position,
			clientId
		});
	}

	/**
	 * Close/terminate a tab
	 * @param {string} tabId - Tab ID
	 * @returns {Promise<{success: boolean}>}
	 */
	async closeTab(tabId) {
		return this._sessionApi.delete(tabId);
	}

	/**
	 * Rename a tab (convenience method)
	 * @param {string} tabId
	 * @param {string} newTitle
	 * @returns {Promise<{success: boolean}>}
	 */
	async renameTab(tabId, newTitle) {
		return this._sessionApi.rename(tabId, newTitle);
	}

	/**
	 * Add tab to panel (convenience method)
	 * @param {string} tabId
	 * @param {string} panelId
	 * @param {number} position
	 * @param {string} clientId
	 * @returns {Promise<{success: boolean}>}
	 */
	async setTabPanel(tabId, panelId, position = 0, clientId) {
		return this._sessionApi.setLayout(tabId, panelId, position, clientId);
	}

	/**
	 * Remove tab from panel (convenience method)
	 * @param {string} tabId
	 * @returns {Promise<{success: boolean}>}
	 */
	async removeTabPanel(tabId) {
		return this._sessionApi.removeLayout(tabId);
	}

	// ===== LAYOUT MANAGEMENT =====

	/**
	 * Get current layout (all panel assignments)
	 * @returns {Promise<{layout: Array}>}
	 */
	async getLayout() {
		return this._sessionApi.getLayout();
	}

	/**
	 * Get tab history
	 * @param {string} tabId
	 * @returns {Promise<Array>}
	 */
	async getTabHistory(tabId) {
		return this._sessionApi.getHistory(tabId);
	}

	/**
	 * Validate tab options
	 * @param {CreateTabOptions} options
	 * @returns {boolean}
	 */
	validateTabOptions(options) {
		if (!options.tabType || !options.projectPath) {
			return false;
		}
		return isValidTabType(options.tabType);
	}

	// ===== PROJECT MANAGEMENT (delegates to workspace API) =====

	/**
	 * Get all projects
	 * @returns {Promise<Array>}
	 */
	async getProjects() {
		return this._sessionApi.getWorkspaces();
	}

	/**
	 * Create a new project
	 * @param {Object} project - Project data
	 * @returns {Promise<Object>}
	 */
	async createProject(project) {
		return this._sessionApi.createWorkspace(project);
	}

	/**
	 * Update project metadata
	 * @param {string} projectId - Project ID
	 * @param {Object} updates - Updates
	 * @returns {Promise<Object>}
	 */
	async updateProject(projectId, updates) {
		return this._sessionApi.updateWorkspace(projectId, updates);
	}

	/**
	 * Delete a project
	 * @param {string} projectId - Project ID
	 * @returns {Promise<{success: boolean}>}
	 */
	async deleteProject(projectId) {
		return this._sessionApi.deleteWorkspace(projectId);
	}

	// ===== SYSTEM STATUS =====

	/**
	 * Get system status including onboarding
	 * @returns {Promise<Object>}
	 */
	async getSystemStatus() {
		return this._sessionApi.getSystemStatus();
	}

	// ===== USER PREFERENCES =====

	/**
	 * Get user preferences
	 * @param {string} [category]
	 * @returns {Promise<Object>}
	 */
	async getUserPreferences(category) {
		return this._sessionApi.getUserPreferences(category);
	}

	/**
	 * Update user preferences
	 * @param {string} category
	 * @param {Object} preferences
	 * @returns {Promise<Object>}
	 */
	async updateUserPreferences(category, preferences) {
		return this._sessionApi.updateUserPreferences(category, preferences);
	}

	/**
	 * Reset preferences to defaults
	 * @param {string} category
	 * @returns {Promise<Object>}
	 */
	async resetPreferences(category) {
		return this._sessionApi.resetPreferences(category);
	}

	// ===== CLEANUP =====

	/**
	 * Dispose of resources
	 */
	dispose() {
		if (this._sessionApi) {
			this._sessionApi.dispose();
		}
	}
}
