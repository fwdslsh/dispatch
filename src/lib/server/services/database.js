import { logger } from '../shared/utils/logger.js';

/**
 * Database service for managing onboarding, preferences, and retention policy data
 */
export class DatabaseService {
	constructor(dbManager) {
		this.db = dbManager;
	}

	// ========== Onboarding State Management ==========

	/**
	 * Get onboarding state for a user
	 * @param {string} userId
	 */
	async getOnboardingState(userId) {
		const row = await this.db.get('SELECT * FROM onboarding_state WHERE user_id = ?', [userId]);
		if (row && row.completed_steps) {
			row.completed_steps = JSON.parse(row.completed_steps);
		}
		return row;
	}

	/**
	 * Create or update onboarding state
	 * @param {string} userId
	 * @param {object} state
	 */
	async saveOnboardingState(userId, state) {
		const completedSteps = JSON.stringify(state.completedSteps || []);
		const sql = `
			INSERT INTO onboarding_state (
				user_id, current_step, completed_steps, is_complete,
				first_workspace_id, created_at, completed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				current_step = excluded.current_step,
				completed_steps = excluded.completed_steps,
				is_complete = excluded.is_complete,
				first_workspace_id = excluded.first_workspace_id,
				completed_at = excluded.completed_at
		`;

		await this.db.run(sql, [
			userId,
			state.currentStep || 'auth',
			completedSteps,
			state.isComplete || false,
			state.firstWorkspaceId || null,
			state.createdAt || new Date().toISOString(),
			state.completedAt || null
		]);

		logger.info('DATABASE', `Saved onboarding state for user ${userId}`);
	}

	/**
	 * Mark onboarding as complete
	 * @param {string} userId
	 * @param {string} firstWorkspaceId
	 */
	async completeOnboarding(userId, firstWorkspaceId) {
		await this.saveOnboardingState(userId, {
			currentStep: 'complete',
			completedSteps: ['auth', 'workspace', 'settings', 'complete'],
			isComplete: true,
			firstWorkspaceId,
			completedAt: new Date().toISOString()
		});
	}

	// ========== User Preferences Management ==========

