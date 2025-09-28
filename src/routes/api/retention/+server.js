import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/shared/auth.js';

/**
 * Retention Policy API - Manages data retention settings and cleanup policies
 * Following the simple summary approach from the specification
 */

export async function GET({ url, locals }) {
	const authKey = url.searchParams.get('authKey') || url.searchParams.get('key') || '';

	if (!validateKey(authKey)) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

	try {
		const policy = await locals.services.database.getRetentionPolicy();

		// Return current policy or defaults
		return json({
			sessionRetentionDays: policy?.sessionRetentionDays || 30,
			logRetentionDays: policy?.logRetentionDays || 7,
			autoCleanupEnabled: policy?.autoCleanupEnabled ?? true,
			updatedAt: policy?.updatedAt || null
		});
	} catch (error) {
		console.error('[Retention API] Failed to get retention policy:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function PUT({ request, locals }) {
	try {
		const body = await request.json();
		const { authKey, sessionRetentionDays, logRetentionDays, autoCleanupEnabled } = body;

		if (!validateKey(authKey)) {
			return json({ error: 'Invalid authentication key' }, { status: 401 });
		}

		// Validate retention periods
		if (sessionRetentionDays !== undefined) {
			if (!Number.isInteger(sessionRetentionDays) || sessionRetentionDays < 1 || sessionRetentionDays > 365) {
				return json({ error: 'Session retention days must be between 1 and 365' }, { status: 400 });
			}
		}

		if (logRetentionDays !== undefined) {
			if (!Number.isInteger(logRetentionDays) || logRetentionDays < 1 || logRetentionDays > 90) {
				return json({ error: 'Log retention days must be between 1 and 90' }, { status: 400 });
			}
		}

		// Update retention policy
		const updatedPolicy = await locals.services.database.updateRetentionPolicy({
			sessionRetentionDays,
			logRetentionDays,
			autoCleanupEnabled
		});

		return json(updatedPolicy);
	} catch (error) {
		console.error('[Retention API] Failed to update retention policy:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	try {
		const body = await request.json();
		const { action, authKey, sessionRetentionDays, logRetentionDays } = body;

		if (!validateKey(authKey)) {
			return json({ error: 'Invalid authentication key' }, { status: 401 });
		}

		if (action === 'preview') {
			// Validate parameters for preview
			if (!Number.isInteger(sessionRetentionDays) || sessionRetentionDays < 1 || sessionRetentionDays > 365) {
				return json({ error: 'Session retention days must be between 1 and 365' }, { status: 400 });
			}

			if (!Number.isInteger(logRetentionDays) || logRetentionDays < 1 || logRetentionDays > 90) {
				return json({ error: 'Log retention days must be between 1 and 90' }, { status: 400 });
			}

			// Calculate what would be deleted with new policy
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - sessionRetentionDays);

			// Count sessions older than retention period
			const sessionQuery = `
				SELECT COUNT(*) as count
				FROM sessions
				WHERE created_at < ?
			`;
			const sessionResult = await locals.services.database.get(sessionQuery, [cutoffDate.toISOString()]);
			const sessionsToDelete = sessionResult?.count || 0;

			// Count session events (logs) older than retention period
			const logCutoffDate = new Date();
			logCutoffDate.setDate(logCutoffDate.getDate() - logRetentionDays);

			const logQuery = `
				SELECT COUNT(*) as count
				FROM session_events
				WHERE timestamp < ?
			`;
			const logResult = await locals.services.database.get(logQuery, [logCutoffDate.toISOString()]);
			const logsToDelete = logResult?.count || 0;

			// Generate simple summary as per specification
			const summary = `Will delete ${sessionsToDelete} sessions older than ${sessionRetentionDays} days and ${logsToDelete} log entries older than ${logRetentionDays} days`;

			return json({
				summary,
				sessionsToDelete,
				logsToDelete,
				sessionRetentionDays,
				logRetentionDays
			});
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('[Retention API] Failed to preview retention changes:', error);
		return json({ error: error.message }, { status: 500 });
	}
}