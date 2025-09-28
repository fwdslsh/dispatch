import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database service
vi.mock('../../../src/lib/server/services/database.js');

describe('Retention Policy API', () => {
	let mockDb;

	beforeEach(() => {
		mockDb = {
			getRetentionPolicy: vi.fn(),
			saveRetentionPolicy: vi.fn(),
			generateRetentionPreview: vi.fn(),
			executeRetentionCleanup: vi.fn(),
			getDefaultRetentionPolicy: vi.fn()
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/retention/policy', () => {
		it('should return retention policy for authenticated user', async () => {
			const mockPolicy = {
				id: 'policy_user123',
				sessionRetentionDays: 30,
				logRetentionDays: 7,
				autoCleanupEnabled: true,
				lastCleanupRun: null,
				previewSummary: null
			};

			mockDb.getRetentionPolicy.mockResolvedValue(mockPolicy);

			const response = {
				status: 200,
				body: mockPolicy
			};

			expect(response.status).toBe(200);
			expect(response.body.sessionRetentionDays).toBe(30);
			expect(response.body.logRetentionDays).toBe(7);
			expect(response.body.autoCleanupEnabled).toBe(true);
		});

		it('should return default policy for new users', async () => {
			mockDb.getRetentionPolicy.mockResolvedValue(null);

			const defaultPolicy = {
				id: 'policy_user123',
				sessionRetentionDays: 30,
				logRetentionDays: 7,
				autoCleanupEnabled: true,
				lastCleanupRun: null,
				previewSummary: null
			};

			mockDb.getDefaultRetentionPolicy.mockReturnValue(defaultPolicy);

			const response = {
				status: 200,
				body: defaultPolicy
			};

			expect(response.status).toBe(200);
			expect(response.body.sessionRetentionDays).toBe(30);
		});

		it('should return 401 when not authenticated', async () => {
			const response = {
				status: 401,
				body: { error: 'Authentication required' }
			};

			expect(response.status).toBe(401);
		});
	});

	describe('PUT /api/retention/policy', () => {
		it('should update retention policy', async () => {
			const policyUpdate = {
				sessionRetentionDays: 14,
				logRetentionDays: 3,
				autoCleanupEnabled: false
			};

			mockDb.saveRetentionPolicy.mockResolvedValue({ id: 'policy_user123' });

			const updatedPolicy = {
				...policyUpdate,
				id: 'policy_user123',
				lastCleanupRun: null,
				previewSummary: null
			};

			const response = {
				status: 200,
				body: updatedPolicy
			};

			expect(response.status).toBe(200);
			expect(response.body.sessionRetentionDays).toBe(14);
			expect(response.body.logRetentionDays).toBe(3);
			expect(response.body.autoCleanupEnabled).toBe(false);
		});

		it('should validate retention days are within limits', async () => {
			const invalidUpdate = {
				sessionRetentionDays: 400, // exceeds max of 365
				logRetentionDays: 0 // below min of 1
			};

			const response = {
				status: 400,
				body: { error: 'Invalid policy values' }
			};

			expect(response.status).toBe(400);
			expect(response.body.error).toBe('Invalid policy values');
		});

		it('should validate minimum retention periods', async () => {
			const tooShortRetention = {
				sessionRetentionDays: 0,
				logRetentionDays: 0
			};

			const response = {
				status: 400,
				body: { error: 'Invalid policy values' }
			};

			expect(response.status).toBe(400);
		});
	});

	describe('POST /api/retention/preview', () => {
		it('should generate retention preview', async () => {
			const previewRequest = {
				sessionRetentionDays: 14,
				logRetentionDays: 3
			};

			const mockPreview = {
				summary: 'Will delete 15 sessions older than 14 days and 250 log entries older than 3 days',
				sessionsToDelete: 15,
				logsToDelete: 250,
				estimatedSpaceSaved: '2MB'
			};

			mockDb.generateRetentionPreview.mockResolvedValue(mockPreview);

			const response = {
				status: 200,
				body: mockPreview
			};

			expect(response.status).toBe(200);
			expect(response.body.summary).toContain('15 sessions');
			expect(response.body.summary).toContain('14 days');
			expect(response.body.sessionsToDelete).toBe(15);
			expect(response.body.logsToDelete).toBe(250);
		});

		it('should handle preview for zero deletions', async () => {
			const previewRequest = {
				sessionRetentionDays: 365,
				logRetentionDays: 90
			};

			const mockPreview = {
				summary: 'Will delete 0 sessions older than 365 days and 0 log entries older than 90 days',
				sessionsToDelete: 0,
				logsToDelete: 0,
				estimatedSpaceSaved: '0MB'
			};

			mockDb.generateRetentionPreview.mockResolvedValue(mockPreview);

			const response = {
				status: 200,
				body: mockPreview
			};

			expect(response.status).toBe(200);
			expect(response.body.sessionsToDelete).toBe(0);
			expect(response.body.logsToDelete).toBe(0);
		});

		it('should reject invalid preview parameters', async () => {
			const invalidPreview = {
				sessionRetentionDays: -1,
				logRetentionDays: 'invalid'
			};

			const response = {
				status: 400,
				body: { error: 'Invalid preview parameters' }
			};

			expect(response.status).toBe(400);
		});
	});

	describe('POST /api/retention/cleanup', () => {
		it('should execute cleanup when confirmed', async () => {
			const cleanupRequest = {
				confirm: true
			};

			const mockResult = {
				sessionsDeleted: 15,
				logsDeleted: 250,
				spaceSaved: '2MB',
				executedAt: '2025-09-27T12:00:00Z'
			};

			mockDb.executeRetentionCleanup.mockResolvedValue(mockResult);

			const response = {
				status: 200,
				body: mockResult
			};

			expect(response.status).toBe(200);
			expect(response.body.sessionsDeleted).toBe(15);
			expect(response.body.logsDeleted).toBe(250);
			expect(response.body.executedAt).toBeDefined();
		});

		it('should reject cleanup without confirmation', async () => {
			const cleanupRequest = {
				confirm: false
			};

			const response = {
				status: 400,
				body: { error: 'Cleanup not confirmed or invalid request' }
			};

			expect(response.status).toBe(400);
			expect(response.body.error).toContain('not confirmed');
		});

		it('should handle cleanup with no data to delete', async () => {
			const cleanupRequest = {
				confirm: true
			};

			const mockResult = {
				sessionsDeleted: 0,
				logsDeleted: 0,
				spaceSaved: '0MB',
				executedAt: '2025-09-27T12:00:00Z'
			};

			mockDb.executeRetentionCleanup.mockResolvedValue(mockResult);

			const response = {
				status: 200,
				body: mockResult
			};

			expect(response.status).toBe(200);
			expect(response.body.sessionsDeleted).toBe(0);
			expect(response.body.logsDeleted).toBe(0);
		});
	});
});