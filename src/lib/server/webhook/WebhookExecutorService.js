/**
 * WebhookExecutorService - Manages HTTP-triggered command execution
 *
 * Features:
 * - Dynamic webhook registration and management
 * - Command execution with request data passed via temp file
 * - Comprehensive logging of execution history
 * - Real-time status updates via Socket.IO
 * - Error handling and recovery
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { logger } from '../shared/utils/logger.js';
import * as WebhookRepo from '../shared/db/WebhookRepository.js';

const execAsync = promisify(exec);

/**
 * Generate unique ID for webhooks
 */
function generateId() {
	return `webhook_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Validate URI path format
 */
function validateUriPath(path) {
	if (!path) {
		return { valid: false, error: 'URI path is required' };
	}
	if (!path.startsWith('/hooks/')) {
		return { valid: false, error: 'URI path must start with /hooks/' };
	}
	if (!/^\/hooks\/[a-zA-Z0-9\-_/]+$/.test(path)) {
		return { valid: false, error: 'URI path contains invalid characters. Use only letters, numbers, hyphens, underscores, and forward slashes.' };
	}
	if (path.length < 8) {
		return { valid: false, error: 'URI path is too short. Must be at least /hooks/x' };
	}
	return { valid: true };
}

/**
 * Validate HTTP method
 */
function validateHttpMethod(method) {
	const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
	const upperMethod = method?.toUpperCase();
	if (!validMethods.includes(upperMethod)) {
		return { valid: false, error: `Invalid HTTP method. Must be one of: ${validMethods.join(', ')}` };
	}
	return { valid: true, method: upperMethod };
}

/**
 * WebhookExecutorService - Main service for webhook management
 */
export class WebhookExecutorService {
	/**
	 * Initialize WebhookExecutorService
	 * @param {DatabaseManager} db - Database manager instance
	 * @param {Object} io - Socket.IO server instance
	 */
	constructor(db, io = null) {
		if (!db) {
			throw new Error('WebhookExecutorService requires a database instance');
		}

		this.db = db;
		this.io = io;
		this.isInitialized = false;
	}

	/**
	 * Initialize service
	 */
	async init() {
		if (this.isInitialized) return;

		try {
			logger.info('WEBHOOK', 'Initializing WebhookExecutorService...');

			// Verify webhooks table exists by attempting a query
			const webhooks = await WebhookRepo.listWebhooks(this.db);
			logger.info('WEBHOOK', `Found ${webhooks.length} configured webhooks`);

			this.isInitialized = true;
			logger.info('WEBHOOK', 'WebhookExecutorService initialized successfully');
		} catch (error) {
			logger.error('WEBHOOK', 'Failed to initialize WebhookExecutorService:', error);
			throw error;
		}
	}

	/**
	 * Create a new webhook
	 * @param {Object} webhookData - Webhook configuration
	 * @returns {Promise<Object>} Created webhook
	 */
	async createWebhook(webhookData) {
		// Validate URI path
		const pathValidation = validateUriPath(webhookData.uriPath);
		if (!pathValidation.valid) {
			throw new Error(pathValidation.error);
		}

		// Validate HTTP method
		const methodValidation = validateHttpMethod(webhookData.httpMethod);
		if (!methodValidation.valid) {
			throw new Error(methodValidation.error);
		}

		// Check for duplicate route
		const exists = await WebhookRepo.webhookRouteExists(
			this.db,
			webhookData.uriPath,
			methodValidation.method
		);
		if (exists) {
			throw new Error(`A webhook already exists for ${methodValidation.method} ${webhookData.uriPath}`);
		}

		// Generate ID
		const webhookId = generateId();

		const webhook = {
			id: webhookId,
			name: webhookData.name,
			description: webhookData.description,
			uriPath: webhookData.uriPath,
			httpMethod: methodValidation.method,
			command: webhookData.command,
			workspacePath: webhookData.workspacePath,
			status: webhookData.status || 'active',
			createdBy: webhookData.createdBy || 'default'
		};

		// Save to database
		const created = await WebhookRepo.createWebhook(this.db, webhook);

		// Emit real-time update
		this.emitUpdate('webhook:created', created);

		logger.info('WEBHOOK', `Created webhook: ${webhook.name} (${webhook.id}) -> ${webhook.httpMethod} ${webhook.uriPath}`);
		return created;
	}

	/**
	 * Update an existing webhook
	 * @param {string} webhookId - Webhook ID
	 * @param {Object} updates - Fields to update
	 * @returns {Promise<Object>} Updated webhook
	 */
	async updateWebhook(webhookId, updates) {
		const webhook = await WebhookRepo.getWebhook(this.db, webhookId);
		if (!webhook) {
			throw new Error(`Webhook not found: ${webhookId}`);
		}

		// Validate URI path if being updated
		if (updates.uriPath) {
			const pathValidation = validateUriPath(updates.uriPath);
			if (!pathValidation.valid) {
				throw new Error(pathValidation.error);
			}
		}

		// Validate HTTP method if being updated
		if (updates.httpMethod) {
			const methodValidation = validateHttpMethod(updates.httpMethod);
			if (!methodValidation.valid) {
				throw new Error(methodValidation.error);
			}
			updates.httpMethod = methodValidation.method;
		}

		// Check for duplicate route if path or method is changing
		if (updates.uriPath || updates.httpMethod) {
			const newPath = updates.uriPath || webhook.uri_path;
			const newMethod = updates.httpMethod || webhook.http_method;
			const exists = await WebhookRepo.webhookRouteExists(this.db, newPath, newMethod, webhookId);
			if (exists) {
				throw new Error(`A webhook already exists for ${newMethod} ${newPath}`);
			}
		}

		// Update database
		const updatedWebhook = await WebhookRepo.updateWebhook(this.db, webhookId, updates);

		// Emit update
		this.emitUpdate('webhook:updated', updatedWebhook);

		logger.info('WEBHOOK', `Updated webhook: ${webhookId}`);
		return updatedWebhook;
	}

	/**
	 * Enable a webhook
	 * @param {string} webhookId - Webhook ID
	 */
	async enableWebhook(webhookId) {
		return await this.updateWebhook(webhookId, { status: 'active' });
	}

	/**
	 * Disable a webhook
	 * @param {string} webhookId - Webhook ID
	 */
	async disableWebhook(webhookId) {
		return await this.updateWebhook(webhookId, { status: 'disabled' });
	}

	/**
	 * Delete a webhook
	 * @param {string} webhookId - Webhook ID
	 */
	async deleteWebhook(webhookId) {
		const webhook = await WebhookRepo.getWebhook(this.db, webhookId);
		if (!webhook) {
			throw new Error(`Webhook not found: ${webhookId}`);
		}

		// Delete from database (cascade deletes logs)
		await WebhookRepo.deleteWebhook(this.db, webhookId);

		// Emit update
		this.emitUpdate('webhook:deleted', { id: webhookId });

		logger.info('WEBHOOK', `Deleted webhook: ${webhookId}`);
	}

	/**
	 * Find a webhook by URI path and HTTP method
	 * @param {string} uriPath - URI path
	 * @param {string} httpMethod - HTTP method
	 * @returns {Promise<Object|null>} Webhook or null
	 */
	async findMatchingWebhook(uriPath, httpMethod) {
		return await WebhookRepo.getWebhookByRoute(this.db, uriPath, httpMethod);
	}

	/**
	 * Execute a webhook command
	 * @param {Object} webhook - Webhook configuration
	 * @param {Object} requestData - Request body and query params
	 * @param {Object} metadata - Additional metadata (clientIp, method, path)
	 * @returns {Promise<Object>} Execution result
	 */
	async executeWebhook(webhook, requestData, metadata = {}) {
		const startTime = Date.now();
		let logId = null;
		let tempFilePath = null;

		try {
			logger.info('WEBHOOK', `Executing webhook: ${webhook.name} (${webhook.id})`);

			// Create log entry
			logId = await WebhookRepo.createWebhookLog(this.db, {
				webhookId: webhook.id,
				requestMethod: metadata.method || webhook.http_method,
				requestPath: metadata.path || webhook.uri_path,
				requestBody: typeof requestData.body === 'string' ? requestData.body : JSON.stringify(requestData.body),
				triggeredAt: startTime,
				status: 'running',
				clientIp: metadata.clientIp
			});

			// Emit real-time update
			this.emitUpdate('webhook:triggered', { id: webhook.id, logId, startTime });

			// Create temp file with request data
			const tempDir = tmpdir();
			tempFilePath = join(tempDir, `webhook_${webhook.id}_${startTime}.json`);
			writeFileSync(tempFilePath, JSON.stringify(requestData, null, 2));

			// Determine working directory
			let cwd = webhook.workspace_path;
			if (!cwd || !existsSync(cwd)) {
				const defaultWorkspace = resolve(homedir(), '.dispatch', 'workspaces');
				if (!existsSync(defaultWorkspace)) {
					mkdirSync(defaultWorkspace, { recursive: true });
				}
				cwd = defaultWorkspace;
			}

			// Execute command
			let output = '';
			let errorOutput = '';
			let exitCode = 0;

			try {
				const result = await execAsync(webhook.command, {
					cwd,
					env: {
						...process.env,
						WEBHOOK_REQUEST_FILE: tempFilePath
					},
					timeout: 300000, // 5 minutes max execution time
					maxBuffer: 50 * 1024 * 1024 // 50MB buffer
				});
				output = result.stdout || '';
				errorOutput = result.stderr || '';
			} catch (execError) {
				output = execError.stdout || '';
				errorOutput = execError.stderr || execError.message || '';
				exitCode = typeof execError.code === 'number' ? execError.code : 1;
			}

			const completedAt = Date.now();
			const durationMs = completedAt - startTime;
			const status = exitCode === 0 ? 'success' : 'failed';

			// Update log
			await WebhookRepo.updateWebhookLog(this.db, logId, {
				completed_at: completedAt,
				status,
				exit_code: exitCode,
				output: output.substring(0, 50000),
				error: errorOutput.substring(0, 10000),
				duration_ms: durationMs
			});

			// Update webhook
			await WebhookRepo.updateWebhook(this.db, webhook.id, {
				last_triggered: startTime,
				last_status: status,
				last_error: status === 'failed' ? errorOutput.substring(0, 500) : null,
				trigger_count: (webhook.trigger_count || 0) + 1
			});

			// Emit completion update
			this.emitUpdate('webhook:completed', {
				id: webhook.id,
				logId,
				status,
				exitCode,
				duration: durationMs
			});

			logger.info('WEBHOOK', `Webhook ${webhook.name} completed with status: ${status} (exit code: ${exitCode})`);

			return {
				logId,
				status,
				exitCode,
				output,
				error: errorOutput,
				duration: durationMs
			};
		} catch (error) {
			logger.error('WEBHOOK', `Webhook ${webhook.name} failed:`, error);

			const completedAt = Date.now();
			const durationMs = completedAt - startTime;

			if (logId) {
				await WebhookRepo.updateWebhookLog(this.db, logId, {
					completed_at: completedAt,
					status: 'failed',
					error: error.message,
					duration_ms: durationMs
				});
			}

			await WebhookRepo.updateWebhook(this.db, webhook.id, {
				last_triggered: startTime,
				last_status: 'failed',
				last_error: error.message.substring(0, 500),
				trigger_count: (webhook.trigger_count || 0) + 1
			});

			this.emitUpdate('webhook:error', {
				id: webhook.id,
				logId,
				error: error.message
			});

			return {
				logId,
				status: 'failed',
				exitCode: 1,
				output: '',
				error: error.message,
				duration: durationMs
			};
		} finally {
			// Clean up temp file
			if (tempFilePath && existsSync(tempFilePath)) {
				try {
					unlinkSync(tempFilePath);
				} catch (cleanupError) {
					logger.warn('WEBHOOK', `Failed to cleanup temp file: ${tempFilePath}`);
				}
			}
		}
	}

	/**
	 * Get all webhooks
	 * @param {string} status - Optional status filter
	 * @returns {Promise<Array>} List of webhooks
	 */
	async listWebhooks(status = null) {
		return await WebhookRepo.listWebhooks(this.db, status);
	}

	/**
	 * Get webhook details
	 * @param {string} webhookId - Webhook ID
	 * @returns {Promise<Object>} Webhook details
	 */
	async getWebhook(webhookId) {
		return await WebhookRepo.getWebhook(this.db, webhookId);
	}

	/**
	 * Get logs for a webhook
	 * @param {string} webhookId - Webhook ID
	 * @param {number} limit - Max number of logs
	 * @returns {Promise<Array>} Webhook execution logs
	 */
	async getWebhookLogs(webhookId, limit = 100) {
		return await WebhookRepo.getWebhookLogs(this.db, webhookId, limit);
	}

	/**
	 * Get all recent logs
	 * @param {number} limit - Max number of logs
	 * @returns {Promise<Array>} Recent execution logs
	 */
	async getAllLogs(limit = 100) {
		return await WebhookRepo.getAllWebhookLogs(this.db, limit);
	}

	/**
	 * Clean up old logs (older than specified days)
	 * @param {number} days - Number of days to keep
	 */
	async cleanupOldLogs(days = 30) {
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
		await WebhookRepo.deleteOldWebhookLogs(this.db, cutoffTime);
		logger.info('WEBHOOK', `Cleaned up logs older than ${days} days`);
	}

	/**
	 * Emit real-time update via Socket.IO
	 * @param {string} event - Event name
	 * @param {Object} data - Event data
	 */
	emitUpdate(event, data) {
		if (this.io) {
			this.io.emit(event, data);
		}
	}
}
