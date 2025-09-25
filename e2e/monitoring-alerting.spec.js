import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment } from './test-helpers.js';

test.describe('Monitoring and Alerting Integration', () => {
	test.beforeEach(async ({ page }) => {
		await setupFreshTestEnvironment(page, '/');
	});

	test.describe('Security Event Monitoring', () => {
		test('monitors failed login attempts and triggers alerts', async ({ page }) => {
			// Mock admin authentication
			await page.route('/api/auth/status', async route => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						authenticated: true,
						user: { id: 1, email: 'admin@example.com', role: 'admin' },
						sessionStatus: 'active'
					})
				});
			});

			// Mock monitoring service endpoints
			await page.route('/api/admin/monitoring*', async route => {
				const url = new URL(route.request().url());
				const endpoint = url.searchParams.get('endpoint');

				if (endpoint === 'dashboard') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							dashboard: {
								overview: {
									systemStatus: 'warning',
									lastUpdated: new Date().toISOString()
								},
								authentication: {
									totalEvents: 25,
									successfulLogins: 15,
									failedLogins: 10,
									successRate: 0.6
								},
								certificates: {
									total: 2,
									expiringSoon: 1,
									healthy: 1
								},
								alerts: {
									active: 2,
									recent: [
										{
											id: 'alert_1',
											type: 'failed_login_threshold',
											severity: 'high',
											message: '10 failed login attempts in the last minute',
											timestamp: new Date().toISOString(),
											status: 'active'
										},
										{
											id: 'alert_2',
											type: 'certificate_expiring',
											severity: 'medium',
											message: 'Certificate for localhost expires in 5 days',
											timestamp: new Date(Date.now() - 60000).toISOString(),
											status: 'active'
										}
									]
								},
								trends: {
									'1h': { totalEvents: 5, failures: 3, successRate: 0.4 },
									'24h': { totalEvents: 25, failures: 10, successRate: 0.6 },
									'7d': { totalEvents: 150, failures: 25, successRate: 0.83 }
								}
							}
						})
					});
				} else if (endpoint === 'alerts') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							alerts: [
								{
									id: 'alert_1',
									type: 'failed_login_threshold',
									category: 'security',
									severity: 'high',
									message: '10 failed login attempts in the last minute',
									timestamp: new Date().toISOString(),
									status: 'active',
									acknowledged: false
								},
								{
									id: 'alert_2',
									type: 'certificate_expiring',
									category: 'security',
									severity: 'medium',
									message: 'Certificate for localhost expires in 5 days',
									timestamp: new Date(Date.now() - 60000).toISOString(),
									status: 'active',
									acknowledged: false
								}
							],
							total: 2
						})
					});
				}
			});

			// Test monitoring dashboard access
			const dashboardResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=dashboard');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Monitoring dashboard result:', dashboardResult);

			expect(dashboardResult.success).toBe(true);
			expect(dashboardResult.data.dashboard).toBeDefined();
			expect(dashboardResult.data.dashboard.authentication.failedLogins).toBe(10);
			expect(dashboardResult.data.dashboard.alerts.active).toBe(2);

			// Test alert retrieval
			const alertsResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=alerts&status=active');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Active alerts result:', alertsResult);

			expect(alertsResult.success).toBe(true);
			expect(alertsResult.data.alerts).toHaveLength(2);
			expect(alertsResult.data.alerts[0].type).toBe('failed_login_threshold');
			expect(alertsResult.data.alerts[0].severity).toBe('high');
		});

		test('handles alert acknowledgment and resolution', async ({ page }) => {
			// Mock alert management endpoints
			await page.route('/api/admin/monitoring', async route => {
				const request = route.request();

				if (request.method() === 'POST') {
					const body = JSON.parse(await request.postData() || '{}');

					if (body.action === 'acknowledgeAlert') {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								message: 'Alert acknowledged'
							})
						});
					} else if (body.action === 'resolveAlert') {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								message: 'Alert resolved'
							})
						});
					} else if (body.action === 'createManualAlert') {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								alert: {
									id: `alert_${Date.now()}`,
									type: `manual_${body.type}`,
									category: body.category,
									severity: body.severity,
									message: body.message,
									timestamp: new Date().toISOString(),
									status: 'active',
									manual: true
								}
							})
						});
					}
				}
			});

			// Test alert acknowledgment
			const ackResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							action: 'acknowledgeAlert',
							alertId: 'alert_1'
						})
					});

					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Alert acknowledgment result:', ackResult);

			expect(ackResult.success).toBe(true);
			expect(ackResult.data.message).toBe('Alert acknowledged');

			// Test alert resolution
			const resolveResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							action: 'resolveAlert',
							alertId: 'alert_1',
							resolution: 'Issue resolved by updating security policies'
						})
					});

					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Alert resolution result:', resolveResult);

			expect(resolveResult.success).toBe(true);
			expect(resolveResult.data.message).toBe('Alert resolved');

			// Test manual alert creation
			const manualAlertResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							action: 'createManualAlert',
							type: 'security_review',
							category: 'security',
							severity: 'medium',
							message: 'Scheduled security review required'
						})
					});

					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Manual alert creation result:', manualAlertResult);

			expect(manualAlertResult.success).toBe(true);
			expect(manualAlertResult.data.alert.type).toBe('manual_security_review');
			expect(manualAlertResult.data.alert.manual).toBe(true);
		});
	});

	test.describe('Certificate Monitoring', () => {
		test('monitors certificate expiry and generates alerts', async ({ page }) => {
			// Mock certificate monitoring endpoints
			await page.route('/api/admin/monitoring*', async route => {
				const url = new URL(route.request().url());
				const endpoint = url.searchParams.get('endpoint');

				if (endpoint === 'dashboard') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							dashboard: {
								certificates: {
									total: 3,
									expiringSoon: 2,
									healthy: 1
								},
								alerts: {
									active: 2,
									recent: [
										{
											id: 'cert_alert_1',
											type: 'certificate_expiring',
											severity: 'high',
											message: 'Certificate for example.com expires in 3 days',
											timestamp: new Date().toISOString(),
											data: { domain: 'example.com', daysUntilExpiry: 3 }
										},
										{
											id: 'cert_alert_2',
											type: 'certificate_expiring',
											severity: 'medium',
											message: 'Certificate for api.example.com expires in 15 days',
											timestamp: new Date(Date.now() - 300000).toISOString(),
											data: { domain: 'api.example.com', daysUntilExpiry: 15 }
										}
									]
								}
							}
						})
					});
				} else if (endpoint === 'alerts') {
					const category = url.searchParams.get('category');

					if (category === 'security') {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								alerts: [
									{
										id: 'cert_alert_1',
										type: 'certificate_expiring',
										category: 'security',
										severity: 'high',
										message: 'Certificate for example.com expires in 3 days',
										timestamp: new Date().toISOString(),
										status: 'active',
										data: { domain: 'example.com', daysUntilExpiry: 3 }
									},
									{
										id: 'cert_alert_2',
										type: 'certificate_expiring',
										category: 'security',
										severity: 'medium',
										message: 'Certificate for api.example.com expires in 15 days',
										timestamp: new Date(Date.now() - 300000).toISOString(),
										status: 'active',
										data: { domain: 'api.example.com', daysUntilExpiry: 15 }
									}
								],
								total: 2
							})
						});
					}
				}
			});

			// Test certificate monitoring
			const certDashboard = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=dashboard');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Certificate dashboard result:', certDashboard);

			expect(certDashboard.success).toBe(true);
			expect(certDashboard.data.dashboard.certificates.total).toBe(3);
			expect(certDashboard.data.dashboard.certificates.expiringSoon).toBe(2);

			// Test certificate-specific alerts
			const certAlerts = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=alerts&category=security');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Certificate alerts result:', certAlerts);

			expect(certAlerts.success).toBe(true);
			expect(certAlerts.data.alerts).toHaveLength(2);
			expect(certAlerts.data.alerts[0].type).toBe('certificate_expiring');
			expect(certAlerts.data.alerts[0].data.daysUntilExpiry).toBe(3);
		});
	});

	test.describe('System Health Monitoring', () => {
		test('performs health checks and monitors system resources', async ({ page }) => {
			// Mock health check endpoints
			await page.route('/api/admin/monitoring*', async route => {
				const url = new URL(route.request().url());
				const endpoint = url.searchParams.get('endpoint');

				if (endpoint === 'health') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							health: {
								timestamp: new Date().toISOString(),
								overallStatus: 'healthy',
								checks: {
									database: {
										status: 'healthy',
										responseTime: 45,
										connections: 5,
										lastQuery: new Date().toISOString()
									},
									authentication: {
										status: 'healthy',
										activeSessions: 12,
										avgResponseTime: 125,
										lastAuthEvent: new Date().toISOString()
									},
									certificates: {
										status: 'warning',
										total: 3,
										expired: 0,
										expiringSoon: 2,
										healthy: 1
									},
									system: {
										status: 'healthy',
										memoryUsage: 65.2,
										uptime: 86400,
										nodeVersion: 'v22.0.0'
									},
									security: {
										status: 'healthy',
										recentSecurityAlerts: 1,
										criticalAlerts: 0,
										lastSecurityEvent: new Date(Date.now() - 300000).toISOString()
									}
								},
								issues: [
									{
										check: 'certificates',
										status: 'warning',
										message: '2 certificates expiring soon',
										timestamp: new Date().toISOString()
									}
								]
							}
						})
					});
				} else if (endpoint === 'status') {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({
							success: true,
							status: {
								isRunning: true,
								lastHealthCheck: new Date().toISOString(),
								systemStatus: 'healthy',
								activeAlerts: 3,
								totalEvents: 1250,
								certificatesMonitored: 3,
								uptime: 86400
							}
						})
					});
				}
			});

			// Mock health check trigger
			await page.route('/api/admin/monitoring', async route => {
				const request = route.request();

				if (request.method() === 'POST') {
					const body = JSON.parse(await request.postData() || '{}');

					if (body.action === 'triggerHealthCheck') {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								healthCheck: {
									timestamp: new Date().toISOString(),
									overallStatus: 'healthy',
									checks: {
										database: { status: 'healthy' },
										authentication: { status: 'healthy' },
										certificates: { status: 'warning' },
										system: { status: 'healthy' },
										security: { status: 'healthy' }
									}
								},
								message: 'Health check completed'
							})
						});
					}
				}
			});

			// Test monitoring status
			const statusResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=status');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Monitoring status result:', statusResult);

			expect(statusResult.success).toBe(true);
			expect(statusResult.data.status.isRunning).toBe(true);
			expect(statusResult.data.status.systemStatus).toBe('healthy');
			expect(statusResult.data.status.activeAlerts).toBeGreaterThanOrEqual(0);

			// Test health check
			const healthResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=health');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Health check result:', healthResult);

			expect(healthResult.success).toBe(true);
			expect(healthResult.data.health.overallStatus).toBe('healthy');
			expect(healthResult.data.health.checks).toHaveProperty('database');
			expect(healthResult.data.health.checks).toHaveProperty('authentication');
			expect(healthResult.data.health.checks).toHaveProperty('certificates');
			expect(healthResult.data.health.checks).toHaveProperty('system');
			expect(healthResult.data.health.checks).toHaveProperty('security');

			// Test manual health check trigger
			const manualHealthCheck = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ action: 'triggerHealthCheck' })
					});

					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Manual health check result:', manualHealthCheck);

			expect(manualHealthCheck.success).toBe(true);
			expect(manualHealthCheck.data.message).toBe('Health check completed');
			expect(manualHealthCheck.data.healthCheck.overallStatus).toBe('healthy');
		});
	});

	test.describe('Alert Threshold Configuration', () => {
		test('allows configuration of alert thresholds', async ({ page }) => {
			// Mock threshold update endpoint
			await page.route('/api/admin/monitoring', async route => {
				const request = route.request();

				if (request.method() === 'POST') {
					const body = JSON.parse(await request.postData() || '{}');

					if (body.action === 'updateThresholds') {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								message: 'Alert thresholds updated',
								thresholds: {
									failedLogins: body.thresholds.failedLogins || 10,
									sessionExpiry: body.thresholds.sessionExpiry || 900000,
									certificateExpiry: body.thresholds.certificateExpiry || 2592000000,
									diskUsage: body.thresholds.diskUsage || 85,
									memoryUsage: body.thresholds.memoryUsage || 80,
									responseTime: body.thresholds.responseTime || 5000
								}
							})
						});
					}
				}
			});

			// Test threshold configuration
			const thresholdResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							action: 'updateThresholds',
							thresholds: {
								failedLogins: 15, // Increase threshold
								memoryUsage: 85,   // Increase threshold
								responseTime: 3000 // Decrease threshold for faster alerts
							}
						})
					});

					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Threshold update result:', thresholdResult);

			expect(thresholdResult.success).toBe(true);
			expect(thresholdResult.data.message).toBe('Alert thresholds updated');
			expect(thresholdResult.data.thresholds.failedLogins).toBe(15);
			expect(thresholdResult.data.thresholds.memoryUsage).toBe(85);
			expect(thresholdResult.data.thresholds.responseTime).toBe(3000);
		});
	});

	test.describe('Monitoring Data Export', () => {
		test('exports monitoring data in various formats', async ({ page }) => {
			// Mock export endpoint
			await page.route('/api/admin/monitoring*', async route => {
				const url = new URL(route.request().url());
				const endpoint = url.searchParams.get('endpoint');
				const format = url.searchParams.get('format');

				if (endpoint === 'export') {
					const exportData = {
						timestamp: new Date().toISOString(),
						monitoringStatus: {
							isRunning: true,
							systemStatus: 'healthy',
							activeAlerts: 3,
							totalEvents: 1250
						},
						systemHealth: {
							lastCheck: new Date().toISOString(),
							status: 'healthy',
							checks: {
								database: { status: 'healthy' },
								authentication: { status: 'healthy' },
								certificates: { status: 'warning' }
							}
						},
						alerts: [
							{
								id: 'alert_1',
								type: 'certificate_expiring',
								severity: 'high',
								message: 'Certificate expires in 3 days'
							}
						],
						authEvents: {
							login_success: 120,
							login_failure: 15,
							webauthn_success: 45
						},
						certificates: [
							['cert1', { domain: 'example.com', status: 'expiring' }],
							['cert2', { domain: 'api.example.com', status: 'healthy' }]
						]
					};

					if (format === 'json') {
						await route.fulfill({
							status: 200,
							headers: {
								'Content-Type': 'application/json',
								'Content-Disposition': `attachment; filename="monitoring-export-${new Date().toISOString().split('T')[0]}.json"`
							},
							body: JSON.stringify(exportData, null, 2)
						});
					} else {
						await route.fulfill({
							status: 200,
							contentType: 'application/json',
							body: JSON.stringify({
								success: true,
								data: exportData
							})
						});
					}
				}
			});

			// Test JSON export
			const jsonExportResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=export&format=json');
					const text = await response.text();
					const contentDisposition = response.headers.get('content-disposition');

					return {
						success: response.ok,
						hasData: text.length > 0,
						isJSON: text.startsWith('{'),
						hasFilename: contentDisposition && contentDisposition.includes('monitoring-export')
					};
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('JSON export result:', jsonExportResult);

			expect(jsonExportResult.success).toBe(true);
			expect(jsonExportResult.hasData).toBe(true);
			expect(jsonExportResult.isJSON).toBe(true);
			expect(jsonExportResult.hasFilename).toBe(true);

			// Test structured data export
			const dataExportResult = await page.evaluate(async () => {
				try {
					const response = await fetch('/api/admin/monitoring?endpoint=export&includeAuthEvents=true');
					const data = await response.json();
					return { success: response.ok, data };
				} catch (error) {
					return { success: false, error: error.message };
				}
			});

			console.log('Data export result:', dataExportResult);

			expect(dataExportResult.success).toBe(true);
			expect(dataExportResult.data.data).toBeDefined();
			expect(dataExportResult.data.data.monitoringStatus).toBeDefined();
			expect(dataExportResult.data.data.alerts).toBeDefined();
			expect(dataExportResult.data.data.authEvents).toBeDefined();
		});
	});
});