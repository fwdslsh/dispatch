import { logger as defaultLogger } from '../utils/logger.js';

export class SocketMediator {
	constructor(io, services, helpers = {}) {
		this.io = io;
		this.services = services;
		this.helpers = helpers;
		this.logger = helpers.logger || defaultLogger;
		this.domains = [];
	}

	registerDomain(registerFn) {
		if (typeof registerFn !== 'function') {
			throw new TypeError('registerFn must be a function');
		}

		this.domains.push(registerFn);
	}

	bindSocket(socket) {
		const register = this.#createRegistrar(socket);
		const context = {
			socket,
			io: this.io,
			services: this.services,
			helpers: this.helpers,
			logger: this.logger,
			register
		};

		for (const registerFn of this.domains) {
			registerFn(context);
		}
	}

	#createRegistrar(socket) {
		return (event, handler, options = {}) => {
			const {
				requireAuth = true,
				unauthorizedPayload = { success: false, error: 'Not authenticated' },
				errorResponse,
				suppressDefaultErrorAck = false
			} = options;

			if (typeof handler !== 'function') {
				throw new TypeError(`Handler for ${event} must be a function`);
			}

			socket.on(event, async (...rawArgs) => {
				let ack = null;
				if (rawArgs.length && typeof rawArgs[rawArgs.length - 1] === 'function') {
					ack = rawArgs.pop();
				}

				if (requireAuth && !socket.data?.authenticated) {
					this.logger.warn('SOCKET', `Unauthenticated ${event} from ${socket.id}`);
					if (ack && unauthorizedPayload !== undefined) {
						ack(unauthorizedPayload);
					}
					return;
				}

				const args = rawArgs;
				const payload = args.length <= 1 ? args[0] : args;
				const context = {
					args,
					payload,
					ack,
					socket,
					io: this.io,
					services: this.services,
					helpers: this.helpers,
					logger: this.logger,
					event
				};

				try {
					await handler(context);
				} catch (error) {
					this.logger.error('SOCKET', `Error handling ${event}`, error);
					if (!ack) {
						return;
					}

					if (typeof errorResponse === 'function') {
						ack(errorResponse(error));
					} else if (errorResponse !== undefined) {
						ack(errorResponse);
					} else if (!suppressDefaultErrorAck) {
						ack({ success: false, error: 'Internal server error' });
					}
				}
			});
		};
	}
}
