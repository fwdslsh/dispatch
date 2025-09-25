import { json } from '@sveltejs/kit';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * OAuth account management API
 * GET /api/auth/oauth/accounts - Get user's OAuth accounts
 * DELETE /api/auth/oauth/accounts - Unlink OAuth account
 */

export async function GET({ request, url, cookies }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Get user ID from authentication (you might need to implement session validation)
		const userId = url.searchParams.get('userId');
		if (!userId) {
			return json({
				success: false,
				error: 'User ID is required'
			}, { status: 400 });
		}

		// Get user's OAuth accounts
		const accounts = await oauthManager.daos.oauthAccounts.getByUserId(userId);

		// Sanitize accounts (remove sensitive data)
		const sanitizedAccounts = accounts.map(account => ({
			id: account.id,
			provider: account.provider,
			providerEmail: account.providerEmail,
			providerName: account.providerName,
			createdAt: account.createdAt,
			updatedAt: account.updatedAt,
			isExpired: account.tokenExpiresAt ? account.tokenExpiresAt < new Date() : false
		}));

		return json({
			success: true,
			accounts: sanitizedAccounts
		});

	} catch (error) {
		logger.error('OAUTH', `Failed to get OAuth accounts: ${error.message}`);
		return json({
			success: false,
			error: 'Failed to get OAuth accounts'
		}, { status: 500 });
	}
}

export async function DELETE({ request, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Get request body
		const body = await request.json();
		const { accountId, userId } = body;

		if (!accountId || !userId) {
			return json({
				success: false,
				error: 'Account ID and User ID are required'
			}, { status: 400 });
		}

		// Unlink OAuth account
		const result = await oauthManager.unlinkAccount(accountId, userId);

		if (result.success) {
			logger.info('OAUTH', `OAuth account ${accountId} unlinked from user ${userId}`);
		}

		return json(result);

	} catch (error) {
		logger.error('OAUTH', `Failed to unlink OAuth account: ${error.message}`);
		return json({
			success: false,
			error: 'Failed to unlink OAuth account'
		}, { status: 500 });
	}
}