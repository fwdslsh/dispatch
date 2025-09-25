/**
 * Certificate model and data access object
 */
export class CertificateDAO {
	constructor(databaseManager) {
		this.db = databaseManager;
	}

	/**
	 * Create a new certificate
	 */
	async create(certificateData) {
		const {
			certType,
			domain,
			certificatePem,
			privateKeyPem,
			caCertificatePem = null,
			issuedAt = null,
			expiresAt = null,
			isActive = true,
			autoRenew = false
		} = certificateData;

		const result = await this.db.run(`
			INSERT INTO certificates (cert_type, domain, certificate_pem, private_key_pem,
			                        ca_certificate_pem, issued_at, expires_at, is_active, auto_renew)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, [certType, domain, certificatePem, privateKeyPem, caCertificatePem,
		    issuedAt, expiresAt, isActive ? 1 : 0, autoRenew ? 1 : 0]);

		return this.getById(result.lastID);
	}

	/**
	 * Get certificate by ID
	 */
	async getById(certificateId) {
		const row = await this.db.get('SELECT * FROM certificates WHERE id = ?', [certificateId]);
		return row ? this.mapRowToCertificate(row) : null;
	}

	/**
	 * Get certificate by domain
	 */
	async getByDomain(domain) {
		const row = await this.db.get(`
			SELECT * FROM certificates
			WHERE domain = ? AND is_active = 1
			ORDER BY created_at DESC
			LIMIT 1
		`, [domain]);

		return row ? this.mapRowToCertificate(row) : null;
	}

	/**
	 * Get active certificate by type and domain
	 */
	async getActive(certType, domain) {
		const row = await this.db.get(`
			SELECT * FROM certificates
			WHERE cert_type = ? AND domain = ? AND is_active = 1
			ORDER BY created_at DESC
			LIMIT 1
		`, [certType, domain]);

		return row ? this.mapRowToCertificate(row) : null;
	}

	/**
	 * List all certificates
	 */
	async list(options = {}) {
		const {
			page = 1,
			limit = 50,
			certType = null,
			domain = null,
			activeOnly = false,
			expiringSoon = false
		} = options;

		const offset = (page - 1) * limit;
		const conditions = [];
		const params = [];

		if (certType) {
			conditions.push('cert_type = ?');
			params.push(certType);
		}

		if (domain) {
			conditions.push('domain LIKE ?');
			params.push(`%${domain}%`);
		}

		if (activeOnly) {
			conditions.push('is_active = 1');
		}

		if (expiringSoon) {
			const soonTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
			conditions.push('expires_at IS NOT NULL AND expires_at < ?');
			params.push(soonTime);
		}

		const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

		params.push(limit, offset);

		const rows = await this.db.all(`
			SELECT * FROM certificates
			${whereClause}
			ORDER BY created_at DESC
			LIMIT ? OFFSET ?
		`, params);

		const certificates = rows.map(row => this.mapRowToCertificate(row));

		// Get total count for pagination
		const countParams = params.slice(0, -2); // Remove limit and offset
		const countResult = await this.db.get(`
			SELECT COUNT(*) as total FROM certificates ${whereClause}
		`, countParams);

		return {
			certificates,
			pagination: {
				page,
				limit,
				total: countResult.total,
				pages: Math.ceil(countResult.total / limit)
			}
		};
	}

	/**
	 * Update certificate
	 */
	async update(certificateId, updateData) {
		const allowedFields = [
			'certificate_pem', 'private_key_pem', 'ca_certificate_pem',
			'issued_at', 'expires_at', 'is_active', 'auto_renew'
		];

		const updates = [];
		const params = [];

		Object.keys(updateData).forEach(key => {
			if (allowedFields.includes(key)) {
				updates.push(`${key} = ?`);
				params.push(updateData[key]);
			}
		});

		if (updates.length === 0) {
			throw new Error('No valid fields to update');
		}

		params.push(Date.now(), certificateId);

		await this.db.run(`
			UPDATE certificates
			SET ${updates.join(', ')}, updated_at = ?
			WHERE id = ?
		`, params);

		return this.getById(certificateId);
	}

	/**
	 * Activate certificate (deactivate others of same type/domain)
	 */
	async activate(certificateId) {
		const cert = await this.getById(certificateId);
		if (!cert) {
			throw new Error('Certificate not found');
		}

		// Deactivate other certificates of same type and domain
		await this.db.run(`
			UPDATE certificates
			SET is_active = 0, updated_at = ?
			WHERE cert_type = ? AND domain = ? AND id != ?
		`, [Date.now(), cert.certType, cert.domain, certificateId]);

		// Activate this certificate
		await this.db.run(`
			UPDATE certificates
			SET is_active = 1, updated_at = ?
			WHERE id = ?
		`, [Date.now(), certificateId]);

		return this.getById(certificateId);
	}

	/**
	 * Deactivate certificate
	 */
	async deactivate(certificateId) {
		await this.db.run(`
			UPDATE certificates
			SET is_active = 0, updated_at = ?
			WHERE id = ?
		`, [Date.now(), certificateId]);
	}

	/**
	 * Delete certificate
	 */
	async delete(certificateId) {
		await this.db.run('DELETE FROM certificates WHERE id = ?', [certificateId]);
	}

	/**
	 * Get certificates expiring soon
	 */
	async getExpiringSoon(days = 30) {
		const futureTime = Date.now() + (days * 24 * 60 * 60 * 1000);

		const rows = await this.db.all(`
			SELECT * FROM certificates
			WHERE expires_at IS NOT NULL
			AND expires_at < ?
			AND is_active = 1
			ORDER BY expires_at ASC
		`, [futureTime]);

		return rows.map(row => this.mapRowToCertificate(row));
	}

	/**
	 * Get expired certificates
	 */
	async getExpired() {
		const now = Date.now();

		const rows = await this.db.all(`
			SELECT * FROM certificates
			WHERE expires_at IS NOT NULL
			AND expires_at < ?
			ORDER BY expires_at DESC
		`, [now]);

		return rows.map(row => this.mapRowToCertificate(row));
	}

	/**
	 * Get certificates eligible for auto-renewal
	 */
	async getAutoRenewEligible(days = 30) {
		const futureTime = Date.now() + (days * 24 * 60 * 60 * 1000);

		const rows = await this.db.all(`
			SELECT * FROM certificates
			WHERE auto_renew = 1
			AND is_active = 1
			AND expires_at IS NOT NULL
			AND expires_at < ?
			ORDER BY expires_at ASC
		`, [futureTime]);

		return rows.map(row => this.mapRowToCertificate(row));
	}

	/**
	 * Get certificate statistics
	 */
	async getStats() {
		const totalCerts = await this.db.get('SELECT COUNT(*) as count FROM certificates');

		const activeCerts = await this.db.get(`
			SELECT COUNT(*) as count FROM certificates WHERE is_active = 1
		`);

		const expiredCerts = await this.db.get(`
			SELECT COUNT(*) as count FROM certificates
			WHERE expires_at IS NOT NULL AND expires_at < ?
		`, [Date.now()]);

		const expiringSoon = await this.db.get(`
			SELECT COUNT(*) as count FROM certificates
			WHERE expires_at IS NOT NULL AND expires_at < ? AND expires_at > ?
		`, [Date.now() + (30 * 24 * 60 * 60 * 1000), Date.now()]);

		const autoRenewEnabled = await this.db.get(`
			SELECT COUNT(*) as count FROM certificates WHERE auto_renew = 1
		`);

		const byType = await this.db.all(`
			SELECT cert_type, COUNT(*) as count
			FROM certificates
			WHERE is_active = 1
			GROUP BY cert_type
			ORDER BY count DESC
		`);

		return {
			total: totalCerts.count,
			active: activeCerts.count,
			expired: expiredCerts.count,
			expiringSoon: expiringSoon.count,
			autoRenewEnabled: autoRenewEnabled.count,
			byType: byType
		};
	}

	/**
	 * Clean up old inactive certificates
	 */
	async cleanupOldCertificates(daysOld = 90) {
		const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

		const result = await this.db.run(`
			DELETE FROM certificates
			WHERE is_active = 0 AND updated_at < ?
		`, [cutoffTime]);

		return result.changes;
	}

	/**
	 * Get certificate chain for domain (including CA certificate)
	 */
	async getCertificateChain(domain) {
		const cert = await this.getByDomain(domain);
		if (!cert) return null;

		return {
			certificate: cert.certificatePem,
			privateKey: cert.privateKeyPem,
			caCertificate: cert.caCertificatePem,
			fullChain: cert.caCertificatePem
				? cert.certificatePem + '\n' + cert.caCertificatePem
				: cert.certificatePem
		};
	}

	/**
	 * Check if domain has valid certificate
	 */
	async hasValidCertificate(domain) {
		const cert = await this.getByDomain(domain);
		if (!cert || !cert.isActive) return false;

		// Check if expired
		if (cert.expiresAt && cert.expiresAt < new Date()) {
			return false;
		}

		return true;
	}

	/**
	 * Map database row to certificate object
	 */
	mapRowToCertificate(row) {
		return {
			id: row.id,
			certType: row.cert_type,
			domain: row.domain,
			certificatePem: row.certificate_pem,
			privateKeyPem: row.private_key_pem,
			caCertificatePem: row.ca_certificate_pem,
			issuedAt: row.issued_at ? new Date(row.issued_at) : null,
			expiresAt: row.expires_at ? new Date(row.expires_at) : null,
			isActive: Boolean(row.is_active),
			autoRenew: Boolean(row.auto_renew),
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at)
		};
	}
}