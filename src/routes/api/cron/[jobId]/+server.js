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
			throw new UnauthorizedError('Authentication required to get cron job');
		}

		const { cronScheduler } = locals.services;
		if (!cronScheduler) {
			throw new Error('CronSchedulerService not available');
		}

		const { jobId } = params;
		const job = await cronScheduler.getJob(jobId);

		if (!job) {
			throw new NotFoundError(`Cron job not found: ${jobId}`);
		}

		// Format response
		const response = {
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
		};

		return json(response);
	} catch (err) {
		handleApiError(err, `GET /api/cron/${params.jobId}`);
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to update cron job');
		}

		const { cronScheduler } = locals.services;
		if (!cronScheduler) {
			throw new Error('CronSchedulerService not available');
		}

		const { jobId } = params;
		const data = await request.json();

		// Check if job exists
		const existing = await cronScheduler.getJob(jobId);
		if (!existing) {
			throw new NotFoundError(`Cron job not found: ${jobId}`);
		}

		// Build updates object
		const updates = {};

		if (data.name !== undefined) {
			if (!data.name.trim()) {
				throw new BadRequestError('Job name cannot be empty', 'INVALID_NAME');
			}
			updates.name = data.name.trim();
		}

		if (data.description !== undefined) {
			updates.description = data.description?.trim() || null;
		}

		if (data.cronExpression !== undefined) {
			if (!data.cronExpression.trim()) {
				throw new BadRequestError('Cron expression cannot be empty', 'INVALID_EXPRESSION');
			}
			updates.cronExpression = data.cronExpression.trim();
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
			if (!['active', 'paused', 'error'].includes(data.status)) {
				throw new BadRequestError('Invalid status value', 'INVALID_STATUS');
			}
			updates.status = data.status;
		}

		// Update job
		const job = await cronScheduler.updateJob(jobId, updates);

		// Format response
		const response = {
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
		};

		logger.info('CRON_API', `Updated cron job: ${jobId}`);
		return json(response);
	} catch (err) {
		handleApiError(err, `PATCH /api/cron/${params.jobId}`);
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required to delete cron job');
		}

		const { cronScheduler } = locals.services;
		if (!cronScheduler) {
			throw new Error('CronSchedulerService not available');
		}

		const { jobId } = params;

		// Check if job exists
		const existing = await cronScheduler.getJob(jobId);
		if (!existing) {
			throw new NotFoundError(`Cron job not found: ${jobId}`);
		}

		// Delete job
		await cronScheduler.deleteJob(jobId);

		logger.info('CRON_API', `Deleted cron job: ${jobId}`);
		return json({ success: true, id: jobId });
	} catch (err) {
		handleApiError(err, `DELETE /api/cron/${params.jobId}`);
	}
}
