/**
 * WorkspaceLayoutService.js
 *
 * Service for managing workspace layout persistence.
 * Handles saving and restoring window manager pane configurations.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('workspace-layout-service');

export class WorkspaceLayoutService {
	/**
	 * Save current workspace layout
	 * @param {string} workspacePath - Workspace path
	 * @param {Object} bwinHostRef - BwinHost component reference
	 * @param {Array} sessionsList - Array of active sessions
	 * @returns {Promise<Object>} Save result
	 */
	async saveWorkspaceLayout(workspacePath, bwinHostRef, sessionsList) {
		if (!bwinHostRef || !workspacePath) {
			log.warn('Cannot save layout: missing bwinHostRef or workspacePath');
			return { success: false, message: 'Missing required parameters' };
		}

		try {
			// Ensure workspace exists before saving layout
			await this._ensureWorkspaceExists(workspacePath);

			// Get BwinHost state using getInfo() method
			const windowState = bwinHostRef.getInfo();

			// Build pane configs from current active sessions
			const paneConfigs = sessionsList
				.filter((s) => s.isActive)
				.map((session, index) => ({
					sessionId: session.id,
					sessionType: session.sessionType || session.type, // Try both fields
					paneConfig: {}, // Empty config - BwinHost manages internal state
					paneOrder: index
				}))
				.filter((p) => p.sessionType); // Filter out sessions without a type

			log.info('Saving workspace layout', {
				workspacePath,
				paneCount: paneConfigs.length,
				hasWindowState: !!windowState
			});

			// Save via API
			const response = await fetch(`/api/workspaces/${encodeURIComponent(workspacePath)}/layout`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ paneConfigs, windowState })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to save workspace layout');
			}

			const result = await response.json();
			log.info('Workspace layout saved successfully', result);
			return result;
		} catch (error) {
			log.error('Failed to save workspace layout:', error);
			throw error;
		}
	}

	/**
	 * Ensure workspace exists in database (create if missing)
	 * @private
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<void>}
	 */
	async _ensureWorkspaceExists(workspacePath) {
		try {
			// Check if workspace exists
			const checkResponse = await fetch(`/api/workspaces/${encodeURIComponent(workspacePath)}`, {
				credentials: 'include'
			});

			if (checkResponse.ok) {
				// Workspace exists
				return;
			}

			if (checkResponse.status === 404) {
				// Workspace doesn't exist - create it
				log.info('Creating workspace entry:', workspacePath);
				const createResponse = await fetch('/api/workspaces', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ path: workspacePath })
				});

				if (!createResponse.ok) {
					const error = await createResponse.json();
					log.warn('Failed to create workspace (will retry save):', error);
				} else {
					log.info('Workspace created successfully');
				}
			}
		} catch (error) {
			log.warn('Error ensuring workspace exists (will retry save):', error);
		}
	}

	/**
	 * Load saved workspace layout
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Object|null>} Saved layout or null if not found
	 */
	async loadWorkspaceLayout(workspacePath) {
		if (!workspacePath) {
			log.warn('Cannot load layout: missing workspacePath');
			return null;
		}

		try {
			log.info('Loading workspace layout for:', workspacePath);

			const response = await fetch(`/api/workspaces/${encodeURIComponent(workspacePath)}/layout`, {
				credentials: 'include'
			});

			if (!response.ok) {
				if (response.status === 404) {
					log.info('No saved layout found for workspace:', workspacePath);
					return null;
				}
				const error = await response.json();
				throw new Error(error.message || 'Failed to load workspace layout');
			}

			const layout = await response.json();
			log.info('Workspace layout loaded', {
				paneCount: layout.paneConfigs?.length || 0,
				hasWindowState: layout.hasSavedLayout
			});

			return layout;
		} catch (error) {
			log.error('Failed to load workspace layout:', error);
			// Return null instead of throwing - missing layout is not an error
			return null;
		}
	}

	/**
	 * Clear workspace layout
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Object>} Clear result
	 */
	async clearWorkspaceLayout(workspacePath) {
		if (!workspacePath) {
			log.warn('Cannot clear layout: missing workspacePath');
			return { success: false, message: 'Missing workspacePath' };
		}

		try {
			log.info('Clearing workspace layout for:', workspacePath);

			const response = await fetch(`/api/workspaces/${encodeURIComponent(workspacePath)}/layout`, {
				method: 'DELETE',
				credentials: 'include'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to clear workspace layout');
			}

			const result = await response.json();
			log.info('Workspace layout cleared successfully');
			return result;
		} catch (error) {
			log.error('Failed to clear workspace layout:', error);
			throw error;
		}
	}
}

// Export singleton instance
export const workspaceLayoutService = new WorkspaceLayoutService();
