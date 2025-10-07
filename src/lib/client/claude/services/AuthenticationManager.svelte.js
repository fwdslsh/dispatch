/**
 * AuthenticationManager.svelte.js
 *
 * Manages OAuth authentication flow state for Claude sessions.
 * Uses Svelte 5 runes-in-classes pattern for reactive state management.
 *
 * Responsibilities:
 * - Track authentication flow state (start, awaiting code, in progress, complete)
 * - Handle authentication event transitions
 * - Process authentication code input
 * - Provide derived states for UI
 *
 * Authentication Flow:
 * 1. auth_start → User opens URL, manager tracks pending URL
 * 2. auth_awaiting_code → User pastes code from browser
 * 3. auth_success/auth_error → Flow completes (success or failure)
 */

export class AuthenticationManager {
	// Authentication state flags
	startRequested = $state(false);
	awaitingCode = $state(false);
	inProgress = $state(false);
	pendingUrl = $state('');

	// Derived states for UI
	isAuthenticating = $derived(this.inProgress || this.awaitingCode);
	needsAuthentication = $derived(this.awaitingCode || this.startRequested);

	/**
	 * Handle auth_start event
	 * @param {string} url - Authorization URL for user to visit
	 * @returns {Object} Message object to display to user
	 */
	handleAuthStart(url) {
		this.startRequested = true;
		this.awaitingCode = false;
		this.inProgress = true;
		this.pendingUrl = url;

		return {
			message: `Please authorize Claude Code:\n\n[Open Authorization URL](${url})`,
			role: 'assistant'
		};
	}

	/**
	 * Handle auth_awaiting_code event
	 * @returns {Object} Message object to display to user
	 */
	handleAuthAwaitingCode() {
		this.awaitingCode = true;
		this.inProgress = false;

		return {
			message: 'Please paste the authorization code from the browser:',
			role: 'assistant'
		};
	}

	/**
	 * Handle auth_success event
	 * @returns {Object} Message object to display to user
	 */
	handleAuthSuccess() {
		this.reset();

		return {
			message: '✓ Authentication successful! You can now use Claude Code.',
			role: 'assistant'
		};
	}

	/**
	 * Handle auth_error event
	 * @param {string} error - Error message from authentication failure
	 * @returns {Object} Message object to display to user with error flag
	 */
	handleAuthError(error) {
		const errorMsg = error || 'Authentication failed';
		this.reset();

		return {
			message: `Authentication error: ${errorMsg}`,
			role: 'assistant',
			isError: true
		};
	}

	/**
	 * Process user input during auth flow
	 * Determines if input is an auth code and formats the command
	 *
	 * @param {string} userInput - User input text
	 * @returns {string|null} Auth command to send to session, or null if not in auth flow
	 */
	processAuthInput(userInput) {
		if (!this.awaitingCode || !userInput.trim()) {
			return null;
		}

		// Mark as in progress while submitting
		this.inProgress = true;

		// Format as auth command
		return `/auth ${userInput.trim()}`;
	}

	/**
	 * Reset authentication state completely
	 * Called on auth success/error to clear all flags
	 */
	reset() {
		this.startRequested = false;
		this.awaitingCode = false;
		this.inProgress = false;
		this.pendingUrl = '';
	}

	/**
	 * Reset on new user turn (not auth-related)
	 * Clears startRequested flag to prepare for new interaction
	 */
	resetForNewTurn() {
		this.startRequested = false;
	}

	/**
	 * Get current authentication state for debugging
	 * @returns {Object} Current state snapshot
	 */
	getState() {
		return {
			startRequested: this.startRequested,
			awaitingCode: this.awaitingCode,
			inProgress: this.inProgress,
			pendingUrl: this.pendingUrl,
			isAuthenticating: this.isAuthenticating,
			needsAuthentication: this.needsAuthentication
		};
	}
}
