import { terminalSessionModule } from './terminal.js';
import { claudeSessionModule } from './claude.js';

const moduleMap = new Map();

function registerOne(module) {
	if (!module || typeof module !== 'object' || !module.type) return;
	moduleMap.set(module.type, module);
	if (Array.isArray(module.aliases)) {
		for (const alias of module.aliases) {
			if (typeof alias === 'string' && alias.length > 0) {
				moduleMap.set(alias, module);
			}
		}
	}
}

export function registerClientSessionModules(...modules) {
	for (const module of modules) {
		registerOne(module);
	}
}

export function getClientSessionModule(type) {
	return type ? moduleMap.get(type) || null : null;
}

export function listClientSessionModules() {
	return Array.from(new Set(moduleMap.values()));
}

registerClientSessionModules(terminalSessionModule, claudeSessionModule);
