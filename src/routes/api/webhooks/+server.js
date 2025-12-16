import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import {
	UnauthorizedError,
	BadRequestError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to list webhooks');
		}

		const { webhookExecutor } = locals.services;
		if (!webhookExecutor) {
			throw new Error('WebhookExecutorService not available');
		}

		// Get query parameters
		const status = url.searchParams.get('status');

		// Get webhooks from service
		const webhooks = await webhookExecutor.listWebhooks(status);

		// Format response
		const response = {
			webhooks: webhooks.map((webhook) => ({
				id: webhook.id,
				name: webhook.name,
				description: webhook.description,
				uriPath: webhook.uri_path,
				httpMethod: webhook.http_method,
				command: webhook.command,
				workspacePath: webhook.workspace_path,
				status: webhook.status,
				lastTriggered: webhook.last_triggered,
				lastStatus: webhook.last_status,
				lastError: webhook.last_error,
				triggerCount: webhook.trigger_count || 0,
				createdAt: webhook.created_at,
				updatedAt: webhook.updated_at,
				createdBy: webhook.created_by
			})),
			total: webhooks.length
		};

		logger.info('WEBHOOK_API', `Listed ${webhooks.length} webhooks (status: ${status || 'all'})`);
		return json(response);
	} catch (err) {
		handleApiError(err, 'GET /api/webhooks');
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to create webhooks');
		}

		const { webhookExecutor } = locals.services;
		if (!webhookExecutor) {
			throw new Error('WebhookExecutorService not available');
		}

		const data = await request.json();
		const { name, description, uriPath, httpMethod, command, workspacePath } = data;

		// Validate required fields
		if (!name || !name.trim()) {
			throw new BadRequestError('Webhook name is required', 'MISSING_NAME');
		}

		if (!uriPath || !uriPath.trim()) {
			throw new BadRequestError('URI path is required', 'MISSING_URI_PATH');
		}

		if (!httpMethod || !httpMethod.trim()) {
			throw new BadRequestError('HTTP method is required', 'MISSING_HTTP_METHOD');
		}

		if (!command || !command.trim()) {
			throw new BadRequestError('Command is required', 'MISSING_COMMAND');
		}

		// Create webhook
		const webhook = await webhookExecutor.createWebhook({
			name: name.trim(),
			description: description?.trim(),
			uriPath: uriPath.trim(),
			httpMethod: httpMethod.trim().toUpperCase(),
			command: command.trim(),
			workspacePath: workspacePath || null,
			status: 'active',
			createdBy: locals.auth.user?.id || 'default'
		});

		// Format response
		const response = {
			id: webhook.id,
			name: webhook.name,
			description: webhook.description,
			uriPath: webhook.uri_path,
			httpMethod: webhook.http_method,
			command: webhook.command,
			workspacePath: webhook.workspace_path,
			status: webhook.status,
			triggerCount: 0,
			createdAt: webhook.created_at,
			updatedAt: webhook.updated_at,
			createdBy: webhook.created_by
		};

		logger.info('WEBHOOK_API', `Created webhook: ${webhook.name} (${webhook.id})`);
		return json(response, { status: 201 });
	} catch (err) {
		handleApiError(err, 'POST /api/webhooks');
	}
}
