/**
 * Monitoring and Alerting Service for Security Events and Certificate Management
 * Provides comprehensive monitoring, alerting, and health check capabilities
 */

import EventEmitter from 'events';
import { promises as fs } from 'fs';
import path from 'path';

export class MonitoringService extends EventEmitter {
	constructor(options = {}) {
		super();

		this.config = {
			alertThresholds: {
				failedLogins: 10, // Alert after 10 failed logins in window
				sessionExpiry: 15 * 60 * 1000, // 15 minutes before expiry
				certificateExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days before expiry
				diskUsage: 85, // Alert at 85% disk usage
				memoryUsage: 80, // Alert at 80% memory usage
				responseTime: 5000, // Alert if response time > 5s
			},
			monitoringInterval: 60000, // 1 minute
			retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
			...options
		};

		this.metrics = {
			authEvents: new Map(), // Track auth events by type
			certificateStatus: new Map(), // Track certificate expiry
			systemHealth: {
				lastCheck: null,
				status: 'unknown',
				issues: []
			},
			alerts: new Map() // Active alerts
		};

		this.monitoringInterval = null;
		this.isRunning = false;
	}

	/**
	 * Start monitoring service
	 */
	async start() {
		if (this.isRunning) {
			return;
		}

		this.isRunning = true;
		console.log('MonitoringService: Starting monitoring and alerting...');

		// Start periodic health checks
		this.monitoringInterval = setInterval(() => {
			this.performHealthCheck();
		}, this.config.monitoringInterval);

		// Perform initial health check
		await this.performHealthCheck();

		this.emit('monitoring:started');
	}

	/**
	 * Stop monitoring service
	 */
	async stop() {
		if (!this.isRunning) {
			return;
		}

		this.isRunning = false;

		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}

