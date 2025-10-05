export function registerVSCodeTunnelHandlers(mediator) {
	mediator.registerDomain(({ register, services, logger }) => {
		const vscodeManager = services.vscodeManager;

		if (!vscodeManager) {
			return;
		}

		register(
			'vscode.tunnel.status',
			async ({ ack }) => {
				if (!ack) {
					return;
				}

				try {
					const status = vscodeManager.getStatus();
					ack({ success: true, status });
				} catch (error) {
					logger.error('SOCKET', 'Error handling vscode.tunnel.status:', error);
					ack({ success: false, error: error.message });
				}
			},
			{ unauthorizedPayload: { success: false, error: 'Unauthorized' } }
		);

		register(
			'vscode.tunnel.start',
			async ({ payload, ack }) => {
				if (!ack) {
					return;
				}

				try {
					const state = await vscodeManager.startTunnel({
						name: payload?.name,
						folder: payload?.folder,
						extra: payload?.extra
					});
					logger.info('SOCKET', 'VS Code tunnel start successful:', state);
					ack({ success: true, state });
				} catch (error) {
					logger.error('SOCKET', 'Error starting VS Code tunnel:', error);
					ack({ success: false, error: error.message });
				}
			},
			{ unauthorizedPayload: { success: false, error: 'Unauthorized' } }
		);

		register(
			'vscode.tunnel.stop',
			async ({ ack }) => {
				if (!ack) {
					return;
				}

				try {
					const success = await vscodeManager.stopTunnel();
					logger.info('SOCKET', `VS Code tunnel stop result: ${success}`);
					ack({ success });
				} catch (error) {
					logger.error('SOCKET', 'Error stopping VS Code tunnel:', error);
					ack({ success: false, error: error.message });
				}
			},
			{ unauthorizedPayload: { success: false, error: 'Unauthorized' } }
		);
	});
}
