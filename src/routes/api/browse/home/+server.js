import { json } from '@sveltejs/kit';
import { readdir, stat, mkdir } from 'node:fs/promises';
import { join, resolve, normalize } from 'node:path';
import { homedir } from 'node:os';

// Get the home directory
function getHomeDirectory() {
	return homedir();
}

// Validate that the requested path is within the home directory
function isPathWithinHome(requestedPath) {
	const homeDir = resolve(getHomeDirectory());
	const resolvedPath = resolve(requestedPath);

	// Ensure the path is within the home directory
	return resolvedPath.startsWith(homeDir);
}

export async function GET({ url }) {
	try {
		// If no path is provided, start in the home directory
		const requestedPath = url.searchParams.get('path') || getHomeDirectory();
		const showHidden = url.searchParams.get('showHidden') === 'true';

		// Resolve and validate the path
		const resolvedPath = resolve(requestedPath);

		// Security check: ensure path is within home directory
		if (!isPathWithinHome(resolvedPath)) {
			return json({ error: 'Access denied: path outside home directory' }, { status: 403 });
		}

		// Check if the path exists and is a directory
		const pathStat = await stat(resolvedPath).catch(() => null);
		if (!pathStat) {
			return json({ error: 'Path does not exist' }, { status: 404 });
		}

		if (!pathStat.isDirectory()) {
			return json({ error: 'Path is not a directory' }, { status: 400 });
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

		// Calculate parent directory (but only if within home)
		const homeDir = getHomeDirectory();
		let parent = null;
		if (resolvedPath !== homeDir) {
			const parentPath = resolve(resolvedPath, '..');
			if (isPathWithinHome(parentPath)) {
				parent = parentPath;
			}
		}

		return json({
			path: resolvedPath,
			entries,
			parent,
			homeDirectory: homeDir
		});
	} catch (error) {
		console.error('Home directory browse error:', error);
		return json({ error: error.message || 'Failed to browse home directory' }, { status: 500 });
	}
}
