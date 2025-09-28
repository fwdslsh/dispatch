import { json, error } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { validateKey } from '$lib/server/shared/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request, locals }) {
	try {
		// Optional authentication - allow unauthenticated read for basic info
		const authKey = url.searchParams.get('authKey') ||
			(request.headers.get('authorization')?.startsWith('Bearer ') ?
				request.headers.get('authorization').slice(7) : null);

		const isAuthenticated = authKey ? validateKey(authKey) : false;

		const dbManager = locals.services.database;
		await dbManager.init();

		// Get query parameters for filtering
		const status = url.searchParams.get('status');
		const limit = parseInt(url.searchParams.get('limit') || '50', 10);
		const offset = parseInt(url.searchParams.get('offset') || '0', 10);

		// Get workspaces with session counts
		let workspaces = await dbManager.listWorkspaces();

		// Get session counts for each workspace
		for (const workspace of workspaces) {
			const sessions = await dbManager.all(
				`SELECT COUNT(*) as count, status
				 FROM sessions
				 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
				 GROUP BY status`,
				[workspace.path]
			);

			workspace.sessionCounts = {
				total: sessions.reduce((sum, s) => sum + s.count, 0),
				running: sessions.find(s => s.status === 'running')?.count || 0,
				stopped: sessions.find(s => s.status === 'stopped')?.count || 0,
				error: sessions.find(s => s.status === 'error')?.count || 0
			};

			// Add derived status based on activity and session state
			if (workspace.sessionCounts.running > 0) {
				workspace.status = 'active';
			} else if (workspace.last_active) {
				const daysSinceActivity = (Date.now() - workspace.last_active) / (1000 * 60 * 60 * 24);
				workspace.status = daysSinceActivity > 30 ? 'archived' : 'inactive';
			} else {
				workspace.status = 'new';
			}
		}

		// Filter by status if specified
		if (status && ['active', 'inactive', 'archived', 'new'].includes(status)) {
			workspaces = workspaces.filter(w => w.status === status);
		}

		// Apply pagination
		const total = workspaces.length;
		workspaces = workspaces.slice(offset, offset + limit);

		// Format response according to API contract
		const response = {
			workspaces: workspaces.map(w => ({
				id: w.path, // Use path as ID for simplicity
				name: extractWorkspaceName(w.path),
				path: w.path,
				status: w.status,
				createdAt: new Date(w.created_at || Date.now()).toISOString(),
				lastActive: w.last_active ? new Date(w.last_active).toISOString() : null,
				updatedAt: new Date(w.updated_at || w.created_at || Date.now()).toISOString(),
				sessionCounts: w.sessionCounts
			})),
			pagination: {
				total,
				limit,
				offset,
				hasMore: offset + limit < total
			}
		};

		logger.info('WORKSPACE_API', `Listed ${workspaces.length} workspaces (filtered: ${status || 'none'})`);
		return json(response);

	} catch (err) {
		logger.error('WORKSPACE_API', 'Failed to list workspaces:', err);
		return error(500, { message: 'Failed to retrieve workspaces' });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const data = await request.json();
		const { name, path, authKey } = data;

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
			return error(401, { message: 'Authentication required for workspace creation' });
		}

		// Validate required fields
		if (!path) {
			return error(400, { message: 'Workspace path is required' });
		}

		// Validate path format and accessibility
		if (!isValidWorkspacePath(path)) {
			return error(400, { message: 'Invalid workspace path format' });
		}

		const dbManager = locals.services.database;
		await dbManager.init();

		// Check if workspace already exists
		const existing = await dbManager.get('SELECT path FROM workspaces WHERE path = ?', [path]);
		if (existing) {
			return error(409, { message: 'Workspace already exists at this path' });
		}

		// Create workspace entry
		await dbManager.createWorkspace(path);

		// Get the created workspace
		const workspace = await dbManager.get('SELECT * FROM workspaces WHERE path = ?', [path]);

		const response = {
			id: workspace.path,
			name: name || extractWorkspaceName(workspace.path),
			path: workspace.path,
			status: 'new',
			createdAt: new Date(workspace.created_at).toISOString(),
			lastActive: null,
			updatedAt: new Date(workspace.updated_at).toISOString(),
			sessionCounts: {
				total: 0,
				running: 0,
				stopped: 0,
				error: 0
			}
		};

		logger.info('WORKSPACE_API', `Created workspace: ${path}`);
		return json(response, { status: 201 });

	} catch (err) {
		logger.error('WORKSPACE_API', 'Failed to create workspace:', err);
		return error(500, { message: 'Failed to create workspace' });
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

/**
 * Validate workspace path format and constraints
 */
function isValidWorkspacePath(path) {
	if (!path || typeof path !== 'string') return false;

	// Basic path validation
	if (path.includes('..') || path.includes('~')) return false;
	if (path.length > 500) return false;

	// Must be absolute path
	if (!path.startsWith('/')) return false;

	return true;
}