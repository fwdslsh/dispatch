import { promises as fs } from 'node:fs';
import path from 'node:path';

export class WorkspaceManager {
	constructor({ rootDir, indexFile }) {
		this.rootDir = rootDir;
		this.indexFile = indexFile;
		this.index = { workspaces: {} };
		console.log('WorkspaceManager initialized with:', { rootDir, indexFile });
	}
	async init() {
		await fs.mkdir(path.dirname(this.indexFile), { recursive: true });
		try {
			this.index = JSON.parse(await fs.readFile(this.indexFile, 'utf8'));
		} catch {
			await this.#persist();
		}
	}
	async list() {
		const names = await fs.readdir(this.rootDir, { withFileTypes: true });
		return names.filter((d) => d.isDirectory()).map((d) => path.join(this.rootDir, d.name));
	}
	async open(dir) {
		const stat = await fs.stat(dir);
		if (!stat.isDirectory()) throw new Error('Not a directory');
		this.index.workspaces[dir] ??= { lastActive: Date.now(), sessions: [] };
		await this.#persist();
		return { path: dir };
	}
	async create(dir) {
		await fs.mkdir(dir, { recursive: true });
		this.index.workspaces[dir] ??= { lastActive: Date.now(), sessions: [] };
		await this.#persist();
		return { path: dir };
	}
	async clone(fromPath, toPath) {
		await fs.cp(fromPath, toPath, { recursive: true, errorOnExist: false });
		return this.open(toPath);
	}
	async rememberSession(dir, sessionDescriptor) {
		const ws = (this.index.workspaces[dir] ??= { lastActive: Date.now(), sessions: [] });
		const i = ws.sessions.findIndex((s) => s.id === sessionDescriptor.id);
		if (i >= 0) ws.sessions[i] = sessionDescriptor;
		else ws.sessions.push(sessionDescriptor);
		ws.lastActive = Date.now();
		await this.#persist();
	}
	async getIndex() {
		return this.index;
	}
	async getAllSessions() {
		// Return all sessions from all workspaces
		const allSessions = [];
		for (const [workspacePath, workspace] of Object.entries(this.index.workspaces)) {
			for (const session of workspace.sessions || []) {
				allSessions.push({
					...session,
					workspacePath
				});
			}
		}
		return allSessions;
	}
	async removeSession(workspacePath, sessionId) {
		const ws = this.index.workspaces[workspacePath];
		if (ws?.sessions) {
			ws.sessions = ws.sessions.filter(s => s.id !== sessionId);
			await this.#persist();
		}
	}
	async renameSession(workspacePath, sessionId, newTitle) {
		const ws = this.index.workspaces[workspacePath];
		if (ws?.sessions) {
			const session = ws.sessions.find(s => s.id === sessionId);
			if (session) {
				session.title = newTitle;
				await this.#persist();
			}
		}
	}
	async #persist() {
		await fs.writeFile(this.indexFile, JSON.stringify(this.index, null, 2));
	}
}
