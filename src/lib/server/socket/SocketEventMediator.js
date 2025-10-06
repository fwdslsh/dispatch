/**
 * SocketEventMediator - Routes socket events with middleware
 * @file Mediator pattern for Socket.IO event handling with middleware chain
 */

import { Server } from 'socket.io';

export class SocketEventMediator {
	#io;
	#middleware = [];
	#handlers = new Map();

	/**
	 * @param {Server} io - Socket.IO server instance
	 */
	constructor(io) {
		if (!io) {
			throw new Error('Socket.IO server instance is required');
		}
		this.#io = io;
	}

	/**
	 * Register middleware function
	 * @param {Function} middleware - Middleware function ([event, ...args], next) => void
	 * @returns {void}
	 */
	use(middleware) {
		if (typeof middleware !== 'function') {
			throw new Error('Middleware must be a function');
		}
		this.#middleware.push(middleware);
	}

	/**
	 * Register event handler
	 * @param {string} eventName - Socket.IO event name
	 * @param {Function} handler - Event handler function (socket, data, callback) => void
	 * @returns {void}
	 */
	on(eventName, handler) {
		if (typeof handler !== 'function') {
			throw new Error('Handler must be a function');
		}
		this.#handlers.set(eventName, handler);
	}

	/**
	 * Initialize mediator (setup socket connections)
	 * @returns {void}
	 */
	initialize() {
		this.#io.on('connection', (socket) => {
			// Apply middleware to socket
			this.#middleware.forEach((mw) => {
				socket.use(mw);
			});

			// Register event handlers
			this.#handlers.forEach((handler, eventName) => {
				socket.on(eventName, (...args) => {
					// Call handler with socket and args
					handler(socket, ...args);
				});
			});
		});
	}

	/**
	 * Get Socket.IO server instance
	 * @returns {Server} Socket.IO server
	 */
	get io() {
		return this.#io;
	}

	/**
	 * Get registered middleware count (for debugging)
	 * @returns {number} Middleware count
	 */
	getMiddlewareCount() {
		return this.#middleware.length;
	}

	/**
	 * Get registered handler count (for debugging)
	 * @returns {number} Handler count
	 */
	getHandlerCount() {
		return this.#handlers.size;
	}
}
