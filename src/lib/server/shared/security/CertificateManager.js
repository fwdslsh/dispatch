import { createDAOs } from '../db/models/index.js';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import * as x509 from '@peculiar/x509';
import acme from 'acme-client';

/**
 * CertificateManager - Manages SSL/TLS certificates with encryption at rest
 *
 * Features:
 * - Encrypted certificate and private key storage
 * - mkcert certificate upload and validation
 * - Let's Encrypt ACME integration
 * - Certificate monitoring and renewal
 * - Expiry alerts and health checks
 */
export class CertificateManager {
	constructor(databaseManager, appSecret) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
		this.appSecret = appSecret;

		// ACME client (initialized on first use)
		this.acmeClient = null;
		this.acmeAccountKey = null;

		// HTTP-01 challenge storage
		this.http01Challenges = new Map();

		// Renewal scheduler
		this.renewalJobs = new Map();
		this.startRenewalScheduler();
	}

	/**
	 * Certificate Storage with Encryption
	 */
	async storeCertificate(certData) {
		const {
			name,
			domain,
			type,
			certificate,
			privateKey,
			caCertificate = null,
			domains = [domain],
			expiresAt = null,
			autoRenew = false
		} = certData;

		// Parse certificate for metadata
		const certInfo = this.parseCertificate(certificate);
		const actualExpiresAt = expiresAt || new Date(certInfo.validTo);

		// Encrypt sensitive data
		const encryptedCert = this.encrypt(certificate);
		const encryptedKey = this.encrypt(privateKey);
		const encryptedCa = caCertificate ? this.encrypt(caCertificate) : null;

		// Use Certificate DAO with existing schema
		const stored = await this.daos.certificate.create({
			certType: type,
			domain,
			certificatePem: encryptedCert,
			privateKeyPem: encryptedKey,
			caCertificatePem: encryptedCa,
			issuedAt: Date.now(),
			expiresAt: actualExpiresAt.getTime(),
			isActive: true,
			autoRenew
		});

		// Log certificate storage
		await this.daos.authEvents.logEvent(
			null, null, null, 'CertificateManager',
			'certificate_stored',
			{ name, domain, type, fingerprint: certInfo.fingerprint }
		);

		return {
			id: stored.id,
			name,
			domain,
			domains,
			type,
			expiresAt: actualExpiresAt,
			fingerprint: certInfo.fingerprint,
			autoRenew
		};
	}

	async getCertificate(certificateId) {
		const cert = await this.daos.certificate.getById(certificateId);
		if (!cert) return null;

		// Decrypt sensitive data
		const certificate = this.decrypt(cert.certificatePem);
		const privateKey = this.decrypt(cert.privateKeyPem);
		const caCertificate = cert.caCertificatePem ? this.decrypt(cert.caCertificatePem) : null;

		return {
			id: cert.id,
			name: `${cert.certType}-${cert.domain}`,
			domain: cert.domain,
			domains: [cert.domain], // Single domain for existing schema
			type: cert.certType,
			certificate,
			privateKey,
			caCertificate,
			expiresAt: cert.expiresAt,
			fingerprint: this.parseCertificate(certificate).fingerprint,
			isActive: cert.isActive,
			autoRenew: cert.autoRenew,
			createdAt: cert.createdAt,
			updatedAt: cert.updatedAt
		};
	}

	async listCertificates() {
		const result = await this.daos.certificate.list();

		return result.certificates.map(cert => {
			const daysUntilExpiry = cert.expiresAt ?
				Math.ceil((cert.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;

			return {
				id: cert.id,
				name: `${cert.certType}-${cert.domain}`,
				domain: cert.domain,
				domains: [cert.domain],
				type: cert.certType,
				expiresAt: cert.expiresAt,
				isActive: cert.isActive,
				autoRenew: cert.autoRenew,
				createdAt: cert.createdAt,
				updatedAt: cert.updatedAt,
				isExpired: cert.expiresAt && cert.expiresAt < new Date(),
				daysUntilExpiry
			};
		});
	}

	async deleteCertificate(certificateId) {
		const cert = await this.getCertificate(certificateId);
		if (!cert) return false;

		await this.daos.certificate.delete(certificateId);

		// Cancel any pending renewals
		if (this.renewalJobs.has(certificateId)) {
			clearTimeout(this.renewalJobs.get(certificateId));
			this.renewalJobs.delete(certificateId);
		}

		// Log deletion
		await this.daos.authEvents.logEvent(
			null, null, null, 'CertificateManager',
			'certificate_deleted',
			{ id: certificateId, name: cert.name, domain: cert.domain }
		);

		return true;
	}

	/**
	 * Encryption/Decryption
	 */
	encrypt(data) {
		const algorithm = 'aes-256-ctr';
		const key = createHash('sha256').update(this.appSecret).digest();
		const iv = randomBytes(16);

		const cipher = createCipheriv(algorithm, key, iv);
		let encrypted = cipher.update(data, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		return iv.toString('hex') + ':' + encrypted;
	}

	decrypt(encryptedData) {
		const algorithm = 'aes-256-ctr';
		const key = createHash('sha256').update(this.appSecret).digest();

		const [ivHex, encrypted] = encryptedData.split(':');
		const iv = Buffer.from(ivHex, 'hex');

		const decipher = createDecipheriv(algorithm, key, iv);
		let decrypted = decipher.update(encrypted, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	}

	/**
	 * Certificate Parsing and Validation
	 */
	parseCertificate(certPEM) {
		try {
			const cert = new x509.X509Certificate(certPEM);

			return {
				subject: cert.subject,
				issuer: cert.issuer,
				serialNumber: cert.serialNumber,
				validFrom: cert.notBefore,
				validTo: cert.notAfter,
				fingerprint: createHash('sha256').update(cert.rawData).digest('hex'),
				version: cert.version,
				extensions: cert.extensions?.map(ext => ({
					oid: ext.oid,
					critical: ext.critical,
					value: ext.value
				})) || []
			};
		} catch (error) {
			// Fallback for non-standard certificates
			return this.parseCertificateFallback(certPEM);
		}
	}

	parseCertificateFallback(certPEM) {
		// Simple regex-based parsing for basic info
		const subjectMatch = certPEM.match(/Subject: (.+)/);
		const issuerMatch = certPEM.match(/Issuer: (.+)/);

		return {
			subject: subjectMatch?.[1] || 'Unknown',
			issuer: issuerMatch?.[1] || 'Unknown',
			validFrom: new Date(),
			validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
			fingerprint: createHash('sha256').update(certPEM).digest('hex')
		};
	}

	validateCertificateKeyPair(certPEM, keyPEM) {
		// This is a simplified validation
		// In production, you'd want proper cryptographic validation
		return certPEM.includes('BEGIN CERTIFICATE') &&
			   keyPEM.includes('BEGIN PRIVATE KEY');
	}

	detectCertificateType(certPEM) {
		const info = this.parseCertificate(certPEM);

		if (info.issuer.includes('mkcert')) {
			return 'mkcert';
		} else if (info.issuer.includes("Let's Encrypt")) {
			return 'letsencrypt';
		} else if (info.subject === info.issuer) {
			return 'self-signed';
		} else {
			return 'ca-signed';
		}
	}

	getDaysUntilExpiry(certPEM) {
		const info = this.parseCertificate(certPEM);
		const now = new Date();
		const expiry = new Date(info.validTo);
		return Math.ceil((expiry - now) / (24 * 60 * 60 * 1000));
	}

	/**
	 * mkcert Integration
	 */
	async uploadMkcertCertificate(mkcertData) {
		const { name, domains, certificate, privateKey } = mkcertData;

		// Validate mkcert certificate
		if (!this.validateMkcertCertificate(certificate)) {
			return {
				success: false,
				error: 'Invalid mkcert certificate format'
			};
		}

		// Validate key pair
		if (!this.validateCertificateKeyPair(certificate, privateKey)) {
			return {
				success: false,
				error: 'Certificate and private key do not match'
			};
		}

		try {
			const stored = await this.storeCertificate({
				name,
				domain: domains[0],
				domains,
				type: 'mkcert',
				certificate,
				privateKey
			});

			return {
				success: true,
				certificate: stored
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	validateMkcertCertificate(certPEM) {
		const info = this.parseCertificate(certPEM);
		// mkcert certificates are typically self-signed or have mkcert in issuer
		return info.issuer.includes('mkcert') || info.subject === info.issuer;
	}

	getMkcertInstallInstructions() {
		return `
# Install mkcert
# On macOS:
brew install mkcert

# On Linux:
sudo apt install libnss3-tools
curl -s https://api.github.com/repos/FiloSottile/mkcert/releases/latest | grep browser_download_url | grep linux-amd64 | cut -d '"' -f 4 | wget -qi -
chmod +x mkcert-*-linux-amd64
sudo mv mkcert-*-linux-amd64 /usr/local/bin/mkcert

# Install CA
mkcert -install

# Generate certificate
mkcert localhost 127.0.0.1 ::1

# This will create:
# localhost+2.pem (certificate)
# localhost+2-key.pem (private key)
		`.trim();
	}

	/**
	 * Let's Encrypt ACME Integration
	 */
	async initializeACMEClient(email, staging = false) {
		const directoryUrl = staging
			? acme.directory.letsencrypt.staging
			: acme.directory.letsencrypt.production;

		// Generate account key if not exists
		if (!this.acmeAccountKey) {
			this.acmeAccountKey = await acme.forge.createPrivateKey();
		}

		this.acmeClient = new acme.Client({
			directoryUrl,
			accountKey: this.acmeAccountKey
		});

		// Create or retrieve account
		try {
			await this.acmeClient.createAccount({
				email,
				termsOfServiceAgreed: true
			});
		} catch (error) {
			// Account might already exist, continue
			console.log('ACME account creation:', error.message);
		}

		return this.acmeClient;
	}

	async initiateACMEOrder(domain, email) {
		if (!this.acmeClient) {
			await this.initializeACMEClient(email);
		}

		const order = await this.acmeClient.createOrder({
			identifiers: [{ type: 'dns', value: domain }]
		});

		const authorizations = await this.acmeClient.getAuthorizations(order);
		const challenges = [];

		for (const authz of authorizations) {
			const http01Challenge = authz.challenges.find(c => c.type === 'http-01');
			if (http01Challenge) {
				const keyAuthorization = await this.acmeClient.getChallengeKeyAuthorization(http01Challenge);
				challenges.push({
					...http01Challenge,
					keyAuthorization
				});
			}
		}

		return {
			order,
			challenges,
			domain
		};
	}

	async setupHTTP01Challenge(challenge) {
		const { token, keyAuthorization } = challenge;
		this.http01Challenges.set(token, keyAuthorization);

		// In a real implementation, you'd set up your web server to serve
		// the challenge at /.well-known/acme-challenge/{token}
	}

	async getHTTP01ChallengeContent(token) {
		return this.http01Challenges.get(token);
	}

	async completeACMEChallenge(challenge) {
		if (!this.acmeClient) {
			throw new Error('ACME client not initialized');
		}

		await this.acmeClient.completeChallenge(challenge);
		await this.acmeClient.waitForValidStatus(challenge);
	}

	async finalizeACMEOrder(order, domain) {
		if (!this.acmeClient) {
			throw new Error('ACME client not initialized');
		}

		// Generate private key and CSR
		const [privateKey, csr] = await acme.forge.createCsr({
			commonName: domain,
			altNames: [domain]
		});

		// Finalize order
		await this.acmeClient.finalizeOrder(order, csr);
		const certificate = await this.acmeClient.getCertificate(order);

		return {
			certificate,
			privateKey,
			domain
		};
	}

	async provisionLetsEncryptCertificate(domain, email) {
		try {
			// Step 1: Initiate ACME order
			const { order, challenges } = await this.initiateACMEOrder(domain, email);

			// Step 2: Set up HTTP-01 challenges
			for (const challenge of challenges) {
				await this.setupHTTP01Challenge(challenge);
			}

			// Step 3: Complete challenges
			for (const challenge of challenges) {
				await this.completeACMEChallenge(challenge);
			}

			// Step 4: Finalize order and get certificate
			const { certificate, privateKey } = await this.finalizeACMEOrder(order, domain);

			// Step 5: Store certificate
			const stored = await this.storeCertificate({
				name: `letsencrypt-${domain}`,
				domain,
				type: 'letsencrypt',
				certificate,
				privateKey
			});

			// Step 6: Schedule renewal
			await this.scheduleRenewal(stored.id, new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)); // 60 days

			return {
				success: true,
				certificate: stored
			};

		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Certificate Monitoring and Renewal
	 */
	async getCertificatesExpiringSoon(days = 30) {
		const expiring = await this.daos.certificate.getExpiringSoon(days);

		return expiring.map(cert => ({
			id: cert.id,
			name: `${cert.certType}-${cert.domain}`,
			domain: cert.domain,
			type: cert.certType,
			expiresAt: cert.expiresAt,
			daysUntilExpiry: Math.ceil((cert.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
		}));
	}

	async scheduleRenewal(certificateId, renewalDate) {
		// Use settings storage for renewal schedules since we don't have a renewals table
		const renewals = await this.db.getSettingsByCategory('certificate_renewals') || {};
		renewals[certificateId] = {
			scheduledAt: renewalDate.getTime(),
			createdAt: Date.now()
		};

		await this.db.setSettingsForCategory('certificate_renewals', renewals, 'Certificate renewal schedule');

		// Schedule in-memory job
		const timeUntilRenewal = renewalDate.getTime() - Date.now();
		if (timeUntilRenewal > 0) {
			const timeoutId = setTimeout(async () => {
				await this.renewCertificate(certificateId);
				this.renewalJobs.delete(certificateId);
			}, timeUntilRenewal);

			this.renewalJobs.set(certificateId, timeoutId);
		}
	}

	async getPendingRenewals() {
		const renewals = await this.db.getSettingsByCategory('certificate_renewals') || {};
		const now = Date.now();

		const pending = [];
		for (const [certIdStr, renewal] of Object.entries(renewals)) {
			const certId = parseInt(certIdStr);
			if (renewal.scheduledAt > now) {
				const cert = await this.getCertificate(certId);
				if (cert) {
					pending.push({
						certificateId: certId,
						name: cert.name,
						domain: cert.domain,
						type: cert.type,
						scheduledAt: new Date(renewal.scheduledAt)
					});
				}
			}
		}

		return pending.sort((a, b) => a.scheduledAt - b.scheduledAt);
	}

	async renewCertificate(certificateId) {
		const cert = await this.getCertificate(certificateId);
		if (!cert) {
			return { success: false, error: 'Certificate not found' };
		}

		if (cert.type !== 'letsencrypt') {
			return { success: false, error: 'Certificate type is not renewable' };
		}

		try {
			// Renew Let's Encrypt certificate
			const result = await this.provisionLetsEncryptCertificate(cert.domain, 'admin@' + cert.domain);

			if (result.success) {
				// Delete old certificate
				await this.deleteCertificate(certificateId);

				// Log renewal
				await this.daos.authEvents.logEvent(
					null, null, null, 'CertificateManager',
					'certificate_renewed',
					{ domain: cert.domain, oldId: certificateId, newId: result.certificate.id }
				);

				return {
					success: true,
					certificate: result.certificate
				};
			} else {
				return result;
			}

		} catch (error) {
			await this.daos.authEvents.logEvent(
				null, null, null, 'CertificateManager',
				'certificate_renewal_failed',
				{ certificateId, domain: cert.domain, error: error.message }
			);

			return { success: false, error: error.message };
		}
	}

	async sendExpiryAlerts() {
		const expiringCerts = await this.getCertificatesExpiringSoon(7); // 7 days

		if (expiringCerts.length > 0 && this.mailer) {
			const message = {
				to: 'admin@example.com', // Configure this
				subject: `Certificate Expiry Alert - ${expiringCerts.length} certificates expiring soon`,
				html: `
					<h2>Certificate Expiry Alert</h2>
					<p>The following certificates are expiring within 7 days:</p>
					<ul>
						${expiringCerts.map(cert =>
							`<li>${cert.domain} - expires in ${cert.daysUntilExpiry} days</li>`
						).join('')}
					</ul>
					<p>Please renew these certificates to avoid service disruption.</p>
				`
			};

			await this.mailer(message);
		}
	}

	setMailer(mailerFunction) {
		this.mailer = mailerFunction;
	}

	async getCertificateHealth() {
		const stats = await this.daos.certificate.getStats();

		return {
			total: stats.total,
			expired: stats.expired,
			expiring: stats.expiringSoon,
			healthy: stats.active - stats.expiringSoon,
			active: stats.active,
			autoRenewEnabled: stats.autoRenewEnabled,
			byType: stats.byType
		};
	}

	/**
	 * Certificate Export/Import
	 */
	async exportCertificate(certificateId) {
		const cert = await this.getCertificate(certificateId);
		if (!cert) return null;

		return {
			certificate: cert.certificate,
			privateKey: cert.privateKey,
			metadata: {
				name: cert.name,
				domain: cert.domain,
				domains: cert.domains,
				type: cert.type,
				fingerprint: cert.fingerprint,
				expiresAt: cert.expiresAt.toISOString(),
				exportDate: new Date().toISOString()
			}
		};
	}

	async importCertificate(backupData) {
		const { certificate, privateKey, metadata } = backupData;

		try {
			const stored = await this.storeCertificate({
				name: metadata.name,
				domain: metadata.domain,
				domains: metadata.domains,
				type: metadata.type,
				certificate,
				privateKey
			});

			return {
				success: true,
				certificate: stored
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Cleanup and Scheduling
	 */
	startRenewalScheduler() {
		// Check for renewals every hour
		setInterval(async () => {
			const pendingRenewals = await this.getPendingRenewals();
			const now = Date.now();

			for (const renewal of pendingRenewals) {
				if (renewal.scheduledAt.getTime() <= now) {
					await this.renewCertificate(renewal.certificateId);
				}
			}

			// Send expiry alerts daily
			const hour = new Date().getHours();
			if (hour === 9) { // 9 AM
				await this.sendExpiryAlerts();
			}
		}, 60 * 60 * 1000); // 1 hour
	}

	async cleanup() {
		// Clear renewal jobs
		for (const timeoutId of this.renewalJobs.values()) {
			clearTimeout(timeoutId);
		}
		this.renewalJobs.clear();

		// Clear challenge storage
		this.http01Challenges.clear();
	}
}