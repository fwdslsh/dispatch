import { json } from '@sveltejs/kit';
import { writeFile, stat, mkdir } from 'node:fs/promises';
import { resolve, normalize, dirname, basename, join } from 'node:path';
import { homedir } from 'node:os';

// Get the base directory for file operations (can be configured via environment)
function getBaseDirectory() {
	return process.env.WORKSPACES_ROOT || process.env.HOME || homedir();
}

// Validate that the requested path is within allowed bounds
function isPathAllowed(requestedPath) {
	const baseDir = getBaseDirectory();
	const resolvedBase = resolve(baseDir);
	const resolvedPath = resolve(requestedPath);

	// Ensure the path is within the base directory
	return resolvedPath.startsWith(resolvedBase);
}

// Generate unique filename if file already exists
async function generateUniqueFilename(targetPath) {
	let counter = 1;
	let finalPath = targetPath;

	while (true) {
		try {
			await stat(finalPath);
			// File exists, try next variant
			const dir = dirname(targetPath);
			const name = basename(targetPath);
			const parts = name.split('.');
			if (parts.length > 1) {
				const ext = parts.pop();
				const baseName = parts.join('.');
				finalPath = join(dir, `${baseName}_${counter}.${ext}`);
			} else {
				finalPath = join(dir, `${name}_${counter}`);
			}
			counter++;
		} catch (error) {
			if (error.code === 'ENOENT') {
				// File doesn't exist, we can use this path
				break;
			}
			throw error;
		}
	}

	return finalPath;
}

export async function POST({ request, locals }) {
	// Require authentication
	const authKey = locals.services.auth.getAuthKeyFromRequest(request);
	if (!locals.services.auth.validateKey(authKey)) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const files = formData.getAll('files');
		const targetDirectoryEntry = formData.get('directory');
		const targetDirectory =
			typeof targetDirectoryEntry === 'string' ? targetDirectoryEntry : getBaseDirectory();

		if (!files || files.length === 0) {
			return json({ error: 'No files provided' }, { status: 400 });
		}

		// Validate target directory
		const resolvedDir = resolve(targetDirectory);
		if (!isPathAllowed(resolvedDir)) {
			return json({ error: 'Access denied to target directory' }, { status: 403 });
		}

		// Ensure target directory exists
		try {
			const dirStat = await stat(resolvedDir);
			if (!dirStat.isDirectory()) {
				return json({ error: 'Target path is not a directory' }, { status: 400 });
			}
		} catch (error) {
			if (error.code === 'ENOENT') {
				// Try to create the directory
				await mkdir(resolvedDir, { recursive: true });
			} else {
				throw error;
			}
		}

		const uploadResults = [];
		const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
		const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total

		let totalSize = 0;

		for (const file of files) {
			if (!(file instanceof File)) {
				continue; // Skip non-file entries
			}

			// Validate file size
			if (file.size > MAX_FILE_SIZE) {
				uploadResults.push({
					name: file.name,
					success: false,
					error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
				});
				continue;
			}

			totalSize += file.size;
			if (totalSize > MAX_TOTAL_SIZE) {
				uploadResults.push({
					name: file.name,
					success: false,
					error: 'Total upload size limit exceeded'
				});
				break;
			}

			try {
				// Generate target path
				const targetPath = join(resolvedDir, file.name);
				const finalPath = await generateUniqueFilename(targetPath);

				// Read file content and write to disk
				const arrayBuffer = await file.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);
				await writeFile(finalPath, buffer);

				// Get file stats
				const fileStat = await stat(finalPath);

				uploadResults.push({
					name: file.name,
					success: true,
					path: finalPath,
					size: fileStat.size,
					modified: fileStat.mtime.toISOString(),
					wasRenamed: finalPath !== targetPath
				});
			} catch (error) {
				console.error(`[API] Failed to upload file ${file.name}:`, error);
				uploadResults.push({
					name: file.name,
					success: false,
					error: error.message
				});
			}
		}

		const successCount = uploadResults.filter((r) => r.success).length;
		const totalCount = uploadResults.length;

		return json({
			success: successCount > 0,
			message: `Uploaded ${successCount} of ${totalCount} files`,
			files: uploadResults,
			targetDirectory: resolvedDir
		});
	} catch (error) {
		console.error('[API] Failed to handle file upload:', error);

		if (error.code === 'EACCES') {
			return json({ error: 'Permission denied' }, { status: 403 });
		}

		if (error.code === 'ENOSPC') {
			return json({ error: 'No space left on device' }, { status: 507 });
		}

		return json({ error: error.message }, { status: 500 });
	}
}
