export function registerTunnelHandlers(mediator) {
	mediator.registerDomain(({ register, io, services, logger }) => {
		const tunnelManager = services.tunnelManager;

		if (!tunnelManager) {
			return;
		}

		register(
			'get-public-url',
			async ({ ack }) => {
				if (!ack) {
					return;
				}

				try {
					const url = tunnelManager.getPublicUrl();
					ack({ ok: !!url, url });
				} catch (error) {
					logger.error('SOCKET', 'Error handling get-public-url:', error);
					ack({ ok: false, error: error.message });
				}
			},
			{ requireAuth: false, unauthorizedPayload: undefined }
		);

		register(
			'tunnel.enable',
			async ({ payload, ack }) => {
				if (!ack) {
					return;
				}

				logger.info('SOCKET', `Tunnel enable requested`, payload);

				if (payload?.port) {
					tunnelManager.port = parseInt(payload.port, 10);
				}

				try {
					const success = await tunnelManager.start();
					const status = tunnelManager.getStatus();
					logger.info('SOCKET', `Tunnel enable result: ${success}`, status);
					ack({ success, status });
					io.emit('tunnel.status', status);
				} catch (error) {
					logger.error('SOCKET', 'Error enabling tunnel:', error);
					ack({ success: false, error: error.message });
				}
			},
			{ unauthorizedPayload: { success: false, error: 'Unauthorized' } }
		);

		register(
			'tunnel.disable',
			async ({ ack }) => {
				if (!ack) {
					return;
				}

				try {
					const success = await tunnelManager.stop();
					const status = tunnelManager.getStatus();
					logger.info('SOCKET', `Tunnel disable result: ${success}`, status);
					ack({ success, status });
					io.emit('tunnel.status', status);
				} catch (error) {
					logger.error('SOCKET', 'Error disabling tunnel:', error);
					ack({ success: false, error: error.message });
				}
			},
			{ unauthorizedPayload: { success: false, error: 'Unauthorized' } }
		);

		register(
			'tunnel.status',
			async ({ ack }) => {
				if (!ack) {
					return;
				}

				try {
					const status = tunnelManager.getStatus();
					ack({ success: true, status });
				} catch (error) {
					logger.error('SOCKET', 'Error getting tunnel status:', error);
					ack({ success: false, error: error.message });
				}
			},
			{ unauthorizedPayload: { success: false, error: 'Unauthorized' } }
		);

		register(
			'tunnel.updateConfig',
			async ({ payload, ack }) => {
				if (!ack) {
					return;
				}

				try {
					const success = await tunnelManager.updateConfig(payload);
					const status = tunnelManager.getStatus();
					logger.info('SOCKET', `Tunnel config update result: ${success}`, status);
					ack({ success, status });
					io.emit('tunnel.status', status);
				} catch (error) {
					logger.error('SOCKET', 'Error updating tunnel config:', error);
					ack({ success: false, error: error.message });
				}
			},
			{ unauthorizedPayload: { success: false, error: 'Unauthorized' } }
		);
	});
}
