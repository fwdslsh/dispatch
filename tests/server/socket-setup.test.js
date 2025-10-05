import http from 'node:http';
import { EventEmitter } from 'node:events';
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
	it('bridges run session events to socket rooms', () => {
		const httpServer = http.createServer();
		const runSessionManager = Object.assign(new EventEmitter(), {
			getEventsSince: vi.fn().mockResolvedValue([]),
			sendInput: vi.fn(),
			performOperation: vi.fn(),
			closeRunSession: vi.fn()
		});

		const auth = { validateKey: vi.fn().mockResolvedValue(true) };
		const tunnelManager = { setSocketIO: vi.fn() };
		const vscodeManager = { setSocketIO: vi.fn() };

		const io = setupSocketIO(httpServer, {
			runSessionManager,
			auth,
			tunnelManager,
			vscodeManager
		});

		const roomEmit = vi.fn();
		const toMock = vi.fn().mockReturnValue({ emit: roomEmit });
		io.to = toMock;

		runSessionManager.emit('runSession:event', {
			runSessionId: 'abc',
			event: { seq: 1, type: 'data' }
		});

		expect(toMock).toHaveBeenCalledWith('run:abc');
		expect(toMock).toHaveBeenCalledWith('runSession:abc');
		expect(roomEmit).toHaveBeenCalledWith('run:event', { seq: 1, type: 'data' });
		expect(roomEmit).toHaveBeenCalledWith('runSession:event', { seq: 1, type: 'data' });

		io.close();
		httpServer.close();
	});
});
