/**
 * LayoutService.js
 *
 * Service for managing responsive layout, grid configurations, and viewport handling.
 * Handles mobile/desktop detection, layout presets, and persistence of layout preferences.
 */

/**
 * @typedef {'1up'|'2up'|'4up'} LayoutPreset
 * @typedef {Object} LayoutState
 * @property {boolean} isMobile
 * @property {boolean} isTablet
 * @property {boolean} isDesktop
 * @property {number} viewportWidth
 * @property {number} viewportHeight
 * @property {LayoutPreset} preset
 * @property {number} columns
 * @property {number} maxVisible
 */

export class LayoutService {
	/**
	 * @param {import('./PersistenceService.js').PersistenceService} persistenceService
	 */
	constructor(persistenceService) {
		this.persistence = persistenceService;

		// Layout constants
		this.BREAKPOINTS = {
			mobile: 768,
			tablet: 1024,
			desktop: 1280
		};

		this.LAYOUT_PRESETS = {
			'1up': { columns: 1, maxVisible: 1 },
			'2up': { columns: 2, maxVisible: 2 },
			'4up': { columns: 2, maxVisible: 4 }
		};

		// Storage keys
		this.STORAGE_KEYS = {
			layout: 'dispatch-layout',
			mobileIndex: 'dispatch-mobile-index',
			sidebarState: 'dispatch-sidebar-state'
		};

		// Current state
		this.state = $state({
			isMobile: false,
			isTablet: false,
			isDesktop: true,
			viewportWidth: 0,
			viewportHeight: 0,
			preset: this.loadLayoutPreset(),
			orientation: 'landscape'
		});

		// Derived values
		this.columns = $derived(this.calculateColumns());
		this.maxVisible = $derived(this.calculateMaxVisible());

		// Media query listeners
		this.mediaQueries = new Map();

		// Initialize
		this.initialize();
	}

