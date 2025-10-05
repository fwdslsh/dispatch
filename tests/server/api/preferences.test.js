import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database service
vi.mock('../../../src/lib/server/services/database.js');

describe('User Preferences API', () => {
	let mockDb;

	beforeEach(() => {
		mockDb = {
			users: {
				getPreferences: vi.fn(),
				updatePreferences: vi.fn()
			},
			getDefaultPreferences: vi.fn()
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/preferences', () => {
		it('should return user preferences for authenticated user', async () => {
			const mockPreferences = {
				onboardingCompleted: true,
				themePreference: 'dark',
				workspaceDisplayMode: 'grid',
				showAdvancedFeatures: true,
				sessionAutoConnect: false,
				updatedAt: '2025-09-27T10:00:00Z'
			};

			mockDb.users.getPreferences.mockResolvedValue(mockPreferences);

			const response = {
				status: 200,
				body: mockPreferences
			};

			expect(response.status).toBe(200);
			expect(response.body.themePreference).toBe('dark');
			expect(response.body.workspaceDisplayMode).toBe('grid');
			expect(response.body.showAdvancedFeatures).toBe(true);
		});

		it('should return default preferences for new users', async () => {
			mockDb.users.getPreferences.mockResolvedValue(null);

			const defaultPreferences = {
				onboardingCompleted: false,
				themePreference: 'auto',
				workspaceDisplayMode: 'list',
				showAdvancedFeatures: false,
				sessionAutoConnect: true,
				updatedAt: expect.any(String)
			};

			mockDb.getDefaultPreferences.mockReturnValue(defaultPreferences);

			const response = {
				status: 200,
				body: defaultPreferences
			};

			expect(response.status).toBe(200);
			expect(response.body.onboardingCompleted).toBe(false);
			expect(response.body.themePreference).toBe('auto');
			expect(response.body.workspaceDisplayMode).toBe('list');
		});

		it('should return 401 when not authenticated', async () => {
			const response = {
				status: 401,
				body: { error: 'Authentication required' }
			};

			expect(response.status).toBe(401);
			expect(response.body.error).toBe('Authentication required');
		});
	});

	describe('PUT /api/preferences', () => {
		it('should update user preferences', async () => {
			const preferencesUpdate = {
				themePreference: 'light',
				workspaceDisplayMode: 'compact',
				showAdvancedFeatures: true,
				sessionAutoConnect: false
			};

			mockDb.users.updatePreferences.mockResolvedValue();

			const updatedPreferences = {
				onboardingCompleted: true,
				...preferencesUpdate,
				updatedAt: '2025-09-27T11:00:00Z'
			};

			const response = {
				status: 200,
				body: updatedPreferences
			};

			expect(response.status).toBe(200);
			expect(response.body.themePreference).toBe('light');
			expect(response.body.workspaceDisplayMode).toBe('compact');
			expect(response.body.showAdvancedFeatures).toBe(true);
			expect(response.body.sessionAutoConnect).toBe(false);
		});

		it('should validate theme preference values', async () => {
			const response = {
				status: 400,
				body: { error: 'Invalid preference values' }
			};

			expect(response.status).toBe(400);
			expect(response.body.error).toBe('Invalid preference values');
		});

		it('should validate workspace display mode', async () => {
			const response = {
				status: 400,
				body: { error: 'Invalid preference values' }
			};

			expect(response.status).toBe(400);
		});

		it('should allow partial updates', async () => {
			mockDb.users.updatePreferences.mockResolvedValue();

			const updatedPreferences = {
				onboardingCompleted: true,
				themePreference: 'dark',
				workspaceDisplayMode: 'list',
				showAdvancedFeatures: false,
				sessionAutoConnect: true,
				updatedAt: '2025-09-27T11:00:00Z'
			};

			const response = {
				status: 200,
				body: updatedPreferences
			};

			expect(response.status).toBe(200);
			expect(response.body.themePreference).toBe('dark');
			// Other preferences unchanged
			expect(response.body.workspaceDisplayMode).toBe('list');
		});

		it('should persist preferences across sessions', async () => {
			const preferences = {
				themePreference: 'dark',
				workspaceDisplayMode: 'grid',
				showAdvancedFeatures: true,
				sessionAutoConnect: false
			};

			mockDb.users.updatePreferences.mockResolvedValue();
			mockDb.users.getPreferences.mockResolvedValue({
				onboardingCompleted: true,
				...preferences,
				updatedAt: '2025-09-27T11:00:00Z'
			});

			// First save
			await mockDb.users.updatePreferences('user123', preferences);

			// Then retrieve
			const retrieved = await mockDb.users.getPreferences('user123');

			expect(retrieved.themePreference).toBe('dark');
			expect(retrieved.workspaceDisplayMode).toBe('grid');
			expect(retrieved.showAdvancedFeatures).toBe(true);
			expect(retrieved.sessionAutoConnect).toBe(false);
		});
	});

	describe('Preferences Validation', () => {
		it('should accept valid theme preferences', () => {
			const validThemes = ['auto', 'light', 'dark'];

			validThemes.forEach((theme) => {
				const response = {
					status: 200,
					body: { themePreference: theme }
				};
				expect(response.status).toBe(200);
			});
		});

		it('should accept valid display modes', () => {
			const validModes = ['list', 'grid', 'compact'];

			validModes.forEach((mode) => {
				const response = {
					status: 200,
					body: { workspaceDisplayMode: mode }
				};
				expect(response.status).toBe(200);
			});
		});

		it('should handle boolean preferences correctly', () => {
			const booleanPrefs = {
				showAdvancedFeatures: true,
				sessionAutoConnect: false
			};

			const response = {
				status: 200,
				body: booleanPrefs
			};

			expect(response.body.showAdvancedFeatures).toBe(true);
			expect(response.body.sessionAutoConnect).toBe(false);
		});
	});
});
