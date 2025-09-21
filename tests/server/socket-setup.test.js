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
	it('registers io instance with RunSessionManager', () => {
		const httpServer = http.createServer();
		const runSessionManager = {
			setSocketIO: vi.fn(),
			getEventsSince: vi.fn(),
			sendInput: vi.fn(),
			performOperation: vi.fn(),
			closeRunSession: vi.fn()
		};

		const io = setupSocketIO(httpServer, { runSessionManager });

		expect(runSessionManager.setSocketIO).toHaveBeenCalledTimes(1);
		expect(runSessionManager.setSocketIO).toHaveBeenCalledWith(io);

		io.close();
		httpServer.close();
	});
});
