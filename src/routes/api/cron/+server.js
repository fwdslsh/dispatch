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
			throw new UnauthorizedError('Authentication required to list cron jobs');
		}

		const { cronScheduler } = locals.services;
		if (!cronScheduler) {
			throw new Error('CronSchedulerService not available');
		}

		// Get query parameters
		const status = url.searchParams.get('status');

		// Get jobs from service
		const jobs = await cronScheduler.listJobs(status);

		// Format response
		const response = {
			jobs: jobs.map((job) => ({
				id: job.id,
				name: job.name,
				description: job.description,
				cronExpression: job.cron_expression,
				command: job.command,
				workspacePath: job.workspace_path,
				status: job.status,
				lastRun: job.last_run,
				lastStatus: job.last_status,
				lastError: job.last_error,
				nextRun: job.next_run,
				runCount: job.run_count || 0,
				createdAt: job.created_at,
				updatedAt: job.updated_at,
				createdBy: job.created_by
			})),
			total: jobs.length
		};

		logger.info('CRON_API', `Listed ${jobs.length} cron jobs (status: ${status || 'all'})`);
		return json(response);
	} catch (err) {
		handleApiError(err, 'GET /api/cron');
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to create cron jobs');
		}

		const { cronScheduler } = locals.services;
		if (!cronScheduler) {
			throw new Error('CronSchedulerService not available');
		}

		const data = await request.json();
		const { name, description, cronExpression, command, workspacePath } = data;

		// Validate required fields
		if (!name || !name.trim()) {
			throw new BadRequestError('Job name is required', 'MISSING_NAME');
		}

		if (!cronExpression || !cronExpression.trim()) {
			throw new BadRequestError('Cron expression is required', 'MISSING_EXPRESSION');
		}

		if (!command || !command.trim()) {
			throw new BadRequestError('Command is required', 'MISSING_COMMAND');
		}

		// Create job
		const job = await cronScheduler.createJob({
			name: name.trim(),
			description: description?.trim(),
			cronExpression: cronExpression.trim(),
			command: command.trim(),
			workspacePath: workspacePath || null,
			status: 'active',
			createdBy: locals.auth.user?.id || 'default'
		});

		// Format response
		const response = {
			id: job.id,
			name: job.name,
			description: job.description,
			cronExpression: job.cron_expression || job.cronExpression,
			command: job.command,
			workspacePath: job.workspace_path || job.workspacePath,
			status: job.status,
			nextRun: job.next_run || job.nextRun,
			runCount: 0,
			createdAt: job.created_at || job.createdAt,
			updatedAt: job.updated_at || job.updatedAt,
			createdBy: job.created_by || job.createdBy
		};

		logger.info('CRON_API', `Created cron job: ${job.name} (${job.id})`);
		return json(response, { status: 201 });
	} catch (err) {
		handleApiError(err, 'POST /api/cron');
	}
}
