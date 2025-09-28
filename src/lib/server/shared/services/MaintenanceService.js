import { logger } from '../utils/logger.js';

/**
 * MaintenanceService - System cleanup and maintenance operations
 *
 * Provides automated cleanup for old events, orphaned sessions, retention policies,
 * and general system maintenance for optimal performance.
 */
export class MaintenanceService {
	constructor(database, eventSourcingService = null, workspaceService = null) {
		this.db = database;
		this.eventSourcing = eventSourcingService;
		this.workspaceService = workspaceService;
		this.maintenanceIntervals = new Map();
		this.isRunning = false;
	}

	/**
	 * Set EventSourcingService for event-related maintenance
	 * @param {EventSourcingService} eventSourcingService
	 */
	setEventSourcingService(eventSourcingService) {
		this.eventSourcing = eventSourcingService;
	}

	/**
	 * Set WorkspaceService for workspace-related maintenance
	 * @param {WorkspaceService} workspaceService
	 */
	setWorkspaceService(workspaceService) {
		this.workspaceService = workspaceService;
	}

	/**
	 * Start automated maintenance with configured intervals
	 * @param {Object} config - Maintenance configuration
	 * @param {number} [config.eventCleanupInterval=3600000] - Event cleanup interval (1 hour)
	 * @param {number} [config.sessionCleanupInterval=1800000] - Session cleanup interval (30 min)
	 * @param {number} [config.workspaceCleanupInterval=86400000] - Workspace cleanup interval (24 hours)
	 * @param {number} [config.logCleanupInterval=86400000] - Log cleanup interval (24 hours)
	 */
	start(config = {}) {
		if (this.isRunning) {
			logger.warn('MAINTENANCE', 'MaintenanceService is already running');
			return;
		}

		const {
			eventCleanupInterval = 3600000, // 1 hour
			sessionCleanupInterval = 1800000, // 30 minutes
			workspaceCleanupInterval = 86400000, // 24 hours
			logCleanupInterval = 86400000 // 24 hours
		} = config;

		this.isRunning = true;

		// Schedule automated maintenance tasks
		this.scheduleMaintenanceTask('eventCleanup', eventCleanupInterval, () => this.cleanupOldEvents());
		this.scheduleMaintenanceTask('sessionCleanup', sessionCleanupInterval, () => this.cleanupOrphanedSessions());
		this.scheduleMaintenanceTask('workspaceCleanup', workspaceCleanupInterval, () => this.cleanupInactiveWorkspaces());
		this.scheduleMaintenanceTask('logCleanup', logCleanupInterval, () => this.cleanupOldLogs());

		logger.info('MAINTENANCE', 'MaintenanceService started with automated scheduling');
	}

	/**
	 * Stop automated maintenance
	 */
	stop() {
		if (!this.isRunning) {
			return;
		}

		// Clear all scheduled intervals
		for (const [taskName, intervalId] of this.maintenanceIntervals) {
			clearInterval(intervalId);
			logger.debug('MAINTENANCE', `Stopped scheduled task: ${taskName}`);
		}

		this.maintenanceIntervals.clear();
		this.isRunning = false;

		logger.info('MAINTENANCE', 'MaintenanceService stopped');
	}

	/**
	 * Schedule a maintenance task
	 * @param {string} taskName - Task identifier
	 * @param {number} interval - Interval in milliseconds
	 * @param {Function} taskFunction - Function to execute
	 */
	scheduleMaintenanceTask(taskName, interval, taskFunction) {
		const intervalId = setInterval(async () => {
			try {
				logger.debug('MAINTENANCE', `Running scheduled task: ${taskName}`);
				await taskFunction();
			} catch (error) {
				logger.error('MAINTENANCE', `Scheduled task ${taskName} failed:`, error);
			}
		}, interval);

		this.maintenanceIntervals.set(taskName, intervalId);
		logger.debug('MAINTENANCE', `Scheduled task ${taskName} every ${interval}ms`);
	}

