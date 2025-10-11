import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionOrchestrator } from '../../../src/lib/server/sessions/SessionOrchestrator.js';

describe('SessionOrchestrator', () => {
	let orchestrator;
	let mockAdapterRegistry;
	let mockSessionRepository;
	let mockEventRecorder;

	beforeEach(() => {
		// Create mock adapter registry
		mockAdapterRegistry = {
			getAdapter: vi.fn(),
			hasAdapter: vi.fn()
		};

		// Create mock session repository with all public methods
		// Type assertion needed because mock doesn't include private members (#db, #stmts, #parseSession)
		// which are implementation details not needed for testing
		mockSessionRepository =
			/** @type {import('../../../src/lib/server/database/SessionRepository.js').SessionRepository} */ (
				/** @type {any} */ ({
					create: vi.fn(),
					findById: vi.fn(),
					findByWorkspace: vi.fn(),
					findByKind: vi.fn(),
					updateStatus: vi.fn(),
					updateMetadata: vi.fn(),
					delete: vi.fn(),
					findAll: vi.fn(),
					markAllStopped: vi.fn()
				})
			);

		// Create mock event recorder
		mockEventRecorder = {
			startBuffering: vi.fn(),
			flushBuffer: vi.fn(),
			clearBuffer: vi.fn(),
			recordEvent: vi.fn(),
			stopRecording: vi.fn(),
			getSequence: vi.fn().mockResolvedValue(0),
			eventStore: {
				clearSequence: vi.fn(),
				getSequence: vi.fn().mockResolvedValue(0)
			}
		};

		// Create orchestrator with mocks in correct order (repository, recorder, registry)
		orchestrator = new SessionOrchestrator(
			mockSessionRepository,
			mockEventRecorder,
			mockAdapterRegistry
		);
	});

	describe('createSession', () => {
		it('should create a new session with valid adapter', async () => {
			// Arrange
			const sessionType = 'pty';
			const options = {
				workspacePath: '/test',
				metadata: { shell: '/bin/bash' }
			};
			const mockProcess = {
				input: { write: vi.fn() },
				close: vi.fn()
			};
			const mockAdapter = {
				create: vi.fn().mockResolvedValue(mockProcess)
			};

			mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
			mockSessionRepository.create.mockResolvedValue({
				id: 'session-123',
				kind: sessionType,
				status: 'pending',
				workspacePath: options.workspacePath,
				metadata: options.metadata
			});

			// Act
			const session = await orchestrator.createSession(sessionType, options);

			// Assert
			expect(session).toMatchObject({
				id: 'session-123',
				kind: sessionType,
				status: 'running'
			});
			expect(mockSessionRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: sessionType,
					workspacePath: options.workspacePath,
					metadata: options.metadata
				})
			);
			expect(mockEventRecorder.startBuffering).toHaveBeenCalledWith('session-123');
			expect(mockEventRecorder.flushBuffer).toHaveBeenCalledWith('session-123');
			expect(mockAdapter.create).toHaveBeenCalled();
			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith('session-123', 'running');
		});

		it('should throw error when adapter not found', async () => {
			// Arrange
			mockAdapterRegistry.getAdapter.mockReturnValue(null);
			mockSessionRepository.create.mockResolvedValue({
				id: 'session-123',
				kind: 'unknown'
			});

			// Act & Assert
			await expect(orchestrator.createSession('unknown', {})).rejects.toThrow();

			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith('session-123', 'error');
			expect(mockEventRecorder.clearBuffer).toHaveBeenCalledWith('session-123');
		});

		it('should handle adapter creation failure', async () => {
			// Arrange
			const mockAdapter = {
				create: vi.fn().mockRejectedValue(new Error('Creation failed'))
			};

			mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
			mockSessionRepository.create.mockResolvedValue({
				id: 'session-123',
				kind: 'pty',
				status: 'pending'
			});

			// Act & Assert
			await expect(orchestrator.createSession('pty', {})).rejects.toThrow('Creation failed');

			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith('session-123', 'error');
			expect(mockEventRecorder.clearBuffer).toHaveBeenCalledWith('session-123');
		});
	});

	describe('sendInput', () => {
		it('should send input to active session', async () => {
			// Arrange
			const sessionId = 'session-123';
			const input = 'test input';
			const mockProcess = {
				input: { write: vi.fn().mockResolvedValue(true) }
			};

			// Manually set active session using private field access
			const activeSessions = orchestrator['_SessionOrchestrator__activeSessions'] || new Map();
			activeSessions.set(sessionId, {
				adapter: {},
				process: mockProcess
			});
			orchestrator['_SessionOrchestrator__activeSessions'] = activeSessions;

			// Act
			await orchestrator.sendInput(sessionId, input);

			// Assert
			expect(mockProcess.input.write).toHaveBeenCalledWith(input);
			expect(mockEventRecorder.recordEvent).toHaveBeenCalledWith(
				sessionId,
				expect.objectContaining({
					channel: 'system',
					type: 'input',
					payload: { data: input }
				})
			);
		});

		it('should throw error for non-existent session', async () => {
			// Act & Assert
			await expect(orchestrator.sendInput('invalid', 'test')).rejects.toThrow('Session not found');
		});
	});

	describe('closeSession', () => {
		it('should properly close and cleanup session', async () => {
			// Arrange
			const sessionId = 'session-123';
			const mockProcess = {
				close: vi.fn().mockResolvedValue(true)
			};

			// Manually set active session
			const activeSessions = orchestrator['_SessionOrchestrator__activeSessions'] || new Map();
			activeSessions.set(sessionId, {
				adapter: {},
				process: mockProcess
			});
			orchestrator['_SessionOrchestrator__activeSessions'] = activeSessions;

			// Act
			await orchestrator.closeSession(sessionId);

			// Assert
			expect(mockProcess.close).toHaveBeenCalled();
			expect(mockEventRecorder.clearBuffer).toHaveBeenCalledWith(sessionId);
			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith(sessionId, 'closed');
		});

		it('should handle session not found without error', async () => {
			// Act - closeSession doesn't throw for non-existent sessions
			const result = await orchestrator.closeSession('invalid');

			// Assert - should still update status in database
			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith('invalid', 'closed');
		});
	});

	describe('getActiveProcess', () => {
		it('should return process if session exists', () => {
			// Arrange
			const sessionId = 'session-123';
			const mockProcess = { input: { write: vi.fn() } };

			// Manually set active session
			const activeSessions = orchestrator['_SessionOrchestrator__activeSessions'] || new Map();
			activeSessions.set(sessionId, {
				adapter: {},
				process: mockProcess
			});
			orchestrator['_SessionOrchestrator__activeSessions'] = activeSessions;

			// Act
			const process = orchestrator.getActiveProcess(sessionId);

			// Assert
			expect(process).toBe(mockProcess);
		});

		it('should return undefined for non-existent session', () => {
			// Act
			const process = orchestrator.getActiveProcess('invalid');

			// Assert
			expect(process).toBeUndefined();
		});
	});

	describe('resumeSession', () => {
		it('should resume session from database', async () => {
			// Arrange
			const sessionId = 'session-123';
			const sessionData = {
				id: sessionId,
				kind: 'pty',
				status: 'paused',
				metadata: { workspacePath: '/test' }
			};
			const mockProcess = {
				input: { write: vi.fn() },
				resume: vi.fn()
			};
			const mockAdapter = {
				resume: vi.fn().mockResolvedValue(mockProcess)
			};

			mockSessionRepository.findById.mockResolvedValue(sessionData);
			mockAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);

			// Act
			const result = await orchestrator.resumeSession(sessionId);

			// Assert
			expect(result).toMatchObject({
				sessionId: sessionId,
				success: true
			});
			expect(mockAdapter.resume).toHaveBeenCalledWith(sessionData);
			expect(mockEventRecorder.startBuffering).toHaveBeenCalledWith(sessionId);
			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith(sessionId, 'running');
		});

		it('should throw error if session not found in database', async () => {
			// Arrange
			mockSessionRepository.findById.mockResolvedValue(null);

			// Act & Assert
			await expect(orchestrator.resumeSession('invalid')).rejects.toThrow();
		});

		it('should handle session already running', async () => {
			// Arrange
			const sessionData = {
				id: 'session-123',
				status: 'running'
			};
			mockSessionRepository.findById.mockResolvedValue(sessionData);

			// Act
			const result = await orchestrator.resumeSession('session-123');

			// Assert
			expect(result).toMatchObject({
				sessionId: 'session-123',
				success: true,
				message: expect.stringContaining('already running')
			});
		});
	});

	describe('getActiveSessions', () => {
		it('should return map of active sessions', () => {
			// Arrange
			const session1 = { adapter: {}, process: {} };
			const session2 = { adapter: {}, process: {} };

			// Manually set active sessions
			const activeSessions = new Map();
			activeSessions.set('session-1', session1);
			activeSessions.set('session-2', session2);
			orchestrator['_SessionOrchestrator__activeSessions'] = activeSessions;

			// Act
			const result = orchestrator.getActiveSessions();

			// Assert
			expect(result).toBe(activeSessions);
			expect(result.size).toBe(2);
		});
	});

	describe('getStats', () => {
		it('should return statistics about sessions', () => {
			// Arrange
			const activeSessions = new Map();
			activeSessions.set('session-1', { adapter: {}, process: {} });
			activeSessions.set('session-2', { adapter: {}, process: {} });
			orchestrator['_SessionOrchestrator__activeSessions'] = activeSessions;

			// Act
			const stats = orchestrator.getStats();

			// Assert
			expect(stats).toMatchObject({
				activeSessions: 2,
				sessionIds: ['session-1', 'session-2']
			});
		});
	});

	describe('cleanup', () => {
		it('should close all active sessions', async () => {
			// Arrange
			const mockProcess1 = { close: vi.fn().mockResolvedValue(true) };
			const mockProcess2 = { close: vi.fn().mockResolvedValue(true) };

			const activeSessions = new Map();
			activeSessions.set('session-1', { adapter: {}, process: mockProcess1 });
			activeSessions.set('session-2', { adapter: {}, process: mockProcess2 });
			orchestrator['_SessionOrchestrator__activeSessions'] = activeSessions;

			// Act
			await orchestrator.cleanup();

			// Assert
			expect(mockProcess1.close).toHaveBeenCalled();
			expect(mockProcess2.close).toHaveBeenCalled();
			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith('session-1', 'closed');
			expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith('session-2', 'closed');
		});
	});
});
