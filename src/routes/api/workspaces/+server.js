import { json, error } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			logger.info('WORKSPACE_API', 'Unauthenticated request to list workspaces');
			return json({ error: 'Authentication required to list workspaces' }, { status: 401 });
		}

		const { workspaceRepository, database } = locals.services;
		await database.init();

		// Get query parameters for filtering
		const status = url.searchParams.get('status');
		const limit = parseInt(url.searchParams.get('limit') || '50', 10);
		const offset = parseInt(url.searchParams.get('offset') || '0', 10);

		// Get workspaces with session counts
		let workspaces = await workspaceRepository.findAll();

		// Get session counts for each workspace
		for (const workspace of workspaces) {
			const sessions = await database.all(
				`SELECT COUNT(*) as count, status
				 FROM sessions
				 WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
				 GROUP BY status`,
				[workspace.path]
			);

			workspace.sessionCounts = {
				total: sessions.reduce((sum, s) => sum + s.count, 0),
				running: sessions.find((s) => s.status === 'running')?.count || 0,
				stopped: sessions.find((s) => s.status === 'stopped')?.count || 0,
				error: sessions.find((s) => s.status === 'error')?.count || 0
			};

			// Add derived status based on activity and session state
			if (workspace.sessionCounts.running > 0) {
				workspace.status = 'active';
			} else if (workspace.lastActive) {
				const daysSinceActivity = (Date.now() - workspace.lastActive) / (1000 * 60 * 60 * 24);
				workspace.status = daysSinceActivity > 30 ? 'archived' : 'inactive';
			} else {
				workspace.status = 'new';
			}
		}

		// Filter by status if specified
		if (status && ['active', 'inactive', 'archived', 'new'].includes(status)) {
			workspaces = workspaces.filter((w) => w.status === status);
		}

		// Apply pagination
		const total = workspaces.length;
		workspaces = workspaces.slice(offset, offset + limit);

		// Format response according to API contract
		const response = {
			workspaces: workspaces.map((w) => {
				return {
					id: w.id,
					name: w.name,
					path: w.path,
					status: w.status,
					createdAt: new Date(w.createdAt || Date.now()).toISOString(),
					lastActive: w.lastActive ? new Date(w.lastActive).toISOString() : null,
					updatedAt: new Date(w.updatedAt || w.createdAt || Date.now()).toISOString(),
					sessionCounts: w.sessionCounts
				};
			}),
			pagination: {
				total,
				limit,
				offset,
				hasMore: offset + limit < total
			}
		};

		logger.info(
			'WORKSPACE_API',
			`Listed ${workspaces.length} workspaces (filtered: ${status || 'none'})`
		);
		return json(response);
	} catch (err) {
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_API', 'Failed to list workspaces:', err);
		throw error(500, { message: 'Failed to retrieve workspaces' });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const data = await request.json();
		const { name, path } = data;

		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw error(401, { message: 'Authentication required for workspace creation' });
		}

		// Validate required fields
		if (!path) {
			throw error(400, { message: 'Workspace path is required' });
		}

		// Validate path format and accessibility
		if (!isValidWorkspacePath(path)) {
			throw error(400, { message: 'Invalid workspace path format' });
		}

		const { workspaceRepository } = locals.services;

		// Check if workspace already exists
		const existing = await workspaceRepository.findById(path);
		if (existing) {
			throw error(409, { message: 'Workspace already exists at this path' });
		}

		const displayName =
			typeof name === 'string' && name.trim() ? name.trim() : extractWorkspaceName(path);

		// Create workspace entry
		let workspace;
		try {
			workspace = await workspaceRepository.create({ path, name: displayName });
		} catch (err) {
			if (err?.message?.includes('already exists')) {
				throw error(409, { message: 'Workspace already exists at this path' });
			}
			throw err;
		}

		const response = {
			id: workspace.id,
			name: workspace.name,
			path: workspace.path,
			status: 'new',
			createdAt: new Date(workspace.createdAt).toISOString(),
			lastActive: null,
			updatedAt: new Date(workspace.updatedAt).toISOString(),
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
		if (err?.status && err?.body) {
			throw err;
		}
		logger.error('WORKSPACE_API', 'Failed to create workspace:', err);
		throw error(500, { message: 'Failed to create workspace' });
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
