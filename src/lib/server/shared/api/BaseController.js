import { json } from '@sveltejs/kit';
import { createServiceHandler } from '../utils/error-handling.js';
import { logger } from '../utils/logger.js';
import { validateSchema } from './validation.js';

const DEFAULT_HEADERS = {
	'Cache-Control': 'no-cache, no-store, must-revalidate',
	Pragma: 'no-cache',
	Expires: '0'
};

function mergeHeaders(custom = {}) {
	return new Headers({ ...DEFAULT_HEADERS, ...custom });
}

export class BaseController {
	constructor(event, options = {}) {
		this.event = event;
		this.request = event.request;
		this.locals = event.locals || {};
		this.services = this.locals.services || {};
		this.params = event.params || {};
		this.url = event.url;
		this.config = this.services.configService;
		this.component = options.component || this.constructor.name.toUpperCase();
		this.serviceHandler = createServiceHandler(this.component, { throwOnError: true });
	}

	async handle(methodName, handlerOptions = {}) {
		const method = this[methodName];
		if (typeof method !== 'function') {
			logger.error(this.component, `Method ${methodName} not implemented`);
			return this.fail(500, 'Controller method not implemented');
		}

		if (handlerOptions.requireAuth && !this.locals.auth?.authenticated) {
			return this.notAuthenticated();
		}

		const context = await this.#buildContext(handlerOptions);
		if (context instanceof Response) {
			return context;
		}

		const invoke = this.serviceHandler(method.bind(this), methodName);

		try {
			const result = await invoke(context);
			if (result instanceof Response) {
				return result;
			}

			const status = handlerOptions.successStatus || 200;
			return this.success(result, { status, headers: handlerOptions.headers });
		} catch (error) {
			return this.internalError(error);
		}
	}

	success(data, { status = 200, headers = {} } = {}) {
		return json(data, { status, headers: mergeHeaders(headers) });
	}

	fail(status, message, details = null, headers = {}) {
		const body = details ? { error: message, details } : { error: message };

		return json(body, { status, headers: mergeHeaders(headers) });
	}

	validationError(issues) {
		return this.fail(400, 'Validation failed', issues);
	}

	notAuthenticated() {
		return this.fail(401, 'Authentication required');
	}

	notFound(message = 'Resource not found') {
		return this.fail(404, message);
	}

	async parseJsonBody() {
		try {
			return await this.request.json();
		} catch (error) {
			if (error instanceof SyntaxError) {
				return this.fail(400, 'Invalid JSON payload');
			}

			logger.error(this.component, 'Failed to parse request body:', error);
			return this.fail(400, 'Invalid request payload');
		}
	}

	internalError(error) {
		logger.error(this.component, error.message || error);
		return this.fail(500, 'Internal server error');
	}

	async #buildContext(handlerOptions) {
		const context = {
			params: this.params,
			services: this.services,
			locals: this.locals,
			config: this.config
		};

		if (handlerOptions.querySchema) {
			const queryData = Object.fromEntries(this.url.searchParams.entries());
			const validation = validateSchema(handlerOptions.querySchema, queryData, {
				allowUnknown: handlerOptions.allowUnknownQuery !== false
			});

			if (!validation.success) {
				return this.validationError(validation.errors);
			}

			context.query = validation.data;
		} else {
			context.query = Object.fromEntries(this.url.searchParams.entries());
		}

		if (handlerOptions.paramsSchema) {
			const validation = validateSchema(handlerOptions.paramsSchema, this.params, {
				allowUnknown: handlerOptions.allowUnknownParams !== false
			});

			if (!validation.success) {
				return this.validationError(validation.errors);
			}

			context.params = validation.data;
		}

		if (handlerOptions.bodySchema || handlerOptions.parseBody) {
			const parsedBody = await this.parseJsonBody();
			if (parsedBody instanceof Response) {
				return parsedBody;
			}

			if (handlerOptions.bodySchema) {
				const validation = validateSchema(handlerOptions.bodySchema, parsedBody, {
					allowUnknown: handlerOptions.allowUnknownBody !== false
				});

				if (!validation.success) {
					return this.validationError(validation.errors);
				}

				context.body = validation.data;
			} else {
				context.body = parsedBody;
			}
		}

		return context;
	}
}
