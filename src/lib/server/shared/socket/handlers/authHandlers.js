export function registerAuthHandlers(mediator) {
	mediator.registerDomain(({ register, socket, services, helpers, logger }) => {
		const authService = services.auth;
		const { requireValidKey } = helpers;

		register(
			'auth',
			async ({ args, ack }) => {
				const [key] = args;
				if (!requireValidKey) {
					throw new Error('requireValidKey helper not provided');
				}

				const isValid = await requireValidKey(socket, key, ack, authService);
				if (isValid && ack) {
					ack({ success: true });
				}
			},
			{
				requireAuth: false,
				unauthorizedPayload: undefined,
				errorResponse: () => ({ success: false, error: 'Authentication failed' })
			}
		);

		register('client:hello', async ({ payload }) => {
			const { clientId } = payload || {};
			socket.data.clientId = clientId;
			logger.info('SOCKET', `Client identified: ${clientId} (socket: ${socket.id})`);
		});
	});
}
