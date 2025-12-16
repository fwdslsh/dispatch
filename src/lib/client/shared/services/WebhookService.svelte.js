/**
 * WebhookService - Frontend service for webhook management (MVVM pattern)
 * Manages state, API calls, and real-time updates for webhooks
 */

import { validateUriPath, validateHttpMethod } from '$lib/shared/webhook-utils.js';

export class WebhookService {
	webhooks = $state([]);
	logs = $state([]);
	loading = $state(false);
	error = $state(null);
	selectedWebhookId = $state(null);

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

		socket.on('webhook:created', (webhook) => {
			this.webhooks = [webhook, ...this.webhooks];
		});

		socket.on('webhook:updated', (webhook) => {
			const index = this.webhooks.findIndex((w) => w.id === webhook.id);
			if (index !== -1) {
				this.webhooks[index] = webhook;
				this.webhooks = [...this.webhooks];
			}
		});

		socket.on('webhook:deleted', ({ id }) => {
			this.webhooks = this.webhooks.filter((w) => w.id !== id);
		});

		socket.on('webhook:triggered', ({ id, logId, startTime }) => {
			const webhook = this.webhooks.find((w) => w.id === id);
			if (webhook) {
				webhook.lastTriggered = startTime;
				this.webhooks = [...this.webhooks];
			}
		});

		socket.on('webhook:completed', ({ id, status, exitCode, duration }) => {
			const webhook = this.webhooks.find((w) => w.id === id);
			if (webhook) {
				webhook.lastStatus = status;
				webhook.triggerCount = (webhook.triggerCount || 0) + 1;
				this.webhooks = [...this.webhooks];
			}

			// Refresh logs if viewing this webhook
			if (this.selectedWebhookId === id) {
				this.loadWebhookLogs(id);
			}
		});

		socket.on('webhook:error', ({ id, error }) => {
			const webhook = this.webhooks.find((w) => w.id === id);
			if (webhook) {
				webhook.lastStatus = 'failed';
				webhook.lastError = error;
				this.webhooks = [...this.webhooks];
			}
		});
	}

	/**
	 * Load all webhooks
	 */
	async loadWebhooks(status = null) {
		this.loading = true;
		this.error = null;

		try {
			const url = status ? `/api/webhooks?status=${status}` : '/api/webhooks';
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to load webhooks: ${response.statusText}`);
			}

			const data = await response.json();
			this.webhooks = data.webhooks || [];
		} catch (err) {
			this.error = err.message;
			console.error('Failed to load webhooks:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Create a new webhook
	 */
	async createWebhook(webhookData) {
		this.loading = true;
		this.error = null;

		try {
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

			const response = await fetch('/api/webhooks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(webhookData)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to create webhook');
			}

			const webhook = await response.json();
			this.webhooks = [webhook, ...this.webhooks];
			return webhook;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Update a webhook
	 */
	async updateWebhook(webhookId, updates) {
		this.loading = true;
		this.error = null;

		try {
			// Validate URI path if provided
			if (updates.uriPath) {
				const pathValidation = validateUriPath(updates.uriPath);
				if (!pathValidation.valid) {
					throw new Error(pathValidation.error);
				}
			}

			// Validate HTTP method if provided
			if (updates.httpMethod) {
				const methodValidation = validateHttpMethod(updates.httpMethod);
				if (!methodValidation.valid) {
					throw new Error(methodValidation.error);
				}
			}

			const response = await fetch(`/api/webhooks/${webhookId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to update webhook');
			}

			const webhook = await response.json();

			// Update in local state
			const index = this.webhooks.findIndex((w) => w.id === webhookId);
			if (index !== -1) {
				this.webhooks[index] = webhook;
				this.webhooks = [...this.webhooks];
			}

			return webhook;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Enable a webhook
	 */
	async enableWebhook(webhookId) {
		return await this.updateWebhook(webhookId, { status: 'active' });
	}

	/**
	 * Disable a webhook
	 */
	async disableWebhook(webhookId) {
		return await this.updateWebhook(webhookId, { status: 'disabled' });
	}

	/**
	 * Delete a webhook
	 */
	async deleteWebhook(webhookId) {
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch(`/api/webhooks/${webhookId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to delete webhook');
			}

			// Remove from local state
			this.webhooks = this.webhooks.filter((w) => w.id !== webhookId);
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load logs for a specific webhook
	 */
	async loadWebhookLogs(webhookId, limit = 100) {
		this.selectedWebhookId = webhookId;
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch(`/api/webhooks/${webhookId}/logs?limit=${limit}`);

			if (!response.ok) {
				throw new Error(`Failed to load logs: ${response.statusText}`);
			}

			const data = await response.json();
			this.logs = data.logs || [];
		} catch (err) {
			this.error = err.message;
			console.error('Failed to load webhook logs:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load all recent logs
	 */
	async loadAllLogs(limit = 100) {
		this.selectedWebhookId = null;
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch(`/api/webhooks/logs?limit=${limit}`);

			if (!response.ok) {
				throw new Error(`Failed to load logs: ${response.statusText}`);
			}

			const data = await response.json();
			this.logs = data.logs || [];
		} catch (err) {
			this.error = err.message;
			console.error('Failed to load webhook logs:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Get webhook by ID
	 */
	getWebhook(webhookId) {
		return this.webhooks.find((w) => w.id === webhookId);
	}

	/**
	 * Clear error
	 */
	clearError() {
		this.error = null;
	}

	/**
	 * Validate URI path
	 */
	validatePath(path) {
		return validateUriPath(path);
	}

	/**
	 * Validate HTTP method
	 */
	validateMethod(method) {
		return validateHttpMethod(method);
	}
}