	/**
	 * Get user preferences
	 * @param {string} userId
	 */
	async getUserPreferences(userId) {
		const row = await this.db.get('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
		return row || this.getDefaultPreferences();
	}

	/**
	 * Get default preferences
	 */
	getDefaultPreferences() {
		return {
			onboarding_completed: false,
			theme_preference: 'auto',
			workspace_display_mode: 'list',
			show_advanced_features: false,
			session_auto_connect: true,
			updated_at: new Date().toISOString()
		};
	}

	/**
	 * Save user preferences
	 * @param {string} userId
	 * @param {object} preferences
	 */
	async saveUserPreferences(userId, preferences) {
		const sql = `
			INSERT INTO user_preferences (
				user_id, onboarding_completed, theme_preference,
				workspace_display_mode, show_advanced_features,
				session_auto_connect, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				onboarding_completed = excluded.onboarding_completed,
				theme_preference = excluded.theme_preference,
				workspace_display_mode = excluded.workspace_display_mode,
				show_advanced_features = excluded.show_advanced_features,
				session_auto_connect = excluded.session_auto_connect,
				updated_at = excluded.updated_at
		`;

		await this.db.run(sql, [
			userId,
			preferences.onboardingCompleted ?? preferences.onboarding_completed ?? false,
			preferences.themePreference ?? preferences.theme_preference ?? 'auto',
			preferences.workspaceDisplayMode ?? preferences.workspace_display_mode ?? 'list',
			preferences.showAdvancedFeatures ?? preferences.show_advanced_features ?? false,
			preferences.sessionAutoConnect ?? preferences.session_auto_connect ?? true,
			new Date().toISOString()
		]);

		logger.info('DATABASE', `Saved preferences for user ${userId}`);
	}

	// ========== Retention Policy Management ==========

	/**
	 * Get retention policy for a user
	 * @param {string} userId
	 */
	async getRetentionPolicy(userId) {
		const row = await this.db.get('SELECT * FROM retention_policies WHERE user_id = ?', [userId]);
		return row || this.getDefaultRetentionPolicy(userId);
	}

	/**
	 * Get default retention policy
	 */
	getDefaultRetentionPolicy(userId) {
		return {
			id: `policy_${userId}`,
			user_id: userId,
			session_retention_days: 30,
			log_retention_days: 7,
			auto_cleanup_enabled: true,
			last_cleanup_run: null,
			preview_summary: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
	}

	/**
	 * Save retention policy
	 * @param {string} userId
	 * @param {object} policy
	 */
	async saveRetentionPolicy(userId, policy) {
		const policyId = policy.id || `policy_${userId}`;
		const sql = `
			INSERT INTO retention_policies (
				id, user_id, session_retention_days, log_retention_days,
				auto_cleanup_enabled, last_cleanup_run, preview_summary,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				session_retention_days = excluded.session_retention_days,
				log_retention_days = excluded.log_retention_days,
				auto_cleanup_enabled = excluded.auto_cleanup_enabled,
				last_cleanup_run = excluded.last_cleanup_run,
				preview_summary = excluded.preview_summary,
				updated_at = excluded.updated_at
		`;

		await this.db.run(sql, [
			policyId,
			userId,
			policy.sessionRetentionDays ?? policy.session_retention_days ?? 30,
			policy.logRetentionDays ?? policy.log_retention_days ?? 7,
			policy.autoCleanupEnabled ?? policy.auto_cleanup_enabled ?? true,
			policy.lastCleanupRun ?? policy.last_cleanup_run ?? null,
			policy.previewSummary ?? policy.preview_summary ?? null,
			policy.createdAt ?? policy.created_at ?? new Date().toISOString(),
			new Date().toISOString()
		]);

		logger.info('DATABASE', `Saved retention policy for user ${userId}`);
		return { id: policyId };
	}

	/**
	 * Generate retention preview
	 * @param {string} userId
	 * @param {number} sessionDays
	 * @param {number} logDays
	 */
	async generateRetentionPreview(userId, sessionDays, logDays) {
		// Count sessions that would be deleted
		const sessionCutoff = Date.now() - sessionDays * 24 * 60 * 60 * 1000;
		const sessionResult = await this.db.get(
			'SELECT COUNT(*) as count FROM sessions WHERE created_at < ?',
			[sessionCutoff]
		);

		// Count logs that would be deleted
		const logCutoff = Date.now() - logDays * 24 * 60 * 60 * 1000;
		const logResult = await this.db.get('SELECT COUNT(*) as count FROM logs WHERE timestamp < ?', [
			logCutoff
		]);

		const sessionsToDelete = sessionResult?.count || 0;
		const logsToDelete = logResult?.count || 0;

		// Create simple summary
		const summary = `Will delete ${sessionsToDelete} sessions older than ${sessionDays} days and ${logsToDelete} log entries older than ${logDays} days`;

		return {
			summary,
			sessionsToDelete,
			logsToDelete,
			estimatedSpaceSaved: `${Math.round((sessionsToDelete * 50 + logsToDelete * 2) / 1024)}MB`
		};
	}

	/**
	 * Execute retention cleanup
	 * @param {string} userId
	 */
	async executeRetentionCleanup(userId) {
		const policy = await this.getRetentionPolicy(userId);

		// Delete old sessions
		const sessionCutoff = Date.now() - policy.session_retention_days * 24 * 60 * 60 * 1000;
		const sessionResult = await this.db.run('DELETE FROM sessions WHERE created_at < ?', [
			sessionCutoff
		]);

		// Delete old logs
		const logCutoff = Date.now() - policy.log_retention_days * 24 * 60 * 60 * 1000;
		const logResult = await this.db.run('DELETE FROM logs WHERE timestamp < ?', [logCutoff]);

		// Update last cleanup run
		await this.db.run('UPDATE retention_policies SET last_cleanup_run = ? WHERE user_id = ?', [
			new Date().toISOString(),
			userId
		]);

		logger.info(
			'DATABASE',
			`Cleanup completed: ${sessionResult.changes} sessions, ${logResult.changes} logs deleted`
		);

		return {
			sessionsDeleted: sessionResult.changes,
			logsDeleted: logResult.changes,
			spaceSaved: `${Math.round((sessionResult.changes * 50 + logResult.changes * 2) / 1024)}MB`,
			executedAt: new Date().toISOString()
		};
	}

	// ========== Navigation History Management ==========

	/**
	 * Get navigation history for a client
	 * @param {string} clientId
	 */
	async getNavigationHistory(clientId) {
		const row = await this.db.get(
			'SELECT navigation_history FROM workspace_layout WHERE client_id = ?',
			[clientId]
		);

		if (row && row.navigation_history) {
			return JSON.parse(row.navigation_history);
		}
		return [];
	}

	/**
	 * Update navigation history
	 * @param {string} clientId
	 * @param {string} runId
	 * @param {string} workspacePath
	 */
	async updateNavigationHistory(clientId, runId, workspacePath) {
		const history = await this.getNavigationHistory(clientId);

		// Add to history (remove if exists, then add to front)
		const filtered = history.filter((h) => h.workspacePath !== workspacePath);
		filtered.unshift({ workspacePath, runId, timestamp: Date.now() });

		// Keep only last 10 entries
		const trimmed = filtered.slice(0, 10);

		await this.db.run('UPDATE workspace_layout SET navigation_history = ? WHERE client_id = ?', [
			JSON.stringify(trimmed),
			clientId
		]);

		logger.debug('DATABASE', `Updated navigation history for client ${clientId}`);
	}
}

export default DatabaseService;
