import { json } from '@sveltejs/kit';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * OAuth token refresh API
 * POST /api/auth/oauth/refresh - Refresh OAuth tokens
 */

export async function POST({ request, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Get request body
		const body = await request.json();
		const { accountId } = body;

		if (!accountId) {
			return json(
				{
					success: false,
					error: 'Account ID is required'
				},
				{ status: 400 }
			);
		}

		// Get OAuth account
		const account = await oauthManager.daos.oauthAccounts.getById(accountId);
		if (!account) {
			return json(
				{
					success: false,
					error: 'OAuth account not found'
				},
				{ status: 404 }
			);
		}

		if (!account.refreshToken) {
			return json(
				{
					success: false,
					error: 'No refresh token available for this account'
				},
				{ status: 400 }
			);
		}

		// Refresh tokens based on provider
		const refreshResult = await refreshProviderTokens(account, baseUrl);

		if (refreshResult.success) {
			// Update account with new tokens
			const updateResult = await oauthManager.refreshToken(accountId, {
				accessToken: refreshResult.accessToken,
				refreshToken: refreshResult.refreshToken,
				tokenExpiresAt: refreshResult.expiresAt
			});

			if (updateResult.success) {
				logger.info('OAUTH', `Successfully refreshed tokens for account ${accountId}`);
				return json({
					success: true,
					message: 'Tokens refreshed successfully'
				});
			} else {
				return json(
					{
						success: false,
						error: 'Failed to update tokens in database'
					},
					{ status: 500 }
				);
			}
		} else {
			logger.error(
				'OAUTH',
				`Token refresh failed for account ${accountId}: ${refreshResult.error}`
			);
			return json(
				{
					success: false,
					error: refreshResult.error
				},
				{ status: 400 }
			);
		}
	} catch (error) {
		logger.error('OAUTH', `OAuth token refresh error: ${error.message}`);
		return json(
			{
				success: false,
				error: 'Token refresh failed'
			},
			{ status: 500 }
		);
	}
}

/**
 * Refresh tokens for different OAuth providers
 */
async function refreshProviderTokens(account, baseUrl) {
	try {
		switch (account.provider) {
			case 'google':
				return await refreshGoogleTokens(account, baseUrl);
			case 'github':
				return await refreshGitHubTokens(account, baseUrl);
			default:
				return {
					success: false,
					error: `Token refresh not implemented for provider: ${account.provider}`
				};
		}
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Refresh Google OAuth tokens
 */
async function refreshGoogleTokens(account, baseUrl) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const oauthManager = new OAuthManager(db, baseUrl);
		const providerConfig = await oauthManager.getProviderConfig('google');

		const tokenUrl = 'https://oauth2.googleapis.com/token';
		const params = new URLSearchParams({
			client_id: providerConfig.clientId,
			client_secret: providerConfig.clientSecret,
			refresh_token: account.refreshToken,
			grant_type: 'refresh_token'
		});

		const response = await fetch(tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: params
		});

		if (!response.ok) {
			const errorData = await response.text();
			return { success: false, error: `Google token refresh failed: ${errorData}` };
		}

		const tokens = await response.json();

		if (tokens.error) {
			return {
				success: false,
				error: `Google token refresh failed: ${tokens.error_description || tokens.error}`
			};
		}

		return {
			success: true,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token || account.refreshToken, // Google may not return new refresh token
			expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null
		};
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Refresh GitHub OAuth tokens
 * Note: GitHub doesn't support refresh tokens in the traditional sense
 * Access tokens have long expiration times and don't typically need refreshing
 */
async function refreshGitHubTokens(account, baseUrl) {
	// GitHub tokens are typically long-lived and don't need refreshing
	// This is a placeholder for GitHub-specific token management if needed
	return {
		success: false,
		error: 'GitHub tokens do not require refreshing - they are long-lived'
	};
}

/**
 * Check if account tokens need refreshing
 */
export async function needsRefresh(account) {
	if (!account.tokenExpiresAt) {
		return false; // No expiration time set
	}

	// Refresh if token expires within the next 5 minutes
	const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
	return account.tokenExpiresAt < fiveMinutesFromNow;
}

/**
 * Auto-refresh expired tokens (can be called by a background job)
 */
export async function autoRefreshExpiredTokens() {
	try {
		const db = new DatabaseManager();
		await db.init();

		const oauthManager = new OAuthManager(db);
		const expiredAccounts = await oauthManager.getExpiredTokens();

		const refreshPromises = expiredAccounts
			.filter((account) => account.refreshToken) // Only refresh accounts with refresh tokens
			.map(async (account) => {
				try {
					const refreshResult = await refreshProviderTokens(account, 'http://localhost:3000');
					if (refreshResult.success) {
						await oauthManager.refreshToken(account.id, {
							accessToken: refreshResult.accessToken,
							refreshToken: refreshResult.refreshToken,
							tokenExpiresAt: refreshResult.expiresAt
						});
						logger.info('OAUTH', `Auto-refreshed tokens for account ${account.id}`);
					} else {
						logger.warn(
							'OAUTH',
							`Failed to auto-refresh tokens for account ${account.id}: ${refreshResult.error}`
						);
					}
				} catch (error) {
					logger.error('OAUTH', `Auto-refresh error for account ${account.id}: ${error.message}`);
				}
			});

		await Promise.all(refreshPromises);
		return { success: true, processed: expiredAccounts.length };
	} catch (error) {
		logger.error('OAUTH', `Auto-refresh process error: ${error.message}`);
		return { success: false, error: error.message };
	}
}
