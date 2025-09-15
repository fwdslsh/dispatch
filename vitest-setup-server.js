/**
 * Vitest server-side test setup
 * Configures Node.js environment for server tests
 */
import { vi } from 'vitest';

// Mock global environment variables
if (!process.env.NODE_ENV) {
	process.env.NODE_ENV = 'test';
}

// Mock database manager for tests
vi.mock('./src/lib/server/db/DatabaseManager.js', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getDatabaseManager: vi.fn(() => ({
			init: vi.fn(),
			createWorkspace: vi.fn(),
			updateWorkspaceActivity: vi.fn(),
			addWorkspaceSession: vi.fn(),
			getWorkspaceSessions: vi.fn(() => []),
			setPinned: vi.fn(),
			close: vi.fn()
		}))
	};
});

// Mock Socket.IO for server tests
vi.mock('socket.io', () => ({
	Server: vi.fn(() => ({
		on: vi.fn(),
		emit: vi.fn(),
		to: vi.fn(() => ({
			emit: vi.fn()
		}))
	}))
}));

// Set up global mocks
global.__API_SERVICES = {
	databaseManager: {
		init: vi.fn(),
		createWorkspace: vi.fn(),
		updateWorkspaceActivity: vi.fn(),
		addWorkspaceSession: vi.fn(),
		getWorkspaceSessions: vi.fn(() => []),
		setPinned: vi.fn()
	}
};

// Console suppression for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
	// Suppress known test-related console errors
	const message = args[0]?.toString() || '';
	if (
		message.includes('DATABASE') ||
		message.includes('ViewModel') ||
		message.includes('Load error:')
	) {
		return; // Suppress these during tests
	}
	originalConsoleError.apply(console, args);
};
