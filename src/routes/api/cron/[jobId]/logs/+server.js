import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import {
	UnauthorizedError,
	NotFoundError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to get cron logs');
		}

		const { cronScheduler } = locals.services;
		if (!cronScheduler) {
			throw new Error('CronSchedulerService not available');
		}

		const { jobId } = params;
		const limit = parseInt(url.searchParams.get('limit') || '100', 10);

		// Check if job exists
		const job = await cronScheduler.getJob(jobId);
		if (!job) {
			throw new NotFoundError(`Cron job not found: ${jobId}`);
		}

		// Get logs
		const logs = await cronScheduler.getJobLogs(jobId, limit);

		// Format response
		const response = {
			jobId,
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

		logger.info('CRON_API', `Retrieved ${logs.length} logs for job: ${jobId}`);
		return json(response);
	} catch (err) {
		handleApiError(err, `GET /api/cron/${params.jobId}/logs`);
	}
}
