/**
 * UIState.svelte.js
 *
 * Focused UI state management using Svelte 5 runes.
 * Single responsibility: managing UI layout, modals, and display state.
 */

import { createLogger } from '../utils/logger.js';

const _log = createLogger('ui-state');

export class UIState {
	constructor() {
		// Layout state
		this.layout = $state({
			isMobile: false,
			isTablet: false,
			isDesktop: true,
			preset: '2up',
			columns: 2,
			maxVisible: 4,
			currentMobileSession: 0,
			showBottomSheet: false
		});

		// Modal state
		this.modals = $state({
			activeModal: null,
			history: []
		});

		// Display state
		this.display = $state({
			displayedSessionIds: [],
			showOnlyPinned: false, // Changed to false to show all sessions by default (including resumed sessions)
			filterByWorkspace: null
		});

		// Loading states
		this.loading = $state({
			sessions: false,
			workspaces: false,
			creatingSession: false
		});

		// Error states
		this.errors = $state({
			sessions: null,
			workspaces: null,
			global: null
		});

		// Derived state
		this.canNavigateLeft = $derived(this.layout.currentMobileSession > 0);
		this.hasActiveModal = $derived(this.modals.activeModal !== null);
		this.isLoading = $derived(Object.values(this.loading).some((loading) => loading));
		this.hasErrors = $derived(Object.values(this.errors).some((error) => error !== null));
	}

	// Layout management
	setLayoutMode(layoutData) {
		this.layout = { ...this.layout, ...layoutData };
	}

	setResponsiveState(isMobile, isTablet, isDesktop) {
		this.layout.isMobile = isMobile;
		this.layout.isTablet = isTablet;
		this.layout.isDesktop = isDesktop;
	}

	setMobileSession(index, maxSessions) {
		if (maxSessions === 0) {
			this.layout.currentMobileSession = 0;
			return;
		}

		if (typeof index === 'number') {
			this.layout.currentMobileSession = Math.max(0, Math.min(index, maxSessions - 1));
		} else if (index === 'next') {
			this.layout.currentMobileSession = Math.min(
				this.layout.currentMobileSession + 1,
				maxSessions - 1
			);
		} else if (index === 'previous' || index === 'prev') {
			this.layout.currentMobileSession = Math.max(this.layout.currentMobileSession - 1, 0);
		}
	}

	toggleBottomSheet() {
		this.layout.showBottomSheet = !this.layout.showBottomSheet;
	}

	// Display management
	setDisplayedSessions(sessionIds) {
		this.display.displayedSessionIds = [...sessionIds];
	}

	addToDisplay(sessionId) {
		if (!this.display.displayedSessionIds.includes(sessionId)) {
			const maxVisible = this.layout.maxVisible;
			const currentIds = this.display.displayedSessionIds.filter((id) => id !== sessionId);
			const headIds = currentIds.slice(0, Math.max(0, maxVisible - 1));
			this.display.displayedSessionIds = [...headIds, sessionId];
		}
	}

	removeFromDisplay(sessionId) {
		this.display.displayedSessionIds = this.display.displayedSessionIds.filter(
			(id) => id !== sessionId
		);
	}

	// Modal management
	openModal(modalType, data = {}) {
		if (this.modals.activeModal) {
			this.modals.history.push(this.modals.activeModal);
		}
		this.modals.activeModal = { type: modalType, data };
	}

	closeModal() {
		this.modals.activeModal = null;
		if (this.modals.history.length > 0) {
			this.modals.activeModal = this.modals.history.pop();
		}
	}

	closeAllModals() {
		this.modals.activeModal = null;
		this.modals.history = [];
	}

	// Loading state management
	setLoading(scope, loading) {
		this.loading[scope] = loading;
	}

	clearAllLoading() {
		Object.keys(this.loading).forEach((key) => {
			this.loading[key] = false;
		});
	}

	// Error state management
	setError(scope, error) {
		this.errors[scope] = error;
	}

	clearError(scope) {
		if (scope) {
			this.errors[scope] = null;
		} else {
			Object.keys(this.errors).forEach((key) => {
				this.errors[key] = null;
			});
		}
	}
}
