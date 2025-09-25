/**
 * Admin Monitoring API Endpoints
 * Provides access to monitoring data, alerts, and health checks
 */

import { json } from '@sveltejs/kit';
import { requireAdminAuth } from '$lib/server/shared/auth/middleware.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, url }) {
	try {
		const user = await requireAdminAuth(request);
		if (!user) {
			return json({ success: false, error: 'Admin authentication required' }, { status: 401 });
		}

		const monitoringService = globalThis.__API_SERVICES?.monitoringService;
		if (!monitoringService) {
			return json({ success: false, error: 'Monitoring service not available' }, { status: 503 });
		}

		const endpoint = url.searchParams.get('endpoint') || 'status';

		switch (endpoint) {
			case 'status':
				return json({
					success: true,
					status: monitoringService.getMonitoringStatus()
				});

			case 'dashboard':
				return json({
					success: true,
					dashboard: monitoringService.getSecurityDashboard()
				});

			case 'health':
				const healthCheck = await monitoringService.performHealthCheck();
				return json({
					success: true,
					health: healthCheck
				});

			case 'alerts':
				const filter = {
					status: url.searchParams.get('status'),
					category: url.searchParams.get('category'),
					severity: url.searchParams.get('severity'),
					since: url.searchParams.get('since')
				};

				// Remove null values
				Object.keys(filter).forEach(key => {
					if (filter[key] === null) delete filter[key];
				});

				const alerts = monitoringService.getAlerts(filter);
				return json({
					success: true,
					alerts,
					total: alerts.length
				});

			case 'export':
				const exportOptions = {
					format: url.searchParams.get('format') || 'json',
					includeAuthEvents: url.searchParams.get('includeAuthEvents') === 'true'
				};

				const exportData = await monitoringService.exportMonitoringData(exportOptions);

				if (exportOptions.format === 'json') {
					return new Response(exportData, {
						headers: {
							'Content-Type': 'application/json',
							'Content-Disposition': `attachment; filename="monitoring-export-${new Date().toISOString().split('T')[0]}.json"`
						}
					});
				}

				return json({
					success: true,
					data: exportData
				});

			default:
				return json({ success: false, error: 'Unknown endpoint' }, { status: 400 });
		}

	} catch (error) {
		console.error('Monitoring API error:', error);
		return json({
			success: false,
			error: 'Failed to get monitoring data'
		}, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const user = await requireAdminAuth(request);
		if (!user) {
			return json({ success: false, error: 'Admin authentication required' }, { status: 401 });
		}

		const monitoringService = globalThis.__API_SERVICES?.monitoringService;
		if (!monitoringService) {
			return json({ success: false, error: 'Monitoring service not available' }, { status: 503 });
		}

		const body = await request.json();
		const { action, ...data } = body;

		switch (action) {
			case 'acknowledgeAlert':
				const { alertId } = data;
				const acknowledged = monitoringService.acknowledgeAlert(alertId, user.email);

				if (acknowledged) {
					return json({
						success: true,
						message: 'Alert acknowledged'
					});
				} else {
					return json({
						success: false,
						error: 'Alert not found'
					}, { status: 404 });
				}

			case 'resolveAlert':
				const { alertId: resolveAlertId, resolution = '' } = data;
				const resolved = monitoringService.resolveAlert(resolveAlertId, user.email, resolution);

				if (resolved) {
					return json({
						success: true,
						message: 'Alert resolved'
					});
				} else {
					return json({
						success: false,
						error: 'Alert not found'
					}, { status: 404 });
				}

			case 'createManualAlert':
				const { type, category, severity, message } = data;

				if (!type || !category || !severity || !message) {
					return json({
						success: false,
						error: 'Missing required fields: type, category, severity, message'
					}, { status: 400 });
				}

				const alert = monitoringService.createAlert({
					type: `manual_${type}`,
					category,
					severity,
					message,
					createdBy: user.email,
					manual: true
				});

				return json({
					success: true,
					alert
				});

			case 'updateThresholds':
				const { thresholds } = data;

				if (!thresholds || typeof thresholds !== 'object') {
					return json({
						success: false,
						error: 'Invalid thresholds data'
					}, { status: 400 });
				}

				// Update monitoring thresholds
				Object.assign(monitoringService.config.alertThresholds, thresholds);

				return json({
					success: true,
					message: 'Alert thresholds updated',
					thresholds: monitoringService.config.alertThresholds
				});

			case 'triggerHealthCheck':
				const healthCheck = await monitoringService.performHealthCheck();

				return json({
					success: true,
					healthCheck,
					message: 'Health check completed'
				});

			default:
				return json({ success: false, error: 'Unknown action' }, { status: 400 });
		}

	} catch (error) {
		console.error('Monitoring API POST error:', error);
		return json({
			success: false,
			error: 'Failed to process monitoring action'
		}, { status: 500 });
	}
}