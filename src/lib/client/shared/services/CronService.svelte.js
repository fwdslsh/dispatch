/**
 * CronService - Frontend service for cron job management (MVVM pattern)
 * Manages state, API calls, and real-time updates for cron jobs
 */

import { validateCronExpression, cronToHuman } from '$lib/shared/cron-utils.js';

export class CronService {
	jobs = $state([]);
	logs = $state([]);
	loading = $state(false);
	error = $state(null);
	selectedJobId = $state(null);

	constructor(socketService = null) {
		this.socketService = socketService;
		this.setupRealtimeUpdates();
	}

	/**
	 * Setup Socket.IO listeners for real-time updates
	 */
	setupRealtimeUpdates() {
		if (!this.socketService?.socket) return;

		const socket = this.socketService.socket;

		socket.on('cron:job:created', (job) => {
			this.jobs = [job, ...this.jobs];
		});

		socket.on('cron:job:updated', (job) => {
			const index = this.jobs.findIndex((j) => j.id === job.id);
			if (index !== -1) {
				this.jobs[index] = job;
				this.jobs = [...this.jobs];
			}
		});

		socket.on('cron:job:deleted', ({ id }) => {
			this.jobs = this.jobs.filter((j) => j.id !== id);
		});

		socket.on('cron:job:started', ({ id, logId, startTime }) => {
			const job = this.jobs.find((j) => j.id === id);
			if (job) {
				job.lastRun = startTime;
				this.jobs = [...this.jobs];
			}
		});

		socket.on('cron:job:completed', ({ id, status, exitCode, duration }) => {
			const job = this.jobs.find((j) => j.id === id);
			if (job) {
				job.lastStatus = status;
				job.runCount = (job.runCount || 0) + 1;
				this.jobs = [...this.jobs];
			}

			// Refresh logs if viewing this job
			if (this.selectedJobId === id) {
				this.loadJobLogs(id);
			}
		});

		socket.on('cron:job:error', ({ id, error }) => {
			const job = this.jobs.find((j) => j.id === id);
			if (job) {
				job.status = 'error';
				job.lastError = error;
				this.jobs = [...this.jobs];
			}
		});
	}

	/**
	 * Load all cron jobs
	 */
	async loadJobs(status = null) {
		this.loading = true;
		this.error = null;

		try {
			const url = status ? `/api/cron?status=${status}` : '/api/cron';
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to load jobs: ${response.statusText}`);
			}

			const data = await response.json();
			this.jobs = data.jobs || [];
		} catch (err) {
			this.error = err.message;
			console.error('Failed to load cron jobs:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Create a new cron job
	 */
	async createJob(jobData) {
		this.loading = true;
		this.error = null;

		try {
			// Validate cron expression
			const validation = validateCronExpression(jobData.cronExpression);
			if (!validation.valid) {
				throw new Error(validation.error);
			}

			const response = await fetch('/api/cron', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(jobData)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to create job');
			}

			const job = await response.json();
			this.jobs = [job, ...this.jobs];
			return job;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Update a cron job
	 */
	async updateJob(jobId, updates) {
		this.loading = true;
		this.error = null;

		try {
			// Validate cron expression if provided
			if (updates.cronExpression) {
				const validation = validateCronExpression(updates.cronExpression);
				if (!validation.valid) {
					throw new Error(validation.error);
				}
			}

			const response = await fetch(`/api/cron/${jobId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to update job');
			}

			const job = await response.json();

			// Update in local state
			const index = this.jobs.findIndex((j) => j.id === jobId);
			if (index !== -1) {
				this.jobs[index] = job;
				this.jobs = [...this.jobs];
			}

			return job;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Pause a cron job
	 */
	async pauseJob(jobId) {
		return await this.updateJob(jobId, { status: 'paused' });
	}

	/**
	 * Resume a paused cron job
	 */
	async resumeJob(jobId) {
		return await this.updateJob(jobId, { status: 'active' });
	}

	/**
	 * Delete a cron job
	 */
	async deleteJob(jobId) {
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch(`/api/cron/${jobId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to delete job');
			}

			// Remove from local state
			this.jobs = this.jobs.filter((j) => j.id !== jobId);
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load logs for a specific job
	 */
	async loadJobLogs(jobId, limit = 100) {
		this.selectedJobId = jobId;
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch(`/api/cron/${jobId}/logs?limit=${limit}`);

			if (!response.ok) {
				throw new Error(`Failed to load logs: ${response.statusText}`);
			}

			const data = await response.json();
			this.logs = data.logs || [];
		} catch (err) {
			this.error = err.message;
			console.error('Failed to load cron logs:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load all recent logs
	 */
	async loadAllLogs(limit = 100) {
		this.selectedJobId = null;
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch(`/api/cron/logs?limit=${limit}`);

			if (!response.ok) {
				throw new Error(`Failed to load logs: ${response.statusText}`);
			}

			const data = await response.json();
			this.logs = data.logs || [];
		} catch (err) {
			this.error = err.message;
			console.error('Failed to load cron logs:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Get human-readable description for a cron expression
	 */
	getHumanReadable(expression) {
		return cronToHuman(expression);
	}

	/**
	 * Validate a cron expression
	 */
	validateExpression(expression) {
		return validateCronExpression(expression);
	}

	/**
	 * Get job by ID
	 */
	getJob(jobId) {
		return this.jobs.find((j) => j.id === jobId);
	}

	/**
	 * Clear error
	 */
	clearError() {
		this.error = null;
	}
}
