import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { UnauthorizedError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to get webhook logs');
		}

		const { webhookExecutor } = locals.services;
		if (!webhookExecutor) {
			throw new Error('WebhookExecutorService not available');
		}

		// Get query parameters
		const limit = parseInt(url.searchParams.get('limit') || '100', 10);

		// Get all recent logs from service
		const logs = await webhookExecutor.getAllLogs(limit);

		// Format response
		const response = {
			logs: logs.map((log) => ({
				id: log.id,
				webhookId: log.webhook_id,
				requestMethod: log.request_method,
				requestPath: log.request_path,
				requestBody: log.request_body,
				triggeredAt: log.triggered_at,
				completedAt: log.completed_at,
				status: log.status,
				exitCode: log.exit_code,
				output: log.output,
				error: log.error,
				durationMs: log.duration_ms,
				clientIp: log.client_ip
			})),
			total: logs.length
		};

		logger.info('WEBHOOK_API', `Listed ${logs.length} recent webhook logs`);
		return json(response);
	} catch (err) {
		handleApiError(err, 'GET /api/webhooks/logs');
	}
}