	/**
	 * Clean up old session events based on retention policy
	 * @param {Object} [options] - Cleanup options
	 * @param {number} [options.maxAge=2592000000] - Max age in ms (30 days default)
	 * @param {number} [options.maxEventsPerSession=10000] - Max events per session
	 * @param {boolean} [options.keepSnapshots=true] - Preserve snapshot events
	 * @returns {Promise<Object>} Cleanup statistics
	 */
	async cleanupOldEvents(options = {}) {
		const {
			maxAge = 30 * 24 * 60 * 60 * 1000, // 30 days
			maxEventsPerSession = 10000,
			keepSnapshots = true
		} = options;

		await this.db.init();

		const startTime = Date.now();
		let totalDeleted = 0;
		const cutoffTime = Date.now() - maxAge;

		try {
			// Get all sessions that might need cleanup
			const sessions = await this.db.all('SELECT DISTINCT run_id FROM session_events');

			for (const session of sessions) {
				const runId = session.run_id;

				// Count events for this session
				const eventCount = await this.db.get(
					'SELECT COUNT(*) as count FROM session_events WHERE run_id = ?',
					[runId]
				);

				let deletedForSession = 0;

				// Clean up by age
				if (maxAge > 0) {
					let sql = 'DELETE FROM session_events WHERE run_id = ? AND ts < ?';
					const params = [runId, cutoffTime];

					// Preserve snapshots if requested
					if (keepSnapshots) {
						sql += ' AND type != ?';
						params.push('snapshot');
					}

					const ageResult = await this.db.run(sql, params);
					deletedForSession += ageResult.changes || 0;
				}

				// Clean up by count (keep only the most recent events)
				if (eventCount.count > maxEventsPerSession) {
					const excessCount = eventCount.count - maxEventsPerSession;

					let sql = `DELETE FROM session_events WHERE run_id = ? AND seq IN (
								SELECT seq FROM session_events WHERE run_id = ?`;

					const params = [runId, runId];

					if (keepSnapshots) {
						sql += ' AND type != ?';
						params.push('snapshot');
					}

					sql += ' ORDER BY seq ASC LIMIT ?)';
					params.push(excessCount);

					const countResult = await this.db.run(sql, params);
					deletedForSession += countResult.changes || 0;
				}

				totalDeleted += deletedForSession;

				if (deletedForSession > 0) {
					logger.debug('MAINTENANCE', `Cleaned ${deletedForSession} events from session ${runId}`);
				}
			}

			const duration = Date.now() - startTime;
			const stats = {
				sessionsProcessed: sessions.length,
				eventsDeleted: totalDeleted,
				duration,
				maxAge,
				maxEventsPerSession
			};

			logger.info('MAINTENANCE', `Event cleanup completed: ${totalDeleted} events deleted from ${sessions.length} sessions in ${duration}ms`);
			return stats;

		} catch (error) {
			logger.error('MAINTENANCE', 'Event cleanup failed:', error);
			throw error;
		}
	}

	/**
	 * Clean up orphaned sessions (sessions without corresponding live processes)
	 * @param {Object} [options] - Cleanup options
	 * @param {number} [options.maxInactiveTime=86400000] - Max inactive time (24 hours)
	 * @param {boolean} [options.markAsStoppedOnly=true] - Only mark as stopped, don't delete
	 * @returns {Promise<Object>} Cleanup statistics
	 */
	async cleanupOrphanedSessions(options = {}) {
		const {
			maxInactiveTime = 24 * 60 * 60 * 1000, // 24 hours
			markAsStoppedOnly = true
		} = options;

		await this.db.init();

		const startTime = Date.now();
		const cutoffTime = Date.now() - maxInactiveTime;

		try {
			// Find sessions that are marked as 'running' but haven't been updated recently
			const orphanedSessions = await this.db.all(
				`SELECT run_id, kind, updated_at FROM sessions
				 WHERE status = 'running' AND updated_at < ?`,
				[cutoffTime]
			);

			let processedCount = 0;

			for (const session of orphanedSessions) {
				try {
					if (markAsStoppedOnly) {
						// Just mark as stopped
						await this.db.updateRunSessionStatus(session.run_id, 'stopped');
						logger.debug('MAINTENANCE', `Marked orphaned session as stopped: ${session.run_id}`);
					} else {
						// Fully delete the session
						await this.db.deleteRunSession(session.run_id);
						logger.debug('MAINTENANCE', `Deleted orphaned session: ${session.run_id}`);
					}
					processedCount++;
				} catch (error) {
					logger.warn('MAINTENANCE', `Failed to clean orphaned session ${session.run_id}:`, error);
				}
			}

			const duration = Date.now() - startTime;
			const stats = {
				orphanedSessions: orphanedSessions.length,
				processedCount,
				duration,
				action: markAsStoppedOnly ? 'marked_stopped' : 'deleted'
			};

			logger.info('MAINTENANCE', `Session cleanup completed: ${processedCount}/${orphanedSessions.length} orphaned sessions processed in ${duration}ms`);
			return stats;

		} catch (error) {
			logger.error('MAINTENANCE', 'Session cleanup failed:', error);
			throw error;
		}
	}

