import { json } from '@sveltejs/kit';
import { writeFile, stat, mkdir } from 'node:fs/promises';
import { resolve, normalize, dirname, basename, join } from 'node:path';
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

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const files = formData.getAll('files');
		const targetDirectoryEntry = formData.get('directory');
		const targetDirectory =
			typeof targetDirectoryEntry === 'string' ? targetDirectoryEntry : getHomeDirectory();

		if (!files || files.length === 0) {
			return json({ error: 'No files provided' }, { status: 400 });
		}

		// Validate target directory
		const resolvedDir = resolve(targetDirectory);
		if (!isPathWithinHome(resolvedDir)) {
			return json({ error: 'Access denied: directory outside home directory' }, { status: 403 });
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
				try {
					await mkdir(resolvedDir, { recursive: true });
				} catch (mkdirError) {
					return json(
						{ error: `Failed to create directory: ${mkdirError.message}` },
						{ status: 500 }
					);
				}
			} else {
				throw error;
			}
		}

		// Process each file
		const uploadResults = [];
		for (const file of files) {
			if (file instanceof File) {
				try {
					const targetPath = join(resolvedDir, file.name);

					// Security check: ensure final path is still within home
					if (!isPathWithinHome(targetPath)) {
						uploadResults.push({
							name: file.name,
							success: false,
							error: 'File path outside home directory'
						});
						continue;
					}

					// Generate unique filename if needed
					const finalPath = await generateUniqueFilename(targetPath);

					// Convert file to buffer and write
					const arrayBuffer = await file.arrayBuffer();
					const buffer = Buffer.from(arrayBuffer);
					await writeFile(finalPath, buffer);

					// Get file stats for response
					const fileStat = await stat(finalPath);

					uploadResults.push({
						name: file.name,
						success: true,
						path: finalPath,
						size: fileStat.size,
						modified: fileStat.mtime.toISOString()
					});
				} catch (error) {
					console.error(`Failed to upload file ${file.name}:`, error);
					uploadResults.push({
						name: file.name,
						success: false,
						error: error.message
					});
				}
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
