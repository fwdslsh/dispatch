import { BaseClient } from '../../../shared/io/BaseClient.js';

export class ShellClient extends BaseClient {
	constructor(io, config = {}) {
		super(io, '/shell', config);
		this.currentSession = null;
	}

	setupEventListeners() {
		this.on('shell:session-created', this.handleSessionCreated.bind(this));
		this.on('shell:connected', this.handleConnected.bind(this));
		this.on('shell:output', this.handleOutput.bind(this));
		this.on('shell:command-executed', this.handleCommandExecuted.bind(this));
		this.on('shell:session-ended', this.handleSessionEnded.bind(this));
	}

	handleSessionCreated(data) {
		if (data.session) {
			this.currentSession = data.session;
		}

		if (this.onSessionCreated) {
			this.onSessionCreated(data);
		}
	}

	handleConnected(data) {
		if (data.session) {
			this.currentSession = data.session;
		}

		if (this.onConnected) {
			this.onConnected(data);
		}
	}

	handleOutput(data) {
		if (this.onOutput) {
			this.onOutput(data);
		}
	}

	handleCommandExecuted(data) {
		if (this.onCommandExecuted) {
			this.onCommandExecuted(data);
		}
	}

	handleSessionEnded(data) {
		if (this.currentSession?.sessionId === data.sessionId) {
			this.currentSession = null;
		}

		if (this.onSessionEnded) {
			this.onSessionEnded(data);
		}
	}

	async createSession(options = {}) {
		return new Promise((resolve, reject) => {
			const sessionOptions = {
				name: options.name || 'Shell Session',
				cols: options.cols || 80,
				rows: options.rows || 24,
				projectId: options.projectId,
				workingDirectory: options.workingDirectory,
				shell: options.shell || '/bin/bash'
			};

			this.emit('shell:create', sessionOptions, (response) => {
				if (response.success) {
					this.currentSession = response.session;
					resolve(response);
				} else {
					reject(new Error(response.error || 'Failed to create shell session'));
				}
			});
		});
	}

	async connect(sessionId) {
		return new Promise((resolve, reject) => {
			this.emit('shell:connect', { sessionId }, (response) => {
				if (response.success) {
					this.currentSession = response.session;
					resolve(response);
				} else {
					reject(new Error(response.error || 'Failed to connect to shell session'));
				}
			});
		});
	}

	async execute(command) {
		if (!this.currentSession?.sessionId) {
			throw new Error('No active shell session');
		}

		return new Promise((resolve, reject) => {
			this.emit('shell:execute', { command }, (response) => {
				if (response.success) {
					resolve(response);
				} else {
					reject(new Error(response.error || 'Failed to execute command'));
				}
			});
		});
	}

	async endSession(sessionId = null) {
		const targetSessionId = sessionId || this.currentSession?.sessionId;

		if (!targetSessionId) {
			throw new Error('No shell session to end');
		}

		return new Promise((resolve, reject) => {
			this.emit('shell:end', { sessionId: targetSessionId }, (response) => {
				if (response.success) {
					if (!sessionId || sessionId === this.currentSession?.sessionId) {
						this.currentSession = null;
					}
					resolve(response);
				} else {
					reject(new Error(response.error || 'Failed to end shell session'));
				}
			});
		});
	}

	getCurrentSession() {
		return this.currentSession;
	}

	hasActiveSession() {
		return this.currentSession !== null;
	}

	getSessionId() {
		return this.currentSession?.sessionId || null;
	}

	// Convenience methods for common shell operations
	async runCommand(command) {
		return this.execute(command);
	}

	async changeDirectory(path) {
		return this.execute(`cd ${path}`);
	}

	async listFiles(path = '.') {
		return this.execute(`ls -la ${path}`);
	}

	async createFile(filename, content = '') {
		if (content) {
			return this.execute(`cat > ${filename} << 'EOF'\n${content}\nEOF`);
		} else {
			return this.execute(`touch ${filename}`);
		}
	}

	async removeFile(filename) {
		return this.execute(`rm ${filename}`);
	}

	async createDirectory(dirname) {
		return this.execute(`mkdir -p ${dirname}`);
	}

	async removeDirectory(dirname) {
		return this.execute(`rm -rf ${dirname}`);
	}

	// Event callback setters
	setOnSessionCreated(callback) {
		this.onSessionCreated = callback;
	}

	setOnConnected(callback) {
		this.onConnected = callback;
	}

	setOnOutput(callback) {
		this.onOutput = callback;
	}

	setOnCommandExecuted(callback) {
		this.onCommandExecuted = callback;
	}

	setOnSessionEnded(callback) {
		this.onSessionEnded = callback;
	}
}
