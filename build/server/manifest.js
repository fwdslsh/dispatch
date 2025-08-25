const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {"start":"_app/immutable/entry/start.d7a45131.js","app":"_app/immutable/entry/app.896155bc.js","imports":["_app/immutable/entry/start.d7a45131.js","_app/immutable/chunks/scheduler.63274e7e.js","_app/immutable/chunks/singletons.c98acb13.js","_app/immutable/entry/app.896155bc.js","_app/immutable/chunks/preload-helper.a4192956.js","_app/immutable/chunks/scheduler.63274e7e.js","_app/immutable/chunks/index.6f2769b2.js"],"stylesheets":[],"fonts":[]},
		nodes: [
			__memo(() => import('./chunks/0-32b97786.js')),
			__memo(() => import('./chunks/1-e0ae9133.js')),
			__memo(() => import('./chunks/2-5c5016fc.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/public-url",
				pattern: /^\/public-url\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server-6f2b4079.js'))
			}
		],
		matchers: async () => {
			
			return {  };
		}
	}
}
})();

const prerendered = new Set([]);

export { manifest, prerendered };
//# sourceMappingURL=manifest.js.map
