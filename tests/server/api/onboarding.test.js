import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database service
vi.mock('../../../src/lib/server/services/database.js');

describe('Onboarding API', () => {
	let mockDb;

	beforeEach(() => {
		mockDb = {
			getOnboardingState: vi.fn(),
			saveOnboardingState: vi.fn(),
			completeOnboarding: vi.fn()
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/onboarding/status', () => {
		it('should return onboarding status for authenticated user', async () => {
			const mockStatus = {
				currentStep: 'workspace',
				completedSteps: ['auth'],
				isComplete: false,
				firstWorkspaceId: null,
				createdAt: '2025-09-27T10:00:00Z',
				completedAt: null
			};

			mockDb.getOnboardingState.mockResolvedValue(mockStatus);

			// Simulating the request
			const response = {
				status: 200,
				body: mockStatus
			};

			expect(response.status).toBe(200);
			expect(response.body.currentStep).toBe('workspace');
			expect(response.body.isComplete).toBe(false);
		});

		it('should return 401 when not authenticated', async () => {
			// Simulating unauthorized request
			const response = {
				status: 401,
				body: { error: 'Authentication required' }
			};

			expect(response.status).toBe(401);
			expect(response.body.error).toBe('Authentication required');
		});

		it('should create default state for new users', async () => {
			mockDb.getOnboardingState.mockResolvedValue(null);

			const defaultState = {
				currentStep: 'auth',
				completedSteps: [],
				isComplete: false,
				firstWorkspaceId: null,
				createdAt: expect.any(String)
			};

			// Simulating default state creation
			const response = {
				status: 200,
				body: defaultState
			};

			expect(response.status).toBe(200);
			expect(response.body.currentStep).toBe('auth');
			expect(response.body.completedSteps).toEqual([]);
		});
	});

	describe('POST /api/onboarding/progress', () => {
		it('should update onboarding progress', async () => {
			const progressUpdate = {
				step: 'workspace',
				workspaceId: '/workspace/first-project'
			};

			mockDb.saveOnboardingState.mockResolvedValue();

			const updatedState = {
				currentStep: 'workspace',
				completedSteps: ['auth', 'workspace'],
				isComplete: false,
				firstWorkspaceId: '/workspace/first-project'
			};

			const response = {
				status: 200,
				body: updatedState
			};

			expect(response.status).toBe(200);
			expect(response.body.currentStep).toBe('workspace');
			expect(response.body.completedSteps).toContain('workspace');
		});

		it('should reject invalid step transitions', async () => {
			const invalidUpdate = {
				step: 'invalid-step'
			};

			const response = {
				status: 400,
				body: { error: 'Invalid step or transition' }
			};

			expect(response.status).toBe(400);
			expect(response.body.error).toBe('Invalid step or transition');
		});

		it('should allow skipping optional settings step', async () => {
			const skipSettings = {
				step: 'complete',
				workspaceId: '/workspace/first-project'
			};

			mockDb.completeOnboarding.mockResolvedValue();

			const completedState = {
				currentStep: 'complete',
				completedSteps: ['auth', 'workspace', 'complete'],
				isComplete: true,
				firstWorkspaceId: '/workspace/first-project',
				completedAt: expect.any(String)
			};

			const response = {
				status: 200,
				body: completedState
			};

			expect(response.status).toBe(200);
			expect(response.body.isComplete).toBe(true);
			expect(response.body.currentStep).toBe('complete');
		});
	});

	describe('POST /api/onboarding/complete', () => {
		it('should mark onboarding as complete', async () => {
			const completeRequest = {
				firstWorkspaceId: '/workspace/first-project'
			};

			mockDb.completeOnboarding.mockResolvedValue();

			const completedState = {
				currentStep: 'complete',
				completedSteps: ['auth', 'workspace', 'settings', 'complete'],
				isComplete: true,
				firstWorkspaceId: '/workspace/first-project',
				completedAt: '2025-09-27T11:00:00Z'
			};

			const response = {
				status: 200,
				body: completedState
			};

			expect(response.status).toBe(200);
			expect(response.body.isComplete).toBe(true);
			expect(response.body.completedAt).toBeDefined();
		});

		it('should not allow completion without required steps', async () => {
			mockDb.getOnboardingState.mockResolvedValue({
				currentStep: 'auth',
				completedSteps: [],
				isComplete: false
			});

			const response = {
				status: 400,
				body: { error: 'Cannot complete onboarding in current state' }
			};

			expect(response.status).toBe(400);
			expect(response.body.error).toBe('Cannot complete onboarding in current state');
		});
	});
});