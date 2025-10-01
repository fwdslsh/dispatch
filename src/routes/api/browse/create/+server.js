import { json } from '@sveltejs/kit';
import { mkdir, access } from 'node:fs/promises';
import { resolve, normalize, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { constants } from 'node:fs';

// Get the base directory for browsing (can be configured via environment)
function getBaseDirectory() {
	// Use WORKSPACES_ROOT if set, otherwise use home directory
	return process.env.WORKSPACES_ROOT || join(homedir(), 'workspaces');
}

// Validate that the requested path is within allowed bounds
function isPathAllowed(requestedPath) {
	const resolved = resolve(requestedPath);

	// Don't allow creation in system directories
	const systemDirs = ['/etc', '/usr', '/bin', '/sbin', '/proc', '/sys', '/dev', '/var'];
	for (const dir of systemDirs) {
		if (resolved.startsWith(dir)) {
			return false;
		}
	}

	// Allow creation within home directory or WORKSPACES_ROOT
	const base = getBaseDirectory();
	const homeDir = homedir();

	// Allow if within base directory or home directory
	return resolved.startsWith(normalize(base)) || resolved.startsWith(normalize(homeDir));
}

export async function POST({ request, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: \'Authentication required\' }, { status: 401 });
	}

	try {
		const { path } = await request.json();

		if (!path) {
			return json({ error: 'Path is required' }, { status: 400 });
		}

		// Resolve and validate the path
		const resolvedPath = resolve(path);

		if (!isPathAllowed(resolvedPath)) {
			return json({ error: 'Cannot create directory in this location' }, { status: 403 });
		}

		// Check if directory already exists
		try {
			await access(resolvedPath, constants.F_OK);
			return json({ error: 'Directory already exists' }, { status: 409 });
		} catch (e) {
			// Directory doesn't exist, which is what we want
		}

		// Check if parent directory exists and is writable
		const parentDir = dirname(resolvedPath);
		try {
			await access(parentDir, constants.W_OK);
		} catch (e) {
			return json({ error: 'Parent directory does not exist or is not writable' }, { status: 403 });
		}

		// Create the directory
		await mkdir(resolvedPath, { recursive: true });

		return json({
			success: true,
			path: resolvedPath,
			message: 'Directory created successfully'
		});
	} catch (error) {
		console.error('Directory creation error:', error);
		return json({ error: error.message || 'Failed to create directory' }, { status: 500 });
	}
}
