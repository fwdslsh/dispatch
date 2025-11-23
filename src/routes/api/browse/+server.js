import { json } from '@sveltejs/kit';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { BadRequestError, NotFoundError, ForbiddenError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

// Get the base directory for browsing (can be configured via environment)
function getBaseDirectory() {
	// Use WORKSPACES_ROOT if set, otherwise fall back to home directory
	return process.env.WORKSPACES_ROOT || join(homedir(), 'workspaces');
}

// Validate that the requested path is within allowed bounds
function isPathAllowed(requestedPath) {
	const resolved = resolve(requestedPath);

	// Only block access to truly sensitive system directories
	const blockedDirs = ['/proc', '/sys', '/dev'];
	for (const dir of blockedDirs) {
		if (resolved.startsWith(dir)) {
			return false;
		}
	}

	return true;
}

export async function GET({ url }) {
	try {
		// If no path is provided, start in the workspaces root directory
		const requestedPath = url.searchParams.get('path') || getBaseDirectory();
		const showHidden = url.searchParams.get('showHidden') === 'true';

		// Resolve and validate the path
		const resolvedPath = resolve(requestedPath);

		if (!isPathAllowed(resolvedPath)) {
			throw new ForbiddenError('Access denied to this directory');
		}

		// Check if the path exists and is a directory
		const pathStat = await stat(resolvedPath).catch(() => null);
		if (!pathStat) {
			throw new NotFoundError('Path does not exist');
		}

		if (!pathStat.isDirectory()) {
			throw new BadRequestError('Path is not a directory', 'NOT_A_DIRECTORY');
		}

		// Read directory contents
		const items = await readdir(resolvedPath, { withFileTypes: true });

		// Filter and map entries
		const entries = [];
		for (const item of items) {
			// Skip hidden files unless requested
			if (!showHidden && item.name.startsWith('.')) {
				continue;
			}

			// Allow all directories and files (user can decide what to browse)

			const itemPath = join(resolvedPath, item.name);

			// Get additional stats for the item
			const itemStat = await stat(itemPath).catch(() => null);
			if (!itemStat) continue;

			entries.push({
				name: item.name,
				path: itemPath,
				isDirectory: item.isDirectory(),
				isFile: item.isFile(),
				size: itemStat.size,
				modified: itemStat.mtime.toISOString()
			});
		}

		// Sort entries: directories first, then alphabetically
		entries.sort((a, b) => {
			if (a.isDirectory && !b.isDirectory) return -1;
			if (!a.isDirectory && b.isDirectory) return 1;
			return a.name.localeCompare(b.name);
		});

		return json({
			path: resolvedPath,
			entries,
			parent: resolvedPath !== '/' ? resolve(resolvedPath, '..') : null
		});
	} catch (err) {
		handleApiError(err, 'GET /api/browse');
	}
}
