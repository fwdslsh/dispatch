const resolveRunSessionId = (payload = {}) => payload.runSessionId || payload.runId;

export function registerRunSessionHandlers(mediator) {
	mediator.registerDomain(({ register, socket, services, logger }) => {
		const { runSessionManager } = services;

		if (!runSessionManager) {
			throw new Error('RunSessionManager service not provided');
		}

		const attachHandler = async ({ payload, ack }) => {
			const runSessionId = resolveRunSessionId(payload);
			const { afterSeq } = payload || {};

			if (!ack || !runSessionId) {
				return;
			}

			try {
				socket.join(`run:${runSessionId}`);
				socket.join(`runSession:${runSessionId}`);
				const backlog = await runSessionManager.getEventsSince(runSessionId, afterSeq || 0);
				logger.info(
					'SOCKET',
					`Client attached to run session ${runSessionId}, sent ${backlog.length} events since seq ${
						afterSeq || 0
					}`
				);
				ack({ success: true, events: backlog, runSessionId, runId: runSessionId });
			} catch (error) {
				logger.error('SOCKET', `Failed to attach to run session ${runSessionId}`, error);
				ack({ success: false, error: 'Failed to attach to run session' });
			}
		};

		const inputHandler = async ({ payload }) => {
			const runSessionId = resolveRunSessionId(payload);
			const { data } = payload || {};

			try {
				await runSessionManager.sendInput(runSessionId, data);
				logger.debug('SOCKET', `Input sent to run session ${runSessionId}`);
			} catch (error) {
				logger.error('SOCKET', `Failed to send input to run session ${runSessionId}:`, error);
				socket.emit('run:error', {
					runId: runSessionId,
					runSessionId,
					error: error.message,
					type: 'input_failed'
				});
				socket.emit('runSession:error', {
					runSessionId,
					error: error.message,
					type: 'input_failed'
				});
			}
		};

		const resizeHandler = async ({ payload }) => {
			const runSessionId = resolveRunSessionId(payload);
			const { cols, rows } = payload || {};

			try {
				await runSessionManager.performOperation(runSessionId, 'resize', [cols, rows]);
				logger.debug('SOCKET', `Resized run session ${runSessionId} to ${cols}x${rows}`);
			} catch (error) {
				logger.error('SOCKET', `Failed to resize run session ${runSessionId}:`, error);
			}
		};

		const closeHandler = async ({ payload }) => {
			const runSessionId = resolveRunSessionId(payload);

			try {
				await runSessionManager.closeRunSession(runSessionId);
				socket.leave(`run:${runSessionId}`);
				socket.leave(`runSession:${runSessionId}`);
				logger.info('SOCKET', `Run session closed: ${runSessionId}`);
			} catch (error) {
				logger.error('SOCKET', `Failed to close run session ${runSessionId}:`, error);
			}
		};

		register('run:attach', async (args) => attachHandler(args), {
			unauthorizedPayload: { error: 'Not authenticated' },
			errorResponse: { success: false, error: 'Failed to attach to run session' }
		});
		register('runSession:attach', async (args) => attachHandler(args), {
			unauthorizedPayload: { error: 'Not authenticated' },
			errorResponse: { success: false, error: 'Failed to attach to run session' }
		});

		register('run:input', async (args) => inputHandler(args));
		register('runSession:input', async (args) => inputHandler(args));

		register('run:resize', async (args) => resizeHandler(args));
		register('runSession:resize', async (args) => resizeHandler(args));

		register('run:close', async (args) => closeHandler(args));
		register('runSession:close', async (args) => closeHandler(args));
	});
}
