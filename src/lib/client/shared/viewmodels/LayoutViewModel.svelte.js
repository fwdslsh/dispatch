/**
 * LayoutViewModel.svelte.js
 *
 * ViewModel for layout management and responsive behavior coordination.
 * Coordinates between LayoutService and UI components for responsive layout management.
 */

export class LayoutViewModel {
	/**
	 * @param {import('../services/LayoutService.js').LayoutService} layoutService
	 * @param {import('../services/PersistenceService.js').PersistenceService} persistence
	 */
	constructor(layoutService, persistence) {
		this.layoutService = layoutService;
		this.persistence = persistence;

		// Observable state using Svelte 5 runes
		this.layoutPreset = $state(layoutService.state.preset);
		this.isMobile = $state(layoutService.state.isMobile);
		this.isTablet = $state(layoutService.state.isTablet);
		this.isDesktop = $state(layoutService.state.isDesktop);

		// Derived layout calculations
		this.columns = $derived(this.layoutService.columns);
		this.maxVisible = $derived(this.layoutService.maxVisible);
		this.deviceType = $derived(this.getDeviceType());

		// Sidebar state
		this.sidebarCollapsed = $state(false);
		this.sidebarWidth = $state(280);

		// Mobile-specific state
		this.showMobileMenu = $state(false);
		this.keyboardVisible = $state(false);
		this.orientation = $state(layoutService.state.orientation);

		// Layout transitions
		this.transitioning = $state(false);
		this.previousCols = $state(0);

		// Grid layout state
		this.gridGap = $state(16);
		this.itemMinWidth = $state(300);

		// Initialize
		this.initialize();
	}

	/**
	 * Initialize the view model
	 */
	initialize() {
		// Sync with layout service state
		this.syncWithLayoutService();

		// Load persistent sidebar state
		this.loadSidebarState();

		// Setup reactive effects
		this.setupEffects();
	}

	/**
	 * Sync state with layout service
	 */
	syncWithLayoutService() {
		// Subscribe to layout service state changes
		$effect(() => {
			this.isMobile = this.layoutService.state.isMobile;
			this.isTablet = this.layoutService.state.isTablet;
			this.isDesktop = this.layoutService.state.isDesktop;
			this.orientation = this.layoutService.state.orientation;

			// Auto-collapse sidebar on mobile
			if (this.isMobile) {
				this.sidebarCollapsed = true;
				this.showMobileMenu = false;
			}
		});

		// Watch for layout preset changes
		$effect(() => {
			this.layoutPreset = this.layoutService.state.preset;
		});
	}

	/**
	 * Load sidebar state from persistence
	 */
	loadSidebarState() {
		const sidebarState = this.layoutService.getSidebarState();
		this.sidebarCollapsed = sidebarState.collapsed || false;
		this.sidebarWidth = sidebarState.width || 280;
	}

	/**
	 * Save sidebar state to persistence
	 */
	saveSidebarState() {
		this.layoutService.setSidebarState({
			collapsed: this.sidebarCollapsed,
			width: this.sidebarWidth
		});
	}

	/**
	 * Setup reactive effects
	 */
	setupEffects() {
		// Track column changes for transitions
		$effect(() => {
			if (this.columns !== this.previousCols) {
				this.transitioning = true;
				this.previousCols = this.columns;

				// Reset transition state after animation
				setTimeout(() => {
					this.transitioning = false;
				}, 300);
			}
		});

		// Save sidebar state when it changes
		$effect(() => {
			if (this.sidebarCollapsed !== undefined) {
				this.saveSidebarState();
			}
		});
	}

	/**
	 * Get current device type
	 * @returns {'mobile'|'tablet'|'desktop'}
	 */
	getDeviceType() {
		if (this.isMobile) return 'mobile';
		if (this.isTablet) return 'tablet';
		return 'desktop';
	}

	/**
	 * Set layout preset
	 * @param {'1up'|'2up'|'4up'} preset
	 */
	setLayoutPreset(preset) {
		this.layoutService.setLayoutPreset(preset);
		this.layoutPreset = preset;
	}

	/**
	 * Cycle through layout presets
	 * @returns {string} New preset
	 */
	cycleLayoutPreset() {
		const newPreset = this.layoutService.cycleLayoutPreset();
		this.layoutPreset = newPreset;
		return newPreset;
	}

	/**
	 * Toggle sidebar collapsed state
	 */
	toggleSidebar() {
		this.sidebarCollapsed = !this.sidebarCollapsed;
	}

	/**
	 * Show sidebar (uncollapse)
	 */
	showSidebar() {
		this.sidebarCollapsed = false;
	}

	/**
	 * Hide sidebar (collapse)
	 */
	hideSidebar() {
		this.sidebarCollapsed = true;
	}

	/**
	 * Toggle mobile menu
	 */
	toggleMobileMenu() {
		this.showMobileMenu = !this.showMobileMenu;
	}

	/**
	 * Close mobile menu
	 */
	closeMobileMenu() {
		this.showMobileMenu = false;
	}

