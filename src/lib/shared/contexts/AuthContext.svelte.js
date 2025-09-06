/**
 * Simple Auth Context - Pure State Management
 *
 * Clean context focused only on authentication state without service creation.
 */

import { getContext, setContext } from 'svelte';

const AUTH_CONTEXT_KEY = Symbol('auth-context');

/**
 * Auth states
 */
export const AUTH_STATES = {
	UNKNOWN: 'unknown',
	CHECKING: 'checking',
	AUTHENTICATED: 'authenticated',
	NOT_AUTHENTICATED: 'not-authenticated',
	AUTHENTICATING: 'authenticating',
	ERROR: 'error'
};

/**
 * Create simple auth context
 */
export function createAuthContext() {
	// Simple reactive state - no service creation
	const auth = $state({
		state: AUTH_STATES.UNKNOWN,
		terminalKey: null,
		lastAttempt: null,
		error: null
	});

	// Claude-specific auth state
	const claudeAuth = $state({
		state: AUTH_STATES.UNKNOWN,
		oAuthUrl: null,
		authToken: '',
		authSessionId: null,
		projectId: null
	});

	// Simple computed states
	const isAuthenticated = $derived(() => auth.state === AUTH_STATES.AUTHENTICATED);
	const isAuthenticating = $derived(
		() => auth.state === AUTH_STATES.AUTHENTICATING || auth.state === AUTH_STATES.CHECKING
	);
	const hasAuthError = $derived(() => auth.state === AUTH_STATES.ERROR);

	const isClaudeAuthenticated = $derived(() => claudeAuth.state === AUTH_STATES.AUTHENTICATED);
	const isClaudeAuthenticating = $derived(
		() =>
			claudeAuth.state === AUTH_STATES.AUTHENTICATING || claudeAuth.state === AUTH_STATES.CHECKING
	);
	const showClaudeTokenInput = $derived(
		() => claudeAuth.state === 'waiting-for-token' && claudeAuth.oAuthUrl
	);

	// Simple state actions
	const actions = {
		// Terminal auth actions
		setAuthState(state) {
			auth.state = state;
			auth.lastAttempt = new Date().toISOString();
		},

		setTerminalKey(key) {
			auth.terminalKey = key;
		},

		setAuthError(error) {
			auth.error = error;
			auth.state = AUTH_STATES.ERROR;
		},

		clearAuthError() {
			auth.error = null;
			if (auth.state === AUTH_STATES.ERROR) {
				auth.state = AUTH_STATES.UNKNOWN;
			}
		},

		// Claude auth actions
		setClaudeAuthState(state) {
			claudeAuth.state = state;
		},

		setClaudeOAuthUrl(url) {
			claudeAuth.oAuthUrl = url;
		},

		setClaudeAuthToken(token) {
			claudeAuth.authToken = token;
		},

		setClaudeAuthSessionId(sessionId) {
			claudeAuth.authSessionId = sessionId;
		},

		setClaudeProjectId(projectId) {
			claudeAuth.projectId = projectId;
		},

		clearClaudeAuth() {
			claudeAuth.state = AUTH_STATES.UNKNOWN;
			claudeAuth.oAuthUrl = null;
			claudeAuth.authToken = '';
			claudeAuth.authSessionId = null;
		},

		// Combined actions
		reset() {
			auth.state = AUTH_STATES.UNKNOWN;
			auth.terminalKey = null;
			auth.lastAttempt = null;
			auth.error = null;

			this.clearClaudeAuth();
		}
	};

	const context = {
		// State
		auth,
		claudeAuth,

		// Computed
		isAuthenticated,
		isAuthenticating,
		hasAuthError,
		isClaudeAuthenticated,
		isClaudeAuthenticating,
		showClaudeTokenInput,

		// Actions
		...actions
	};

	setContext(AUTH_CONTEXT_KEY, context);
	return context;
}

/**
 * Get auth context
 */
export function getAuthContext() {
	const context = getContext(AUTH_CONTEXT_KEY);
	if (!context) {
		throw new Error(
			'Auth context not found. Make sure createAuthContext() is called in a parent component.'
		);
	}
	return context;
}

/**
 * Simple utility for terminal authentication
 */
export function useAuth() {
	const context = getAuthContext();
	return {
		isAuthenticated: context.isAuthenticated,
		isAuthenticating: context.isAuthenticating,
		hasError: context.hasAuthError,
		authState: context.auth.state,
		terminalKey: context.auth.terminalKey,
		error: context.auth.error,

		// Actions
		setAuthState: context.setAuthState,
		setTerminalKey: context.setTerminalKey,
		setError: context.setAuthError,
		clearError: context.clearAuthError,
		reset: context.reset
	};
}

/**
 * Simple utility for Claude authentication
 */
export function useClaudeAuth() {
	const context = getAuthContext();
	return {
		isAuthenticated: context.isClaudeAuthenticated,
		isAuthenticating: context.isClaudeAuthenticating,
		showTokenInput: context.showClaudeTokenInput,
		authState: context.claudeAuth.state,
		oAuthUrl: context.claudeAuth.oAuthUrl,
		authToken: context.claudeAuth.authToken,
		authSessionId: context.claudeAuth.authSessionId,
		projectId: context.claudeAuth.projectId,

		// Actions
		setState: context.setClaudeAuthState,
		setOAuthUrl: context.setClaudeOAuthUrl,
		setToken: context.setClaudeAuthToken,
		setSessionId: context.setClaudeAuthSessionId,
		setProjectId: context.setClaudeProjectId,
		clear: context.clearClaudeAuth
	};
}
