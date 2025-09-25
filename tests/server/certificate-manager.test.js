import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { AuthMigrationManager } from '../../src/lib/server/shared/db/AuthMigrationManager.js';
import { CertificateManager } from '../../src/lib/server/shared/security/CertificateManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync, writeFileSync, readFileSync } from 'fs';

describe('Certificate Manager', () => {
	let db;
	let migrationManager;
	let certManager;
	let tempDbPath;

	const mockCertPEM = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/heBjcOuMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTUwNTA4MTIwMjI4WhcNMjUwNTA1MTIwMjI4WjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAuJbhFxNlYQRxS2b9qv4OIR5aR1U5n7JcYfmIcE6LR4rCKWR2Q3E6xdY5
nH5E6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE
nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6n
E6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE
6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6
nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6n
E6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE
6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6
nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6n
E6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE
6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6
nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6n
E6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE
6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6
nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6n
E6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE
6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6
nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6n
E6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE
6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6
nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6nE6n
QIDAQAB
-----END CERTIFICATE-----`;

	const mockKeyPEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4luEXE2VhBHFL
Zv2q/g4hHlpHVTmfslxh+YhwTotHisIpZHZDcTrF1jmcfkTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcT
qcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
TqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTq
cTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqcTqc
-----END PRIVATE KEY-----`;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-certs-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run auth migrations
		migrationManager = new AuthMigrationManager(db);
		await migrationManager.runAllMigrations();

		// Create certificate manager with test app secret
		certManager = new CertificateManager(db, 'test-secret-key-for-encryption');
	});

	afterEach(async () => {
		if (db) {
			await db.close();
		}
		try {
			rmSync(tempDbPath, { force: true });
		} catch (e) {
			// Ignore cleanup errors
		}
	});

	describe('Certificate Storage', () => {
		it('should store and retrieve certificates with encryption', async () => {
			const certData = {
				name: 'test-cert',
				domain: 'example.com',
				type: 'mkcert',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			};

			const stored = await certManager.storeCertificate(certData);
			expect(stored.id).toBeDefined();

			const retrieved = await certManager.getCertificate(stored.id);
			expect(retrieved.certificate).toBe(mockCertPEM);
			expect(retrieved.privateKey).toBe(mockKeyPEM);
			expect(retrieved.domain).toBe('example.com');
		});

		it('should encrypt certificate data at rest', async () => {
			const certData = {
				name: 'encrypted-cert',
				domain: 'secure.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			};

			const stored = await certManager.storeCertificate(certData);

			// Check raw database storage is encrypted
			const rawRow = await db.get('SELECT * FROM certificates WHERE id = ?', [stored.id]);
			expect(rawRow.certificate_data).not.toBe(mockCertPEM);
			expect(rawRow.private_key_data).not.toBe(mockKeyPEM);
			expect(rawRow.certificate_data).toMatch(/^[a-f0-9]+$/); // Encrypted hex
		});

		it('should list certificates with metadata', async () => {
			await certManager.storeCertificate({
				name: 'cert1',
				domain: 'example.com',
				type: 'mkcert',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			await certManager.storeCertificate({
				name: 'cert2',
				domain: 'test.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			const certificates = await certManager.listCertificates();
			expect(certificates).toHaveLength(2);
			expect(certificates[0]).toHaveProperty('name');
			expect(certificates[0]).toHaveProperty('domain');
			expect(certificates[0]).toHaveProperty('type');
			expect(certificates[0]).toHaveProperty('expiresAt');
		});

		it('should delete certificates', async () => {
			const stored = await certManager.storeCertificate({
				name: 'to-delete',
				domain: 'delete.com',
				type: 'mkcert',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			await certManager.deleteCertificate(stored.id);

			const retrieved = await certManager.getCertificate(stored.id);
			expect(retrieved).toBeNull();
		});
	});

	describe('Certificate Parsing and Validation', () => {
		it('should parse certificate information', () => {
			const info = certManager.parseCertificate(mockCertPEM);

			expect(info).toHaveProperty('subject');
			expect(info).toHaveProperty('issuer');
			expect(info).toHaveProperty('validFrom');
			expect(info).toHaveProperty('validTo');
			expect(info).toHaveProperty('fingerprint');
		});

		it('should validate certificate and key pair', () => {
			const isValid = certManager.validateCertificateKeyPair(mockCertPEM, mockKeyPEM);
			expect(isValid).toBe(true);
		});

		it('should detect certificate type', () => {
			// Mock different certificate types
			const mkcertType = certManager.detectCertificateType(mockCertPEM);
			expect(['mkcert', 'self-signed']).toContain(mkcertType);
		});

		it('should check certificate expiry', () => {
			const daysUntilExpiry = certManager.getDaysUntilExpiry(mockCertPEM);
			expect(typeof daysUntilExpiry).toBe('number');
		});
	});

	describe('mkcert Integration', () => {
		it('should handle mkcert certificate upload', async () => {
			const mkcertData = {
				name: 'localhost-mkcert',
				domains: ['localhost', '127.0.0.1'],
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			};

			const result = await certManager.uploadMkcertCertificate(mkcertData);
			expect(result.success).toBe(true);
			expect(result.certificate.type).toBe('mkcert');
			expect(result.certificate.domains).toEqual(['localhost', '127.0.0.1']);
		});

		it('should validate mkcert certificate format', () => {
			const isValidMkcert = certManager.validateMkcertCertificate(mockCertPEM);
			expect(typeof isValidMkcert).toBe('boolean');
		});

		it('should generate mkcert installation instructions', () => {
			const instructions = certManager.getMkcertInstallInstructions();
			expect(instructions).toContain('mkcert');
			expect(instructions).toContain('install');
		});
	});

	describe("Let's Encrypt ACME Integration", () => {
		beforeEach(() => {
			// Mock ACME client
			vi.mock('acme-client', () => ({
				default: {
					forge: {
						createCsr: vi.fn(),
						createPrivateKey: vi.fn()
					}
				}
			}));
		});

		it("should initiate Let's Encrypt certificate request", async () => {
			const domain = 'example.com';
			const email = 'admin@example.com';

			// Mock successful ACME flow
			const mockChallenge = {
				type: 'http-01',
				token: 'test-token',
				keyAuthorization: 'test-key-auth',
				url: 'http://example.com/.well-known/acme-challenge/test-token'
			};

			certManager.acmeClient = {
				createOrder: vi.fn().mockResolvedValue({
					url: 'order-url',
					authorizations: ['auth-url']
				}),
				getAuthorization: vi.fn().mockResolvedValue({
					challenges: [mockChallenge]
				})
			};

			const order = await certManager.initiateACMEOrder(domain, email);
			expect(order).toHaveProperty('challenges');
			expect(order.challenges[0].type).toBe('http-01');
		});

		it('should handle ACME HTTP-01 challenge', async () => {
			const challenge = {
				type: 'http-01',
				token: 'test-token',
				keyAuthorization: 'test-key-auth'
			};

			await certManager.setupHTTP01Challenge(challenge);

			// Verify challenge file is created
			const challengeContent = await certManager.getHTTP01ChallengeContent(challenge.token);
			expect(challengeContent).toBe(challenge.keyAuthorization);
		});

		it('should complete ACME certificate issuance', async () => {
			const mockOrder = {
				url: 'order-url',
				finalize: vi.fn().mockResolvedValue({
					certificate: mockCertPEM
				})
			};

			certManager.acmeClient = {
				finalizeOrder: vi.fn().mockResolvedValue(mockCertPEM)
			};

			const certificate = await certManager.finalizeACMEOrder(mockOrder, mockCertPEM);
			expect(certificate).toBe(mockCertPEM);
		});

		it('should handle ACME errors gracefully', async () => {
			certManager.acmeClient = {
				createOrder: vi.fn().mockRejectedValue(new Error('ACME server error'))
			};

			await expect(
				certManager.initiateACMEOrder('example.com', 'admin@example.com')
			).rejects.toThrow('ACME server error');
		});
	});

	describe('Certificate Monitoring', () => {
		it('should get certificates expiring soon', async () => {
			// Create certificate expiring in 10 days
			const expiringSoon = new Date();
			expiringSoon.setDate(expiringSoon.getDate() + 10);

			await certManager.storeCertificate({
				name: 'expiring-soon',
				domain: 'expire.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM,
				expiresAt: expiringSoon
			});

			const expiringCerts = await certManager.getCertificatesExpiringSoon(30); // 30 days
			expect(expiringCerts).toHaveLength(1);
			expect(expiringCerts[0].domain).toBe('expire.com');
		});

		it('should schedule certificate renewal', async () => {
			const cert = await certManager.storeCertificate({
				name: 'auto-renew',
				domain: 'renew.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			await certManager.scheduleRenewal(cert.id, new Date(Date.now() + 24 * 60 * 60 * 1000)); // 1 day

			const renewals = await certManager.getPendingRenewals();
			expect(renewals).toHaveLength(1);
			expect(renewals[0].certificateId).toBe(cert.id);
		});

		it('should send expiry alerts', async () => {
			const mockMailer = vi.fn();
			certManager.setMailer(mockMailer);

			const expiringSoon = new Date();
			expiringSoon.setDate(expiringSoon.getDate() + 5);

			await certManager.storeCertificate({
				name: 'alert-cert',
				domain: 'alert.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM,
				expiresAt: expiringSoon
			});

			await certManager.sendExpiryAlerts();
			expect(mockMailer).toHaveBeenCalled();
		});

		it('should get certificate health status', async () => {
			await certManager.storeCertificate({
				name: 'health-check',
				domain: 'health.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			const health = await certManager.getCertificateHealth();
			expect(health).toHaveProperty('total');
			expect(health).toHaveProperty('expiring');
			expect(health).toHaveProperty('expired');
			expect(health).toHaveProperty('healthy');
		});
	});

	describe('Certificate Renewal', () => {
		it("should automatically renew Let's Encrypt certificates", async () => {
			const cert = await certManager.storeCertificate({
				name: 'auto-renew-test',
				domain: 'autorenew.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			// Mock ACME renewal process
			certManager.acmeClient = {
				createOrder: vi.fn().mockResolvedValue({ url: 'order-url' }),
				finalizeOrder: vi.fn().mockResolvedValue(mockCertPEM)
			};

			const renewed = await certManager.renewCertificate(cert.id);
			expect(renewed.success).toBe(true);
			expect(renewed.certificate).toBeDefined();
		});

		it('should handle renewal failures', async () => {
			const cert = await certManager.storeCertificate({
				name: 'renewal-fail',
				domain: 'fail.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			// Mock ACME failure
			certManager.acmeClient = {
				createOrder: vi.fn().mockRejectedValue(new Error('Renewal failed'))
			};

			const result = await certManager.renewCertificate(cert.id);
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should not renew non-renewable certificates', async () => {
			const cert = await certManager.storeCertificate({
				name: 'manual-cert',
				domain: 'manual.com',
				type: 'mkcert',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			const result = await certManager.renewCertificate(cert.id);
			expect(result.success).toBe(false);
			expect(result.error).toContain('not renewable');
		});
	});

	describe('Certificate Backup and Recovery', () => {
		it('should export certificate for backup', async () => {
			const cert = await certManager.storeCertificate({
				name: 'backup-test',
				domain: 'backup.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM
			});

			const exported = await certManager.exportCertificate(cert.id);
			expect(exported).toHaveProperty('certificate');
			expect(exported).toHaveProperty('privateKey');
			expect(exported).toHaveProperty('metadata');
		});

		it('should import certificate from backup', async () => {
			const backupData = {
				name: 'imported-cert',
				domain: 'import.com',
				type: 'letsencrypt',
				certificate: mockCertPEM,
				privateKey: mockKeyPEM,
				metadata: { backupDate: new Date().toISOString() }
			};

			const imported = await certManager.importCertificate(backupData);
			expect(imported.success).toBe(true);
			expect(imported.certificate.name).toBe('imported-cert');
		});
	});
});
