import pathModule from 'node:path';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { projectsRoot } from '$lib/server/claude/cc-root.js';
import { sanitizePath, isValidDirectory } from '$lib/server/utils/paths.js';
import { logger } from '$lib/server/utils/logger.js';

export async function GET({ locals }) {
	const list = await locals.workspaceManager.list();
	return new Response(JSON.stringify({ list }), {
		headers: { 'content-type': 'application/json' }
	});
}

function _sanitizeRequestedPath(rawPath) {
	// Use our comprehensive sanitization
	const sanitized = sanitizePath(rawPath);
	if (!sanitized) {
		throw new Error('Invalid workspace path after sanitization');
	}
	return sanitized;
}

export async function POST({ request, locals }) {
	const { action, from, to, path: rawPath, isNewProject } = await request.json();
	const workspaceRoot = process.env.WORKSPACES_ROOT || process.cwd();

	try {
		if (action === 'open') {
			const p = _sanitizeRequestedPath(rawPath);
			logger.debug('WorkspaceAPI', `Opening workspace: ${p}`);

			// If the client provided an absolute path, validate it and return directly without persisting
			if (pathModule.isAbsolute(p)) {
				const fullAbs = pathModule.resolve(p);
				if (await isValidDirectory(fullAbs)) {
					// For absolute paths, we don't enforce workspace root restriction
					// but we do log for security awareness
					logger.info('WorkspaceAPI', `Opened absolute path: ${fullAbs}`);
					return new Response(JSON.stringify({ path: fullAbs }), {
						headers: { 'content-type': 'application/json' }
					});
				}
				// If absolute path doesn't exist, fall through to project lookup below
			}

			// For relative paths, resolve against WORKSPACES_ROOT but don't enforce restrictions
			const fullPath = pathModule.join(workspaceRoot, p);
			try {
				if (await isValidDirectory(fullPath)) {
					logger.debug('WorkspaceAPI', `Opened workspace path: ${fullPath}`);
					return new Response(JSON.stringify(await locals.workspaceManager.open(fullPath)), {
						headers: { 'content-type': 'application/json' }
					});
				}
			} catch (e) {
				logger.debug('WorkspaceAPI', `Path not found in workspace root: ${e.message}`);
				// not found under WORKSPACES_ROOT - fall through to try resolving as a Claude project name
			}

			// Try to resolve as a Claude project name using the central projectsRoot
			try {
				const baseProjectsRoot = projectsRoot();
				logger.debug(
					'WorkspaceAPI',
					`Searching for project ${p} in projects root: ${baseProjectsRoot}`
				);

				const candidatePath = pathModule.isAbsolute(p)
					? pathModule.resolve(p)
					: pathModule.join(baseProjectsRoot, p);

				if (await isValidDirectory(candidatePath)) {
					// Return the actual project folder path directly (do not persist in workspaces index)
					logger.info('WorkspaceAPI', `Found Claude project: ${candidatePath}`);
					return new Response(JSON.stringify({ path: candidatePath }), {
						headers: { 'content-type': 'application/json' }
					});
				}
			} catch (error) {
				logger.warn('WorkspaceAPI', `Error searching projects root: ${error.message}`);
			}

			throw new Error('Workspace not found');
		}

		if (action === 'create') {
			const projectName = _sanitizeRequestedPath(rawPath);
			logger.debug('WorkspaceAPI', `Creating workspace: ${projectName}`);

			// Allow creation in any directory, just resolve the path
			const targetPath = pathModule.isAbsolute(projectName)
				? pathModule.resolve(projectName)
				: pathModule.join(workspaceRoot, projectName);

			logger.info('WorkspaceAPI', `Creating workspace at: ${targetPath}`);

			return new Response(JSON.stringify(await locals.workspaceManager.create(targetPath)), {
				headers: { 'content-type': 'application/json' }
			});
		}

		if (action === 'clone') {
			logger.debug('WorkspaceAPI', `Cloning workspace from ${from} to ${to}`);

			// Sanitize both paths but allow any accessible directory
			const sanitizedFrom = _sanitizeRequestedPath(from);
			const sanitizedTo = _sanitizeRequestedPath(to);

			// Resolve paths without enforcing workspace boundaries
			const fromPath = pathModule.isAbsolute(sanitizedFrom)
				? pathModule.resolve(sanitizedFrom)
				: pathModule.join(workspaceRoot, sanitizedFrom);

			const toPath = pathModule.isAbsolute(sanitizedTo)
				? pathModule.resolve(sanitizedTo)
				: pathModule.join(workspaceRoot, sanitizedTo);

			logger.info('WorkspaceAPI', `Cloning workspace: ${fromPath} -> ${toPath}`);
			return new Response(JSON.stringify(await locals.workspaceManager.clone(fromPath, toPath)), {
				headers: { 'content-type': 'application/json' }
			});
		}

		return new Response('Bad Request', { status: 400 });
	} catch (err) {
		logger.error('WorkspaceAPI', 'Workspace operation failed:', err.message);
		return new Response(JSON.stringify({ error: String(err) }), {
			status: 400,
			headers: { 'content-type': 'application/json' }
		});
	}
}
