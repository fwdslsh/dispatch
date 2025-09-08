import { promises as fs } from 'node:fs';
import path from 'node:path';

export class WorkspaceManager {
	constructor({ rootDir, indexFile }) {
		this.rootDir = rootDir;
		this.indexFile = indexFile;
		this.index = { workspaces: {} };
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
	async #persist() {
		await fs.writeFile(this.indexFile, JSON.stringify(this.index, null, 2));
	}
}
