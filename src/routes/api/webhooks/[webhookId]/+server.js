import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import {
	UnauthorizedError,
	NotFoundError,
	BadRequestError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to get webhook');
		}

		const { webhookExecutor } = locals.services;
		if (!webhookExecutor) {
			throw new Error('WebhookExecutorService not available');
		}

		const { webhookId } = params;
		const webhook = await webhookExecutor.getWebhook(webhookId);

		if (!webhook) {
			throw new NotFoundError(`Webhook not found: ${webhookId}`);
		}

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
			lastTriggered: webhook.last_triggered,
			lastStatus: webhook.last_status,
			lastError: webhook.last_error,
			triggerCount: webhook.trigger_count || 0,
			createdAt: webhook.created_at,
			updatedAt: webhook.updated_at,
			createdBy: webhook.created_by
		};

		return json(response);
	} catch (err) {
		handleApiError(err, `GET /api/webhooks/${params.webhookId}`);
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to update webhook');
		}

		const { webhookExecutor } = locals.services;
		if (!webhookExecutor) {
			throw new Error('WebhookExecutorService not available');
		}

		const { webhookId } = params;
		const data = await request.json();

		// Check if webhook exists
		const existing = await webhookExecutor.getWebhook(webhookId);
		if (!existing) {
			throw new NotFoundError(`Webhook not found: ${webhookId}`);
		}

		// Build updates object
		const updates = {};

		if (data.name !== undefined) {
			if (!data.name.trim()) {
				throw new BadRequestError('Webhook name cannot be empty', 'INVALID_NAME');
			}
			updates.name = data.name.trim();
		}

		if (data.description !== undefined) {
			updates.description = data.description?.trim() || null;
		}

		if (data.uriPath !== undefined) {
			if (!data.uriPath.trim()) {
				throw new BadRequestError('URI path cannot be empty', 'INVALID_URI_PATH');
			}
			updates.uriPath = data.uriPath.trim();
		}

		if (data.httpMethod !== undefined) {
			if (!data.httpMethod.trim()) {
				throw new BadRequestError('HTTP method cannot be empty', 'INVALID_HTTP_METHOD');
			}
			updates.httpMethod = data.httpMethod.trim().toUpperCase();
		}

		if (data.command !== undefined) {
			if (!data.command.trim()) {
				throw new BadRequestError('Command cannot be empty', 'INVALID_COMMAND');
			}
			updates.command = data.command.trim();
		}

		if (data.workspacePath !== undefined) {
			updates.workspace_path = data.workspacePath || null;
		}

		if (data.status !== undefined) {
			if (!['active', 'disabled'].includes(data.status)) {
				throw new BadRequestError('Invalid status value', 'INVALID_STATUS');
			}
			updates.status = data.status;
		}

		// Update webhook
		const webhook = await webhookExecutor.updateWebhook(webhookId, updates);

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
			lastTriggered: webhook.last_triggered,
			lastStatus: webhook.last_status,
			lastError: webhook.last_error,
			triggerCount: webhook.trigger_count || 0,
			createdAt: webhook.created_at,
			updatedAt: webhook.updated_at,
			createdBy: webhook.created_by
		};

		logger.info('WEBHOOK_API', `Updated webhook: ${webhookId}`);
		return json(response);
	} catch (err) {
		handleApiError(err, `PATCH /api/webhooks/${params.webhookId}`);
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to delete webhook');
		}

		const { webhookExecutor } = locals.services;
		if (!webhookExecutor) {
			throw new Error('WebhookExecutorService not available');
		}

		const { webhookId } = params;

		// Check if webhook exists
		const existing = await webhookExecutor.getWebhook(webhookId);
		if (!existing) {
			throw new NotFoundError(`Webhook not found: ${webhookId}`);
		}

		// Delete webhook
		await webhookExecutor.deleteWebhook(webhookId);

		logger.info('WEBHOOK_API', `Deleted webhook: ${webhookId}`);
		return json({ success: true, id: webhookId });
	} catch (err) {
		handleApiError(err, `DELETE /api/webhooks/${params.webhookId}`);
	}
}