		console.log('MonitoringService: Stopped monitoring');
		this.emit('monitoring:stopped');
	}

	/**
	 * Record authentication event for monitoring
	 */
	recordAuthEvent(event) {
		const eventType = `${event.type}_${event.success ? 'success' : 'failure'}`;
		const timestamp = new Date();

		if (!this.metrics.authEvents.has(eventType)) {
			this.metrics.authEvents.set(eventType, []);
		}

		this.metrics.authEvents.get(eventType).push({
			timestamp,
			userId: event.userId,
			ip: event.ip,
			userAgent: event.userAgent,
			details: event.details || {}
		});

		// Clean old events (keep last 24 hours for analysis)
		this.cleanupOldEvents(eventType, 24 * 60 * 60 * 1000);

		// Check for alert conditions
		this.checkAuthAlerts(eventType);

		this.emit('auth:event', { type: eventType, event });
	}

	/**
	 * Update certificate status for monitoring
	 */
	updateCertificateStatus(certificates) {
		const now = new Date();

		certificates.forEach(cert => {
			const expiryDate = new Date(cert.expiresAt);
			const timeUntilExpiry = expiryDate.getTime() - now.getTime();

			this.metrics.certificateStatus.set(cert.id, {
				domain: cert.domain,
				type: cert.type,
				expiresAt: cert.expiresAt,
				timeUntilExpiry,
				status: this.getCertificateStatus(timeUntilExpiry),
				lastChecked: now
			});

			// Check for expiry alerts
			this.checkCertificateAlerts(cert.id);
		});

		this.emit('certificates:updated', { count: certificates.length });
	}

	/**
	 * Record system metrics for monitoring
	 */
	recordSystemMetrics(metrics) {
		const timestamp = new Date();

		// Update system health
		this.metrics.systemHealth = {
			lastCheck: timestamp,
			status: this.calculateSystemStatus(metrics),
			metrics,
			issues: this.identifySystemIssues(metrics)
		};

		// Check for system alerts
		this.checkSystemAlerts(metrics);

		this.emit('system:metrics', { timestamp, metrics });
	}

	/**
	 * Get current monitoring status
	 */
	getMonitoringStatus() {
		const activeAlerts = Array.from(this.metrics.alerts.values())
			.filter(alert => alert.status === 'active');

		return {
			isRunning: this.isRunning,
			lastHealthCheck: this.metrics.systemHealth.lastCheck,
			systemStatus: this.metrics.systemHealth.status,
			activeAlerts: activeAlerts.length,
			totalEvents: this.getTotalEventCount(),
			certificatesMonitored: this.metrics.certificateStatus.size,
			uptime: process.uptime()
		};
	}

	/**
	 * Get security dashboard data
	 */
	getSecurityDashboard() {
		const now = new Date();
		const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		// Calculate metrics for last 24 hours
		const authEvents = this.getAuthEventsInPeriod(last24h, now);
		const failedLogins = authEvents.filter(e => e.type.includes('failure')).length;
		const successfulLogins = authEvents.filter(e => e.type.includes('success')).length;

		// Certificate status summary
		const certificates = Array.from(this.metrics.certificateStatus.values());
		const expiringSoon = certificates.filter(cert =>
			cert.timeUntilExpiry <= this.config.alertThresholds.certificateExpiry
		).length;

		// Active security alerts
		const securityAlerts = Array.from(this.metrics.alerts.values())
			.filter(alert => alert.category === 'security' && alert.status === 'active');

		return {
			overview: {
				systemStatus: this.metrics.systemHealth.status,
				lastUpdated: now.toISOString()
			},
			authentication: {
				totalEvents: authEvents.length,
				successfulLogins,
				failedLogins,
				successRate: successfulLogins / Math.max(1, successfulLogins + failedLogins)
			},
			certificates: {
				total: certificates.length,
				expiringSoon,
				healthy: certificates.length - expiringSoon
			},
			alerts: {
				active: securityAlerts.length,
				recent: securityAlerts.slice(0, 5) // Last 5 alerts
			},
			trends: this.calculateSecurityTrends()
		};
	}

	/**
	 * Perform comprehensive health check
	 */
	async performHealthCheck() {
		const healthCheck = {
			timestamp: new Date(),
			checks: {}
		};

		try {
			// Database connectivity check
			healthCheck.checks.database = await this.checkDatabaseHealth();

			// Authentication system check
			healthCheck.checks.authentication = await this.checkAuthHealth();

			// Certificate validity check
			healthCheck.checks.certificates = await this.checkCertificateHealth();

			// System resources check
			healthCheck.checks.system = await this.checkSystemHealth();

			// Security posture check
			healthCheck.checks.security = await this.checkSecurityPosture();

			// Overall health calculation
			const allChecks = Object.values(healthCheck.checks);
			const healthyChecks = allChecks.filter(check => check.status === 'healthy').length;
			const overallHealth = healthyChecks / allChecks.length;

			healthCheck.overallStatus = overallHealth >= 0.8 ? 'healthy' :
										overallHealth >= 0.6 ? 'warning' : 'critical';

			this.metrics.systemHealth = {
				lastCheck: healthCheck.timestamp,
				status: healthCheck.overallStatus,
				checks: healthCheck.checks,
				issues: this.extractHealthIssues(healthCheck.checks)
			};

			this.emit('health:check', healthCheck);

		} catch (error) {
			console.error('MonitoringService: Health check failed:', error);

			healthCheck.overallStatus = 'error';
			healthCheck.error = error.message;

			this.createAlert({
				type: 'health_check_failure',
				category: 'system',
				severity: 'high',
				message: `Health check failed: ${error.message}`,
				timestamp: new Date()
			});
		}

		return healthCheck;
	}

	/**
	 * Create and manage alerts
	 */
	createAlert(alertData) {
		const alert = {
			id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date(),
			status: 'active',
			acknowledged: false,
			...alertData
		};

		this.metrics.alerts.set(alert.id, alert);

		// Emit alert event
		this.emit('alert:created', alert);

		// Log alert
		console.warn(`MonitoringService Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);

		// Send notifications if configured
		this.sendAlertNotification(alert);

		return alert;
	}

	/**
	 * Acknowledge alert
	 */
	acknowledgeAlert(alertId, acknowledgedBy = 'system') {
		const alert = this.metrics.alerts.get(alertId);
		if (alert) {
			alert.acknowledged = true;
			alert.acknowledgedBy = acknowledgedBy;
			alert.acknowledgedAt = new Date();

			this.emit('alert:acknowledged', alert);
			return true;
		}
		return false;
	}

	/**
	 * Resolve alert
	 */
	resolveAlert(alertId, resolvedBy = 'system', resolution = '') {
		const alert = this.metrics.alerts.get(alertId);
		if (alert) {
			alert.status = 'resolved';
			alert.resolvedBy = resolvedBy;
			alert.resolvedAt = new Date();
			alert.resolution = resolution;

			this.emit('alert:resolved', alert);
			return true;
		}
		return false;
	}

	/**
	 * Get alerts with filtering
	 */
	getAlerts(filter = {}) {
		let alerts = Array.from(this.metrics.alerts.values());

		if (filter.status) {
			alerts = alerts.filter(alert => alert.status === filter.status);
		}

		if (filter.category) {
			alerts = alerts.filter(alert => alert.category === filter.category);
		}

		if (filter.severity) {
			alerts = alerts.filter(alert => alert.severity === filter.severity);
		}

		if (filter.since) {
			const since = new Date(filter.since);
			alerts = alerts.filter(alert => alert.timestamp >= since);
		}

		// Sort by timestamp (newest first)
		alerts.sort((a, b) => b.timestamp - a.timestamp);

		return alerts;
	}

	/**
	 * Export monitoring data
	 */
	async exportMonitoringData(options = {}) {
		const exportData = {
			timestamp: new Date().toISOString(),
			monitoringStatus: this.getMonitoringStatus(),
			systemHealth: this.metrics.systemHealth,
			alerts: this.getAlerts(),
			authEvents: this.exportAuthEvents(options.includeAuthEvents),
			certificates: Array.from(this.metrics.certificateStatus.entries())
		};

		if (options.format === 'json') {
			return JSON.stringify(exportData, null, 2);
		}

		return exportData;
	}

	// Private helper methods

	/**
	 * Check authentication system alerts
	 */
	checkAuthAlerts(eventType) {
		if (eventType.includes('failure')) {
			const recentFailures = this.getRecentEvents(eventType, 60000); // Last minute

			if (recentFailures.length >= this.config.alertThresholds.failedLogins) {
				this.createAlert({
					type: 'failed_login_threshold',
					category: 'security',
					severity: 'high',
					message: `${recentFailures.length} failed login attempts in the last minute`,
					data: { eventType, count: recentFailures.length }
				});
			}
		}
	}

	/**
	 * Check certificate expiry alerts
	 */
	checkCertificateAlerts(certId) {
		const cert = this.metrics.certificateStatus.get(certId);
		if (!cert) return;

		const alertKey = `cert_expiry_${certId}`;

		if (cert.timeUntilExpiry <= this.config.alertThresholds.certificateExpiry &&
			cert.timeUntilExpiry > 0) {

			// Check if we already have an active alert for this certificate
			const existingAlert = Array.from(this.metrics.alerts.values())
				.find(alert => alert.type === 'certificate_expiring' && alert.data?.certId === certId);

			if (!existingAlert) {
				const daysUntilExpiry = Math.ceil(cert.timeUntilExpiry / (24 * 60 * 60 * 1000));

				this.createAlert({
					type: 'certificate_expiring',
					category: 'security',
					severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
					message: `Certificate for ${cert.domain} expires in ${daysUntilExpiry} days`,
					data: { certId, domain: cert.domain, daysUntilExpiry }
				});
			}
		}
	}

	/**
	 * Check system resource alerts
	 */
	checkSystemAlerts(metrics) {
		// Memory usage alert
		if (metrics.memoryUsage && metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
			this.createAlert({
				type: 'high_memory_usage',
				category: 'system',
				severity: 'medium',
				message: `High memory usage: ${metrics.memoryUsage.toFixed(1)}%`,
				data: { memoryUsage: metrics.memoryUsage }
			});
		}

		// Response time alert
		if (metrics.avgResponseTime && metrics.avgResponseTime > this.config.alertThresholds.responseTime) {
			this.createAlert({
				type: 'slow_response_time',
				category: 'performance',
				severity: 'medium',
				message: `Slow response time: ${metrics.avgResponseTime}ms`,
				data: { responseTime: metrics.avgResponseTime }
			});
		}
	}

	/**
	 * Get certificate status based on time until expiry
	 */
	getCertificateStatus(timeUntilExpiry) {
		if (timeUntilExpiry <= 0) return 'expired';
		if (timeUntilExpiry <= 7 * 24 * 60 * 60 * 1000) return 'expiring_soon';
		if (timeUntilExpiry <= 30 * 24 * 60 * 60 * 1000) return 'expiring';
		return 'healthy';
	}

	/**
	 * Calculate system status based on metrics
	 */
	calculateSystemStatus(metrics) {
		const issues = [];

		if (metrics.memoryUsage > 90) issues.push('critical_memory');
		if (metrics.diskUsage > 95) issues.push('critical_disk');
		if (metrics.avgResponseTime > 10000) issues.push('critical_response_time');

		if (issues.length > 0) return 'critical';

		if (metrics.memoryUsage > 80 || metrics.diskUsage > 85 || metrics.avgResponseTime > 5000) {
			return 'warning';
		}

		return 'healthy';
	}

	/**
	 * Get recent events for analysis
	 */
	getRecentEvents(eventType, timeWindow = 60000) {
		const events = this.metrics.authEvents.get(eventType) || [];
		const cutoff = new Date(Date.now() - timeWindow);

		return events.filter(event => event.timestamp >= cutoff);
	}

	/**
	 * Clean up old events
	 */
	cleanupOldEvents(eventType, maxAge) {
		const events = this.metrics.authEvents.get(eventType);
		if (!events) return;

		const cutoff = new Date(Date.now() - maxAge);
		const filteredEvents = events.filter(event => event.timestamp >= cutoff);

		this.metrics.authEvents.set(eventType, filteredEvents);
	}

	/**
	 * Get total event count
	 */
	getTotalEventCount() {
		let total = 0;
		for (const events of this.metrics.authEvents.values()) {
			total += events.length;
		}
		return total;
	}

	/**
	 * Get auth events in time period
	 */
	getAuthEventsInPeriod(start, end) {
		const events = [];

		for (const [type, eventList] of this.metrics.authEvents.entries()) {
			const filteredEvents = eventList
				.filter(event => event.timestamp >= start && event.timestamp <= end)
				.map(event => ({ ...event, type }));

			events.push(...filteredEvents);
		}

		return events.sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Calculate security trends
	 */
	calculateSecurityTrends() {
		const now = new Date();
		const periods = {
			'1h': new Date(now.getTime() - 60 * 60 * 1000),
			'24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
			'7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
		};

		const trends = {};

		for (const [period, startTime] of Object.entries(periods)) {
			const events = this.getAuthEventsInPeriod(startTime, now);
			const failures = events.filter(e => e.type.includes('failure')).length;

			trends[period] = {
				totalEvents: events.length,
				failures,
				successRate: events.length > 0 ? ((events.length - failures) / events.length) : 1
			};
		}

		return trends;
	}

	/**
	 * Health check implementations
	 */
	async checkDatabaseHealth() {
		try {
			// This would normally check database connectivity
			// For now, return a mock healthy status
			return {
				status: 'healthy',
				responseTime: 45,
				connections: 5,
				lastQuery: new Date()
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				error: error.message
			};
		}
	}

	async checkAuthHealth() {
		try {
			// Check if auth services are responsive
			return {
				status: 'healthy',
				activeSessions: 12,
				avgResponseTime: 125,
				lastAuthEvent: new Date()
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				error: error.message
			};
		}
	}

	async checkCertificateHealth() {
		const certificates = Array.from(this.metrics.certificateStatus.values());
		const expired = certificates.filter(cert => cert.timeUntilExpiry <= 0).length;
		const expiringSoon = certificates.filter(cert =>
			cert.timeUntilExpiry > 0 && cert.timeUntilExpiry <= this.config.alertThresholds.certificateExpiry
		).length;

		return {
			status: expired > 0 ? 'unhealthy' : expiringSoon > 0 ? 'warning' : 'healthy',
			total: certificates.length,
			expired,
			expiringSoon,
			healthy: certificates.length - expired - expiringSoon
		};
	}

	async checkSystemHealth() {
		try {
			const memUsage = process.memoryUsage();
			const memoryUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

			return {
				status: memoryUsage > 80 ? 'warning' : 'healthy',
				memoryUsage,
				uptime: process.uptime(),
				nodeVersion: process.version
			};
		} catch (error) {
			return {
				status: 'unhealthy',
				error: error.message
			};
		}
	}

	async checkSecurityPosture() {
		const recentAlerts = this.getAlerts({
			category: 'security',
			since: new Date(Date.now() - 24 * 60 * 60 * 1000)
		});

		const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'high').length;

		return {
			status: criticalAlerts > 0 ? 'warning' : 'healthy',
			recentSecurityAlerts: recentAlerts.length,
			criticalAlerts,
			lastSecurityEvent: recentAlerts[0]?.timestamp
		};
	}

	/**
	 * Extract issues from health checks
	 */
	extractHealthIssues(checks) {
		const issues = [];

		for (const [checkName, check] of Object.entries(checks)) {
			if (check.status === 'unhealthy' || check.status === 'warning') {
				issues.push({
					check: checkName,
					status: check.status,
					message: check.error || check.message || `${checkName} check failed`,
					timestamp: new Date()
				});
			}
		}

		return issues;
	}

	/**
	 * Send alert notification (placeholder for integration with notification services)
	 */
	sendAlertNotification(alert) {
		// This could be extended to integrate with:
		// - Email services (SendGrid, SES)
		// - Slack/Discord webhooks
		// - PagerDuty/OpsGenie
		// - SMS services

		console.log(`MonitoringService: Alert notification sent for ${alert.type}`);

		// Emit event for external notification handlers
		this.emit('notification:send', {
			type: 'alert',
			alert,
			channels: ['console'] // Could include 'email', 'slack', etc.
		});
	}

	/**
	 * Export auth events (with privacy filtering)
	 */
	exportAuthEvents(includeEvents = false) {
		if (!includeEvents) {
			// Return only summary data
			const summary = {};
			for (const [type, events] of this.metrics.authEvents.entries()) {
				summary[type] = events.length;
			}
			return summary;
		}

		// Return events with sensitive data removed
		const exportedEvents = {};
		for (const [type, events] of this.metrics.authEvents.entries()) {
			exportedEvents[type] = events.map(event => ({
				timestamp: event.timestamp,
				// Remove IP addresses and user agents for privacy
				hasUserId: !!event.userId,
				hasIP: !!event.ip,
				hasUserAgent: !!event.userAgent
			}));
		}

		return exportedEvents;
	}
}