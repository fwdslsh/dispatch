import { terminalSessionModule } from '../../terminal/terminal.js';
import { claudeSessionModule } from '../../claude/claude.js';
import { fileEditorSessionModule } from '../../file-editor/file-editor.js';
import { registerSettingsSection } from '../../settings/registry/settings-registry.js';

const moduleMap = new Map();

export function registerClientSessionModules(...modules) {
	for (const module of modules) {
		if (!module || typeof module !== 'object' || !module.type) continue;

		// Register session module
		moduleMap.set(module.type, module);

		// Auto-register settings section if provided
		if (module.settingsSection) {
			registerSettingsSection({
				category: 'sessions', // Default category for session modules
				order: 70,             // Default order for session modules
				...module.settingsSection
			});
		}
	}
}

export function getClientSessionModule(type) {
	return type ? moduleMap.get(type) || null : null;
}

export function listClientSessionModules() {
	return Array.from(moduleMap.values());
}

registerClientSessionModules(terminalSessionModule, claudeSessionModule, fileEditorSessionModule);
