import { terminalSessionModule } from '../../terminal/terminal.js';
import { claudeSessionModule } from '../../claude/claude.js';
import { fileEditorSessionModule } from '../../file-editor/file-editor.js';

const moduleMap = new Map();

export function registerClientSessionModules(...modules) {
	for (const module of modules) {
		if (!module || typeof module !== 'object' || !module.type) continue;
		moduleMap.set(module.type, module);
	}
}

export function getClientSessionModule(type) {
	return type ? moduleMap.get(type) || null : null;
}

export function listClientSessionModules() {
	return Array.from(moduleMap.values());
}

registerClientSessionModules(terminalSessionModule, claudeSessionModule, fileEditorSessionModule);
