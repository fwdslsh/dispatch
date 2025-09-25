import { createDAOs } from './models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Manages database cleanup jobs for expired sessions, old events, and maintenance
 */
export class CleanupManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
		this.intervals = new Map();
		this.isRunning = false;
	}

	/**
	 * Start all cleanup jobs with default intervals
	 */
	start(options = {}) {
		const {
			expiredSessionsInterval = 60 * 60 * 1000, // 1 hour
			oldEventsInterval = 24 * 60 * 60 * 1000, // 24 hours
			oldDevicesInterval = 24 * 60 * 60 * 1000, // 24 hours
			oldCertificatesInterval = 24 * 60 * 60 * 1000, // 24 hours
			unusedCredentialsInterval = 7 * 24 * 60 * 60 * 1000 // 7 days
		} = options;

		if (this.isRunning) {
			logger.warn('CLEANUP', 'Cleanup manager is already running');
			return;
		}

		this.isRunning = true;

		// Schedule cleanup jobs
		this.scheduleJob(
			'expiredSessions',
			() => this.cleanupExpiredSessions(),
			expiredSessionsInterval
		);
		this.scheduleJob('oldEvents', () => this.cleanupOldEvents(), oldEventsInterval);
		this.scheduleJob('oldDevices', () => this.cleanupOldDevices(), oldDevicesInterval);
		this.scheduleJob(
			'oldCertificates',
			() => this.cleanupOldCertificates(),
			oldCertificatesInterval
		);
		this.scheduleJob(
			'unusedCredentials',
			() => this.cleanupUnusedCredentials(),
			unusedCredentialsInterval
		);

		// Run initial cleanup after a short delay
		setTimeout(() => this.runAllCleanups(), 10000); // 10 seconds

		logger.info('CLEANUP', 'Started database cleanup manager with scheduled jobs');
	}

	/**
	 * Stop all cleanup jobs
	 */
	stop() {
		if (!this.isRunning) {
			return;
		}

		// Clear all intervals
		for (const [jobName, intervalId] of this.intervals) {
			clearInterval(intervalId);
			logger.debug('CLEANUP', `Stopped cleanup job: ${jobName}`);
		}

		this.intervals.clear();
		this.isRunning = false;

		logger.info('CLEANUP', 'Stopped database cleanup manager');
	}

	/**
	 * Schedule a cleanup job with interval
	 */
	scheduleJob(jobName, jobFunction, intervalMs) {
		const intervalId = setInterval(async () => {
			try {
				await jobFunction();
			} catch (error) {
				logger.error('CLEANUP', `Error in scheduled job '${jobName}': ${error.message}`);
			}
		}, intervalMs);

		this.intervals.set(jobName, intervalId);
		logger.debug('CLEANUP', `Scheduled cleanup job '${jobName}' every ${intervalMs}ms`);
	}

	/**
	 * Run all cleanup jobs once
	 */
	async runAllCleanups() {
		logger.info('CLEANUP', 'Running all database cleanup jobs');

		const results = {
			expiredSessions: 0,
			oldEvents: 0,
			oldDevices: 0,
			oldCertificates: 0,
			unusedCredentials: 0
		};

		try {
			results.expiredSessions = await this.cleanupExpiredSessions();
			results.oldEvents = await this.cleanupOldEvents();
			results.oldDevices = await this.cleanupOldDevices();
			results.oldCertificates = await this.cleanupOldCertificates();
			results.unusedCredentials = await this.cleanupUnusedCredentials();

			logger.info('CLEANUP', 'Completed all cleanup jobs', results);
		} catch (error) {
			logger.error('CLEANUP', `Error running cleanup jobs: ${error.message}`);
		}

		return results;
	}

	/**
	 * Clean up expired authentication sessions
	 */
	async cleanupExpiredSessions() {
		try {
			const deletedCount = await this.daos.authSessions.cleanupExpired();

			if (deletedCount > 0) {
				logger.info('CLEANUP', `Cleaned up ${deletedCount} expired authentication sessions`);
			}

			return deletedCount;
		} catch (error) {
			logger.error('CLEANUP', `Failed to cleanup expired sessions: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Clean up old authentication events (default: 90 days)
	 */
	async cleanupOldEvents(daysOld = 90) {
		try {
			const deletedCount = await this.daos.authEvents.cleanupOldEvents(daysOld);

			if (deletedCount > 0) {
				logger.info(
					'CLEANUP',
					`Cleaned up ${deletedCount} authentication events older than ${daysOld} days`
				);
			}

			return deletedCount;
		} catch (error) {
			logger.error('CLEANUP', `Failed to cleanup old events: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Clean up old inactive devices (default: 90 days)
	 */
	async cleanupOldDevices(daysOld = 90) {
		try {
			const deletedCount = await this.daos.userDevices.cleanupInactive(daysOld);

			if (deletedCount > 0) {
				logger.info(
					'CLEANUP',
					`Cleaned up ${deletedCount} inactive devices older than ${daysOld} days`
				);
			}

			return deletedCount;
		} catch (error) {
			logger.error('CLEANUP', `Failed to cleanup old devices: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Clean up old inactive certificates (default: 90 days)
	 */
	async cleanupOldCertificates(daysOld = 90) {
		try {
			const deletedCount = await this.daos.certificates.cleanupOldCertificates(daysOld);

			if (deletedCount > 0) {
				logger.info(
					'CLEANUP',
					`Cleaned up ${deletedCount} old certificates older than ${daysOld} days`
				);
			}

			return deletedCount;
		} catch (error) {
			logger.error('CLEANUP', `Failed to cleanup old certificates: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Clean up unused WebAuthn credentials (default: 365 days)
	 */
	async cleanupUnusedCredentials(daysOld = 365) {
		try {
			const deletedCount = await this.daos.webauthnCredentials.cleanupUnusedCredentials(daysOld);

			if (deletedCount > 0) {
				logger.info(
					'CLEANUP',
					`Cleaned up ${deletedCount} unused WebAuthn credentials older than ${daysOld} days`
				);
			}

			return deletedCount;
		} catch (error) {
			logger.error('CLEANUP', `Failed to cleanup unused credentials: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Clean up expired OAuth tokens (default: 90 days)
	 */
	async cleanupExpiredOAuthTokens(daysOld = 90) {
		try {
			const deletedCount = await this.daos.oauthAccounts.cleanupExpiredTokens(daysOld);

			if (deletedCount > 0) {
				logger.info(
					'CLEANUP',
					`Cleaned up ${deletedCount} expired OAuth tokens older than ${daysOld} days`
				);
			}

			return deletedCount;
		} catch (error) {
			logger.error('CLEANUP', `Failed to cleanup expired OAuth tokens: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Vacuum database to reclaim space after cleanup
	 */
	async vacuumDatabase() {
		try {
			logger.info('CLEANUP', 'Starting database vacuum to reclaim space');
			await this.db.run('VACUUM');
			logger.info('CLEANUP', 'Database vacuum completed');
		} catch (error) {
			logger.error('CLEANUP', `Failed to vacuum database: ${error.message}`);
		}
	}

	/**
	 * Get cleanup statistics
	 */
	async getCleanupStats() {
		try {
			const stats = {
				authSessions: await this.daos.authSessions.getStats(),
				authEvents: await this.daos.authEvents.getStats(30), // Last 30 days
				userDevices: await this.daos.userDevices.getStats(),
				certificates: await this.daos.certificates.getStats(),
				webauthnCredentials: await this.daos.webauthnCredentials.getStats(),
				oauthAccounts: await this.daos.oauthAccounts.getStats()
			};

			// Calculate cleanup recommendations
			const now = Date.now();
			const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
			const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

			const recommendations = [];

			if (stats.authSessions.expired > 100) {
				recommendations.push('High number of expired sessions - consider running session cleanup');
			}

			if (stats.userDevices.total - stats.userDevices.recent > 50) {
				recommendations.push('Many inactive devices - consider running device cleanup');
			}

			if (stats.certificates.expired > 5) {
				recommendations.push('Multiple expired certificates - consider certificate cleanup');
			}

			return {
				stats,
				recommendations,
				lastCleanup: new Date().toISOString(),
				isRunning: this.isRunning,
				activeJobs: Array.from(this.intervals.keys())
			};
		} catch (error) {
			logger.error('CLEANUP', `Failed to get cleanup stats: ${error.message}`);
			return {
				error: error.message,
				isRunning: this.isRunning
			};
		}
	}

	/**
	 * Run manual cleanup with custom parameters
	 */
	async runManualCleanup(options = {}) {
		const {
			sessions = true,
			events = true,
			devices = true,
			certificates = true,
			credentials = true,
			oauthTokens = true,
			vacuum = false,
			eventsDaysOld = 90,
			devicesDaysOld = 90,
			certificatesDaysOld = 90,
			credentialsDaysOld = 365,
			oauthDaysOld = 90
		} = options;

		logger.info('CLEANUP', 'Starting manual cleanup with options', options);

		const results = {};

		try {
			if (sessions) {
				results.expiredSessions = await this.cleanupExpiredSessions();
			}

			if (events) {
				results.oldEvents = await this.cleanupOldEvents(eventsDaysOld);
			}

			if (devices) {
				results.oldDevices = await this.cleanupOldDevices(devicesDaysOld);
			}

			if (certificates) {
				results.oldCertificates = await this.cleanupOldCertificates(certificatesDaysOld);
			}

			if (credentials) {
				results.unusedCredentials = await this.cleanupUnusedCredentials(credentialsDaysOld);
			}

			if (oauthTokens) {
				results.expiredOAuthTokens = await this.cleanupExpiredOAuthTokens(oauthDaysOld);
			}

			if (vacuum) {
				await this.vacuumDatabase();
				results.vacuum = true;
			}

			logger.info('CLEANUP', 'Manual cleanup completed', results);
			return results;
		} catch (error) {
			logger.error('CLEANUP', `Manual cleanup failed: ${error.message}`);
			throw error;
		}
	}
}
