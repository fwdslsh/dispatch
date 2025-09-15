/**
 * ui-state.svelte.js
 *
 * Shared UI state using Svelte 5 runes.
 * Manages global UI state like modals, layout, responsive behavior, etc.
 */

// Reactive state using $state
export const uiState = $state({
	// Layout state
	layout: {
		preset: 'single', // 'single', '2up', '4up', 'grid'
		isMobile: false,
		isTablet: false,
		isDesktop: true,
		showBottomSheet: false,
		bottomSheetHeight: 300
	},

	// Modal state
	modals: {
		active: null,
		stack: [],
		backdrop: true,
		closeOnEscape: true
	},

	// Loading states
	loading: {
		global: false,
		workspace: false,
		sessions: false,
		auth: false
	},

	// Error states
	errors: {
		global: null,
		workspace: null,
		sessions: null,
		auth: null
	},

	// Notification state
	notifications: [],

	// Touch/gesture state
	touch: {
		isSupported: false,
		isActive: false,
		gesturesEnabled: true
	},

	// Theme and appearance
	appearance: {
		theme: 'dark', // 'light', 'dark', 'auto'
		reducedMotion: false,
		highContrast: false
	},

	// Focus and accessibility
	focus: {
		trapModal: false,
		currentFocus: null,
		announcements: []
	}
});

// Computed value helpers - create these derived values in your components instead
// Example: const isLoading = $derived(Object.values(uiState.loading).some(loading => loading));
// Available computations:
// - isLoading: Object.values(uiState.loading).some(loading => loading)
// - hasErrors: Object.values(uiState.errors).some(error => error !== null)
// - hasNotifications: uiState.notifications.length > 0
// - hasActiveModal: uiState.modals.active !== null
// - modalStackDepth: uiState.modals.stack.length
// - currentBreakpoint: uiState.layout.isMobile ? 'mobile' : (uiState.layout.isTablet ? 'tablet' : 'desktop')
// - layoutColumns: uiState.layout.isMobile ? 1 : (uiState.layout.preset === '2up' || uiState.layout.preset === '4up' ? 2 : (uiState.layout.preset === 'grid' ? (uiState.layout.isTablet ? 2 : 3) : 1))
// - canUseGridLayout: !uiState.layout.isMobile
// - shouldShowMobileNav: uiState.layout.isMobile

// Layout functions
export function setLayoutPreset(preset) {
	uiState.layout.preset = preset;
}

export function setResponsiveState(isMobile, isTablet, isDesktop) {
	uiState.layout.isMobile = isMobile;
	uiState.layout.isTablet = isTablet;
	uiState.layout.isDesktop = isDesktop;

	// Auto-adjust layout for mobile
	if (isMobile && ['2up', '4up', 'grid'].includes(uiState.layout.preset)) {
		uiState.layout.preset = 'single';
	}
}

export function toggleSidebar() {
	uiState.layout.sidebarCollapsed = !uiState.layout.sidebarCollapsed;
}

export function setSidebarCollapsed(collapsed) {
	uiState.layout.sidebarCollapsed = collapsed;
}

export function showBottomSheet() {
	uiState.layout.showBottomSheet = true;
}

export function hideBottomSheet() {
	uiState.layout.showBottomSheet = false;
}

export function setBottomSheetHeight(height) {
	uiState.layout.bottomSheetHeight = height;
}

// Modal functions
export function openModal(type, data = {}) {
	// Close current modal if any
	if (uiState.modals.active) {
		uiState.modals.stack.push(uiState.modals.active);
	}

	uiState.modals.active = {
		type,
		data,
		timestamp: Date.now()
	};

	uiState.focus.trapModal = true;
}

export function closeModal() {
	uiState.modals.active = null;
	uiState.focus.trapModal = false;

	// Restore previous modal from stack
	if (uiState.modals.stack.length > 0) {
		uiState.modals.active = uiState.modals.stack.pop();
		uiState.focus.trapModal = true;
	}
}

export function closeAllModals() {
	uiState.modals.active = null;
	uiState.modals.stack = [];
	uiState.focus.trapModal = false;
}

export function setModalBackdrop(backdrop) {
	uiState.modals.backdrop = backdrop;
}

export function setModalCloseOnEscape(closeOnEscape) {
	uiState.modals.closeOnEscape = closeOnEscape;
}