	/**
	 * Clean up inactive workspaces
	 * @param {Object} [options] - Cleanup options
	 * @param {number} [options.inactiveDays=90] - Days of inactivity before cleanup
	 * @param {boolean} [options.archiveOnly=true] - Archive instead of delete
	 * @returns {Promise<Object>} Cleanup statistics
	 */
	async cleanupInactiveWorkspaces(options = {}) {
		const {
			inactiveDays = 90,
			archiveOnly = true
		} = options;

		if (!this.workspaceService) {
			logger.warn('MAINTENANCE', 'WorkspaceService not available for workspace cleanup');
			return { processedCount: 0, skipped: true };
		}

		const startTime = Date.now();

		try {
			let stats;

			if (archiveOnly) {
				// Use WorkspaceService to archive inactive workspaces
				stats = await this.workspaceService.archiveInactiveWorkspaces(inactiveDays);
			} else {
				// Find and delete truly inactive workspaces
				const cutoffTime = Date.now() - (inactiveDays * 24 * 60 * 60 * 1000);

				const inactiveWorkspaces = await this.db.all(
					`SELECT path FROM workspaces
					 WHERE (last_active < ? OR last_active IS NULL)
					 AND created_at < ?`,
					[cutoffTime, cutoffTime]
				);

				let deletedCount = 0;
				for (const workspace of inactiveWorkspaces) {
					try {
						// Check if workspace has no active sessions
						const workspaceData = await this.workspaceService.getWorkspaceByPath(workspace.path);
						if (workspaceData && workspaceData.sessionCounts.running === 0) {
							await this.workspaceService.deleteWorkspace(workspace.path, false);
							deletedCount++;
						}
					} catch (error) {
						logger.warn('MAINTENANCE', `Failed to delete inactive workspace ${workspace.path}:`, error);
					}
				}

				stats = { deletedCount, totalChecked: inactiveWorkspaces.length };
			}

			const duration = Date.now() - startTime;

			logger.info('MAINTENANCE', `Workspace cleanup completed in ${duration}ms:`, stats);
			return { ...stats, duration };

		} catch (error) {
			logger.error('MAINTENANCE', 'Workspace cleanup failed:', error);
			throw error;
		}
	}

	/**
	 * Clean up old application logs
	 * @param {Object} [options] - Cleanup options
	 * @param {number} [options.maxAge=604800000] - Max age in ms (7 days default)
	 * @param {number} [options.maxLogEntries=10000] - Max log entries to keep
	 * @returns {Promise<Object>} Cleanup statistics
	 */
	async cleanupOldLogs(options = {}) {
		const {
			maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days
			maxLogEntries = 10000
		} = options;

		await this.db.init();

		const startTime = Date.now();
		const cutoffTime = Date.now() - maxAge;

		try {
			let totalDeleted = 0;

			// Clean up by age
			if (maxAge > 0) {
				const ageResult = await this.db.run(
					'DELETE FROM logs WHERE timestamp < ?',
					[cutoffTime]
				);
				totalDeleted += ageResult.changes || 0;
			}

			// Clean up by count (keep only the most recent entries)
			const logCount = await this.db.get('SELECT COUNT(*) as count FROM logs');
			if (logCount.count > maxLogEntries) {
				const excessCount = logCount.count - maxLogEntries;
				const countResult = await this.db.run(
					`DELETE FROM logs WHERE id IN (
						SELECT id FROM logs ORDER BY timestamp ASC LIMIT ?
					)`,
					[excessCount]
				);
				totalDeleted += countResult.changes || 0;
			}

			const duration = Date.now() - startTime;
			const stats = {
				logsDeleted: totalDeleted,
				duration,
				maxAge,
				maxLogEntries
			};

			logger.info('MAINTENANCE', `Log cleanup completed: ${totalDeleted} log entries deleted in ${duration}ms`);
			return stats;

		} catch (error) {
			logger.error('MAINTENANCE', 'Log cleanup failed:', error);
			throw error;
		}
	}

