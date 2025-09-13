export class SessionRouter {
	constructor() {
		this.map = new Map();
		this.activityState = new Map(); // Track activity state: 'idle', 'processing', 'streaming'
	}

	bind(sessionId, descriptor) {
		this.map.set(sessionId, descriptor);
		// Initialize as idle when binding
		this.activityState.set(sessionId, 'idle');
	}

	get(sessionId) {
		const descriptor = this.map.get(sessionId);
		if (descriptor) {
			return {
				...descriptor,
				activityState: this.activityState.get(sessionId) || 'idle'
			};
		}
		return descriptor;
	}

	all() {
		return Array.from(this.map.entries()).map(([id, d]) => ({
			id,
			...d,
			activityState: this.activityState.get(id) || 'idle'
		}));
	}

	byWorkspace(workspacePath) {
		return this.all().filter((s) => s.workspacePath === workspacePath);
	}

	unbind(sessionId) {
		this.activityState.delete(sessionId);
		return this.map.delete(sessionId);
	}

	// New methods for activity tracking
	setActivityState(sessionId, state) {
		if (this.map.has(sessionId)) {
			this.activityState.set(sessionId, state);
			console.log(`[SessionRouter] Session ${sessionId} activity: ${state}`);
		}
	}

	getActivityState(sessionId) {
		return this.activityState.get(sessionId) || 'idle';
	}

	setProcessing(sessionId) {
		this.setActivityState(sessionId, 'processing');
	}

	setStreaming(sessionId) {
		this.setActivityState(sessionId, 'streaming');
	}

	setIdle(sessionId) {
		this.setActivityState(sessionId, 'idle');
	}
}
