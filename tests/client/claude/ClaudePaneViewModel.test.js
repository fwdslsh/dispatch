/**
 * ClaudePaneViewModel Tests
 *
 * Demonstrates dependency injection pattern for testing the ViewModel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudePaneViewModel } from '../../../src/lib/client/claude/viewmodels/ClaudePaneViewModel.svelte.js';

describe('ClaudePaneViewModel - Dependency Injection', () => {
	let mockSessionClient;
	let viewModel;

	beforeEach(() => {
		// Create mock session client
		mockSessionClient = {
			getStatus: vi.fn().mockReturnValue({ connected: true, authenticated: true }),
			sendInput: vi.fn(),
			attachToRunSession: vi.fn(),
			detachFromRunSession: vi.fn()
		};
	});

	describe('Constructor', () => {
		it('should accept sessionClient via dependency injection', () => {
			viewModel = new ClaudePaneViewModel({
				sessionId: 'test-session-id',
				sessionClient: mockSessionClient
			});

			expect(viewModel.sessionClient).toBe(mockSessionClient);
			expect(viewModel.sessionId).toBe('test-session-id');
		});

		it('should fallback to singleton if no sessionClient provided', () => {
			viewModel = new ClaudePaneViewModel({
				sessionId: 'test-session-id'
			});

			// Should use the imported runSessionClient singleton
			expect(viewModel.sessionClient).toBeDefined();
			expect(viewModel.sessionId).toBe('test-session-id');
		});

		it('should accept optional claudeSessionId and shouldResume', () => {
			viewModel = new ClaudePaneViewModel({
				sessionId: 'test-session-id',
				claudeSessionId: 'claude-123',
				shouldResume: true,
				sessionClient: mockSessionClient
			});

			expect(viewModel.claudeSessionId).toBe('claude-123');
			expect(viewModel.shouldResume).toBe(true);
		});
	});

	describe('submitInput', () => {
		beforeEach(() => {
			viewModel = new ClaudePaneViewModel({
				sessionId: 'test-session-id',
				sessionClient: mockSessionClient
			});
			viewModel.isAttached = true;
		});

		it('should use injected sessionClient to send input', async () => {
			viewModel.input = 'Hello Claude';

			await viewModel.submitInput();

			expect(mockSessionClient.sendInput).toHaveBeenCalledWith('test-session-id', 'Hello Claude');
		});

		it('should not send input if not attached', async () => {
			viewModel.isAttached = false;
			viewModel.input = 'Hello';

			await viewModel.submitInput();

			expect(mockSessionClient.sendInput).not.toHaveBeenCalled();
		});

		it('should check connection status using injected client', async () => {
			viewModel.input = 'Test message';

			await viewModel.submitInput();

			expect(mockSessionClient.getStatus).toHaveBeenCalled();
		});

		it('should handle auth code submission via injected client', async () => {
			viewModel.input = 'auth-code-123';
			// Set auth manager to awaiting code state
			viewModel.authManager.awaitingCode = true;

			await viewModel.submitInput();

			expect(mockSessionClient.sendInput).toHaveBeenCalledWith(
				'test-session-id',
				'/auth auth-code-123'
			);
		});
	});

	describe('State Management', () => {
		beforeEach(() => {
			viewModel = new ClaudePaneViewModel({
				sessionId: 'test-session-id',
				sessionClient: mockSessionClient
			});
		});

		it('should add user message to state', async () => {
			viewModel.isAttached = true;
			viewModel.input = 'Test message';
			const initialLength = viewModel.messages.length;

			await viewModel.submitInput();

			expect(viewModel.messages.length).toBe(initialLength + 1);
			expect(viewModel.messages[viewModel.messages.length - 1]).toMatchObject({
				role: 'user',
				text: 'Test message'
			});
		});

		it('should clear input after submission', async () => {
			viewModel.isAttached = true;
			viewModel.input = 'Test message';

			await viewModel.submitInput();

			expect(viewModel.input).toBe('');
		});

		it('should set waiting state after submission', async () => {
			viewModel.isAttached = true;
			viewModel.input = 'Test message';

			await viewModel.submitInput();

			expect(viewModel.isWaitingForReply).toBe(true);
		});
	});
});
