import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { UnauthorizedError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to get cron logs');
		}

		const { cronScheduler } = locals.services;
		if (!cronScheduler) {
			throw new Error('CronSchedulerService not available');
		}

		const limit = parseInt(url.searchParams.get('limit') || '100', 10);

		// Get all logs
		const logs = await cronScheduler.getAllLogs(limit);

		// Format response
		const response = {
			logs: logs.map((log) => ({
				id: log.id,
				jobId: log.job_id,
				startedAt: log.started_at,
				completedAt: log.completed_at,
				status: log.status,
				exitCode: log.exit_code,
				output: log.output,
				error: log.error,
				duration: log.completed_at ? log.completed_at - log.started_at : null
			})),
			total: logs.length
		};

		logger.info('CRON_API', `Retrieved ${logs.length} recent cron logs`);
		return json(response);
	} catch (err) {
		handleApiError(err, 'GET /api/cron/logs');
	}
}
