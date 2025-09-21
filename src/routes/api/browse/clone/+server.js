import { json } from '@sveltejs/kit';
import { stat, readdir, mkdir, copyFile, access } from 'node:fs/promises';
import { resolve, normalize, dirname, join, basename } from 'node:path';
import { homedir } from 'node:os';
import { constants } from 'node:fs';

// Get the base directory for browsing (can be configured via environment)
function getBaseDirectory() {
	// Use WORKSPACES_ROOT if set, otherwise fall back to DISPATCH_PROJECTS_DIR or home directory
	return process.env.WORKSPACES_ROOT || process.env.DISPATCH_PROJECTS_DIR || homedir();
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

// Recursive directory copy function using promises
async function copyDirectoryRecursive(source, target) {
	// Ensure source exists and is a directory
	const sourceStat = await stat(source);
	if (!sourceStat.isDirectory()) {
		throw new Error('Source path is not a directory');
	}

	// Create target directory if it doesn't exist
	try {
		await mkdir(target, { recursive: true });
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}

	// Read directory contents
	const items = await readdir(source, { withFileTypes: true });

	// Copy each item
	for (const item of items) {
		const sourcePath = join(source, item.name);
		const targetPath = join(target, item.name);

		if (item.isDirectory()) {
			// Recursively copy subdirectory
			await copyDirectoryRecursive(sourcePath, targetPath);
		} else if (item.isFile()) {
			// Copy file
			await copyFile(sourcePath, targetPath);
		}
		// Skip symbolic links and other special files for security
	}
}

export async function POST({ request }) {
	try {
		const { sourcePath, targetPath, overwrite = false } = await request.json();

		if (!sourcePath) {
			return json({ error: 'Source path is required' }, { status: 400 });
		}

		if (!targetPath) {
			return json({ error: 'Target path is required' }, { status: 400 });
		}

		// Resolve and validate paths
		const resolvedSource = resolve(sourcePath);
		const resolvedTarget = resolve(targetPath);

		if (!isPathAllowed(resolvedSource)) {
			return json({ error: 'Access denied to source directory' }, { status: 403 });
		}

		if (!isPathAllowed(resolvedTarget)) {
			return json({ error: 'Access denied to target location' }, { status: 403 });
		}

		// Validate source exists and is a directory
		try {
			const sourceStat = await stat(resolvedSource);
			if (!sourceStat.isDirectory()) {
				return json({ error: 'Source path is not a directory' }, { status: 400 });
			}
		} catch (error) {
			if (error.code === 'ENOENT') {
				return json({ error: 'Source directory does not exist' }, { status: 404 });
			}
			throw error;
		}

		// Check if target already exists
		try {
			await access(resolvedTarget, constants.F_OK);
			if (!overwrite) {
				return json({ error: 'Target directory already exists' }, { status: 409 });
			}
		} catch (error) {
			// Target doesn't exist, which is what we want (unless overwrite is enabled)
		}

		// Validate parent directory of target exists and is writable
		const targetParent = dirname(resolvedTarget);
		try {
			await access(targetParent, constants.W_OK);
		} catch (error) {
			return json(
				{ error: 'Target parent directory does not exist or is not writable' },
				{ status: 403 }
			);
		}

		// Prevent copying a directory into itself or a subdirectory
		if (resolvedTarget.startsWith(resolvedSource + '/') || resolvedTarget === resolvedSource) {
			return json(
				{ error: 'Cannot copy directory into itself or its subdirectory' },
				{ status: 400 }
			);
		}

		// Perform the directory copy
		await copyDirectoryRecursive(resolvedSource, resolvedTarget);

		return json({
			success: true,
			sourcePath: resolvedSource,
			targetPath: resolvedTarget,
			message: 'Directory cloned successfully'
		});
	} catch (error) {
		console.error('Directory clone error:', error);
		return json({ error: error.message || 'Failed to clone directory' }, { status: 500 });
	}
}