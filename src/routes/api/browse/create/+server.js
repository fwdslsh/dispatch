import { json } from '@sveltejs/kit';
import { mkdir, access } from 'node:fs/promises';
import { resolve, normalize, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { constants } from 'node:fs';
import {
	BadRequestError,
	ForbiddenError,
	ConflictError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

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

export async function POST({ request, locals: _locals }) {
	try {
		const { path } = await request.json();

		if (!path) {
			throw new BadRequestError('Path is required', 'MISSING_PATH');
		}

		// Resolve and validate the path
		const resolvedPath = resolve(path);

		if (!isPathAllowed(resolvedPath)) {
			throw new ForbiddenError('Cannot create directory in this location');
		}

		// Check if directory already exists
		try {
			await access(resolvedPath, constants.F_OK);
			throw new ConflictError('Directory already exists');
		} catch (_e) {
			// Directory doesn't exist, which is what we want
		}

		// Check if parent directory exists and is writable
		const parentDir = dirname(resolvedPath);
		try {
			await access(parentDir, constants.W_OK);
		} catch (_e) {
			throw new ForbiddenError('Parent directory does not exist or is not writable');
		}

		// Create the directory
		await mkdir(resolvedPath, { recursive: true });

		return json({
			success: true,
			path: resolvedPath,
			message: 'Directory created successfully'
		});
	} catch (err) {
		handleApiError(err, 'POST /api/browse/create');
	}
}
