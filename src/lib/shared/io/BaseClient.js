export class BaseClient {
	constructor(io, namespacePath, config = {}) {
		if (new.target === BaseClient) {
			throw new Error('BaseClient is abstract and cannot be instantiated directly');
		}

		this.config = config;
		this.namespacePath = namespacePath;

		// Use current page origin if baseUrl is not provided
		let baseUrl = config.baseUrl;

		// BaseClient should only be used client-side
		if (typeof window === 'undefined') {
			console.warn(
				`[BaseClient] Attempted to create BaseClient on server-side for ${namespacePath}. Socket.io clients should only run in the browser.`
			);
			this.socket = null;
			return;
		}

		// Get window origin safely
		if (!baseUrl && window.location) {
			baseUrl = window.location.origin;
		}

		// Ensure we have a valid baseUrl or use relative connection
		let socketUrl;
		if (baseUrl && typeof baseUrl === 'string' && baseUrl !== 'undefined' && baseUrl !== '') {
			socketUrl = `${baseUrl}${namespacePath}`;
		} else {
			// Use relative connection - let socket.io auto-detect
			socketUrl = namespacePath;
		}

		console.log(`[BaseClient] Connecting to: ${socketUrl}`);
		this.socket = io(socketUrl);

		this.register();
	}

	register() {
		if (!this.socket) {
			// Server-side - no socket connection
			return;
		}

		this.socket.on('connect', () => {
			console.log(`Connected to ${this.namespacePath} namespace`);
			this.setupEventListeners();
			this.onConnect();
		});

		this.socket.on('disconnect', () => {
			console.log(`Disconnected from ${this.namespacePath} namespace`);
			this.onDisconnect();
		});

		this.socket.on('connect_error', (error) => {
			console.error(`Connection error to ${this.namespacePath}:`, error);
			this.onConnectionError(error);
		});
	}

	setupEventListeners() {
		// Override in subclasses to set up specific event listeners
	}

	onConnect() {
		// Override in subclasses for connect handling
	}

	onDisconnect() {
		// Override in subclasses for disconnect handling
	}

	onConnectionError(error) {
		// Override in subclasses for error handling
	}

	emit(event, data, callback) {
		if (!this.socket) return;
		return this.socket.emit(event, data, callback);
	}

	on(event, handler) {
		if (!this.socket) return;
		return this.socket.on(event, handler);
	}

	off(event, handler) {
		if (!this.socket) return;
		return this.socket.off(event, handler);
	}

	disconnect() {
		if (!this.socket) return;
		return this.socket.disconnect();
	}

	get connected() {
		return this.socket?.connected || false;
	}

	/**
	 * Utility method for consistent callback error handling
	 * Transforms socket.io response into Node.js-style callback: callback(error, result)
	 */
	_handleResponse(callback) {
		return (response) => {
			if (!response) {
				callback(new Error('No response received'), null);
				return;
			}

			if (response.success === false) {
				callback(new Error(response.error || 'Operation failed'), null);
			} else {
				callback(null, response);
			}
		};
	}

	/**
	 * Utility method to promisify callback-based methods for backward compatibility
	 * Usage: return this._promisify(this.methodName.bind(this), ...args);
	 */
	_promisify(method, ...args) {
		return new Promise((resolve, reject) => {
			method(...args, (error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});
		});
	}
}
