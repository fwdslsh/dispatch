import http from 'node:http';
import { describe, expect, it, vi } from 'vitest';

vi.mock('socket.io', () => {
	class MockServer {
		constructor() {
			this.use = vi.fn();
			this.on = vi.fn();
			this.emit = vi.fn();
			this.close = vi.fn();
			this.to = vi.fn().mockReturnValue({ emit: vi.fn() });
		}
	}

	return { Server: MockServer };
});

const { setupSocketIO } = await import('../../src/lib/server/shared/socket-setup.js');

describe('setupSocketIO', () => {
	it('subscribes to EventRecorder for real-time events', () => {
		const httpServer = http.createServer();

		const mockEventRecorder = {
			subscribe: vi.fn()
		};

		const mockSessionOrchestrator = {
			attachToSession: vi.fn(),
			sendInput: vi.fn(),
			closeSession: vi.fn()
		};

		const mockAuthService = {
			validateKey: vi.fn()
		};

		const services = {
			sessionOrchestrator: mockSessionOrchestrator,
			eventRecorder: mockEventRecorder,
			auth: mockAuthService,
			tunnelManager: { setSocketIO: vi.fn() },
			vscodeManager: { setSocketIO: vi.fn() }
		};

		const io = setupSocketIO(httpServer, services);

		// Verify EventRecorder subscription
		expect(mockEventRecorder.subscribe).toHaveBeenCalledTimes(1);
		expect(mockEventRecorder.subscribe).toHaveBeenCalledWith('event', expect.any(Function));

		io.close();
		httpServer.close();
	});
});
