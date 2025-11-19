import { json } from '@sveltejs/kit';
import { UnauthorizedError, BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

/**
 * Maintenance API - Data cleanup operations based on user preferences
 * Consolidated approach: reads retention policy from user preferences (maintenance category)
 */

export async function POST({ request, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError();
		}

		const body = await request.json();
		const { action } = body;

		if (!action) {
			throw new BadRequestError('Missing action parameter', 'MISSING_ACTION');
		}

		// Get maintenance preferences from settings repository
		const { settingsRepository } = locals.services;
		const maintenancePrefs = await settingsRepository.getByCategory('maintenance');

		// Use defaults if no preferences are set
		const sessionRetentionDays = maintenancePrefs.sessionRetentionDays || 30;
		const logRetentionDays = maintenancePrefs.logRetentionDays || 7;
		const autoCleanupEnabled = maintenancePrefs.autoCleanupEnabled ?? true;

		if (action === 'preview') {
			// Calculate what would be deleted based on current maintenance preferences
			const preview = await calculateCleanupPreview(
				locals.services.database,
				sessionRetentionDays,
				logRetentionDays
			);

			return json({
				success: true,
				preview: {
					...preview,
					sessionRetentionDays,
					logRetentionDays,
					autoCleanupEnabled
				}
			});
		}

		if (action === 'cleanup') {
			// Execute cleanup based on current maintenance preferences
			const cleanup = await executeCleanup(
				locals.services.database,
				sessionRetentionDays,
				logRetentionDays
			);

			return json({
				success: true,
				cleanup: {
					...cleanup,
					sessionRetentionDays,
					logRetentionDays
				}
			});
		}

		throw new BadRequestError('Invalid action. Must be "preview" or "cleanup"', 'INVALID_ACTION');
	} catch (err) {
		handleApiError(err, 'POST /api/maintenance');
	}
}

/**
 * Calculate cleanup preview without making changes
 * @param {Object} database - DatabaseManager instance
 * @param {number} sessionDays - Session retention days
 * @param {number} logDays - Log retention days
 * @returns {Promise<Object>} Preview results
 */
async function calculateCleanupPreview(database, sessionDays, logDays) {
	// Calculate cutoff dates
	const sessionCutoff = new Date();
	sessionCutoff.setDate(sessionCutoff.getDate() - sessionDays);

	const logCutoff = new Date();
	logCutoff.setDate(logCutoff.getDate() - logDays);

	// Count sessions older than retention period
	const sessionQuery = `
		SELECT COUNT(*) as count
		FROM sessions
		WHERE created_at < ?
	`;
	const sessionResult = await database.get(sessionQuery, [sessionCutoff.getTime()]);
	const sessionsToDelete = sessionResult?.count || 0;

	// Count session events (logs) older than retention period
	const eventQuery = `
		SELECT COUNT(*) as count
		FROM session_events
		WHERE ts < ?
	`;
	const eventResult = await database.get(eventQuery, [logCutoff.getTime()]);
	const eventsToDelete = eventResult?.count || 0;

	// Count application logs older than retention period
	const logQuery = `
		SELECT COUNT(*) as count
		FROM logs
		WHERE timestamp < ?
	`;
	const logResult = await database.get(logQuery, [logCutoff.getTime()]);
	const logsToDelete = logResult?.count || 0;

	// Generate summary
	const summary = `Will delete ${sessionsToDelete} sessions older than ${sessionDays} days, ${eventsToDelete} session events older than ${logDays} days, and ${logsToDelete} log entries older than ${logDays} days`;

	return {
		sessionsToDelete,
		eventsToDelete,
		logsToDelete,
		summary
	};
}

/**
 * Execute cleanup operations
 * @param {Object} database - DatabaseManager instance
 * @param {number} sessionDays - Session retention days
 * @param {number} logDays - Log retention days
 * @returns {Promise<Object>} Cleanup results
 */
async function executeCleanup(database, sessionDays, logDays) {
	// Calculate cutoff dates
	const sessionCutoff = new Date();
	sessionCutoff.setDate(sessionCutoff.getDate() - sessionDays);

	const logCutoff = new Date();
	logCutoff.setDate(logCutoff.getDate() - logDays);

	// Delete old session events first (foreign key constraint)
	const eventResult = await database.run('DELETE FROM session_events WHERE ts < ?', [
		logCutoff.getTime()
	]);
	const eventsDeleted = eventResult.changes || 0;

	// Delete old sessions
	const sessionResult = await database.run('DELETE FROM sessions WHERE created_at < ?', [
		sessionCutoff.getTime()
	]);
	const sessionsDeleted = sessionResult.changes || 0;

	// Delete old application logs
	const logResult = await database.run('DELETE FROM logs WHERE timestamp < ?', [
		logCutoff.getTime()
	]);
	const logsDeleted = logResult.changes || 0;

	return {
		sessionsDeleted,
		eventsDeleted,
		logsDeleted,
		summary: `Deleted ${sessionsDeleted} sessions, ${eventsDeleted} session events, and ${logsDeleted} log entries`
	};
}
