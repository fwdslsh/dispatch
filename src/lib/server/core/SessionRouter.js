export class SessionRouter {
	constructor() {
		this.map = new Map();
	}
	bind(sessionId, descriptor) {
		this.map.set(sessionId, descriptor);
	}
	get(sessionId) {
		return this.map.get(sessionId);
	}
	all() {
		return Array.from(this.map.entries()).map(([id, d]) => ({ id, ...d }));
	}
	byWorkspace(workspacePath) {
		return this.all().filter((s) => s.workspacePath === workspacePath);
	}
}
