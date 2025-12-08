import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { resolve, normalize } from 'path';
import {
	UnauthorizedError,
	BadRequestError,
	ConflictError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			logger.info('WORKSPACE_API', 'Unauthenticated request to list workspaces');
			throw new UnauthorizedError('Authentication required to list workspaces');
		}

		const { workspaceRepository, database } = locals.services;
		await database.init();

		// Get query parameters for filtering
		const status = url.searchParams.get('status');
		const limit = parseInt(url.searchParams.get('limit') || '50', 10);
		const offset = parseInt(url.searchParams.get('offset') || '0', 10);

		// Get workspaces with session counts in a single query (fixes N+1 problem)
		const workspacesWithCounts = await database.all(`
		SELECT
			w.path,
			w.name,
			w.created_at,
			w.last_active,
			w.updated_at,
			COUNT(CASE WHEN s.status = 'running' THEN 1 END) as running_count,
			COUNT(CASE WHEN s.status = 'stopped' THEN 1 END) as stopped_count,
			COUNT(CASE WHEN s.status = 'error' THEN 1 END) as error_count,
			COUNT(s.run_id) as total_count
		FROM workspaces w
		LEFT JOIN sessions s ON JSON_EXTRACT(s.meta_json, '$.workspacePath') = w.path
		GROUP BY w.path, w.name, w.created_at, w.last_active, w.updated_at
		ORDER BY w.last_active DESC NULLS LAST
	`);

		// Build workspace objects with session counts
		let workspaces = workspacesWithCounts.map((row) => {
			const workspace = {
				path: row.path,
				name: row.name,
				createdAt: row.created_at,
				lastActive: row.last_active,
				updatedAt: row.updated_at,
				sessionCounts: {
					total: row.total_count,
					running: row.running_count,
					stopped: row.stopped_count,
					error: row.error_count
				}
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

			return workspace;
		});

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
		handleApiError(err, 'GET /api/workspaces');
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const data = await request.json();
		const { name, path } = data;

		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required for workspace creation');
		}

		// Validate required fields
		if (!path) {
			throw new BadRequestError('Workspace path is required', 'MISSING_PATH');
		}

		// Validate path format and accessibility
		if (!isValidWorkspacePath(path)) {
			throw new BadRequestError('Invalid workspace path format', 'INVALID_PATH');
		}

		const { workspaceRepository } = locals.services;

		// Check if workspace already exists
		const existing = await workspaceRepository.findById(path);
		if (existing) {
			throw new ConflictError('Workspace already exists at this path');
		}

		const displayName =
			typeof name === 'string' && name.trim() ? name.trim() : extractWorkspaceName(path);

		// Create workspace entry
		let workspace;
		try {
			workspace = await workspaceRepository.create({ path, name: displayName });
		} catch (err) {
			if (err?.message?.includes('already exists')) {
				throw new ConflictError('Workspace already exists at this path');
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
		handleApiError(err, 'POST /api/workspaces');
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
 * Validate workspace path format and constraints with comprehensive security checks
 * @param {string} path - Path to validate
 * @param {string} [allowedRoot] - Allowed workspace root directory (defaults to WORKSPACES_ROOT)
 * @returns {boolean} True if path is valid and safe
 */
function isValidWorkspacePath(path, allowedRoot = null) {
	if (!path || typeof path !== 'string') return false;
	if (path.length > 500) return false;

	try {
		// Decode any URL-encoded characters (防止 %2e%2e 等编码绕过)
		const decoded = decodeURIComponent(path);

		// Normalize path to resolve . and .. segments
		const normalized = normalize(decoded);

		// Resolve to absolute path (handles symlinks and relative paths)
		const resolved = resolve(normalized);

		// Must be absolute path
		if (!resolved.startsWith('/')) return false;

		// Check for path traversal attempts after normalization
		if (normalized.includes('..') || normalized.includes('~')) {
			logger.warn('WORKSPACE_API', `Path traversal attempt blocked: ${path}`);
			return false;
		}

		// Validate against allowed workspace root if provided
		const workspaceRoot = allowedRoot || process.env.WORKSPACES_ROOT;
		if (workspaceRoot) {
			const resolvedRoot = resolve(workspaceRoot);
			if (!resolved.startsWith(resolvedRoot)) {
				logger.warn(
					'WORKSPACE_API',
					`Path outside workspace root blocked: ${resolved} (root: ${resolvedRoot})`
				);
				return false;
			}
		}

		return true;
	} catch (err) {
		// Handle decodeURIComponent errors or other path processing errors
		logger.warn('WORKSPACE_API', `Path validation error for "${path}":`, err);
		return false;
	}
}
