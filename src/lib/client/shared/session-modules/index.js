import { terminalSessionModule } from '../../terminal/terminal.js';
import { claudeSessionModule } from '../../claude/claude.js';
import { opencodeSessionModule } from '../../opencode/opencode.js';
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
				order: 70, // Default order for session modules
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

/**
 * Get the Svelte component for a given session type
 * Used by sv-window-manager integration to render session components in panes
 * @param {string} type - Session type (e.g., 'pty', 'claude', 'file-editor')
 * @returns {import('svelte').SvelteComponent | null} - Svelte component class or null if not found
 */
export function getComponentForSessionType(type) {
	const module = getClientSessionModule(type);
	return module?.component || null;
}

registerClientSessionModules(
	terminalSessionModule,
	claudeSessionModule,
	opencodeSessionModule,
	fileEditorSessionModule
);
