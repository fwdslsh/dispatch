export function createControllerRoute(ControllerClass, methodName, options = {}) {
	const { controllerOptions = {}, ...handlerOptions } = options;

	return async function controllerRoute(event) {
		const controller = new ControllerClass(event, controllerOptions);
		return await controller.handle(methodName, handlerOptions);
	};
}

export function createOptionsResponse(methods = ['GET']) {
	const allowMethods = Array.isArray(methods) ? methods.join(', ') : String(methods);
	return () =>
		new Response(null, {
			status: 200,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': `${allowMethods}, OPTIONS`,
				'Access-Control-Allow-Headers': 'Content-Type, Authorization'
			}
		});
}
