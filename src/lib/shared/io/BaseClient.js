export class BaseClient {
    constructor(io, namespacePath, config = {}) {
        if (new.target === BaseClient) {
            throw new Error('BaseClient is abstract and cannot be instantiated directly');
        }
        
        this.config = config;
        this.namespacePath = namespacePath;
        this.socket = io(`${config.baseUrl || ''}${namespacePath}`);
        
        this.register();
    }

    register() {
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
        return this.socket.emit(event, data, callback);
    }

    on(event, handler) {
        return this.socket.on(event, handler);
    }

    off(event, handler) {
        return this.socket.off(event, handler);
    }

    disconnect() {
        return this.socket.disconnect();
    }

    get connected() {
        return this.socket.connected;
    }
}