	/**
	 * Vacuum database to reclaim space and optimize performance
	 * @returns {Promise<Object>} Vacuum statistics
	 */
	async vacuumDatabase() {
		await this.db.init();

		const startTime = Date.now();

		try {
			// Get database size before vacuum
			const sizeBefore = await this.getDatabaseSize();

			// Run VACUUM command
			await this.db.run('VACUUM');

			// Get database size after vacuum
			const sizeAfter = await this.getDatabaseSize();

			const duration = Date.now() - startTime;
			const spaceReclaimed = sizeBefore - sizeAfter;

			const stats = {
				duration,
				sizeBefore,
				sizeAfter,
				spaceReclaimed
			};

			logger.info('MAINTENANCE', `Database vacuum completed in ${duration}ms: ${spaceReclaimed} bytes reclaimed`);
			return stats;

		} catch (error) {
			logger.error('MAINTENANCE', 'Database vacuum failed:', error);
			throw error;
		}
	}

	/**
	 * Get database file size
	 * @returns {Promise<number>} Database size in bytes
	 */
	async getDatabaseSize() {
		try {
			const { promises: fs } = await import('node:fs');
			const stats = await fs.stat(this.db.dbPath);
			return stats.size;
		} catch (error) {
			logger.warn('MAINTENANCE', 'Could not get database size:', error);
			return 0;
		}
	}

	/**
	 * Run comprehensive maintenance routine
	 * @param {Object} [options] - Maintenance options
	 * @returns {Promise<Object>} Comprehensive maintenance statistics
	 */
	async runComprehensiveMaintenance(options = {}) {
		const startTime = Date.now();

		logger.info('MAINTENANCE', 'Starting comprehensive maintenance routine');

		const results = {
			startTime: new Date(startTime).toISOString(),
			tasks: {}
		};

		try {
			// Run all maintenance tasks
			results.tasks.eventCleanup = await this.cleanupOldEvents(options.events);
			results.tasks.sessionCleanup = await this.cleanupOrphanedSessions(options.sessions);
			results.tasks.workspaceCleanup = await this.cleanupInactiveWorkspaces(options.workspaces);
			results.tasks.logCleanup = await this.cleanupOldLogs(options.logs);

			// Vacuum database at the end
			if (options.vacuum !== false) {
				results.tasks.vacuum = await this.vacuumDatabase();
			}

			const totalDuration = Date.now() - startTime;
			results.totalDuration = totalDuration;
			results.endTime = new Date().toISOString();

			logger.info('MAINTENANCE', `Comprehensive maintenance completed in ${totalDuration}ms`);
			return results;

		} catch (error) {
			const totalDuration = Date.now() - startTime;
			results.totalDuration = totalDuration;
			results.endTime = new Date().toISOString();
			results.error = error.message;

			logger.error('MAINTENANCE', 'Comprehensive maintenance failed:', error);
			throw error;
		}
	}

	/**
	 * Get maintenance service statistics
	 * @returns {Object} Service statistics
	 */
	getStats() {
		return {
			isRunning: this.isRunning,
			scheduledTasks: Array.from(this.maintenanceIntervals.keys()),
			taskCount: this.maintenanceIntervals.size,
			services: {
				eventSourcing: !!this.eventSourcing,
				workspace: !!this.workspaceService,
				database: !!this.db
			}
		};
	}

	/**
	 * Cleanup service resources
	 */
	cleanup() {
		this.stop();
		this.eventSourcing = null;
		this.workspaceService = null;
		logger.info('MAINTENANCE', 'MaintenanceService cleanup complete');
	}
}