	/**
	 * Set keyboard visibility (for mobile layout adjustments)
	 * @param {boolean} visible
	 */
	setKeyboardVisible(visible) {
		this.keyboardVisible = visible;
	}

	/**
	 * Calculate grid layout for given session count
	 * @param {number} sessionCount
	 * @returns {{rows: number, columns: number, itemsPerRow: number[]}}
	 */
	calculateGrid(sessionCount) {
		return this.layoutService.calculateGrid(sessionCount);
	}

	/**
	 * Get optimal layout preset for session count
	 * @param {number} sessionCount
	 * @returns {'1up'|'2up'|'4up'}
	 */
	getOptimalPreset(sessionCount) {
		return this.layoutService.getOptimalPreset(sessionCount);
	}

	/**
	 * Calculate responsive grid styles
	 * @param {number} sessionCount
	 * @returns {Object}
	 */
	getGridStyles(sessionCount) {
		if (this.isMobile) {
			return {
				display: 'block',
				width: '100%',
				height: '100%'
			};
		}

		const grid = this.calculateGrid(sessionCount);
		const cols = this.columns;

		return {
			display: 'grid',
			gridTemplateColumns: `repeat(${cols}, 1fr)`,
			gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
			gap: `${this.gridGap}px`,
			width: '100%',
			height: '100%',
			minHeight: '400px'
		};
	}

	/**
	 * Get session item styles for grid layout
	 * @param {number} index
	 * @param {number} sessionCount
	 * @returns {Object}
	 */
	getSessionItemStyles(index, sessionCount) {
		if (this.isMobile) {
			return {
				width: '100%',
				height: '100%',
				display: 'block'
			};
		}

		const grid = this.calculateGrid(sessionCount);
		const row = Math.floor(index / this.columns) + 1;
		const col = (index % this.columns) + 1;

		return {
			gridRow: row,
			gridColumn: col,
			minWidth: `${this.itemMinWidth}px`,
			minHeight: '300px'
		};
	}

	/**
	 * Get container classes based on current state
	 * @returns {string[]}
	 */
	getContainerClasses() {
		const classes = [];

		classes.push(`device-${this.deviceType}`);
		classes.push(`layout-${this.layoutPreset}`);
		classes.push(`orientation-${this.orientation}`);

		if (this.sidebarCollapsed) classes.push('sidebar-collapsed');
		if (this.showMobileMenu) classes.push('mobile-menu-open');
		if (this.keyboardVisible) classes.push('keyboard-visible');
		if (this.transitioning) classes.push('transitioning');

		return classes;
	}

	/**
	 * Get sidebar classes
	 * @returns {string[]}
	 */
	getSidebarClasses() {
		const classes = ['sidebar'];

		if (this.sidebarCollapsed) classes.push('collapsed');
		if (this.isMobile) classes.push('mobile');

		return classes;
	}

	/**
	 * Get main content styles
	 * @returns {Object}
	 */
	getMainContentStyles() {
		const styles = {
			transition: 'margin-left 300ms ease'
		};

		if (!this.isMobile && !this.sidebarCollapsed) {
			styles.marginLeft = `${this.sidebarWidth}px`;
		}

		return styles;
	}

	/**
	 * Handle viewport resize
	 * @param {number} width
	 * @param {number} height
	 */
	handleResize(width, height) {
		// The LayoutService will handle the actual resize logic
		// This method can trigger additional UI-specific updates
		if (this.isMobile && this.showMobileMenu) {
			// Close mobile menu on resize to prevent layout issues
			this.closeMobileMenu();
		}
	}

	/**
	 * Handle orientation change
	 */
	handleOrientationChange() {
		// Close mobile menu on orientation change
		if (this.showMobileMenu) {
			this.closeMobileMenu();
		}

		// Reset keyboard state
		this.keyboardVisible = false;
	}

	/**
	 * Check if layout supports feature
	 * @param {'sidebar'|'multiColumn'|'gestures'|'keyboard'} feature
	 * @returns {boolean}
	 */
	supportsFeature(feature) {
		switch (feature) {
			case 'sidebar':
				return !this.isMobile;
			case 'multiColumn':
				return this.columns > 1;
			case 'gestures':
				return this.isMobile || this.layoutService.supportsTouch();
			case 'keyboard':
				return this.isMobile;
			default:
				return false;
		}
	}

	/**
	 * Get layout state summary
	 * @returns {Object}
	 */
	getState() {
		return {
			preset: this.layoutPreset,
			deviceType: this.deviceType,
			columns: this.columns,
			maxVisible: this.maxVisible,
			sidebarCollapsed: this.sidebarCollapsed,
			showMobileMenu: this.showMobileMenu,
			keyboardVisible: this.keyboardVisible,
			orientation: this.orientation,
			transitioning: this.transitioning
		};
	}

	/**
	 * Reset layout state
	 */
	reset() {
		this.showMobileMenu = false;
		this.keyboardVisible = false;
		this.transitioning = false;
		// Don't reset sidebar state as it should persist
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.reset();
	}
}