import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ClaudeCommands from '../../src/lib/client/claude/ClaudeCommands.svelte';

// Mock localStorage
const mockLocalStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

// Mock fetch
global.fetch = vi.fn();

describe('ClaudeCommands', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.localStorage = mockLocalStorage;
		mockLocalStorage.getItem.mockReturnValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders command menu button', () => {
		const { container } = render(ClaudeCommands, {
			props: {
				socket: null,
				workspacePath: '/test/workspace',
				sessionId: 'test-session',
				claudeSessionId: 'claude-123',
				onCommandInsert: vi.fn()
			}
		});

		const button = container.querySelector('button[aria-label="Open command menu"]');
		expect(button).toBeTruthy();
		expect(button.textContent.includes('/')).toBe(true);
	});

	it('has proper structure and classes', () => {
		const { container } = render(ClaudeCommands, {
			props: {
				socket: null,
				workspacePath: '/test/workspace',
				sessionId: 'test-session',
				onCommandInsert: vi.fn()
			}
		});

		expect(container.querySelector('.claude-commands')).toBeTruthy();
		expect(container.querySelector('.command-menu-button')).toBeTruthy();
	});

	it('is disabled when disabled prop is true', () => {
		const { container } = render(ClaudeCommands, {
			props: {
				socket: null,
				workspacePath: '/test/workspace',
				sessionId: 'test-session',
				onCommandInsert: vi.fn(),
				disabled: true
			}
		});

		const button = container.querySelector('.command-menu-button');
		expect(button.disabled).toBe(true);
		expect(button.getAttribute('title')).toBe('Commands unavailable');
	});

	it('accepts commands for app session ID', async () => {
		const mockSocket = {
			on: vi.fn(),
			emit: vi.fn(),
			off: vi.fn()
		};

		const component = render(ClaudeCommands, {
			props: {
				socket: mockSocket,
				workspacePath: '/test/workspace',
				sessionId: 'app-session-123',
				claudeSessionId: 'claude-456',
				onCommandInsert: vi.fn()
			}
		});

		// Simulate receiving tools.available event with app session ID
		const handleToolsList = mockSocket.on.mock.calls.find(
			(call) => call[0] === 'claude.tools.available'
		)[1];

		// Mock console.log to capture logs
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		handleToolsList({
			sessionId: 'app-session-123',
			commands: ['clear', 'compact']
		});

		expect(consoleSpy).toHaveBeenCalledWith(
			'[ClaudeCommands] Received 2 commands for session app-session-123'
		);

		consoleSpy.mockRestore();
	});

	it('accepts commands for Claude session ID', async () => {
		const mockSocket = {
			on: vi.fn(),
			emit: vi.fn(),
			off: vi.fn()
		};

		const component = render(ClaudeCommands, {
			props: {
				socket: mockSocket,
				workspacePath: '/test/workspace',
				sessionId: 'app-session-123',
				claudeSessionId: 'claude-456',
				onCommandInsert: vi.fn()
			}
		});

		// Simulate receiving tools.available event with Claude session ID
		const handleToolsList = mockSocket.on.mock.calls.find(
			(call) => call[0] === 'claude.tools.available'
		)[1];

		// Mock console.log to capture logs
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		handleToolsList({
			sessionId: 'claude-456',
			commands: ['clear', 'compact']
		});

		expect(consoleSpy).toHaveBeenCalledWith(
			'[ClaudeCommands] Received 2 commands for session app-session-123'
		);

		consoleSpy.mockRestore();
	});

	it('rejects commands for different session ID', async () => {
		const mockSocket = {
			on: vi.fn(),
			emit: vi.fn(),
			off: vi.fn()
		};

		const component = render(ClaudeCommands, {
			props: {
				socket: mockSocket,
				workspacePath: '/test/workspace',
				sessionId: 'app-session-123',
				claudeSessionId: 'claude-456',
				onCommandInsert: vi.fn()
			}
		});

		// Simulate receiving tools.available event with different session ID
		const handleToolsList = mockSocket.on.mock.calls.find(
			(call) => call[0] === 'claude.tools.available'
		)[1];

		// Mock console.log to capture logs
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		handleToolsList({
			sessionId: 'different-session-789',
			commands: ['clear', 'compact']
		});

		expect(consoleSpy).toHaveBeenCalledWith(
			'[ClaudeCommands] Ignoring tools.available for different session: different-session-789 !== app-session-123 or claude-456'
		);

		consoleSpy.mockRestore();
	});
});
