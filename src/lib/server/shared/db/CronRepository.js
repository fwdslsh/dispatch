/**
 * Cron job repository - Plain functions for cron operations
 * Separated from DatabaseManager to avoid Vite dev mode SSR bundling issues
 */

/**
 * List all cron jobs
 */
export async function listCronJobs(db, status = null) {
	if (status) {
		return await db.all('SELECT * FROM cron_jobs WHERE status = ? ORDER BY created_at DESC', [status]);
	}
	return await db.all('SELECT * FROM cron_jobs ORDER BY created_at DESC');
}

/**
 * Get a cron job by ID
 */
export async function getCronJob(db, id) {
	return await db.get('SELECT * FROM cron_jobs WHERE id = ?', [id]);
}

/**
 * Create a new cron job
 */
export async function createCronJob(db, job) {
	const now = Date.now();
	await db.run(
		`INSERT INTO cron_jobs
		 (id, name, description, cron_expression, command, workspace_path, status,
		  next_run, created_at, updated_at, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			job.id,
			job.name,
			job.description || null,
			job.cronExpression,
			job.command,
			job.workspacePath || null,
			job.status || 'active',
			job.nextRun || null,
			now,
			now,
			job.createdBy || 'default'
		]
	);
	return await getCronJob(db, job.id);
}

/**
 * Update a cron job
 */
export async function updateCronJob(db, id, updates) {
	const fields = [];
	const values = [];

	const allowedFields = [
		'name', 'description', 'cron_expression', 'command', 'workspace_path',
		'status', 'last_run', 'last_status', 'last_error', 'next_run', 'run_count'
	];

	for (const [key, value] of Object.entries(updates)) {
		const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
		if (allowedFields.includes(dbKey)) {
			fields.push(`${dbKey} = ?`);
			values.push(value);
		}
	}

	if (fields.length === 0) return await getCronJob(db, id);

	fields.push('updated_at = ?');
	values.push(Date.now());
	values.push(id);

	await db.run(
		`UPDATE cron_jobs SET ${fields.join(', ')} WHERE id = ?`,
		values
	);

	return await getCronJob(db, id);
}

/**
 * Delete a cron job
 */
export async function deleteCronJob(db, id) {
	await db.run('DELETE FROM cron_jobs WHERE id = ?', [id]);
}

/**
 * Create a cron log
 */
export async function createCronLog(db, log) {
	const result = await db.run(
		`INSERT INTO cron_logs (job_id, started_at, status)
		 VALUES (?, ?, ?)`,
		[log.jobId, log.startedAt, log.status]
	);
	return result.lastID;
}

/**
 * Update a cron log
 */
export async function updateCronLog(db, id, updates) {
	const fields = [];
	const values = [];

	const allowedFields = ['completed_at', 'status', 'exit_code', 'output', 'error'];

	for (const [key, value] of Object.entries(updates)) {
		const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
		if (allowedFields.includes(dbKey)) {
			fields.push(`${dbKey} = ?`);
			values.push(value);
		}
	}

	if (fields.length === 0) return;

	values.push(id);

	await db.run(
		`UPDATE cron_logs SET ${fields.join(', ')} WHERE id = ?`,
		values
	);
}

/**
 * Get logs for a job
 */
export async function getCronLogs(db, jobId, limit = 100) {
	return await db.all(
		'SELECT * FROM cron_logs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?',
		[jobId, limit]
	);
}

/**
 * Get all recent logs
 */
export async function getAllCronLogs(db, limit = 100) {
	return await db.all('SELECT * FROM cron_logs ORDER BY started_at DESC LIMIT ?', [limit]);
}

/**
 * Delete old cron logs
 */
export async function deleteOldCronLogs(db, olderThanTimestamp) {
	await db.run('DELETE FROM cron_logs WHERE started_at < ?', [olderThanTimestamp]);
}
