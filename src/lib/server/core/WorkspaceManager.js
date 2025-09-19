import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import { createDbErrorHandler, safeExecute } from '../utils/error-handling.js';

export class WorkspaceManager {
	constructor({ rootDir, databaseManager }) {
		this.rootDir = rootDir;
		this.databaseManager = databaseManager;
		logger.info('WORKSPACE', `WorkspaceManager initialized with: ${rootDir}`);

		// Create standardized error handlers
		this.handleDbError = createDbErrorHandler('WORKSPACE');
	}
	async init() {
		// Ensure the workspaces root directory exists for operations like list()
		await safeExecute(
			() => fs.mkdir(this.rootDir, { recursive: true }),
			'WORKSPACE',
			'Failed to ensure rootDir exists'
		);
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
		await this.databaseManager.createWorkspace(resolved);
		await this.databaseManager.updateWorkspaceActivity(resolved);
		return { path: resolved };
	}
	async create(dir) {
		if (typeof dir !== 'string' || dir.trim() === '') throw new Error('Invalid directory');
		const resolved = path.resolve(dir);
		const rel = path.relative(this.rootDir, resolved);
		if (rel.startsWith('..')) throw new Error('Workspace path outside root');
		await fs.mkdir(resolved, { recursive: true });

		// Create workspace in database
		await this.databaseManager.createWorkspace(resolved);
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
		await safeExecute(
			() => this.databaseManager.createWorkspace(dir),
			'WORKSPACE',
			'Failed to ensure workspace exists before saving session'
		);

		if (!sessionDescriptor?.type) {
			throw new Error('Session descriptor requires a type');
		}

		const sessionType = sessionDescriptor.type;
		let typeSpecificId = sessionDescriptor.typeSpecificId;
		if (sessionType === 'claude') {
			typeSpecificId = typeof typeSpecificId === 'string' ? typeSpecificId : '';
		} else {
			typeSpecificId = typeSpecificId || sessionDescriptor.id;
		}

		// Save to database
		await this.databaseManager.addSession(
			sessionDescriptor.id,
			sessionType,
			typeSpecificId,
			sessionDescriptor.title || sessionDescriptor.name || 'Untitled Session',
			dir, // working directory
			1 // pinned
		);
	}
	async getIndex() {
		// Build index object from the database
		const index = { workspaces: {} };

		const buildIndex = this.handleDbError(async () => {
			const workspaces = await this.databaseManager.listWorkspaces();
			for (const workspace of workspaces) {
				const wsPath = workspace.path;
				index.workspaces[wsPath] = {
					lastActive: workspace.last_active,
					sessions: []
				};
				const allSessions = await this.databaseManager.getAllSessions(true); // Get all pinned sessions
			const sessions = allSessions.filter(session => session.working_directory === wsPath);
				index.workspaces[wsPath].sessions = sessions.map((session) => ({
					id: session.id,
					title: session.title,
					type: session.session_type,
					typeSpecificId: session.type_specific_id
				}));
			}
		}, 'Failed to build index from database');
		await buildIndex();

		return index;
	}
	async getAllSessions(pinnedOnly = true) {
		// Return all sessions from database
		const getSessions = this.handleDbError(async () => {
			const sessions = await this.databaseManager.getAllSessions(pinnedOnly);
			return sessions.map((session) => ({
				id: session.id,
				title: session.title,
				type: session.session_type,
				typeSpecificId: session.type_specific_id,
				workspacePath: session.working_directory,
				pinned: session.pinned === 1 || session.pinned === true,
				createdAt: session.created_at,
				lastActivity: session.updated_at
			}));
		}, 'Failed to get sessions from database');
		return await getSessions() || [];
	}

	async getSession(workspacePath, sessionId) {
		// Get a specific session from database
		const getSession = this.handleDbError(async () => {
			const session = await this.databaseManager.getWorkspaceSession(workspacePath, sessionId);
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
		}, 'Failed to get session from database');
		return await getSession();
	}

	async setPinned(workspacePath, sessionId, pinned) {
		await this.databaseManager.setWorkspaceSessionPinned(workspacePath, sessionId, pinned);
	}
	async removeSession(workspacePath, sessionId) {
		// Remove from database
		await this.databaseManager.removeWorkspaceSession(workspacePath, sessionId);
	}
	async renameSession(workspacePath, sessionId, newTitle) {
		// Update in database
		await this.databaseManager.renameWorkspaceSession(workspacePath, sessionId, newTitle);
	}

	async updateTypeSpecificId(workspacePath, sessionId, newTypeSpecificId) {
		await this.databaseManager.updateWorkspaceSessionTypeId(
			workspacePath,
			sessionId,
			newTypeSpecificId
		);
	}
}
