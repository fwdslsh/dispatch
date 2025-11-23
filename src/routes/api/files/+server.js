import { json } from '@sveltejs/kit';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { ApiError, BadRequestError, ForbiddenError, NotFoundError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

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
			throw new BadRequestError('Path parameter is required', 'MISSING_PATH');
		}

		// Resolve and validate the path
		const resolvedPath = resolve(requestedPath);

		if (!isPathAllowed(resolvedPath)) {
			throw new ForbiddenError('Access denied to this file');
		}

		// Check if the path exists and is a file
		const pathStat = await stat(resolvedPath).catch(() => null);
		if (!pathStat) {
			throw new NotFoundError('File does not exist');
		}

		if (!pathStat.isFile()) {
			throw new BadRequestError('Path is not a file', 'NOT_A_FILE');
		}

		// Check file size (limit to 10MB for safety)
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
		if (pathStat.size > MAX_FILE_SIZE) {
			throw new ApiError('File too large to edit (max 10MB)', 413, 'FILE_TOO_LARGE');
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
	} catch (err) {
		// Handle filesystem errors
		if (err.code === 'EACCES') {
			throw new ForbiddenError('Permission denied');
		}
		if (err.code === 'ENOENT') {
			throw new NotFoundError('File not found');
		}
		if (err.code === 'EISDIR') {
			throw new BadRequestError('Path is a directory', 'IS_DIRECTORY');
		}

		handleApiError(err, 'GET /api/files');
	}
}

export async function PUT({ request, url }) {
	try {
		const requestedPath = url.searchParams.get('path');
		const { content } = await request.json();

		if (!requestedPath) {
			throw new BadRequestError('Path parameter is required', 'MISSING_PATH');
		}

		if (typeof content !== 'string') {
			throw new BadRequestError('Content must be a string', 'INVALID_CONTENT_TYPE');
		}

		// Resolve and validate the path
		const resolvedPath = resolve(requestedPath);

		if (!isPathAllowed(resolvedPath)) {
			throw new ForbiddenError('Access denied to this file');
		}

		// Check if directory exists, create if it doesn't
		const dir = dirname(resolvedPath);
		try {
			await stat(dir);
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new BadRequestError('Directory does not exist', 'DIRECTORY_NOT_FOUND');
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
	} catch (err) {
		// Handle filesystem errors
		if (err.code === 'EACCES') {
			throw new ForbiddenError('Permission denied');
		}
		if (err.code === 'ENOSPC') {
			throw new ApiError('No space left on device', 507, 'INSUFFICIENT_STORAGE');
		}

		handleApiError(err, 'PUT /api/files');
	}
}
