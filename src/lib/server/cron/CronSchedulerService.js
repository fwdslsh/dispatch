/**
 * CronSchedulerService - Manages scheduled task execution with node-cron
 *
 * Features:
 * - Dynamic job scheduling and management
 * - Command execution in workspace context
 * - Comprehensive logging of execution history
 * - Real-time status updates via Socket.IO
 * - Error handling and recovery
 * - Next run time calculation
 */

import cron from 'node-cron';
import parser from 'cron-parser';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { logger } from '../shared/utils/logger.js';
import * as CronRepo from '../shared/db/CronRepository.js';

/**
 * Generate unique ID for cron jobs
 */
function generateId() {
	return `cron_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Parse cron expression and calculate next run time
 * @param {string} expression - Cron expression (e.g., "0 * * * *")
 * @returns {number|null} - Timestamp of next run or null if invalid
 */
function calculateNextRun(expression) {
	try {
		if (!cron.validate(expression)) {
			return null;
		}

		// Parse cron expression and get next occurrence
		const interval = parser.parseExpression(expression, {
			currentDate: new Date(),
			tz: 'UTC'
		});

		const nextDate = interval.next().toDate();
		return nextDate.getTime();
	} catch (error) {
		logger.error('CRON', 'Failed to calculate next run:', error);
		return null;
	}
}

/**
 * CronSchedulerService - Main service for cron job management
 */
export class CronSchedulerService {
	/**
	 * Initialize CronSchedulerService
	 * @param {DatabaseManager} db - Database manager instance
	 * @param {Object} io - Socket.IO server instance
	 */
	constructor(db, io = null) {
		if (!db) {
			throw new Error('CronSchedulerService requires a database instance');
		}

		this.db = db;
		this.io = io;

		// Map of active scheduled tasks: jobId -> cron.ScheduledTask
		this.scheduledTasks = new Map();

		// Map of currently running executions: logId -> { process, startTime }
		this.runningTasks = new Map();

		this.isInitialized = false;
	}

	/**
	 * Initialize service and load active jobs from database
	 */
	async init() {
		if (this.isInitialized) return;

		try {
			logger.info('CRON', 'Initializing CronSchedulerService...');

			// Load all active jobs from database
			const jobs = await CronRepo.listCronJobs(this.db, 'active');

			logger.info('CRON', `Loading ${jobs.length} active cron jobs`);

			// Schedule each active job
			for (const job of jobs) {
				await this.scheduleJob(job);
			}

			this.isInitialized = true;
			logger.info('CRON', 'CronSchedulerService initialized successfully');
		} catch (error) {
			logger.error('CRON', 'Failed to initialize CronSchedulerService:', error);
			throw error;
		}
	}

	/**
	 * Create and schedule a new cron job
	 * @param {Object} jobData - Job configuration
	 * @returns {Promise<Object>} Created job
	 */
	async createJob(jobData) {
		// Validate cron expression
		if (!cron.validate(jobData.cronExpression)) {
			throw new Error(`Invalid cron expression: ${jobData.cronExpression}`);
		}

		// Generate ID and calculate next run
		const jobId = generateId();
		const nextRun = calculateNextRun(jobData.cronExpression);

		const job = {
			id: jobId,
			name: jobData.name,
			description: jobData.description,
			cronExpression: jobData.cronExpression,
			command: jobData.command,
			workspacePath: jobData.workspacePath,
			status: jobData.status || 'active',
			nextRun,
			createdBy: jobData.createdBy || 'default'
		};

		// Save to database
		await CronRepo.createCronJob(this.db, job);

		// Schedule if active
		if (job.status === 'active') {
			await this.scheduleJob(job);
		}

		// Emit real-time update
		this.emitUpdate('job:created', job);

		logger.info('CRON', `Created job: ${job.name} (${job.id})`);
		return job;
	}

	/**
	 * Schedule a cron job with node-cron
	 * @param {Object} job - Job configuration from database
	 */
	async scheduleJob(job) {
		try {
			// Don't schedule if already scheduled
			if (this.scheduledTasks.has(job.id)) {
				return;
			}

			// Create scheduled task
			const task = cron.schedule(job.cron_expression || job.cronExpression, async () => {
				await this.executeJob(job);
			}, {
				scheduled: true,
				timezone: 'UTC'
			});

			this.scheduledTasks.set(job.id, task);
			logger.info('CRON', `Scheduled job: ${job.name} (${job.id})`);
		} catch (error) {
			logger.error('CRON', `Failed to schedule job ${job.id}:`, error);

			// Update job status to error
			await CronRepo.updateCronJob(this.db, job.id, {
				status: 'error',
				last_error: error.message
			});

			this.emitUpdate('job:error', { id: job.id, error: error.message });
		}
	}

	/**
	 * Unschedule a cron job
	 * @param {string} jobId - Job ID
	 */
	unscheduleJob(jobId) {
		const task = this.scheduledTasks.get(jobId);
		if (task) {
			task.stop();
			this.scheduledTasks.delete(jobId);
			logger.info('CRON', `Unscheduled job: ${jobId}`);
		}
	}

	/**
	 * Execute a cron job command
	 * @param {Object} job - Job configuration
	 */
	async executeJob(job) {
		const startTime = Date.now();
		let logId = null;

		try {
			logger.info('CRON', `Executing job: ${job.name} (${job.id})`);

			// Create log entry
			logId = await CronRepo.createCronLog(this.db, {
				jobId: job.id,
				startedAt: startTime,
				status: 'running'
			});

			// Emit real-time update
			this.emitUpdate('job:started', { id: job.id, logId, startTime });

			// Parse command (handle shell syntax)
			const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
			const shellFlag = process.platform === 'win32' ? '/c' : '-c';

			// Execute command
			const childProcess = spawn(shell, [shellFlag, job.command], {
				cwd: job.workspace_path || job.workspacePath || process.cwd(),
				env: { ...process.env },
				timeout: 3600000 // 1 hour max execution time
			});

			// Track running task
			this.runningTasks.set(logId, { process: childProcess, startTime });

			let output = '';
			let errorOutput = '';

			childProcess.stdout?.on('data', (data) => {
				output += data.toString();
			});

			childProcess.stderr?.on('data', (data) => {
				errorOutput += data.toString();
			});

			// Wait for completion
			const exitCode = await new Promise((resolve, reject) => {
				childProcess.on('close', resolve);
				childProcess.on('error', reject);
			});

			// Remove from running tasks
			this.runningTasks.delete(logId);

			const completedAt = Date.now();
			const status = exitCode === 0 ? 'success' : 'failed';

			// Update log
			await CronRepo.updateCronLog(this.db, logId, {
				completed_at: completedAt,
				status,
				exit_code: exitCode,
				output: output.substring(0, 50000), // Limit output size
				error: errorOutput.substring(0, 10000)
			});

			// Update job
			await CronRepo.updateCronJob(this.db, job.id, {
				last_run: startTime,
				last_status: status,
				last_error: status === 'failed' ? errorOutput.substring(0, 500) : null,
				next_run: calculateNextRun(job.cron_expression || job.cronExpression),
				run_count: (job.run_count || 0) + 1,
				status: status === 'failed' ? 'error' : 'active'
			});

			// Emit completion update
			this.emitUpdate('job:completed', {
				id: job.id,
				logId,
				status,
				exitCode,
				duration: completedAt - startTime
			});

			logger.info('CRON', `Job ${job.name} completed with status: ${status} (exit code: ${exitCode})`);
		} catch (error) {
			logger.error('CRON', `Job ${job.name} failed:`, error);

			const completedAt = Date.now();

			// Clean up running task
			if (logId) {
				this.runningTasks.delete(logId);

				// Update log
				await CronRepo.updateCronLog(this.db, logId, {
					completed_at: completedAt,
					status: 'failed',
					error: error.message
				});
			}

			// Update job
			await CronRepo.updateCronJob(this.db, job.id, {
				last_run: startTime,
				last_status: 'failed',
				last_error: error.message.substring(0, 500),
				status: 'error',
				run_count: (job.run_count || 0) + 1
			});

			// Emit error update
			this.emitUpdate('job:error', {
				id: job.id,
				logId,
				error: error.message
			});
		}
	}

	/**
	 * Update an existing cron job
	 * @param {string} jobId - Job ID
	 * @param {Object} updates - Fields to update
	 * @returns {Promise<Object>} Updated job
	 */
	async updateJob(jobId, updates) {
		const job = await CronRepo.getCronJob(this.db, jobId);
		if (!job) {
			throw new Error(`Job not found: ${jobId}`);
		}

		// Validate cron expression if being updated
		if (updates.cronExpression && !cron.validate(updates.cronExpression)) {
			throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
		}

		// Calculate new next run if expression changed
		if (updates.cronExpression) {
			updates.next_run = calculateNextRun(updates.cronExpression);
			updates.cron_expression = updates.cronExpression;
		}

		// Update database
		const updatedJob = await CronRepo.updateCronJob(this.db, jobId, updates);

		// Handle status changes
		if (updates.status) {
			if (updates.status === 'active') {
				await this.scheduleJob({ ...job, ...updates });
			} else {
				this.unscheduleJob(jobId);
			}
		} else if (updates.cronExpression) {
			// Reschedule if expression changed
			this.unscheduleJob(jobId);
			if (job.status === 'active') {
				await this.scheduleJob({ ...job, ...updates });
			}
		}

		// Emit update
		this.emitUpdate('job:updated', updatedJob);

		logger.info('CRON', `Updated job: ${jobId}`);
		return updatedJob;
	}

	/**
	 * Pause a cron job
	 * @param {string} jobId - Job ID
	 */
	async pauseJob(jobId) {
		return await this.updateJob(jobId, { status: 'paused' });
	}

	/**
	 * Resume a paused cron job
	 * @param {string} jobId - Job ID
	 */
	async resumeJob(jobId) {
		return await this.updateJob(jobId, { status: 'active' });
	}

	/**
	 * Delete a cron job
	 * @param {string} jobId - Job ID
	 */
	async deleteJob(jobId) {
		// Unschedule first
		this.unscheduleJob(jobId);

		// Delete from database (cascade deletes logs)
		await CronRepo.deleteCronJob(this.db, jobId);

		// Emit update
		this.emitUpdate('job:deleted', { id: jobId });

		logger.info('CRON', `Deleted job: ${jobId}`);
	}

	/**
	 * Get all cron jobs
	 * @param {string} status - Optional status filter
	 * @returns {Promise<Array>} List of jobs
	 */
	async listJobs(status = null) {
		return await CronRepo.listCronJobs(this.db, status);
	}

	/**
	 * Get job details
	 * @param {string} jobId - Job ID
	 * @returns {Promise<Object>} Job details
	 */
	async getJob(jobId) {
		return await CronRepo.getCronJob(this.db, jobId);
	}

	/**
	 * Get logs for a job
	 * @param {string} jobId - Job ID
	 * @param {number} limit - Max number of logs
	 * @returns {Promise<Array>} Job execution logs
	 */
	async getJobLogs(jobId, limit = 100) {
		return await CronRepo.getCronLogs(this.db, jobId, limit);
	}

	/**
	 * Get all recent logs
	 * @param {number} limit - Max number of logs
	 * @returns {Promise<Array>} Recent execution logs
	 */
	async getAllLogs(limit = 100) {
		return await CronRepo.getAllCronLogs(this.db, limit);
	}

	/**
	 * Clean up old logs (older than specified days)
	 * @param {number} days - Number of days to keep
	 */
	async cleanupOldLogs(days = 30) {
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
		await CronRepo.deleteOldCronLogs(this.db, cutoffTime);
		logger.info('CRON', `Cleaned up logs older than ${days} days`);
	}

	/**
	 * Emit real-time update via Socket.IO
	 * @param {string} event - Event name
	 * @param {Object} data - Event data
	 */
	emitUpdate(event, data) {
		if (this.io) {
			this.io.emit(`cron:${event}`, data);
		}
	}

	/**
	 * Stop all scheduled tasks (cleanup on shutdown)
	 */
	shutdown() {
		logger.info('CRON', 'Shutting down CronSchedulerService...');

		// Stop all scheduled tasks
		for (const [jobId, task] of this.scheduledTasks.entries()) {
			task.stop();
			logger.info('CRON', `Stopped scheduled task: ${jobId}`);
		}

		this.scheduledTasks.clear();

		// Kill any running tasks
		for (const [logId, { process }] of this.runningTasks.entries()) {
			process.kill();
			logger.info('CRON', `Killed running task: ${logId}`);
		}

		this.runningTasks.clear();

		logger.info('CRON', 'CronSchedulerService shut down');
	}
}
