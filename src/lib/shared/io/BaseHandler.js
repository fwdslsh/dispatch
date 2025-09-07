export class BaseHandler {
	constructor(io, namespacePath) {
		if (new.target === BaseHandler) {
			throw new Error('BaseHandler is abstract and cannot be instantiated directly');
		}

		this.io = io;
		this.namespacePath = namespacePath;
		this.namespace = io.of(namespacePath);

		this.register();
	}

	register() {
		this.namespace.on('connection', (socket) => {
			console.log(`Client connected to ${this.namespacePath} namespace`);

			this.setupEventHandlers(socket);

			socket.on('disconnect', () => {
				console.log(`Client disconnected from ${this.namespacePath} namespace`);
				this.handleDisconnect(socket);
			});
		});
	}

	setupEventHandlers(socket) {
		throw new Error('setupEventHandlers must be implemented by subclass');
	}

	handleDisconnect(socket) {
		// Default disconnect handler - can be overridden
	}

	emitToNamespace(event, data) {
		this.namespace.emit(event, data);
	}

	emitToSocket(socket, event, data) {
		socket.emit(event, data);
	}
}
