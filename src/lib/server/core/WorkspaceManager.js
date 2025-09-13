import { promises as fs } from 'node:fs';
import path from 'node:path';
import { databaseManager } from '../db/DatabaseManager.js';

export class WorkspaceManager {
	constructor({ rootDir }) {
		this.rootDir = rootDir;
		console.log('WorkspaceManager initialized with:', { rootDir });
		this.initializeDatabase();
	}

	async initializeDatabase() {
		try {
			await databaseManager.init();
		} catch (error) {
			console.error('[WORKSPACE] Failed to initialize database:', error);
		}
	}
	async init() {
		// Ensure the workspaces root directory exists for operations like list()
		try {
			await fs.mkdir(this.rootDir, { recursive: true });
		} catch (error) {
			console.error('[WORKSPACE] Failed to ensure rootDir exists:', error);
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
		await databaseManager.createWorkspace(resolved);
		await databaseManager.updateWorkspaceActivity(resolved);
		return { path: resolved };
	}
	async create(dir) {
		if (typeof dir !== 'string' || dir.trim() === '') throw new Error('Invalid directory');
		const resolved = path.resolve(dir);
		const rel = path.relative(this.rootDir, resolved);
		if (rel.startsWith('..')) throw new Error('Workspace path outside root');
		await fs.mkdir(resolved, { recursive: true });

		// Create workspace in database
		await databaseManager.createWorkspace(resolved);
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
			await databaseManager.createWorkspace(dir);
		} catch (error) {
			console.error('[WORKSPACE] Failed to ensure workspace exists before saving session:', error);
		}

		// Determine session type and type-specific ID, preferring descriptor fields
		let sessionType = sessionDescriptor.type || 'unknown';
		let typeSpecificId = sessionDescriptor.typeSpecificId || sessionDescriptor.id;

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
		await databaseManager.addWorkspaceSession(
			sessionDescriptor.id,
			dir,
			sessionType,
			typeSpecificId,
			sessionDescriptor.title || sessionDescriptor.name || 'Untitled Session'
		);
	}
	async getIndex() {
		// Build index object from the database
		const index = { workspaces: {} };

		try {
			const workspaces = await databaseManager.listWorkspaces();
			for (const workspace of workspaces) {
				const wsPath = workspace.path;
				index.workspaces[wsPath] = {
					lastActive: workspace.last_active,
					sessions: []
				};
				const sessions = await databaseManager.getWorkspaceSessions(wsPath);
				index.workspaces[wsPath].sessions = sessions.map((session) => ({
					id: session.id,
					title: session.title,
					type: session.session_type,
					typeSpecificId: session.type_specific_id
				}));
			}
		} catch (error) {
			console.error('[WORKSPACE] Failed to build index from database:', error);
		}

		return index;
	}
	async getAllSessions() {
		// Return all sessions from database
		try {
			const sessions = await databaseManager.getAllSessions();
			return sessions.map((session) => ({
				id: session.id,
				title: session.title,
				type: session.session_type,
				typeSpecificId: session.type_specific_id,
				workspacePath: session.workspace_path
			}));
		} catch (error) {
			console.error('[WORKSPACE] Failed to get sessions from database:', error);
			return [];
		}
	}
	async removeSession(workspacePath, sessionId) {
		// Remove from database
		await databaseManager.removeWorkspaceSession(workspacePath, sessionId);
	}
	async renameSession(workspacePath, sessionId, newTitle) {
		// Update in database
		await databaseManager.renameWorkspaceSession(workspacePath, sessionId, newTitle);
	}
}
