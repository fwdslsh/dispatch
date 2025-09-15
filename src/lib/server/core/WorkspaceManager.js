import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDatabaseManager } from '../db/DatabaseManager.js';
import { logger } from '../utils/logger.js';

export class WorkspaceManager {
	constructor({ rootDir }) {
		this.rootDir = rootDir;
		logger.info('WORKSPACE', `WorkspaceManager initialized with: ${rootDir}`);
		this.initializeDatabase();
	}

	async initializeDatabase() {
		try {
			await getDatabaseManager().init();
		} catch (error) {
			logger.error('[WORKSPACE] Failed to initialize database:', error);
		}
	}
	async init() {
		// Ensure the workspaces root directory exists for operations like list()
		try {
			await fs.mkdir(this.rootDir, { recursive: true });
		} catch (error) {
			logger.error('[WORKSPACE] Failed to ensure rootDir exists:', error);
		}
	}
	async list() {
		const names = await fs.readdir(this.rootDir, { withFileTypes: true });
		return names
			.filter((d) => d.isDirectory() && !d.name.startsWith('.'))
			.map((d) => path.join(this.rootDir, d.name));
	}
	async open(dir) {
		if (typeof dir !== 'string' || dir.trim() === '') throw new Error('Invalid directory');
		// Resolve to absolute path
		const resolved = path.resolve(dir);
		// Ensure it's inside configured rootDir
		const rel = path.relative(this.rootDir, resolved);
		if (rel.startsWith('..')) throw new Error('Workspace path outside root');
		const stat = await fs.stat(resolved);
		if (!stat.isDirectory()) throw new Error('Not a directory');

		// Create or update workspace in database
		await getDatabaseManager().createWorkspace(resolved);
		await getDatabaseManager().updateWorkspaceActivity(resolved);
		return { path: resolved };
	}
	async create(dir) {
		if (typeof dir !== 'string' || dir.trim() === '') throw new Error('Invalid directory');
		const resolved = path.resolve(dir);
		const rel = path.relative(this.rootDir, resolved);
		if (rel.startsWith('..')) throw new Error('Workspace path outside root');
		await fs.mkdir(resolved, { recursive: true });

		// Create workspace in database
		await getDatabaseManager().createWorkspace(resolved);
		return { path: resolved };
	}
	async clone(fromPath, toPath) {
		await fs.cp(fromPath, toPath, { recursive: true, errorOnExist: false });
		return this.open(toPath);
	}
	async rememberSession(dir, sessionDescriptor) {
		// Ensure a corresponding workspace row exists in the database.
		// This is important for absolute paths (e.g. Claude project folders)
		// that may not have been opened via the workspaces API.
		try {
			await getDatabaseManager().createWorkspace(dir);
		} catch (error) {
			logger.error('[WORKSPACE] Failed to ensure workspace exists before saving session:', error);
		}

		// Determine session type and type-specific ID, preferring descriptor fields
		let sessionType = sessionDescriptor.type || 'unknown';
		let typeSpecificId = sessionDescriptor.typeSpecificId;
		// For Claude sessions, allow empty typeSpecificId until the real ID is known
		if (sessionType === 'claude') {
			typeSpecificId = typeof typeSpecificId === 'string' ? typeSpecificId : '';
		} else {
			// For other types, fall back to descriptor.id when missing
			typeSpecificId = typeSpecificId || sessionDescriptor.id;
		}

		// Legacy fallback based on ID prefixes
		if (sessionType === 'unknown' && typeof sessionDescriptor.id === 'string') {
			if (sessionDescriptor.id.startsWith('claude_')) {
				sessionType = 'claude';
				typeSpecificId = sessionDescriptor.id.replace(/^claude_/, '');
			} else if (sessionDescriptor.id.startsWith('pty_')) {
				sessionType = 'pty';
			}
		}

		// Save to database
		await getDatabaseManager().addWorkspaceSession(
			sessionDescriptor.id,
			dir,
			sessionType,
			typeSpecificId,
			sessionDescriptor.title || sessionDescriptor.name || 'Untitled Session',
			1
		);
	}
	async getIndex() {
		// Build index object from the database
		const index = { workspaces: {} };

		try {
			const workspaces = await getDatabaseManager().listWorkspaces();
			for (const workspace of workspaces) {
				const wsPath = workspace.path;
				index.workspaces[wsPath] = {
					lastActive: workspace.last_active,
					sessions: []
				};
				const sessions = await getDatabaseManager().getWorkspaceSessions(wsPath);
				index.workspaces[wsPath].sessions = sessions.map((session) => ({
					id: session.id,
					title: session.title,
					type: session.session_type,
					typeSpecificId: session.type_specific_id
				}));
			}
		} catch (error) {
			logger.error('[WORKSPACE] Failed to build index from database:', error);
		}

		return index;
	}
	async getAllSessions(pinnedOnly = true) {
		// Return all sessions from database
		try {
			const sessions = await getDatabaseManager().getAllSessions(pinnedOnly);
			return sessions.map((session) => ({
				id: session.id,
				title: session.title,
				type: session.session_type,
				typeSpecificId: session.type_specific_id,
				workspacePath: session.workspace_path,
				pinned: session.pinned === 1 || session.pinned === true,
				createdAt: session.created_at,
				lastActivity: session.updated_at
			}));
		} catch (error) {
			logger.error('[WORKSPACE] Failed to get sessions from database:', error);
			return [];
		}
	}

	async getSession(workspacePath, sessionId) {
		// Get a specific session from database
		try {
			const session = await getDatabaseManager().getWorkspaceSession(workspacePath, sessionId);
			if (session) {
				return {
					id: session.id,
					title: session.title,
					sessionType: session.session_type,
					typeSpecificId: session.type_specific_id,
					workspacePath: session.workspace_path,
					pinned: session.pinned === 1 || session.pinned === true,
					createdAt: session.created_at,
					lastActivity: session.updated_at
				};
			}
			return null;
		} catch (error) {
			logger.error('[WORKSPACE] Failed to get session from database:', error);
			return null;
		}
	}

	async setPinned(workspacePath, sessionId, pinned) {
		await getDatabaseManager().setWorkspaceSessionPinned(workspacePath, sessionId, pinned);
	}
	async removeSession(workspacePath, sessionId) {
		// Remove from database
		await getDatabaseManager().removeWorkspaceSession(workspacePath, sessionId);
	}
	async renameSession(workspacePath, sessionId, newTitle) {
		// Update in database
		await getDatabaseManager().renameWorkspaceSession(workspacePath, sessionId, newTitle);
	}

	async updateTypeSpecificId(workspacePath, sessionId, newTypeSpecificId) {
		await getDatabaseManager().updateWorkspaceSessionTypeId(
			workspacePath,
			sessionId,
			newTypeSpecificId
		);
	}
}