// Loading functions
export function setGlobalLoading(loading) {
	uiState.loading.global = loading;
}

export function setWorkspaceLoading(loading) {
	uiState.loading.workspace = loading;
}

export function setSessionsLoading(loading) {
	uiState.loading.sessions = loading;
}

export function setAuthLoading(loading) {
	uiState.loading.auth = loading;
}

export function clearAllLoading() {
	Object.keys(uiState.loading).forEach((key) => {
		uiState.loading[key] = false;
	});
}

// Error functions
export function setGlobalError(error) {
	uiState.errors.global = error;
}

export function setWorkspaceError(error) {
	uiState.errors.workspace = error;
}

export function setSessionsError(error) {
	uiState.errors.sessions = error;
}

export function setAuthError(error) {
	uiState.errors.auth = error;
}

export function clearError(type) {
	if (type && uiState.errors.hasOwnProperty(type)) {
		uiState.errors[type] = null;
	}
}

export function clearAllErrors() {
	Object.keys(uiState.errors).forEach((key) => {
		uiState.errors[key] = null;
	});
}

// Notification functions
export function addNotification(notification) {
	const id = Date.now() + Math.random();
	uiState.notifications.push({
		id,
		timestamp: Date.now(),
		type: 'info',
		autoClose: true,
		duration: 5000,
		...notification
	});

	// Auto-remove if specified
	if (notification.autoClose !== false) {
		setTimeout(() => {
			removeNotification(id);
		}, notification.duration || 5000);
	}

	return id;
}

export function removeNotification(id) {
	uiState.notifications = uiState.notifications.filter((n) => n.id !== id);
}

export function clearAllNotifications() {
	uiState.notifications = [];
}

// Touch/gesture functions
export function setTouchSupported(supported) {
	uiState.touch.isSupported = supported;
}

export function setTouchActive(active) {
	uiState.touch.isActive = active;
}

export function setGesturesEnabled(enabled) {
	uiState.touch.gesturesEnabled = enabled;
}

// Theme functions
export function setTheme(theme) {
	uiState.appearance.theme = theme;
}

export function setReducedMotion(reduced) {
	uiState.appearance.reducedMotion = reduced;
}

export function setHighContrast(highContrast) {
	uiState.appearance.highContrast = highContrast;
}

// Focus and accessibility functions
export function setCurrentFocus(element) {
	uiState.focus.currentFocus = element;
}

export function addAnnouncement(message, priority = 'polite') {
	uiState.focus.announcements.push({
		id: Date.now(),
		message,
		priority,
		timestamp: Date.now()
	});

	// Auto-remove after announcement
	setTimeout(() => {
		uiState.focus.announcements = uiState.focus.announcements.filter(
			(a) => a.timestamp !== Date.now()
		);
	}, 1000);
}

// Utility functions
export function resetUIState() {
	uiState.layout.preset = 'single';
	uiState.layout.sidebarCollapsed = false;
	uiState.layout.showBottomSheet = false;
	closeAllModals();
	clearAllLoading();
	clearAllErrors();
	clearAllNotifications();
}

export function getModalData() {
	return uiState.modals.active?.data || {};
}

export function isModalType(type) {
	return uiState.modals.active?.type === type;
}

export function shouldShowLoader(type = 'global') {
	return uiState.loading[type] || false;
}

export function getError(type = 'global') {
	return uiState.errors[type] || null;
}

// Responsive helper functions
export function updateResponsiveState() {
	const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
	const isMobile = width < 768;
	const isTablet = width >= 768 && width < 1024;
	const isDesktop = width >= 1024;

	setResponsiveState(isMobile, isTablet, isDesktop);
}

// Initialize touch support detection
export function initializeTouchSupport() {
	if (typeof window !== 'undefined') {
		const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		setTouchSupported(hasTouch);
	}
}

// Initialize system preferences
export function initializeSystemPreferences() {
	if (typeof window !== 'undefined') {
		// Check for reduced motion preference
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		setReducedMotion(reducedMotion);

		// Check for high contrast preference
		const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
		setHighContrast(highContrast);

		// Check color scheme preference
		const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
		if (uiState.appearance.theme === 'auto') {
			setTheme(darkMode ? 'dark' : 'light');
		}
	}
}
