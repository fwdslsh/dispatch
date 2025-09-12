import pathModule from 'node:path';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { projectsRoot } from '$lib/server/claude/cc-root.js';
import { assertInWorkspacesRoot, createSafeWorkspacePath, sanitizePath, isValidDirectory } from '$lib/server/utils/paths.js';
import { logger } from '$lib/server/utils/logger.js';

export async function GET({ locals }) {
	const list = await locals.workspaces.list();
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
					return new Response(JSON.stringify({ path: fullAbs }), { headers: { 'content-type': 'application/json' } });
				}
				// If absolute path doesn't exist, fall through to project lookup below
			}

			// For relative paths, resolve against WORKSPACES_ROOT with validation
			try {
				const safePath = createSafeWorkspacePath(p, workspaceRoot);
				if (await isValidDirectory(safePath)) {
					logger.debug('WorkspaceAPI', `Opened workspace path: ${safePath}`);
					return new Response(JSON.stringify(await locals.workspaces.open(safePath)), { headers: { 'content-type': 'application/json' } });
				}
			} catch (e) {
				logger.debug('WorkspaceAPI', `Path not found in workspace root: ${e.message}`);
				// not found under WORKSPACES_ROOT - fall through to try resolving as a Claude project name
			}

			// Try to resolve as a Claude project name using the central projectsRoot
			try {
				const baseProjectsRoot = projectsRoot();
				logger.debug('WorkspaceAPI', `Searching for project ${p} in projects root: ${baseProjectsRoot}`);
				
				const candidatePath = pathModule.isAbsolute(p)
					? pathModule.resolve(p)
					: pathModule.join(baseProjectsRoot, p);
					
				if (await isValidDirectory(candidatePath)) {
					// Return the actual project folder path directly (do not persist in workspaces index)
					logger.info('WorkspaceAPI', `Found Claude project: ${candidatePath}`);
					return new Response(JSON.stringify({ path: candidatePath }), { headers: { 'content-type': 'application/json' } });
				}
			} catch (error) {
				logger.warn('WorkspaceAPI', `Error searching projects root: ${error.message}`);
			}

			throw new Error('Workspace not found');
		}

		if (action === 'create') {
			const projectName = _sanitizeRequestedPath(rawPath);
			logger.debug('WorkspaceAPI', `Creating workspace: ${projectName}`);
			
			// Use our safe path creation with validation
			const safePath = createSafeWorkspacePath(projectName, workspaceRoot);
			logger.info('WorkspaceAPI', `Creating workspace at: ${safePath}`);
			
			return new Response(JSON.stringify(await locals.workspaces.create(safePath)), {
				headers: { 'content-type': 'application/json' }
			});
		}

		if (action === 'clone') {
			logger.debug('WorkspaceAPI', `Cloning workspace from ${from} to ${to}`);
			
			// Sanitize and validate both paths
			const sanitizedFrom = _sanitizeRequestedPath(from);
			const sanitizedTo = _sanitizeRequestedPath(to);
			
			// Create safe paths with validation
			const fromPath = pathModule.isAbsolute(sanitizedFrom) 
				? pathModule.resolve(sanitizedFrom)
				: createSafeWorkspacePath(sanitizedFrom, workspaceRoot);
				
			const toPath = pathModule.isAbsolute(sanitizedTo)
				? pathModule.resolve(sanitizedTo)
				: createSafeWorkspacePath(sanitizedTo, workspaceRoot);
			
			// Additional validation for workspace root if not absolute
			if (!pathModule.isAbsolute(sanitizedFrom)) {
				assertInWorkspacesRoot(fromPath, workspaceRoot);
			}
			if (!pathModule.isAbsolute(sanitizedTo)) {
				assertInWorkspacesRoot(toPath, workspaceRoot);
			}
			
			logger.info('WorkspaceAPI', `Cloning workspace: ${fromPath} -> ${toPath}`);
			return new Response(JSON.stringify(await locals.workspaces.clone(fromPath, toPath)), {
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
