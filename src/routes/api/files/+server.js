import { json } from '@sveltejs/kit';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// Validate that the requested path is within allowed bounds
function isPathAllowed(requestedPath) {
	const resolvedPath = resolve(requestedPath);

	// Only block access to truly sensitive system directories
	const blockedDirs = ['/proc', '/sys', '/dev'];
	for (const dir of blockedDirs) {
		if (resolvedPath.startsWith(dir)) {
			return false;
		}
	}

	return true;
}

// Sanitize file content to prevent issues
function sanitizeContent(content) {
	// Basic content sanitization - remove null bytes
	return content.replace(/\0/g, '');
}

export async function GET({ url }) {
	try {
		const requestedPath = url.searchParams.get('path');

		if (!requestedPath) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		// Resolve and validate the path
		const resolvedPath = resolve(requestedPath);

		if (!isPathAllowed(resolvedPath)) {
			return json({ error: 'Access denied to this file' }, { status: 403 });
		}

		// Check if the path exists and is a file
		const pathStat = await stat(resolvedPath).catch(() => null);
		if (!pathStat) {
			return json({ error: 'File does not exist' }, { status: 404 });
		}

		if (!pathStat.isFile()) {
			return json({ error: 'Path is not a file' }, { status: 400 });
		}

		// Check file size (limit to 10MB for safety)
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
		if (pathStat.size > MAX_FILE_SIZE) {
			return json({ error: 'File too large to edit (max 10MB)' }, { status: 413 });
		}

		// Read file content
		const content = await readFile(resolvedPath, 'utf8');

		return json({
			path: resolvedPath,
			content: sanitizeContent(content),
			size: pathStat.size,
			modified: pathStat.mtime.toISOString(),
			readonly: false // Could be determined by file permissions
		});
	} catch (error) {
		console.error('[API] Failed to read file:', error);

		if (error.code === 'EACCES') {
			return json({ error: 'Permission denied' }, { status: 403 });
		}

		if (error.code === 'ENOENT') {
			return json({ error: 'File not found' }, { status: 404 });
		}

		if (error.code === 'EISDIR') {
			return json({ error: 'Path is a directory' }, { status: 400 });
		}

		return json({ error: error.message }, { status: 500 });
	}
}

export async function PUT({ request, url }) {
	try {
		const requestedPath = url.searchParams.get('path');
		const { content } = await request.json();

		if (!requestedPath) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		if (typeof content !== 'string') {
			return json({ error: 'Content must be a string' }, { status: 400 });
		}

		// Resolve and validate the path
		const resolvedPath = resolve(requestedPath);

		if (!isPathAllowed(resolvedPath)) {
			return json({ error: 'Access denied to this file' }, { status: 403 });
		}

		// Check if directory exists, create if it doesn't
		const dir = dirname(resolvedPath);
		try {
			await stat(dir);
		} catch (error) {
			if (error.code === 'ENOENT') {
				return json({ error: 'Directory does not exist' }, { status: 400 });
			}
			throw error;
		}

		// Write the file
		const sanitizedContent = sanitizeContent(content);
		await writeFile(resolvedPath, sanitizedContent, 'utf8');

		// Get updated file stats
		const pathStat = await stat(resolvedPath);

		return json({
			success: true,
			path: resolvedPath,
			size: pathStat.size,
			modified: pathStat.mtime.toISOString()
		});
	} catch (error) {
		console.error('[API] Failed to write file:', error);

		if (error.code === 'EACCES') {
			return json({ error: 'Permission denied' }, { status: 403 });
		}

		if (error.code === 'ENOSPC') {
			return json({ error: 'No space left on device' }, { status: 507 });
		}

		return json({ error: error.message }, { status: 500 });
	}
}
