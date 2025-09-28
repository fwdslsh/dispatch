import { logger } from '../utils/logger.js';

/**
 * RetentionService - User-configurable retention policy enforcement
 *
 * Provides flexible retention policies for events, sessions, logs, and workspaces
 * with user-defined quotas and automated cleanup based on configurable rules.
 */
export class RetentionService {
	constructor(database, maintenanceService = null, eventSourcingService = null) {
		this.db = database;
		this.maintenanceService = maintenanceService;
		this.eventSourcing = eventSourcingService;
		this.policies = new Map();
		this.isInitialized = false;
		this.enforcementInterval = null;
	}

	/**
	 * Initialize retention service
	 */
	async init() {
		if (this.isInitialized) return;

		await this.db.init();

		// Create retention policies table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS retention_policies (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				target_type TEXT NOT NULL,  -- 'events', 'sessions', 'logs', 'workspaces'
				policy_config TEXT NOT NULL, -- JSON configuration
				is_enabled BOOLEAN DEFAULT 1,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				last_enforced INTEGER
			)
		`);

		// Create retention enforcement log
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS retention_enforcement_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				policy_id TEXT NOT NULL,
				enforced_at INTEGER NOT NULL,
				items_processed INTEGER DEFAULT 0,
				items_retained INTEGER DEFAULT 0,
				items_deleted INTEGER DEFAULT 0,
				execution_time INTEGER DEFAULT 0,
				error_message TEXT,
				FOREIGN KEY (policy_id) REFERENCES retention_policies(id)
			)
		`);

		// Load existing policies
		await this.loadPolicies();

		// Create default policies if none exist
		await this.createDefaultPolicies();

		this.isInitialized = true;
		logger.info('RETENTION', `RetentionService initialized with ${this.policies.size} policies`);
	}

	/**
	 * Load retention policies from database
	 */
	async loadPolicies() {
		const policies = await this.db.all('SELECT * FROM retention_policies WHERE is_enabled = 1');

		this.policies.clear();
		for (const policy of policies) {
			try {
				const config = JSON.parse(policy.policy_config);
				this.policies.set(policy.id, {
					...policy,
					config
				});
			} catch (error) {
				logger.warn('RETENTION', `Failed to parse policy config for ${policy.id}:`, error);
			}
		}
	}

	/**
	 * Create default retention policies
	 */
	async createDefaultPolicies() {
		const existingPolicies = await this.db.get('SELECT COUNT(*) as count FROM retention_policies');
		if (existingPolicies.count > 0) {
			return; // Policies already exist
		}

		const defaultPolicies = [
			{
				id: 'events_age_limit',
				name: 'Event Age Limit',
				description: 'Remove events older than 30 days',
				targetType: 'events',
				config: {
					maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
					preserveSnapshots: true,
					batchSize: 1000
				}
			},
			{
				id: 'events_count_limit',
				name: 'Event Count Limit',
				description: 'Keep only the latest 10,000 events per session',
				targetType: 'events',
				config: {
					maxEventsPerSession: 10000,
					preserveSnapshots: true
				}
			},
			{
				id: 'sessions_cleanup',
				name: 'Session Cleanup',
				description: 'Clean up stopped sessions older than 7 days',
				targetType: 'sessions',
				config: {
					maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
					includeStatuses: ['stopped', 'error'],
					preserveRunning: true
				}
			},
			{
				id: 'logs_retention',
				name: 'Log Retention',
				description: 'Keep application logs for 14 days',
				targetType: 'logs',
				config: {
					maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
					maxEntries: 50000,
					preserveLevels: ['error', 'warn']
				}
			},
			{
				id: 'workspace_archival',
				name: 'Workspace Archival',
				description: 'Archive workspaces inactive for 90 days',
				targetType: 'workspaces',
				config: {
					inactiveDays: 90,
					action: 'archive', // 'archive' or 'delete'
					preserveActive: true
				}
			}
		];

		for (const policy of defaultPolicies) {
			await this.createPolicy(policy);
		}

		logger.info('RETENTION', `Created ${defaultPolicies.length} default retention policies`);
	}

	/**
	 * Create a new retention policy
	 * @param {Object} policyData - Policy configuration
	 * @returns {Promise<string>} Policy ID
	 */
	async createPolicy(policyData) {
		await this.init();

		const {
			id = `policy_${Date.now()}`,
			name,
			description,
			targetType,
			config,
			isEnabled = true
		} = policyData;

		const now = Date.now();

		await this.db.run(
			`INSERT INTO retention_policies
			 (id, name, description, target_type, policy_config, is_enabled, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[id, name, description, targetType, JSON.stringify(config), isEnabled, now, now]
		);

		// Add to memory
		this.policies.set(id, {
			id,
			name,
			description,
			target_type: targetType,
			policy_config: JSON.stringify(config),
			config,
			is_enabled: isEnabled,
			created_at: now,
			updated_at: now
		});

		logger.info('RETENTION', `Created retention policy: ${id} (${name})`);
		return id;
	}

	/**
	 * Update an existing retention policy
	 * @param {string} policyId - Policy ID
	 * @param {Object} updates - Policy updates
	 * @returns {Promise<boolean>} Success status
	 */
	async updatePolicy(policyId, updates) {
		await this.init();

		const policy = this.policies.get(policyId);
		if (!policy) {
			throw new Error(`Retention policy not found: ${policyId}`);
		}

		const updateFields = [];
		const updateValues = [];

		if (updates.name !== undefined) {
			updateFields.push('name = ?');
			updateValues.push(updates.name);
		}

		if (updates.description !== undefined) {
			updateFields.push('description = ?');
			updateValues.push(updates.description);
		}

		if (updates.config !== undefined) {
			updateFields.push('policy_config = ?');
			updateValues.push(JSON.stringify(updates.config));
		}

		if (updates.isEnabled !== undefined) {
			updateFields.push('is_enabled = ?');
			updateValues.push(updates.isEnabled);
		}

		updateFields.push('updated_at = ?');
		updateValues.push(Date.now());

		updateValues.push(policyId);

		await this.db.run(
			`UPDATE retention_policies SET ${updateFields.join(', ')} WHERE id = ?`,
			updateValues
		);

		// Reload policies
		await this.loadPolicies();

		logger.info('RETENTION', `Updated retention policy: ${policyId}`);
		return true;
	}

	/**
	 * Delete a retention policy
	 * @param {string} policyId - Policy ID
	 * @returns {Promise<boolean>} Success status
	 */
	async deletePolicy(policyId) {
		await this.init();

		await this.db.run('DELETE FROM retention_policies WHERE id = ?', [policyId]);
		await this.db.run('DELETE FROM retention_enforcement_log WHERE policy_id = ?', [policyId]);

		this.policies.delete(policyId);

		logger.info('RETENTION', `Deleted retention policy: ${policyId}`);
		return true;
	}

	/**
	 * Enforce a specific retention policy
	 * @param {string} policyId - Policy ID to enforce
	 * @param {Object} [options] - Enforcement options
	 * @returns {Promise<Object>} Enforcement results
	 */
	async enforcePolicy(policyId, options = {}) {
		await this.init();

		const policy = this.policies.get(policyId);
		if (!policy || !policy.is_enabled) {
			throw new Error(`Retention policy not found or disabled: ${policyId}`);
		}

		const startTime = Date.now();
		let result = { processed: 0, retained: 0, deleted: 0, error: null };

		try {
			switch (policy.target_type) {
				case 'events':
					result = await this.enforceEventPolicy(policy, options);
					break;
				case 'sessions':
					result = await this.enforceSessionPolicy(policy, options);
					break;
				case 'logs':
					result = await this.enforceLogPolicy(policy, options);
					break;
				case 'workspaces':
					result = await this.enforceWorkspacePolicy(policy, options);
					break;
				default:
					throw new Error(`Unknown policy target type: ${policy.target_type}`);
			}

			// Update last enforced timestamp
			await this.db.run('UPDATE retention_policies SET last_enforced = ? WHERE id = ?', [
				Date.now(),
				policyId
			]);
		} catch (error) {
			result.error = error.message;
			logger.error('RETENTION', `Policy enforcement failed for ${policyId}:`, error);
		}

		const executionTime = Date.now() - startTime;

		// Log enforcement
		await this.db.run(
			`INSERT INTO retention_enforcement_log
			 (policy_id, enforced_at, items_processed, items_retained, items_deleted, execution_time, error_message)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				policyId,
				Date.now(),
				result.processed,
				result.retained,
				result.deleted,
				executionTime,
				result.error
			]
		);

		logger.info(
			'RETENTION',
			`Enforced policy ${policyId}: ${result.deleted}/${result.processed} items deleted in ${executionTime}ms`
		);

		return {
			...result,
			executionTime,
			policyId
		};
	}

	/**
	 * Enforce event retention policy
	 * @param {Object} policy - Policy configuration
	 * @param {Object} options - Options
	 * @returns {Promise<Object>} Results
	 */
	async enforceEventPolicy(policy, options = {}) {
		const config = policy.config;
		const { dryRun = false } = options;

		if (!this.maintenanceService) {
			throw new Error('MaintenanceService required for event policy enforcement');
		}

		const cleanupOptions = {
			maxAge: config.maxAge,
			maxEventsPerSession: config.maxEventsPerSession,
			keepSnapshots: config.preserveSnapshots
		};

		if (dryRun) {
			// Count what would be deleted
			let totalToDelete = 0;
			const sessions = await this.db.all('SELECT DISTINCT run_id FROM session_events');

			for (const session of sessions) {
				const cutoffTime = Date.now() - (config.maxAge || 0);

				// Count by age
				if (config.maxAge) {
					const ageCount = await this.db.get(
						'SELECT COUNT(*) as count FROM session_events WHERE run_id = ? AND ts < ?',
						[session.run_id, cutoffTime]
					);
					totalToDelete += ageCount.count;
				}

				// Count by excess
				if (config.maxEventsPerSession) {
					const totalCount = await this.db.get(
						'SELECT COUNT(*) as count FROM session_events WHERE run_id = ?',
						[session.run_id]
					);
					if (totalCount.count > config.maxEventsPerSession) {
						totalToDelete += totalCount.count - config.maxEventsPerSession;
					}
				}
			}

			return { processed: sessions.length, retained: 0, deleted: totalToDelete };
		}

		const result = await this.maintenanceService.cleanupOldEvents(cleanupOptions);
		return {
			processed: result.sessionsProcessed,
			retained: 0,
			deleted: result.eventsDeleted
		};
	}

	/**
	 * Enforce session retention policy
	 * @param {Object} policy - Policy configuration
	 * @param {Object} options - Options
	 * @returns {Promise<Object>} Results
	 */
	async enforceSessionPolicy(policy, options = {}) {
		const config = policy.config;
		const { dryRun = false } = options;

		const cutoffTime = Date.now() - config.maxAge;
		const statuses = config.includeStatuses || ['stopped', 'error'];

		// Find sessions to clean up
		const sessionsToCleanup = await this.db.all(
			`SELECT run_id FROM sessions
			 WHERE status IN (${statuses.map(() => '?').join(',')})
			 AND updated_at < ?`,
			[...statuses, cutoffTime]
		);

		if (dryRun) {
			return {
				processed: sessionsToCleanup.length,
				retained: 0,
				deleted: sessionsToCleanup.length
			};
		}

		let deleted = 0;
		for (const session of sessionsToCleanup) {
			try {
				await this.db.deleteRunSession(session.run_id);
				deleted++;
			} catch (error) {
				logger.warn('RETENTION', `Failed to delete session ${session.run_id}:`, error);
			}
		}

		return { processed: sessionsToCleanup.length, retained: 0, deleted };
	}

	/**
	 * Enforce log retention policy
	 * @param {Object} policy - Policy configuration
	 * @param {Object} options - Options
	 * @returns {Promise<Object>} Results
	 */
	async enforceLogPolicy(policy, options = {}) {
		const config = policy.config;
		const { dryRun = false } = options;

		if (!this.maintenanceService) {
			throw new Error('MaintenanceService required for log policy enforcement');
		}

		const cleanupOptions = {
			maxAge: config.maxAge,
			maxLogEntries: config.maxEntries
		};

		if (dryRun) {
			// Count what would be deleted
			let totalToDelete = 0;

			if (config.maxAge) {
				const cutoffTime = Date.now() - config.maxAge;
				const ageCount = await this.db.get(
					'SELECT COUNT(*) as count FROM logs WHERE timestamp < ?',
					[cutoffTime]
				);
				totalToDelete += ageCount.count;
			}

			if (config.maxEntries) {
				const totalCount = await this.db.get('SELECT COUNT(*) as count FROM logs');
				if (totalCount.count > config.maxEntries) {
					totalToDelete += totalCount.count - config.maxEntries;
				}
			}

			return { processed: 1, retained: 0, deleted: totalToDelete };
		}

		const result = await this.maintenanceService.cleanupOldLogs(cleanupOptions);
		return {
			processed: 1,
			retained: 0,
			deleted: result.logsDeleted
		};
	}

	/**
	 * Enforce workspace retention policy
	 * @param {Object} policy - Policy configuration
	 * @param {Object} options - Options
	 * @returns {Promise<Object>} Results
	 */
	async enforceWorkspacePolicy(policy, options = {}) {
		const config = policy.config;
		const { dryRun = false } = options;

		if (!this.maintenanceService?.workspaceService) {
			throw new Error('WorkspaceService required for workspace policy enforcement');
		}

		if (dryRun) {
			// Count inactive workspaces
			const cutoffTime = Date.now() - config.inactiveDays * 24 * 60 * 60 * 1000;
			const inactiveWorkspaces = await this.db.all(
				'SELECT path FROM workspaces WHERE last_active < ? OR last_active IS NULL',
				[cutoffTime]
			);

			return {
				processed: inactiveWorkspaces.length,
				retained: 0,
				deleted: inactiveWorkspaces.length
			};
		}

		if (config.action === 'archive') {
			const result = await this.maintenanceService.workspaceService.archiveInactiveWorkspaces(
				config.inactiveDays
			);
			return {
				processed: result.totalChecked,
				retained: result.totalChecked - result.archivedCount,
				deleted: result.archivedCount
			};
		} else if (config.action === 'delete') {
			// Implementation for workspace deletion would go here
			logger.warn(
				'RETENTION',
				'Workspace deletion not implemented in workspace policy enforcement'
			);
			return { processed: 0, retained: 0, deleted: 0 };
		}

		return { processed: 0, retained: 0, deleted: 0 };
	}

	/**
	 * Enforce all enabled retention policies
	 * @param {Object} [options] - Enforcement options
	 * @returns {Promise<Array>} Array of enforcement results
	 */
	async enforceAllPolicies(options = {}) {
		await this.init();

		const enabledPolicies = Array.from(this.policies.values()).filter((p) => p.is_enabled);
		const results = [];

		for (const policy of enabledPolicies) {
			try {
				const result = await this.enforcePolicy(policy.id, options);
				results.push(result);
			} catch (error) {
				logger.error('RETENTION', `Failed to enforce policy ${policy.id}:`, error);
				results.push({
					policyId: policy.id,
					error: error.message,
					processed: 0,
					retained: 0,
					deleted: 0
				});
			}
		}

		logger.info('RETENTION', `Enforced ${results.length} retention policies`);
		return results;
	}

	/**
	 * Start automated retention enforcement
	 * @param {number} [interval=3600000] - Enforcement interval in ms (1 hour default)
	 */
	startAutomaticEnforcement(interval = 3600000) {
		if (this.enforcementInterval) {
			clearInterval(this.enforcementInterval);
		}

		this.enforcementInterval = setInterval(async () => {
			try {
				logger.debug('RETENTION', 'Running automatic retention enforcement');
				await this.enforceAllPolicies();
			} catch (error) {
				logger.error('RETENTION', 'Automatic retention enforcement failed:', error);
			}
		}, interval);

		logger.info('RETENTION', `Started automatic retention enforcement every ${interval}ms`);
	}

	/**
	 * Stop automated retention enforcement
	 */
	stopAutomaticEnforcement() {
		if (this.enforcementInterval) {
			clearInterval(this.enforcementInterval);
			this.enforcementInterval = null;
			logger.info('RETENTION', 'Stopped automatic retention enforcement');
		}
	}

	/**
	 * Get retention policy statistics
	 * @returns {Promise<Object>} Statistics
	 */
	async getStats() {
		await this.init();

		const totalPolicies = await this.db.get('SELECT COUNT(*) as count FROM retention_policies');
		const enabledPolicies = await this.db.get(
			'SELECT COUNT(*) as count FROM retention_policies WHERE is_enabled = 1'
		);

		const recentEnforcements = await this.db.all(
			`SELECT policy_id, COUNT(*) as enforcement_count, MAX(enforced_at) as last_enforced
			 FROM retention_enforcement_log
			 WHERE enforced_at > ?
			 GROUP BY policy_id`,
			[Date.now() - 24 * 60 * 60 * 1000] // Last 24 hours
		);

		const totalEnforcements = await this.db.get(
			'SELECT COUNT(*) as count FROM retention_enforcement_log'
		);

		return {
			totalPolicies: totalPolicies.count,
			enabledPolicies: enabledPolicies.count,
			automaticEnforcement: !!this.enforcementInterval,
			totalEnforcements: totalEnforcements.count,
			recentEnforcements: recentEnforcements.length,
			policies: Array.from(this.policies.values()).map((p) => ({
				id: p.id,
				name: p.name,
				targetType: p.target_type,
				enabled: p.is_enabled,
				lastEnforced: p.last_enforced ? new Date(p.last_enforced).toISOString() : null
			}))
		};
	}

	/**
	 * Get enforcement history for a policy
	 * @param {string} policyId - Policy ID
	 * @param {number} [limit=50] - Number of records to return
	 * @returns {Promise<Array>} Enforcement history
	 */
	async getEnforcementHistory(policyId, limit = 50) {
		await this.init();

		const history = await this.db.all(
			`SELECT * FROM retention_enforcement_log
			 WHERE policy_id = ?
			 ORDER BY enforced_at DESC
			 LIMIT ?`,
			[policyId, limit]
		);

		return history.map((record) => ({
			id: record.id,
			enforcedAt: new Date(record.enforced_at).toISOString(),
			itemsProcessed: record.items_processed,
			itemsRetained: record.items_retained,
			itemsDeleted: record.items_deleted,
			executionTime: record.execution_time,
			error: record.error_message
		}));
	}

	/**
	 * List all retention policies
	 * @returns {Promise<Array>} List of policies
	 */
	async listPolicies() {
		await this.init();

		return Array.from(this.policies.values()).map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			targetType: p.target_type,
			config: p.config,
			enabled: p.is_enabled,
			createdAt: new Date(p.created_at).toISOString(),
			updatedAt: new Date(p.updated_at).toISOString(),
			lastEnforced: p.last_enforced ? new Date(p.last_enforced).toISOString() : null
		}));
	}

	/**
	 * Cleanup service resources
	 */
	cleanup() {
		this.stopAutomaticEnforcement();
		this.policies.clear();
		logger.info('RETENTION', 'RetentionService cleanup complete');
	}
}
