/**
 * Dynamic webhook trigger route
 * Handles incoming webhook requests at /hooks/*
 * Authentication: Requires valid API key via Authorization: Bearer header
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * Handle webhook request for any HTTP method
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
async function handleWebhook(event) {
	try {
		// Authentication is handled by hooks.server.js middleware
		// Requires valid API key via Authorization: Bearer header
		if (!event.locals.auth?.authenticated) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const { webhookExecutor } = event.locals.services;
		if (!webhookExecutor) {
			logger.error('WEBHOOK_ROUTE', 'WebhookExecutorService not available');
			return json({ error: 'Webhook service unavailable' }, { status: 503 });
		}

		const uriPath = `/hooks/${event.params.path}`;
		const method = event.request.method;

		// Find matching webhook
		const webhook = await webhookExecutor.findMatchingWebhook(uriPath, method);
		if (!webhook) {
			logger.warn('WEBHOOK_ROUTE', `No webhook found for ${method} ${uriPath}`);
			return json({ error: 'Webhook not found' }, { status: 404 });
		}

		// Check if webhook is active
		if (webhook.status !== 'active') {
			logger.warn('WEBHOOK_ROUTE', `Webhook ${webhook.id} is disabled`);
			return json({ error: 'Webhook is disabled' }, { status: 404 });
		}

		// Build request data for temp file (body and query only)
		let bodyText = '';
		try {
			bodyText = await event.request.text();
		} catch (e) {
			// No body or already consumed
		}

		const requestData = {
			query: Object.fromEntries(event.url.searchParams),
			body: bodyText
		};

		// Get client IP
		let clientIp = event.getClientAddress();
		try {
			// Try to get forwarded IP if behind proxy
			const forwardedFor = event.request.headers.get('x-forwarded-for');
			if (forwardedFor) {
				clientIp = forwardedFor.split(',')[0].trim();
			}
		} catch (e) {
			// Use original IP
		}

		// Execute webhook
		const result = await webhookExecutor.executeWebhook(webhook, requestData, {
			clientIp,
			method,
			path: uriPath
		});

		logger.info('WEBHOOK_ROUTE', `Webhook ${webhook.name} executed: ${result.status}`);

		// Return response based on execution result
		return new Response(result.output || '', {
			status: result.exitCode === 0 ? 200 : 500,
			headers: {
				'Content-Type': 'text/plain',
				'X-Webhook-Execution-Id': String(result.logId),
				'X-Webhook-Status': result.status,
				'X-Webhook-Duration-Ms': String(result.duration)
			}
		});
	} catch (error) {
		logger.error('WEBHOOK_ROUTE', 'Webhook execution failed:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function GET(event) {
	return handleWebhook(event);
}

/** @type {import('./$types').RequestHandler} */
export async function POST(event) {
	return handleWebhook(event);
}

/** @type {import('./$types').RequestHandler} */
export async function PUT(event) {
	return handleWebhook(event);
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE(event) {
	return handleWebhook(event);
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH(event) {
	return handleWebhook(event);
}
