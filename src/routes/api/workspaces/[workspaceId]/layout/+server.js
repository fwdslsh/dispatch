import { json, error } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * GET /api/workspaces/:workspaceId/layout
 * Get workspace layout configuration (pane configs and window state)
 */
/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
	try {
		const workspaceId = decodeURIComponent(params.workspaceId);

		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw error(401, { message: 'Authentication required' });
		}

		const { workspaceRepository, database } = locals.services;
		await database.init();

		// Check if workspace exists
		const workspace = await workspaceRepository.findById(workspaceId);
		if (!workspace) {
			throw error(404, { message: 'Workspace not found' });
		}

		// Get pane configurations and window state
		const paneConfigs = await workspaceRepository.getPaneConfigs(workspaceId);
		const windowState = await workspaceRepository.getWindowState(workspaceId);

		const response = {
			workspacePath: workspaceId,
			paneConfigs,
			windowState,
			hasSavedLayout: paneConfigs.length > 0 || windowState !== null
		};

		logger.info('WORKSPACE_LAYOUT_API', `Retrieved layout for workspace: ${workspaceId}`, {
			paneCount: paneConfigs.length,
			hasWindowState: !!windowState
		});

		return json(response);
	} catch (err) {
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_LAYOUT_API', 'Failed to get workspace layout:', err);
		throw error(500, { message: 'Failed to retrieve workspace layout' });
	}
}

/**
 * POST /api/workspaces/:workspaceId/layout
 * Save workspace layout configuration
 * Body: { paneConfigs: [...], windowState: {...} }
 */
/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request, locals }) {
	try {
		const workspaceId = decodeURIComponent(params.workspaceId);
		const data = await request.json();
		const { paneConfigs, windowState } = data;

		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw error(401, { message: 'Authentication required' });
		}

		const { workspaceRepository, database } = locals.services;
		await database.init();

		// Check if workspace exists
		const workspace = await workspaceRepository.findById(workspaceId);
		if (!workspace) {
			throw error(404, { message: 'Workspace not found' });
		}

		// Clear existing pane configs before saving new ones
		await workspaceRepository.clearPaneConfigs(workspaceId);

		// Save pane configurations
		if (Array.isArray(paneConfigs)) {
			for (let i = 0; i < paneConfigs.length; i++) {
				const pane = paneConfigs[i];
				await workspaceRepository.savePaneConfig(
					workspaceId,
					pane.sessionId,
					pane.sessionType,
					pane.paneConfig,
					i
				);
			}
		}

		// Save window state
		if (windowState) {
			await workspaceRepository.saveWindowState(workspaceId, windowState);
		}

		logger.info('WORKSPACE_LAYOUT_API', `Saved layout for workspace: ${workspaceId}`, {
			paneCount: paneConfigs?.length || 0,
			hasWindowState: !!windowState
		});

		return json({
			success: true,
			message: 'Workspace layout saved successfully',
			paneCount: paneConfigs?.length || 0
		});
	} catch (err) {
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_LAYOUT_API', 'Failed to save workspace layout:', err);
		throw error(500, { message: 'Failed to save workspace layout' });
	}
}

/**
 * DELETE /api/workspaces/:workspaceId/layout
 * Clear workspace layout configuration
 */
/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	try {
		const workspaceId = decodeURIComponent(params.workspaceId);

		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw error(401, { message: 'Authentication required' });
		}

		const { workspaceRepository, database } = locals.services;
		await database.init();

		// Check if workspace exists
		const workspace = await workspaceRepository.findById(workspaceId);
		if (!workspace) {
			throw error(404, { message: 'Workspace not found' });
		}

		// Clear pane configs and window state
		await workspaceRepository.clearPaneConfigs(workspaceId);
		await workspaceRepository.clearWindowState(workspaceId);

		logger.info('WORKSPACE_LAYOUT_API', `Cleared layout for workspace: ${workspaceId}`);

		return json({
			success: true,
			message: 'Workspace layout cleared successfully'
		});
	} catch (err) {
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_LAYOUT_API', 'Failed to clear workspace layout:', err);
		throw error(500, { message: 'Failed to clear workspace layout' });
	}
}
