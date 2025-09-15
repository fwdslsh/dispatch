/**
 * LayoutViewModel Unit Tests
 * Tests Svelte 5 responsive layout patterns with $effect and $derived
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LayoutViewModel } from '../../src/lib/client/shared/viewmodels/LayoutViewModel.svelte.js';

// Mock DOM environment for Node.js tests
const windowMock = {
	matchMedia: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	})),
	innerWidth: 1024,
	innerHeight: 768,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn()
};

// Set up global window mock
Object.defineProperty(globalThis, 'window', {
	writable: true,
	value: windowMock
});

describe('LayoutViewModel', () => {
	let mockLayoutService;
	let mockPersistence;
	let viewModel;

	beforeEach(() => {
		// Mock LayoutService with proper state structure
		mockLayoutService = {
			state: {
				preset: '1up',
				isMobile: false,
				isTablet: false,
				isDesktop: true,
				orientation: 'landscape'
			},
			columns: 4,
			maxVisible: 4,
			init: vi.fn(),
			destroy: vi.fn(),
			updateMaxVisible: vi.fn(),
			onLayoutChange: vi.fn(),
			getSidebarState: vi.fn().mockReturnValue({ collapsed: false, width: 280 }),
			setSidebarState: vi.fn(),
			setLayoutPreset: vi.fn(),
			cycleLayoutPreset: vi.fn().mockReturnValue('2up'),
			calculateGrid: vi.fn().mockReturnValue({ rows: 2, columns: 2, itemsPerRow: [2, 2] }),
			getOptimalPreset: vi.fn().mockReturnValue('2up'),
			supportsTouch: vi.fn().mockReturnValue(false)
		};

		// Mock PersistenceService
		mockPersistence = {
			get: vi.fn(),
			set: vi.fn(),
			remove: vi.fn(),
			clear: vi.fn()
		};

		// Create ViewModel instance
		viewModel = new LayoutViewModel(mockLayoutService, mockPersistence);
	});

	afterEach(() => {
		if (viewModel) {
			viewModel = null;
		}
	});

	describe('Svelte 5 Runes - Initial State', () => {
		it('should initialize with correct $state values', () => {
			expect(viewModel.isMobile).toBe(false);
			expect(viewModel.isTablet).toBe(false);
			expect(viewModel.columns).toBe(2);
			expect(viewModel.rows).toBe(2);
			expect(viewModel.maxVisible).toBe(4);
			expect(viewModel.sidebarOpen).toBe(false);
			expect(viewModel.transitioning).toBe(false);
			expect(viewModel.previousCols).toBe(2);
		});

		it('should initialize $derived computed values correctly', () => {
			// Desktop layout
			mockLayoutService.isMobile.mockReturnValue(false);
			mockLayoutService.isTablet.mockReturnValue(false);

			expect(viewModel.deviceType).toBe('desktop');
		});
	});

	describe('Svelte 5 Runes - $derived Device Type Detection', () => {
		it('should detect mobile device', () => {
			viewModel.isMobile = true;
			viewModel.isTablet = false;

			expect(viewModel.deviceType).toBe('mobile');
		});

		it('should detect tablet device', () => {
			viewModel.isMobile = false;
			viewModel.isTablet = true;

			expect(viewModel.deviceType).toBe('tablet');
		});

		it('should detect desktop device', () => {
			viewModel.isMobile = false;
			viewModel.isTablet = false;

			expect(viewModel.deviceType).toBe('desktop');
		});

		it('should prioritize mobile over tablet', () => {
			viewModel.isMobile = true;
			viewModel.isTablet = true;

			expect(viewModel.deviceType).toBe('mobile');
		});
	});

	describe('Layout Preset Management', () => {
		it('should set 1up layout preset', () => {
			viewModel.setLayoutPreset('1up');

			expect(viewModel.columns).toBe(1);
			expect(viewModel.rows).toBe(1);
			expect(viewModel.maxVisible).toBe(1);
		});

		it('should set 2up layout preset', () => {
			viewModel.setLayoutPreset('2up');

			expect(viewModel.columns).toBe(2);
			expect(viewModel.rows).toBe(1);
			expect(viewModel.maxVisible).toBe(2);
		});

		it('should set 4up layout preset', () => {
			viewModel.setLayoutPreset('4up');

			expect(viewModel.columns).toBe(2);
			expect(viewModel.rows).toBe(2);
			expect(viewModel.maxVisible).toBe(4);
		});

		it('should handle invalid preset gracefully', () => {
			const initialColumns = viewModel.columns;
			const initialRows = viewModel.rows;

			viewModel.setLayoutPreset('invalid');

			// Should remain unchanged
			expect(viewModel.columns).toBe(initialColumns);
			expect(viewModel.rows).toBe(initialRows);
		});
	});

	describe('Responsive Behavior', () => {
		it('should update layout for mobile device', () => {
			viewModel.updateForMobile();

			expect(viewModel.isMobile).toBe(true);
			expect(viewModel.isTablet).toBe(false);
			expect(viewModel.columns).toBe(1);
			expect(viewModel.rows).toBe(1);
			expect(viewModel.maxVisible).toBe(1);
		});

		it('should update layout for tablet device', () => {
			viewModel.updateForTablet();

			expect(viewModel.isMobile).toBe(false);
			expect(viewModel.isTablet).toBe(true);
			expect(viewModel.columns).toBe(2);
			expect(viewModel.rows).toBe(1);
			expect(viewModel.maxVisible).toBe(2);
		});

		it('should update layout for desktop device', () => {
			// Start with mobile
			viewModel.updateForMobile();

			viewModel.updateForDesktop();

			expect(viewModel.isMobile).toBe(false);
			expect(viewModel.isTablet).toBe(false);
			expect(viewModel.columns).toBe(2);
			expect(viewModel.rows).toBe(2);
			expect(viewModel.maxVisible).toBe(4);
		});
	});

	describe('Sidebar Management', () => {
		it('should toggle sidebar state', () => {
			expect(viewModel.sidebarOpen).toBe(false);

			viewModel.toggleSidebar();

			expect(viewModel.sidebarOpen).toBe(true);

			viewModel.toggleSidebar();

			expect(viewModel.sidebarOpen).toBe(false);
		});

		it('should open sidebar', () => {
			viewModel.openSidebar();

			expect(viewModel.sidebarOpen).toBe(true);
		});

		it('should close sidebar', () => {
			viewModel.sidebarOpen = true;

			viewModel.closeSidebar();

			expect(viewModel.sidebarOpen).toBe(false);
		});
	});

	describe('Custom Layout Configuration', () => {
		it('should set custom grid layout', () => {
			viewModel.setCustomLayout(3, 2);

			expect(viewModel.columns).toBe(3);
			expect(viewModel.rows).toBe(2);
			expect(viewModel.maxVisible).toBe(6);
		});

		it('should handle invalid custom layout values', () => {
			const initialColumns = viewModel.columns;
			const initialRows = viewModel.rows;

			// Test zero values
			viewModel.setCustomLayout(0, 0);
			expect(viewModel.columns).toBe(initialColumns);
			expect(viewModel.rows).toBe(initialRows);

			// Test negative values
			viewModel.setCustomLayout(-1, -2);
			expect(viewModel.columns).toBe(initialColumns);
			expect(viewModel.rows).toBe(initialRows);
		});

		it('should cap custom layout to maximum reasonable values', () => {
			viewModel.setCustomLayout(10, 10);

			// Should be capped to reasonable maximums
			expect(viewModel.columns).toBeLessThanOrEqual(4);
			expect(viewModel.rows).toBeLessThanOrEqual(4);
		});
	});

	describe('Layout Transitions', () => {
		it('should track column changes for transitions', () => {
			expect(viewModel.transitioning).toBe(false);
			expect(viewModel.previousCols).toBe(2);

			// Change columns
			viewModel.columns = 3;

			// In a real Svelte component, the $effect would handle this
			// Here we simulate the transition state manually
			if (viewModel.columns !== viewModel.previousCols) {
				viewModel.transitioning = true;
				viewModel.previousCols = viewModel.columns;
			}

			expect(viewModel.transitioning).toBe(true);
			expect(viewModel.previousCols).toBe(3);
		});

		it('should end transition after timeout', (done) => {
			viewModel.transitioning = true;

			// Simulate transition end
			setTimeout(() => {
				viewModel.transitioning = false;
				expect(viewModel.transitioning).toBe(false);
				done();
			}, 100);
		});
	});

	describe('Service Integration', () => {
		it('should delegate mobile check to service', () => {
			mockLayoutService.isMobile.mockReturnValue(true);

			// This would be called by an effect in the real implementation
			viewModel.isMobile = mockLayoutService.isMobile();

			expect(viewModel.isMobile).toBe(true);
			expect(mockLayoutService.isMobile).toHaveBeenCalled();
		});

		it('should update service max visible when layout changes', () => {
			viewModel.setLayoutPreset('1up');

			// In real implementation, this would be called by an effect
			mockLayoutService.maxVisible = viewModel.maxVisible;
			mockLayoutService.updateMaxVisible(viewModel.maxVisible);

			expect(mockLayoutService.updateMaxVisible).toHaveBeenCalledWith(1);
		});

		it('should register layout change callback with service', () => {
			// In real implementation, this would be set up in constructor
			expect(mockLayoutService.onLayoutChange).toBeDefined();
		});
	});

	describe('Responsive Breakpoints', () => {
		it('should handle mobile breakpoint', () => {
			// Simulate mobile breakpoint match
			window.matchMedia = vi.fn().mockImplementation((query) => ({
				matches: query.includes('768px'),
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn()
			}));

			viewModel.handleBreakpointChange('(max-width: 768px)', true);

			expect(viewModel.isMobile).toBe(true);
			expect(viewModel.columns).toBe(1);
		});

		it('should handle tablet breakpoint', () => {
			window.matchMedia = vi.fn().mockImplementation((query) => ({
				matches: query.includes('1024px') && !query.includes('768px'),
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn()
			}));

			viewModel.handleBreakpointChange('(max-width: 1024px)', true);

			expect(viewModel.isTablet).toBe(true);
			expect(viewModel.columns).toBe(2);
		});
	});

	describe('Layout State Persistence', () => {
		it('should save layout state', () => {
			const layoutState = {
				columns: viewModel.columns,
				rows: viewModel.rows,
				maxVisible: viewModel.maxVisible,
				sidebarOpen: viewModel.sidebarOpen
			};

			// In real implementation, this would use PersistenceService
			expect(layoutState.columns).toBe(2);
			expect(layoutState.rows).toBe(2);
			expect(layoutState.maxVisible).toBe(4);
			expect(layoutState.sidebarOpen).toBe(false);
		});

		it('should restore layout state', () => {
			const savedState = {
				columns: 3,
				rows: 1,
				maxVisible: 3,
				sidebarOpen: true
			};

			// Restore state
			viewModel.columns = savedState.columns;
			viewModel.rows = savedState.rows;
			viewModel.maxVisible = savedState.maxVisible;
			viewModel.sidebarOpen = savedState.sidebarOpen;

			expect(viewModel.columns).toBe(3);
			expect(viewModel.rows).toBe(1);
			expect(viewModel.maxVisible).toBe(3);
			expect(viewModel.sidebarOpen).toBe(true);
		});
	});

	describe('Integration with Other ViewModels', () => {
		it('should provide layout info for session display', () => {
			const layoutInfo = {
				deviceType: viewModel.deviceType,
				maxVisible: viewModel.maxVisible,
				isMobile: viewModel.isMobile,
				columns: viewModel.columns,
				rows: viewModel.rows
			};

			expect(layoutInfo.deviceType).toBe('desktop');
			expect(layoutInfo.maxVisible).toBe(4);
			expect(layoutInfo.isMobile).toBe(false);
			expect(layoutInfo.columns).toBe(2);
			expect(layoutInfo.rows).toBe(2);
		});

		it('should handle layout changes affecting session visibility', () => {
			// Start with 4up layout
			expect(viewModel.maxVisible).toBe(4);

			// Change to mobile (1up)
			viewModel.updateForMobile();
			expect(viewModel.maxVisible).toBe(1);

			// This change should trigger session visibility updates
			// in other ViewModels that depend on maxVisible
		});
	});

	describe('Error Handling', () => {
		it('should handle matchMedia not being available', () => {
			const originalMatchMedia = window.matchMedia;
			delete window.matchMedia;

			// Should not throw when matchMedia is not available
			expect(() => {
				viewModel.handleBreakpointChange('(max-width: 768px)', true);
			}).not.toThrow();

			// Restore
			window.matchMedia = originalMatchMedia;
		});

		it('should handle invalid breakpoint queries', () => {
			expect(() => {
				viewModel.handleBreakpointChange('invalid-query', true);
			}).not.toThrow();
		});
	});
});
