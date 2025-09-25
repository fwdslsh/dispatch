/**
 * OAuthAccount model and data access object
 */
export class OAuthAccountDAO {
	constructor(databaseManager) {
		this.db = databaseManager;
	}

	/**
	 * Create or update OAuth account
	 */
	async createOrUpdate(accountData) {
		const {
			userId,
			provider,
			providerAccountId,
			providerEmail = null,
			providerName = null,
			accessToken = null,
			refreshToken = null,
			tokenExpiresAt = null
		} = accountData;

		// Check if account already exists
		const existing = await this.getByProvider(provider, providerAccountId);

		if (existing) {
			// Update existing account
			await this.db.run(`
				UPDATE oauth_accounts
				SET provider_email = ?, provider_name = ?, access_token = ?,
				    refresh_token = ?, token_expires_at = ?, updated_at = ?
				WHERE provider = ? AND provider_account_id = ?
			`, [providerEmail, providerName, accessToken, refreshToken, tokenExpiresAt, Date.now(), provider, providerAccountId]);

			return this.getById(existing.id);
		} else {
			// Create new account
			const result = await this.db.run(`
				INSERT INTO oauth_accounts (user_id, provider, provider_account_id, provider_email,
				                          provider_name, access_token, refresh_token, token_expires_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`, [userId, provider, providerAccountId, providerEmail, providerName, accessToken, refreshToken, tokenExpiresAt]);

			return this.getById(result.lastID);
		}
	}

	/**
	 * Get OAuth account by ID
	 */
	async getById(accountId) {
		const row = await this.db.get('SELECT * FROM oauth_accounts WHERE id = ?', [accountId]);
		return row ? this.mapRowToAccount(row) : null;
	}

	/**
	 * Get OAuth account by provider and provider account ID
	 */
	async getByProvider(provider, providerAccountId) {
		const row = await this.db.get(`
			SELECT * FROM oauth_accounts
			WHERE provider = ? AND provider_account_id = ?
		`, [provider, providerAccountId]);

		return row ? this.mapRowToAccount(row) : null;
	}

	/**
	 * Get OAuth account by provider and provider email
	 */
	async getByProviderEmail(provider, providerEmail) {
		const row = await this.db.get(`
			SELECT * FROM oauth_accounts
			WHERE provider = ? AND provider_email = ?
		`, [provider, providerEmail]);

		return row ? this.mapRowToAccount(row) : null;
	}

	/**
	 * Get all OAuth accounts for a user
	 */
	async getByUserId(userId) {
		const rows = await this.db.all(`
			SELECT * FROM oauth_accounts
			WHERE user_id = ?
			ORDER BY created_at DESC
		`, [userId]);

		return rows.map(row => this.mapRowToAccount(row));
	}

	/**
	 * Get OAuth accounts by provider for a user
	 */
	async getByUserIdAndProvider(userId, provider) {
		const rows = await this.db.all(`
			SELECT * FROM oauth_accounts
			WHERE user_id = ? AND provider = ?
			ORDER BY created_at DESC
		`, [userId, provider]);

		return rows.map(row => this.mapRowToAccount(row));
	}

	/**
	 * Update OAuth account tokens
	 */
	async updateTokens(accountId, tokens) {
		const { accessToken, refreshToken = null, tokenExpiresAt = null } = tokens;

		await this.db.run(`
			UPDATE oauth_accounts
			SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ?
			WHERE id = ?
		`, [accessToken, refreshToken, tokenExpiresAt, Date.now(), accountId]);
	}

	/**
	 * Update provider information
	 */
	async updateProviderInfo(accountId, providerData) {
		const { providerEmail = null, providerName = null } = providerData;

		await this.db.run(`
			UPDATE oauth_accounts
			SET provider_email = ?, provider_name = ?, updated_at = ?
			WHERE id = ?
		`, [providerEmail, providerName, Date.now(), accountId]);
	}

	/**
	 * Delete OAuth account
	 */
	async delete(accountId) {
		await this.db.run('DELETE FROM oauth_accounts WHERE id = ?', [accountId]);
	}

	/**
	 * Delete OAuth account by provider
	 */
	async deleteByProvider(provider, providerAccountId) {
		await this.db.run(`
			DELETE FROM oauth_accounts
			WHERE provider = ? AND provider_account_id = ?
		`, [provider, providerAccountId]);
	}

