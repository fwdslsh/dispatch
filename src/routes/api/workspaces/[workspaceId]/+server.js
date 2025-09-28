import { json, error } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { validateKey } from '$lib/server/shared/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, request, locals }) {
	try {
		const workspaceId = decodeURIComponent(params.workspaceId);
		const dbManager = locals.services.database;
		await dbManager.init();

		// Get workspace details
		const workspace = await dbManager.get('SELECT * FROM workspaces WHERE path = ?', [workspaceId]);
		if (!workspace) {
			return error(404, { message: 'Workspace not found' });
		}

		// Get active sessions for this workspace
		const sessions = await dbManager.all(
			`SELECT run_id, kind, status, created_at, updated_at, meta_json
			 FROM sessions
			 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
			 ORDER BY created_at DESC`,
			[workspaceId]
		);

		// Calculate session statistics
		const sessionStats = {
			total: sessions.length,
			byStatus: {
				running: sessions.filter((s) => s.status === 'running').length,
				stopped: sessions.filter((s) => s.status === 'stopped').length,
				starting: sessions.filter((s) => s.status === 'starting').length,
				error: sessions.filter((s) => s.status === 'error').length
			},
			byType: {
				terminal: sessions.filter((s) => s.kind === 'pty').length,
				claude: sessions.filter((s) => s.kind === 'claude').length,
				fileEditor: sessions.filter((s) => s.kind === 'file-editor').length
			}
		};

		// Determine workspace status
		let status;
		if (sessionStats.byStatus.running > 0) {
			status = 'active';
		} else if (workspace.last_active) {
			const daysSinceActivity = (Date.now() - workspace.last_active) / (1000 * 60 * 60 * 24);
			status = daysSinceActivity > 30 ? 'archived' : 'inactive';
		} else {
			status = 'new';
		}

		// Format active sessions for response
		const activeSessions = sessions
			.filter((s) => s.status === 'running' || s.status === 'starting')
			.map((s) => ({
				id: s.run_id,
				type: s.kind,
				status: s.status,
				createdAt: new Date(s.created_at).toISOString(),
				updatedAt: new Date(s.updated_at).toISOString()
			}));

		const displayName =
			workspace?.name && workspace.name.toString().trim()
				? workspace.name.toString().trim()
				: extractWorkspaceName(workspace.path);

		const response = {
			id: workspace.path,
			name: displayName,
			path: workspace.path,
			status,
			createdAt: new Date(workspace.created_at || Date.now()).toISOString(),
			lastActive: workspace.last_active ? new Date(workspace.last_active).toISOString() : null,
			updatedAt: new Date(workspace.updated_at || workspace.created_at || Date.now()).toISOString(),
			sessionCounts: sessionStats.byStatus,
			sessionStats,
			activeSessions
		};

		logger.info('WORKSPACE_API', `Retrieved workspace details: ${workspaceId}`);
		return json(response);
	} catch (err) {
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_API', 'Failed to get workspace details:', err);
		throw error(500, { message: 'Failed to retrieve workspace details' });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ params, request, locals }) {
	try {
		const workspaceId = decodeURIComponent(params.workspaceId);
		const data = await request.json();
		const { name, status, authKey } = data;

		// Get auth key from body or headers
		let finalAuthKey = authKey;
		if (!finalAuthKey) {
			const auth = request.headers.get('authorization');
			if (auth && auth.startsWith('Bearer ')) {
				finalAuthKey = auth.slice(7);
			}
		}

		// Require authentication for write operations
		if (!validateKey(finalAuthKey)) {
			throw error(401, { message: 'Authentication required for workspace updates' });
		}

		const dbManager = locals.services.database;
		await dbManager.init();

		// Check if workspace exists
		const workspace = await dbManager.get('SELECT * FROM workspaces WHERE path = ?', [workspaceId]);
		if (!workspace) {
			throw error(404, { message: 'Workspace not found' });
		}

		// Validate status if provided
		if (status && !['active', 'inactive', 'archived'].includes(status)) {
			throw error(400, { message: 'Invalid status. Must be one of: active, inactive, archived' });
		}

		let trimmedName;
		if (Object.prototype.hasOwnProperty.call(data, 'name')) {
			trimmedName = typeof name === 'string' ? name.trim() : '';
			if (!trimmedName) {
				throw error(400, { message: 'Workspace name cannot be empty' });
			}
		}

		// Check for active sessions if trying to archive
		if (status === 'archived') {
			const activeSessions = await dbManager.all(
				`SELECT COUNT(*) as count FROM sessions
				 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
				 AND status IN ('running', 'starting')`,
				[workspaceId]
			);

			if (activeSessions[0]?.count > 0) {
				throw error(400, {
					message: 'Cannot archive workspace with active sessions'
				});
			}
		}

		// Update workspace metadata
		const now = Date.now();
		const updateParts = ['updated_at = ?'];
		/** @type {(string|number)[]} */
		const updateParams = [now];
		if (trimmedName) {
			updateParts.push('name = ?');
			updateParams.push(trimmedName);
		}
		updateParams.push(workspaceId);
		await dbManager.run(
			`UPDATE workspaces SET ${updateParts.join(', ')} WHERE path = ?`,
			updateParams
		);

		// If reactivating, update last_active
		if (status === 'active') {
			await dbManager.updateWorkspaceActivity(workspaceId);
		}

		// Get updated workspace
		const updatedWorkspace = await dbManager.get('SELECT * FROM workspaces WHERE path = ?', [
			workspaceId
		]);

		// Recalculate session counts
		const sessions = await dbManager.all(
			`SELECT status FROM sessions
			 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?`,
			[workspaceId]
		);

		const sessionCounts = {
			total: sessions.length,
			running: sessions.filter((s) => s.status === 'running').length,
			stopped: sessions.filter((s) => s.status === 'stopped').length,
			starting: sessions.filter((s) => s.status === 'starting').length,
			error: sessions.filter((s) => s.status === 'error').length
		};

		const displayName =
			updatedWorkspace?.name && updatedWorkspace.name.toString().trim()
				? updatedWorkspace.name.toString().trim()
				: extractWorkspaceName(updatedWorkspace.path);

		const response = {
			id: updatedWorkspace.path,
			name: displayName,
			path: updatedWorkspace.path,
			status: status || (sessionCounts.running > 0 ? 'active' : 'inactive'),
			createdAt: new Date(updatedWorkspace.created_at).toISOString(),
			lastActive: updatedWorkspace.last_active
				? new Date(updatedWorkspace.last_active).toISOString()
				: null,
			updatedAt: new Date(updatedWorkspace.updated_at).toISOString(),
			sessionCounts
		};

		logger.info('WORKSPACE_API', `Updated workspace: ${workspaceId}`, { status, name: displayName });
		return json(response);
	} catch (err) {
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_API', 'Failed to update workspace:', err);
		throw error(500, { message: 'Failed to update workspace' });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, request, locals }) {
	try {
		const workspaceId = decodeURIComponent(params.workspaceId);

		// Get auth key from query params or headers
		const authKey =
			new URL(request.url).searchParams.get('authKey') ||
			(request.headers.get('authorization')?.startsWith('Bearer ')
				? request.headers.get('authorization').slice(7)
				: null);

		// Require authentication for delete operations
		if (!validateKey(authKey)) {
			throw error(401, { message: 'Authentication required for workspace deletion' });
		}

		const dbManager = locals.services.database;
		await dbManager.init();

		// Check if workspace exists
		const workspace = await dbManager.get('SELECT * FROM workspaces WHERE path = ?', [workspaceId]);
		if (!workspace) {
			throw error(404, { message: 'Workspace not found' });
		}

		// Check for active sessions
		const activeSessions = await dbManager.all(
			`SELECT run_id, status FROM sessions
			 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
			 AND status IN ('running', 'starting')`,
			[workspaceId]
		);

		if (activeSessions.length > 0) {
			throw error(400, {
				message: 'Cannot delete workspace with active sessions'
			});
		}

		// Soft delete - just remove from workspaces table
		// Sessions and events are preserved for historical reference
		await dbManager.run('DELETE FROM workspaces WHERE path = ?', [workspaceId]);

		// Also clean up workspace layouts
		await dbManager.run(
			`DELETE FROM workspace_layout
			 WHERE run_id IN (
				 SELECT run_id FROM sessions
				 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
			 )`,
			[workspaceId]
		);

		logger.info('WORKSPACE_API', `Deleted workspace: ${workspaceId}`);
		return json({ message: 'Workspace deleted successfully' });
	} catch (err) {
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_API', 'Failed to delete workspace:', err);
		throw error(500, { message: 'Failed to delete workspace' });
	}
}

/**
 * Extract workspace name from path (last directory segment)
 */
function extractWorkspaceName(path) {
	if (!path) return 'Unnamed Workspace';
	const segments = path.split('/').filter(Boolean);
	return segments[segments.length - 1] || 'Root';
}
