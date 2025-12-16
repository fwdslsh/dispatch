/**
 * Webhook repository - Plain functions for webhook operations
 * Separated from DatabaseManager to avoid Vite dev mode SSR bundling issues
 */

/**
 * List all webhooks
 */
export async function listWebhooks(db, status = null) {
	if (status) {
		return await db.all('SELECT * FROM webhooks WHERE status = ? ORDER BY created_at DESC', [
			status
		]);
	}
	return await db.all('SELECT * FROM webhooks ORDER BY created_at DESC');
}

/**
 * Get a webhook by ID
 */
export async function getWebhook(db, id) {
	return await db.get('SELECT * FROM webhooks WHERE id = ?', [id]);
}

/**
 * Get a webhook by URI path and HTTP method
 */
export async function getWebhookByRoute(db, uriPath, httpMethod) {
	return await db.get(
		'SELECT * FROM webhooks WHERE uri_path = ? AND http_method = ? AND status = ?',
		[uriPath, httpMethod.toUpperCase(), 'active']
	);
}

/**
 * Check if a webhook route already exists
 */
export async function webhookRouteExists(db, uriPath, httpMethod, excludeId = null) {
	if (excludeId) {
		const result = await db.get(
			'SELECT id FROM webhooks WHERE uri_path = ? AND http_method = ? AND id != ?',
			[uriPath, httpMethod.toUpperCase(), excludeId]
		);
		return !!result;
	}
	const result = await db.get('SELECT id FROM webhooks WHERE uri_path = ? AND http_method = ?', [
		uriPath,
		httpMethod.toUpperCase()
	]);
	return !!result;
}

/**
 * Create a new webhook
 */
export async function createWebhook(db, webhook) {
	const now = Date.now();
	await db.run(
		`INSERT INTO webhooks
		 (id, name, description, uri_path, http_method, command, workspace_path, status,
		  created_at, updated_at, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			webhook.id,
			webhook.name,
			webhook.description || null,
			webhook.uriPath,
			webhook.httpMethod.toUpperCase(),
			webhook.command,
			webhook.workspacePath || null,
			webhook.status || 'active',
			now,
			now,
			webhook.createdBy || 'default'
		]
	);
	return await getWebhook(db, webhook.id);
}

/**
 * Update a webhook
 */
export async function updateWebhook(db, id, updates) {
	const fields = [];
	const values = [];

	const allowedFields = [
		'name',
		'description',
		'uri_path',
		'http_method',
		'command',
		'workspace_path',
		'status',
		'last_triggered',
		'last_status',
		'last_error',
		'trigger_count'
	];

	for (const [key, value] of Object.entries(updates)) {
		const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
		if (allowedFields.includes(dbKey)) {
			fields.push(`${dbKey} = ?`);
			values.push(value);
		}
	}

	if (fields.length === 0) return await getWebhook(db, id);

	fields.push('updated_at = ?');
	values.push(Date.now());
	values.push(id);

	await db.run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, values);

	return await getWebhook(db, id);
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(db, id) {
	await db.run('DELETE FROM webhooks WHERE id = ?', [id]);
}

/**
 * Create a webhook log
 */
export async function createWebhookLog(db, log) {
	const result = await db.run(
		`INSERT INTO webhook_logs (webhook_id, request_method, request_path, request_body, triggered_at, status, client_ip)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			log.webhookId,
			log.requestMethod,
			log.requestPath,
			log.requestBody || null,
			log.triggeredAt,
			log.status,
			log.clientIp || null
		]
	);
	return result.lastID;
}

/**
 * Update a webhook log
 */
export async function updateWebhookLog(db, id, updates) {
	const fields = [];
	const values = [];

	const allowedFields = ['completed_at', 'status', 'exit_code', 'output', 'error', 'duration_ms'];

	for (const [key, value] of Object.entries(updates)) {
		const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
		if (allowedFields.includes(dbKey)) {
			fields.push(`${dbKey} = ?`);
			values.push(value);
		}
	}

	if (fields.length === 0) return;

	values.push(id);

	await db.run(`UPDATE webhook_logs SET ${fields.join(', ')} WHERE id = ?`, values);
}

/**
 * Get logs for a webhook
 */
export async function getWebhookLogs(db, webhookId, limit = 100) {
	return await db.all(
		'SELECT * FROM webhook_logs WHERE webhook_id = ? ORDER BY triggered_at DESC LIMIT ?',
		[webhookId, limit]
	);
}

/**
 * Get all recent logs
 */
export async function getAllWebhookLogs(db, limit = 100) {
	return await db.all('SELECT * FROM webhook_logs ORDER BY triggered_at DESC LIMIT ?', [limit]);
}

/**
 * Delete old webhook logs
 */
export async function deleteOldWebhookLogs(db, olderThanTimestamp) {
	await db.run('DELETE FROM webhook_logs WHERE triggered_at < ?', [olderThanTimestamp]);
}
