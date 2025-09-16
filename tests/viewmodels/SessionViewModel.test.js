/**
 * SessionViewModel Unit Tests
 * Tests Svelte 5 MVVM patterns with complex $derived.by filtering and session management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionViewModel } from '../../src/lib/client/shared/viewmodels/SessionViewModel.svelte.js';

describe('SessionViewModel', () => {
	let mockSessionApi;
	let mockLayoutService;
	let mockSocketService;
	let viewModel;

	beforeEach(() => {
		// Mock SessionApiClient
		mockSessionApi = {
			config: { debug: false, apiBaseUrl: '/api', authTokenKey: 'test-token' },
			baseUrl: '/api',
			list: vi.fn().mockResolvedValue([]),
			create: vi.fn().mockResolvedValue({ id: 'new-session', type: 'pty' }),
			delete: vi.fn().mockResolvedValue(),
			pin: vi.fn().mockResolvedValue(),
			unpin: vi.fn().mockResolvedValue(),
			rename: vi.fn().mockResolvedValue(),
			update: vi.fn().mockResolvedValue(),
			getHistory: vi.fn().mockResolvedValue([]),
			getClaudeSessions: vi.fn().mockResolvedValue([]),
			checkClaudeAuth: vi.fn().mockResolvedValue({ authenticated: true }),
			validateSessionOptions: vi.fn().mockReturnValue(true),
			dispose: vi.fn(),
			getHeaders: vi.fn().mockReturnValue({}),
			handleResponse: vi.fn().mockResolvedValue({})
		};

		// Mock PersistenceService
		const mockPersistence = {
			config: { debug: false, maxStorageSize: 5242880, warnStorageSize: 4194304 },
			keyMigrationMap: new Map(),
			get: vi.fn().mockReturnValue(null),
			set: vi.fn(),
			remove: vi.fn(),
			clear: vi.fn(),
			getByPrefix: vi.fn().mockReturnValue([]),
			removeByPrefix: vi.fn().mockReturnValue(0),
			getStorageUsage: vi.fn().mockReturnValue({ used: 0, available: 0 }),
			checkStorageUsage: vi.fn(),
			handleQuotaExceeded: vi.fn(),
			cleanupOldData: vi.fn().mockReturnValue(0),
			export: vi.fn().mockReturnValue({}),
			import: vi.fn().mockReturnValue(true),
			migrateOldKeys: vi.fn(),
			dispose: vi.fn(),
			session: {
				get: vi.fn().mockReturnValue(null),
				set: vi.fn(),
				remove: vi.fn(),
				clear: vi.fn()
			}
		};

		// Mock LayoutService
		mockLayoutService = {
			persistence: mockPersistence,
			BREAKPOINTS: { mobile: 768, tablet: 1024, desktop: 1280 },
			LAYOUT_PRESETS: {
				'1up': { columns: 1, maxVisible: 1 },
				'2up': { columns: 2, maxVisible: 2 },
				'4up': { columns: 2, maxVisible: 4 }
			},
			STORAGE_KEYS: {
				layout: 'dispatch-layout',
				mobileIndex: 'dispatch-mobile-index',
				sidebarState: 'dispatch-sidebar-state'
			},
			mediaQueries: new Map(),
			columns: 4,
			maxVisible: 4,
			state: {
				preset: /** @type {'1up'} */ ('1up'),
				isMobile: false,
				isTablet: false,
				isDesktop: true,
				orientation: 'landscape',
				viewportWidth: 1024,
				viewportHeight: 768
			},
			initialize: vi.fn(),
			dispose: vi.fn(),
			getSidebarState: vi.fn().mockReturnValue({ collapsed: false, width: 280 }),
			setSidebarState: vi.fn(),
			setLayoutPreset: vi.fn(),
			cycleLayoutPreset: vi.fn().mockReturnValue('2up'),
			calculateGrid: vi.fn().mockReturnValue({ rows: 2, columns: 2, itemsPerRow: [2, 2] }),
			getOptimalPreset: vi.fn().mockReturnValue('2up'),
			supportsTouch: vi.fn().mockReturnValue(false),
			isMobile: vi.fn().mockReturnValue(false),
			isTablet: vi.fn().mockReturnValue(false),
			isDesktop: vi.fn().mockReturnValue(true),
			getDeviceType: vi.fn().mockReturnValue('desktop'),
			calculateColumns: vi.fn().mockReturnValue(4),
			calculateMaxVisible: vi.fn().mockReturnValue(4),
			loadLayoutPreset: vi.fn(),
			getMobileSessionIndex: vi.fn().mockReturnValue(0),
			setMobileSessionIndex: vi.fn(),
			setupMediaQueries: vi.fn(),
			updateViewport: vi.fn(),
			updateOrientation: vi.fn(),
			getState: vi.fn().mockReturnValue({
				preset: /** @type {'1up'} */ ('1up'),
				isMobile: false,
				isTablet: false,
				isDesktop: true,
				orientation: 'landscape',
				viewportWidth: 1024,
				viewportHeight: 768
			})
		};

		// Mock SocketService
		mockSocketService = {
			on: vi.fn(),
			off: vi.fn(),
			emit: vi.fn()
		};

		// Create ViewModel instance
		viewModel = new SessionViewModel(mockSessionApi, mockPersistence, mockLayoutService);
	});

	afterEach(() => {
		if (viewModel) {
			viewModel = null;
		}
	});

	describe('Svelte 5 Runes - Initial State', () => {
		it('should initialize with correct $state values', () => {
			expect(viewModel.sessions).toEqual([]);
			expect(viewModel.activeSessions).toBeInstanceOf(Set);
			expect(viewModel.activeSessions.size).toBe(0);
			expect(viewModel.loading).toBe(false);
			expect(viewModel.error).toBe(null);
			expect(viewModel.displayed).toEqual([]);
			expect(viewModel.currentMobileSession).toBe(0);
			expect(viewModel.creatingSession).toBe(false);
			expect(viewModel.selectedSessionId).toBe(null);
			expect(viewModel.showOnlyPinned).toBe(true);
			expect(viewModel.filterByWorkspace).toBe(null);
		});

		it('should initialize $derived computed values correctly', () => {
			expect(viewModel.sessionCount).toBe(0);
			expect(viewModel.activeSessionCount).toBe(0);
			expect(viewModel.hasActiveSessions).toBe(false);
		});
	});

	describe('Svelte 5 Runes - $derived.by Session Filtering', () => {
		beforeEach(() => {
			// Set up test sessions
			viewModel.sessions = [
				{ id: 'pinned-1', pinned: true, type: 'pty', workspacePath: '/workspace1' },
				{ id: 'pinned-2', pinned: true, type: 'claude', workspacePath: '/workspace1' },
				{ id: 'unpinned-1', pinned: false, type: 'pty', workspacePath: '/workspace2' },
				{ id: 'unpinned-2', pinned: false, type: 'claude', workspacePath: '/workspace2' }
			];
		});

		it('should filter pinned sessions correctly with $derived.by', () => {
			const pinned = viewModel.pinnedSessions;

			expect(pinned).toHaveLength(2);
			expect(pinned.every((s) => s.pinned)).toBe(true);
			expect(pinned.map((s) => s.id)).toEqual(['pinned-1', 'pinned-2']);
		});

		it('should filter unpinned sessions correctly with $derived.by', () => {
			const unpinned = viewModel.unpinnedSessions;

			expect(unpinned).toHaveLength(2);
			expect(unpinned.every((s) => !s.pinned)).toBe(true);
			expect(unpinned.map((s) => s.id)).toEqual(['unpinned-1', 'unpinned-2']);
		});

		it('should show visible sessions based on desktop layout', () => {
			mockLayoutService.isMobile.mockReturnValue(false);
			viewModel.displayed = ['pinned-1', 'unpinned-1'];

			const visible = viewModel.visibleSessions;

			expect(visible).toHaveLength(2);
			expect(visible.map((s) => s.id)).toEqual(['pinned-1', 'unpinned-1']);
		});

		it('should show single session on mobile layout', () => {
			mockLayoutService.isMobile.mockReturnValue(true);
			viewModel.currentMobileSession = 1;

			const visible = viewModel.visibleSessions;

			expect(visible).toHaveLength(1);
			expect(visible[0].id).toBe('pinned-2'); // Second session (index 1)
		});

		it('should handle empty sessions gracefully on mobile', () => {
			mockLayoutService.isMobile.mockReturnValue(true);
			viewModel.sessions = [];

			const visible = viewModel.visibleSessions;
			expect(visible).toEqual([]);
		});

		it('should reactively update when sessions change', () => {
			expect(viewModel.pinnedSessions).toHaveLength(2);

			// Add new pinned session
			viewModel.sessions = [
				...viewModel.sessions,
				{ id: 'new-pinned', pinned: true, type: 'pty', workspacePath: '/workspace3' }
			];

			expect(viewModel.pinnedSessions).toHaveLength(3);
			expect(viewModel.sessionCount).toBe(5);
		});
	});

	describe('Session Operations', () => {
		it('should load sessions and update reactive state', async () => {
			const mockSessions = [
				{ id: 'session-1', pinned: true, type: 'pty' },
				{ id: 'session-2', pinned: false, type: 'claude' }
			];
			mockSessionApi.list.mockResolvedValue(mockSessions);

			await viewModel.loadSessions();

			expect(viewModel.sessions).toEqual(mockSessions);
			expect(viewModel.sessionCount).toBe(2);
			expect(viewModel.pinnedSessions).toHaveLength(1);
			expect(viewModel.unpinnedSessions).toHaveLength(1);
			expect(viewModel.loading).toBe(false);
			expect(viewModel.error).toBe(null);
		});

		it('should handle loading errors', async () => {
			const error = new Error('Failed to load sessions');
			mockSessionApi.list.mockRejectedValue(error);

			await viewModel.loadSessions();

			expect(viewModel.error).toBe('Failed to load sessions');
			expect(viewModel.loading).toBe(false);
			expect(viewModel.sessions).toEqual([]);
		});

		it('should create new session', async () => {
			const newSession = { id: 'new-session', type: 'pty', pinned: false };
			mockSessionApi.create.mockResolvedValue(newSession);

			viewModel.creatingSession = false;
			const result = await viewModel.createSession({ type: 'pty', workspacePath: '/test' });

			expect(mockSessionApi.create).toHaveBeenCalledWith({ type: 'pty', workspacePath: '/test' });
			expect(viewModel.creatingSession).toBe(false);
			expect(result).toEqual(newSession);
		});

		it('should pin session', async () => {
			const sessionId = 'test-session';

			await viewModel.pinSession(sessionId);

			expect(mockSessionApi.pin).toHaveBeenCalledWith(sessionId);
		});

		it('should unpin session', async () => {
			const sessionId = 'test-session';

			await viewModel.unpinSession(sessionId);

			expect(mockSessionApi.unpin).toHaveBeenCalledWith(sessionId);
		});
	});

	describe('Session Display Management', () => {
		beforeEach(() => {
			viewModel.sessions = [
				{ id: 'session-1', pinned: true },
				{ id: 'session-2', pinned: true },
				{ id: 'session-3', pinned: false }
			];
		});

		it('should add session to display on desktop', () => {
			mockLayoutService.isMobile.mockReturnValue(false);
			mockLayoutService.maxVisible = 4;

			viewModel.addToDisplay('session-1');

			expect(viewModel.displayed).toContain('session-1');
		});

		it('should set current mobile session index', () => {
			mockLayoutService.isMobile.mockReturnValue(true);

			viewModel.addToDisplay('session-2');

			expect(viewModel.currentMobileSession).toBe(1); // Index of session-2
		});

		it('should remove session from display', () => {
			viewModel.displayed = ['session-1', 'session-2'];

			viewModel.removeFromDisplay('session-1');

			expect(viewModel.displayed).toEqual(['session-2']);
		});

		it('should respect maxVisible limit', () => {
			mockLayoutService.isMobile.mockReturnValue(false);
			mockLayoutService.maxVisible = 2;
			viewModel.displayed = ['old-1', 'old-2'];

			viewModel.addToDisplay('new-session');

			expect(viewModel.displayed).toHaveLength(2);
			expect(viewModel.displayed).toContain('new-session');
			expect(viewModel.displayed).not.toContain('old-2');
		});
	});

	describe('Mobile Navigation', () => {
		beforeEach(() => {
			mockLayoutService.isMobile.mockReturnValue(true);
			viewModel.sessions = [
				{ id: 'mobile-1', pinned: true },
				{ id: 'mobile-2', pinned: true },
				{ id: 'mobile-3', pinned: false }
			];
		});

		it('should navigate to next session', () => {
			viewModel.currentMobileSession = 0;

			viewModel.nextMobileSession();

			expect(viewModel.currentMobileSession).toBe(1);
		});

		it('should wrap around at end of sessions', () => {
			viewModel.currentMobileSession = 2; // Last session

			viewModel.nextMobileSession();

			expect(viewModel.currentMobileSession).toBe(0); // Wrap to first
		});

		it('should navigate to previous session', () => {
			viewModel.currentMobileSession = 1;

			viewModel.previousMobileSession();

			expect(viewModel.currentMobileSession).toBe(0);
		});

		it('should wrap around at beginning of sessions', () => {
			viewModel.currentMobileSession = 0;

			viewModel.previousMobileSession();

			expect(viewModel.currentMobileSession).toBe(2); // Wrap to last
		});
	});

	describe('Session Activity Tracking', () => {
		it('should track active sessions', () => {
			expect(viewModel.activeSessionCount).toBe(0);
			expect(viewModel.hasActiveSessions).toBe(false);

			viewModel.setSessionActive('session-1');

			expect(viewModel.activeSessions.has('session-1')).toBe(true);
			expect(viewModel.activeSessionCount).toBe(1);
			expect(viewModel.hasActiveSessions).toBe(true);
		});

		it('should remove from active sessions', () => {
			viewModel.setSessionActive('session-1');
			viewModel.setSessionActive('session-2');
			expect(viewModel.activeSessionCount).toBe(2);

			viewModel.setSessionInactive('session-1');

			expect(viewModel.activeSessions.has('session-1')).toBe(false);
			expect(viewModel.activeSessionCount).toBe(1);
		});

		it('should clear all active sessions', () => {
			viewModel.setSessionActive('session-1');
			viewModel.setSessionActive('session-2');

			viewModel.clearActiveSessions();

			expect(viewModel.activeSessionCount).toBe(0);
			expect(viewModel.hasActiveSessions).toBe(false);
		});
	});

	describe('Filter State Management', () => {
		beforeEach(() => {
			viewModel.sessions = [
				{ id: 'pinned-1', pinned: true, workspacePath: '/workspace1' },
				{ id: 'unpinned-1', pinned: false, workspacePath: '/workspace1' },
				{ id: 'pinned-2', pinned: true, workspacePath: '/workspace2' }
			];
		});

		it('should toggle show only pinned filter', () => {
			expect(viewModel.showOnlyPinned).toBe(true);

			viewModel.toggleShowOnlyPinned();

			expect(viewModel.showOnlyPinned).toBe(false);
		});

		it('should set workspace filter', () => {
			expect(viewModel.filterByWorkspace).toBe(null);

			viewModel.setWorkspaceFilter('/workspace1');

			expect(viewModel.filterByWorkspace).toBe('/workspace1');
		});

		it('should clear workspace filter', () => {
			viewModel.setWorkspaceFilter('/workspace1');

			viewModel.clearWorkspaceFilter();

			expect(viewModel.filterByWorkspace).toBe(null);
		});
	});

	describe('Error Handling', () => {
		it('should handle create session errors', async () => {
			mockSessionApi.create.mockRejectedValue(new Error('Creation failed'));

			await expect(viewModel.createSession({ type: 'pty' })).rejects.toThrow('Creation failed');
			expect(viewModel.error).toBe('Creation failed');
			expect(viewModel.creatingSession).toBe(false);
		});

		it('should handle pin/unpin errors', async () => {
			mockSessionApi.pin.mockRejectedValue(new Error('Pin failed'));

			await expect(viewModel.pinSession('session-1')).rejects.toThrow('Pin failed');
			expect(viewModel.error).toBe('Pin failed');
		});

		it('should clear previous errors on successful operations', async () => {
			viewModel.error = 'Previous error';

			mockSessionApi.list.mockResolvedValue([]);
			await viewModel.loadSessions();

			expect(viewModel.error).toBe(null);
		});
	});

	describe('Reactive Integration', () => {
		it('should maintain reactivity across complex operations', async () => {
			// Start with empty state
			expect(viewModel.sessionCount).toBe(0);
			expect(viewModel.hasActiveSessions).toBe(false);

			// Load sessions
			const sessions = [
				{ id: 'test-1', pinned: true, type: 'pty' },
				{ id: 'test-2', pinned: false, type: 'claude' }
			];
			mockSessionApi.list.mockResolvedValue(sessions);
			await viewModel.loadSessions();

			expect(viewModel.sessionCount).toBe(2);
			expect(viewModel.pinnedSessions).toHaveLength(1);
			expect(viewModel.unpinnedSessions).toHaveLength(1);

			// Add to display and activate
			viewModel.addToDisplay('test-1');
			viewModel.setSessionActive('test-1');

			expect(viewModel.displayed).toContain('test-1');
			expect(viewModel.hasActiveSessions).toBe(true);
			expect(viewModel.activeSessionCount).toBe(1);

			// Change filter
			viewModel.toggleShowOnlyPinned();
			expect(viewModel.showOnlyPinned).toBe(false);
		});
	});

	describe('Session Finding and Utilities', () => {
		beforeEach(() => {
			viewModel.sessions = [
				{ id: 'session-1', type: 'pty', workspacePath: '/workspace1' },
				{ id: 'session-2', type: 'claude', workspacePath: '/workspace2' }
			];
		});

		it('should find session by id', () => {
			const session = viewModel.getSession('session-1');

			expect(session).toBeDefined();
			expect(session.id).toBe('session-1');
		});

		it('should return undefined for non-existent session', () => {
			const session = viewModel.getSession('non-existent');

			expect(session).toBeUndefined();
		});

		it('should check if session exists', () => {
			expect(viewModel.hasSession('session-1')).toBe(true);
			expect(viewModel.hasSession('non-existent')).toBe(false);
		});
	});
});