	/**
	 * Initialize the service
	 */
	initialize() {
		if (typeof window === 'undefined') return;

		// Set initial viewport state
		this.updateViewport();

		// Setup media query listeners
		this.setupMediaQueries();

		// Listen for resize events with debouncing
		let resizeTimeout;
		window.addEventListener('resize', () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				this.updateViewport();
			}, 150);
		});

		// Listen for orientation changes
		if ('orientation' in window) {
			window.addEventListener('orientationchange', () => {
				this.updateOrientation();
			});
		}
	}

	/**
	 * Setup media query listeners
	 */
	setupMediaQueries() {
		if (typeof window === 'undefined' || !window.matchMedia) return;

		// Mobile query
		const mobileQuery = window.matchMedia(`(max-width: ${this.BREAKPOINTS.mobile - 1}px)`);
		this.mediaQueries.set('mobile', mobileQuery);
		mobileQuery.addEventListener('change', (e) => {
			this.state.isMobile = e.matches;
			this.state.isDesktop = !e.matches && !this.state.isTablet;
		});
		this.state.isMobile = mobileQuery.matches;

		// Tablet query
		const tabletQuery = window.matchMedia(
			`(min-width: ${this.BREAKPOINTS.mobile}px) and (max-width: ${this.BREAKPOINTS.tablet - 1}px)`
		);
		this.mediaQueries.set('tablet', tabletQuery);
		tabletQuery.addEventListener('change', (e) => {
			this.state.isTablet = e.matches;
			this.state.isDesktop = !e.matches && !this.state.isMobile;
		});
		this.state.isTablet = tabletQuery.matches;

		// Desktop query
		const desktopQuery = window.matchMedia(`(min-width: ${this.BREAKPOINTS.tablet}px)`);
		this.mediaQueries.set('desktop', desktopQuery);
		desktopQuery.addEventListener('change', (e) => {
			this.state.isDesktop = e.matches;
		});
		this.state.isDesktop = desktopQuery.matches;
	}

	/**
	 * Update viewport dimensions
	 */
	updateViewport() {
		if (typeof window === 'undefined') return;

		this.state.viewportWidth = window.innerWidth;
		this.state.viewportHeight = window.innerHeight;
		this.updateOrientation();
	}

	/**
	 * Update device orientation
	 */
	updateOrientation() {
		if (typeof window === 'undefined') return;

		const isPortrait = window.innerHeight > window.innerWidth;
		this.state.orientation = isPortrait ? 'portrait' : 'landscape';
	}

	/**
	 * Calculate number of columns based on current state
	 * @returns {number}
	 */
	calculateColumns() {
		if (this.state.isMobile) {
			return 1;
		}

		const preset = this.LAYOUT_PRESETS[this.state.preset];
		return preset ? preset.columns : 2;
	}

	/**
	 * Calculate maximum visible sessions
	 * @returns {number}
	 */
	calculateMaxVisible() {
		if (this.state.isMobile) {
			return 1;
		}

		const preset = this.LAYOUT_PRESETS[this.state.preset];
		return preset ? preset.maxVisible : 2;
	}

	/**
	 * Load layout preset from storage
	 * @returns {LayoutPreset}
	 */
	loadLayoutPreset() {
		const saved = this.persistence.get(this.STORAGE_KEYS.layout);
		if (saved && this.LAYOUT_PRESETS[saved]) {
			return saved;
		}
		return '2up'; // default
	}

	/**
	 * Set layout preset
	 * @param {LayoutPreset} preset
	 */
	setLayoutPreset(preset) {
		if (!this.LAYOUT_PRESETS[preset]) {
			console.warn(`[LayoutService] Invalid preset: ${preset}`);
			return;
		}

		this.state.preset = preset;
		this.persistence.set(this.STORAGE_KEYS.layout, preset);
	}

	/**
	 * Get current mobile session index
	 * @returns {number}
	 */
	getMobileSessionIndex() {
		return this.persistence.get(this.STORAGE_KEYS.mobileIndex, 0);
	}

	/**
	 * Set mobile session index
	 * @param {number} index
	 */
	setMobileSessionIndex(index) {
		this.persistence.set(this.STORAGE_KEYS.mobileIndex, index);
	}

	/**
	 * Get sidebar state
	 * @returns {Object}
	 */
	getSidebarState() {
		return this.persistence.get(this.STORAGE_KEYS.sidebarState, {
			collapsed: false,
			width: 280
		});
	}

	/**
	 * Set sidebar state
	 * @param {Object} state
	 */
	setSidebarState(state) {
		this.persistence.set(this.STORAGE_KEYS.sidebarState, state);
	}

	/**
	 * Check if viewport is mobile size
	 * @returns {boolean}
	 */
	isMobile() {
		return this.state.isMobile;
	}

	/**
	 * Check if viewport is tablet size
	 * @returns {boolean}
	 */
	isTablet() {
		return this.state.isTablet;
	}

	/**
	 * Check if viewport is desktop size
	 * @returns {boolean}
	 */
	isDesktop() {
		return this.state.isDesktop;
	}

	/**
	 * Get current device type
	 * @returns {'mobile'|'tablet'|'desktop'}
	 */
	getDeviceType() {
		if (this.state.isMobile) return 'mobile';
		if (this.state.isTablet) return 'tablet';
		return 'desktop';
	}

	/**
	 * Check if device supports touch
	 * @returns {boolean}
	 */
	supportsTouch() {
		if (typeof window === 'undefined') return false;
		return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	}

	/**
	 * Calculate grid layout for sessions
	 * @param {number} sessionCount
	 * @returns {{rows: number, columns: number, itemsPerRow: number[]}}
	 */
	calculateGrid(sessionCount) {
		const columns = this.columns;
		const maxVisible = this.maxVisible;
		const visibleCount = Math.min(sessionCount, maxVisible);

		const rows = Math.ceil(visibleCount / columns);
		const itemsPerRow = [];

		for (let i = 0; i < rows; i++) {
			const start = i * columns;
			const end = Math.min(start + columns, visibleCount);
			itemsPerRow.push(end - start);
		}

		return {
			rows,
			columns,
			itemsPerRow
		};
	}

	/**
	 * Get optimal layout preset for session count
	 * @param {number} sessionCount
	 * @returns {LayoutPreset}
	 */
	getOptimalPreset(sessionCount) {
		if (this.state.isMobile) {
			return '1up';
		}

		if (sessionCount <= 1) {
			return '1up';
		} else if (sessionCount <= 2) {
			return '2up';
		} else {
			return '4up';
		}
	}

	/**
	 * Cycle to next layout preset
	 * @returns {LayoutPreset}
	 */
	cycleLayoutPreset() {
		const presets = Object.keys(this.LAYOUT_PRESETS);
		const currentIndex = presets.indexOf(this.state.preset);
		const nextIndex = (currentIndex + 1) % presets.length;
		const nextPreset = presets[nextIndex];

		this.setLayoutPreset(nextPreset);
		return nextPreset;
	}

	/**
	 * Get layout state summary
	 * @returns {LayoutState}
	 */
	getState() {
		return {
			isMobile: this.state.isMobile,
			isTablet: this.state.isTablet,
			isDesktop: this.state.isDesktop,
			viewportWidth: this.state.viewportWidth,
			viewportHeight: this.state.viewportHeight,
			preset: this.state.preset,
			columns: this.columns,
			maxVisible: this.maxVisible,
			orientation: this.state.orientation
		};
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		// Clean up media query listeners
		for (const [, query] of this.mediaQueries) {
			if (query && query.removeEventListener) {
				// Note: We'd need to store the listener references to properly remove them
				// For now, just clear the map
			}
		}
		this.mediaQueries.clear();
	}
}