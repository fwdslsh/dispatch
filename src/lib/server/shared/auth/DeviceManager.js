import { createDAOs } from '../db/models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Device management for authentication system
 * Handles device registration, trust, and cleanup
 */
export class DeviceManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
	}

	/**
	 * Register or update a device for a user
	 */
	async registerDevice(deviceData) {
		try {
			const {
				userId,
				deviceName,
				deviceFingerprint,
				ipAddress,
				userAgent,
				isTrusted = false
			} = deviceData;

			// Validate required fields
			if (!userId || !deviceName) {
				throw new Error('User ID and device name are required');
			}

			// Generate fingerprint if not provided
			let fingerprint = deviceFingerprint;
			if (!fingerprint) {
				fingerprint = this.generateDeviceFingerprint({
					userAgent,
					ipAddress,
					userId: userId.toString()
				});
			}

			// Create or update device
			const device = await this.daos.userDevices.createOrUpdate({
				userId,
				deviceName,
				deviceFingerprint: fingerprint,
				ipAddress,
				userAgent,
				isTrusted
			});

			// Log device registration event
			await this.daos.authEvents.logDeviceRegistered(
				userId,
				device.id,
				ipAddress,
				userAgent,
				deviceName
			);

			logger.info(
				'DEVICE_MANAGER',
				`Registered device for user ${userId}: ${deviceName} (ID: ${device.id})`
			);

			return device;
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Device registration error: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get all devices for a user
	 */
	async getUserDevices(userId, options = {}) {
		try {
			const { includeInactive = false, page = 1, limit = 50 } = options;

			const result = await this.daos.userDevices.getDevicesForUser(userId, {
				page,
				limit
			});

			// Add session information for each device
			for (const device of result.devices) {
				const sessions = await this.daos.authSessions.getByUserId(userId, false);
				device.activeSessions = sessions.filter((s) => s.deviceId === device.id).length;
			}

			return result;
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to get user devices: ${error.message}`);
			return { devices: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } };
		}
	}

	/**
	 * Get device by fingerprint
	 */
	async getDeviceByFingerprint(fingerprint) {
		try {
			return await this.daos.userDevices.getByFingerprint(fingerprint);
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to get device by fingerprint: ${error.message}`);
			return null;
		}
	}

	/**
	 * Update device trust status
	 */
	async setDeviceTrust(deviceId, isTrusted, adminUserId = null) {
		try {
			await this.daos.userDevices.updateTrustStatus(deviceId, isTrusted);

			const device = await this.daos.userDevices.getById(deviceId);
			if (device) {
				// Log trust change event
				await this.daos.authEvents.create({
					userId: device.userId,
					deviceId: device.id,
					eventType: isTrusted ? 'device_trusted' : 'device_untrusted',
					details: {
						adminUserId,
						deviceName: device.deviceName
					}
				});

				logger.info('DEVICE_MANAGER', `Set device ${deviceId} trust status to: ${isTrusted}`);
			}

			return { success: true };
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to set device trust: ${error.message}`);
			return { success: false, error: 'Failed to update device trust status' };
		}
	}

	/**
	 * Update device name
	 */
	async updateDeviceName(deviceId, newName, userId = null) {
		try {
			await this.daos.userDevices.updateDeviceName(deviceId, newName);

			// Log name change event
			if (userId) {
				await this.daos.authEvents.create({
					userId,
					deviceId,
					eventType: 'device_renamed',
					details: {
						newName,
						oldName: null // Could fetch old name if needed
					}
				});
			}

			logger.info('DEVICE_MANAGER', `Updated device ${deviceId} name to: ${newName}`);

			return { success: true };
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to update device name: ${error.message}`);
			return { success: false, error: 'Failed to update device name' };
		}
	}

	/**
	 * Revoke a device (delete and revoke all sessions)
	 */
	async revokeDevice(deviceId, adminUserId = null) {
		try {
			const device = await this.daos.userDevices.getById(deviceId);
			if (!device) {
				return { success: false, error: 'Device not found' };
			}

			// Log device revocation event before deletion
			await this.daos.authEvents.create({
				userId: device.userId,
				deviceId: device.id,
				eventType: 'device_revoked',
				details: {
					deviceName: device.deviceName,
					adminUserId,
					reason: 'manual_revocation'
				}
			});

			// Delete device (this will also revoke sessions via DAO)
			await this.daos.userDevices.delete(deviceId);

			logger.info('DEVICE_MANAGER', `Revoked device: ${device.deviceName} (ID: ${deviceId})`);

			return { success: true };
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to revoke device: ${error.message}`);
			return { success: false, error: 'Failed to revoke device' };
		}
	}

	/**
	 * Check device policy compliance
	 */
	async validateDevicePolicy(userId, deviceId = null) {
		try {
			const authConfig = await this.db.getSettingsByCategory('auth');
			const maxDevices = authConfig.max_devices_per_user || 10;

			const userDevices = await this.daos.userDevices.getByUserId(userId, false);

			// Check device count limit
			if (userDevices.length >= maxDevices) {
				// If we're checking a specific device, see if it's already registered
				if (deviceId) {
					const existingDevice = userDevices.find((d) => d.id === deviceId);
					if (existingDevice) {
						return { compliant: true, reason: 'device_already_registered' };
					}
				}

				return {
					compliant: false,
					reason: 'max_devices_exceeded',
					maxDevices,
					currentDevices: userDevices.length
				};
			}

			return { compliant: true };
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Device policy validation error: ${error.message}`);
			return { compliant: false, reason: 'policy_validation_error' };
		}
	}

	/**
	 * Clean up old inactive devices
	 */
	async cleanupInactiveDevices(daysOld = 90) {
		try {
			const deletedCount = await this.daos.userDevices.cleanupInactive(daysOld);

			if (deletedCount > 0) {
				logger.info(
					'DEVICE_MANAGER',
					`Cleaned up ${deletedCount} inactive devices older than ${daysOld} days`
				);
			}

			return deletedCount;
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to cleanup inactive devices: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Get device statistics for admin dashboard
	 */
	async getDeviceStats() {
		try {
			return await this.daos.userDevices.getStats();
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to get device stats: ${error.message}`);
			return { total: 0, trusted: 0, recent: 0, active: 0 };
		}
	}

	/**
	 * List all devices for admin interface
	 */
	async listAllDevices(options = {}) {
		try {
			const { page = 1, limit = 50, userId = null, trustedOnly = false } = options;

			const devices = await this.daos.userDevices.listAllDevices({
				page,
				limit,
				userId,
				trustedOnly
			});

			// Add additional context for each device
			for (const device of devices) {
				// Get recent activity
				const recentEvents = await this.daos.authEvents.getByDeviceId(device.id, {
					limit: 5,
					days: 30
				});
				device.recentActivity = recentEvents.map((event) => ({
					type: event.eventType,
					timestamp: event.createdAt,
					ipAddress: event.ipAddress
				}));
			}

			return devices;
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Failed to list all devices: ${error.message}`);
			return [];
		}
	}

	/**
	 * Generate device fingerprint from available data
	 */
	generateDeviceFingerprint(data) {
		const { userAgent = '', ipAddress = '', userId = '', timestamp = Date.now() } = data;

		// Create a hash from available device information
		const fingerprintData = [userAgent, ipAddress, userId, timestamp.toString()].join('|');

		// Simple hash function (in production, use crypto.createHash)
		let hash = 0;
		for (let i = 0; i < fingerprintData.length; i++) {
			const char = fingerprintData.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}

		return `device_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
	}

	/**
	 * Analyze device security
	 */
	async analyzeDeviceSecurity(deviceId) {
		try {
			const device = await this.daos.userDevices.getById(deviceId);
			if (!device) {
				return { error: 'Device not found' };
			}

			// Get device sessions and events
			const [sessions, events] = await Promise.all([
				this.daos.authSessions.getByUserId(device.userId, true),
				this.daos.authEvents.getByDeviceId(deviceId, { limit: 50, days: 30 })
			]);

			const deviceSessions = sessions.filter((s) => s.deviceId === deviceId);

			// Security analysis
			const analysis = {
				deviceId: device.id,
				deviceName: device.deviceName,
				isTrusted: device.isTrusted,
				lastSeenAt: device.lastSeenAt,
				securityScore: 0,
				warnings: [],
				recommendations: []
			};

			// Calculate security score (0-100)
			let score = 50; // Base score

			// Trust bonus
			if (device.isTrusted) {
				score += 20;
			} else {
				analysis.warnings.push('Device is not marked as trusted');
			}

			// Recent activity bonus
			const daysSinceLastSeen = Math.floor(
				(Date.now() - device.lastSeenAt.getTime()) / (24 * 60 * 60 * 1000)
			);
			if (daysSinceLastSeen <= 7) {
				score += 15;
			} else if (daysSinceLastSeen <= 30) {
				score += 5;
			} else {
				score -= 10;
				analysis.warnings.push(`Device not seen for ${daysSinceLastSeen} days`);
			}

			// Multiple active sessions penalty
			const activeSessions = deviceSessions.filter((s) => s.isActive && s.expiresAt > new Date());
			if (activeSessions.length > 3) {
				score -= 10;
				analysis.warnings.push(`Device has ${activeSessions.length} active sessions`);
			}

			// Failed login attempts penalty
			const failedLogins = events.filter((e) => e.eventType === 'failed_login');
			if (failedLogins.length > 5) {
				score -= 15;
				analysis.warnings.push(`${failedLogins.length} failed login attempts from this device`);
			}

			// IP address consistency bonus
			const uniqueIPs = new Set(events.filter((e) => e.ipAddress).map((e) => e.ipAddress));
			if (uniqueIPs.size === 1) {
				score += 10;
			} else if (uniqueIPs.size > 5) {
				score -= 5;
				analysis.warnings.push(`Device used from ${uniqueIPs.size} different IP addresses`);
			}

			analysis.securityScore = Math.max(0, Math.min(100, score));

			// Generate recommendations
			if (!device.isTrusted && analysis.securityScore > 70) {
				analysis.recommendations.push('Consider marking this device as trusted');
			}

			if (activeSessions.length > 1) {
				analysis.recommendations.push('Review multiple active sessions for security');
			}

			if (daysSinceLastSeen > 60) {
				analysis.recommendations.push('Consider removing this inactive device');
			}

			return analysis;
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Device security analysis error: ${error.message}`);
			return { error: 'Failed to analyze device security' };
		}
	}

	/**
	 * Bulk operations for device management
	 */
	async bulkOperations(operation, deviceIds, options = {}) {
		try {
			const results = [];

			for (const deviceId of deviceIds) {
				let result;
				switch (operation) {
					case 'trust':
						result = await this.setDeviceTrust(deviceId, true, options.adminUserId);
						break;
					case 'untrust':
						result = await this.setDeviceTrust(deviceId, false, options.adminUserId);
						break;
					case 'revoke':
						result = await this.revokeDevice(deviceId, options.adminUserId);
						break;
					default:
						result = { success: false, error: 'Unknown operation' };
				}

				results.push({
					deviceId,
					...result
				});
			}

			const successCount = results.filter((r) => r.success).length;
			logger.info(
				'DEVICE_MANAGER',
				`Bulk ${operation}: ${successCount}/${deviceIds.length} devices processed successfully`
			);

			return {
				success: successCount > 0,
				results,
				processed: deviceIds.length,
				successful: successCount,
				failed: deviceIds.length - successCount
			};
		} catch (error) {
			logger.error('DEVICE_MANAGER', `Bulk operation error: ${error.message}`);
			return {
				success: false,
				error: 'Bulk operation failed',
				results: []
			};
		}
	}
}