	/**
	 * Delete all OAuth accounts for a user
	 */
	async deleteByUserId(userId) {
		await this.db.run('DELETE FROM oauth_accounts WHERE user_id = ?', [userId]);
	}

	/**
	 * List all OAuth accounts with user information for admin
	 */
	async listAllAccounts(options = {}) {
		const { page = 1, limit = 50, provider = null, userId = null } = options;
		const offset = (page - 1) * limit;

		const conditions = [];
		const params = [];

		if (provider) {
			conditions.push('o.provider = ?');
			params.push(provider);
		}

		if (userId) {
			conditions.push('o.user_id = ?');
			params.push(userId);
		}

		const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

		params.push(limit, offset);

		const rows = await this.db.all(`
			SELECT o.*, u.username, u.display_name
			FROM oauth_accounts o
			LEFT JOIN users u ON o.user_id = u.id
			${whereClause}
			ORDER BY o.updated_at DESC
			LIMIT ? OFFSET ?
		`, params);

		return rows.map(row => this.mapRowToAccount(row, true));
	}

	/**
	 * Get OAuth account statistics
	 */
	async getStats() {
		const totalAccounts = await this.db.get('SELECT COUNT(*) as count FROM oauth_accounts');

		const byProvider = await this.db.all(`
			SELECT provider, COUNT(*) as count
			FROM oauth_accounts
			GROUP BY provider
			ORDER BY count DESC
		`);

		const recentlyUpdated = await this.db.get(`
			SELECT COUNT(*) as count FROM oauth_accounts
			WHERE updated_at > ?
		`, [Date.now() - (30 * 24 * 60 * 60 * 1000)]); // Last 30 days

		const expiringSoon = await this.db.get(`
			SELECT COUNT(*) as count FROM oauth_accounts
			WHERE token_expires_at IS NOT NULL AND token_expires_at < ?
		`, [Date.now() + (24 * 60 * 60 * 1000)]); // Expiring within 24 hours

		return {
			total: totalAccounts.count,
			byProvider: byProvider,
			recentlyUpdated: recentlyUpdated.count,
			expiringSoon: expiringSoon.count
		};
	}

	/**
	 * Find OAuth account for login (by provider and email)
	 */
	async findForLogin(provider, providerAccountId, providerEmail) {
		// First try to find by provider account ID
		let account = await this.getByProvider(provider, providerAccountId);

		// If not found and email provided, try to find by email
		if (!account && providerEmail) {
			account = await this.getByProviderEmail(provider, providerEmail);
		}

		return account;
	}

	/**
	 * Check if provider account is already linked to another user
	 */
	async isProviderAccountLinked(provider, providerAccountId, excludeUserId = null) {
		let sql = 'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?';
		const params = [provider, providerAccountId];

		if (excludeUserId) {
			sql += ' AND user_id != ?';
			params.push(excludeUserId);
		}

		const result = await this.db.get(sql, params);
		return result !== undefined;
	}

	/**
	 * Get accounts with expired tokens
	 */
	async getAccountsWithExpiredTokens() {
		const now = Date.now();
		const rows = await this.db.all(`
			SELECT * FROM oauth_accounts
			WHERE token_expires_at IS NOT NULL AND token_expires_at < ?
			ORDER BY token_expires_at ASC
		`, [now]);

		return rows.map(row => this.mapRowToAccount(row));
	}

	/**
	 * Clean up old OAuth accounts with expired tokens
	 */
	async cleanupExpiredTokens(daysOld = 90) {
		const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

		const result = await this.db.run(`
			DELETE FROM oauth_accounts
			WHERE token_expires_at IS NOT NULL AND token_expires_at < ?
		`, [cutoffTime]);

		return result.changes;
	}

	/**
	 * Map database row to OAuth account object
	 */
	mapRowToAccount(row, includeExtended = false) {
		const account = {
			id: row.id,
			userId: row.user_id,
			provider: row.provider,
			providerAccountId: row.provider_account_id,
			providerEmail: row.provider_email,
			providerName: row.provider_name,
			accessToken: row.access_token,
			refreshToken: row.refresh_token,
			tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at)
		};

		if (includeExtended) {
			account.user = {
				username: row.username,
				displayName: row.display_name
			};
		}

		return account;
	}
}