/**
 * Session Modules Index
 *
 * v2.0 Hard Fork: OpenCode-first architecture
 * - Simplified to 3 session types: Terminal, AI, File Editor
 * - AI sessions are powered by OpenCode SDK
 *
 * @file src/lib/client/shared/session-modules/index.js
 */

import { terminalSessionModule } from '../../terminal/terminal.js';
import { aiSessionModule } from '../../ai/ai.js';
import { opencodeSessionModule } from '../../opencode/opencode.js';
import { fileEditorSessionModule } from '../../file-editor/file-editor.js';
import { registerSettingsSection } from '../../settings/registry/settings-registry.js';
import { normalizeSessionType } from '$lib/shared/session-types.js';

const moduleMap = new Map();

export function registerClientSessionModules(...modules) {
	for (const module of modules) {
		if (!module || typeof module !== 'object' || !module.type) continue;

		// Register session module
		moduleMap.set(module.type, module);

		// Auto-register settings section if provided
		if (module.settingsSection) {
			registerSettingsSection({
				category: 'sessions',
				order: 70,
				...module.settingsSection
			});
		}
	}
}

/**
 * Get client session module by type
 * Handles legacy type normalization for backward compatibility
 * @param {string} type - Session type (may be legacy)
 * @returns {Object|null} Session module or null
 */
export function getClientSessionModule(type) {
	if (!type) return null;

	// Try direct lookup first
	const module = moduleMap.get(type);
	if (module) return module;

	// Normalize legacy types and try again
	const normalizedType = normalizeSessionType(type);
	return moduleMap.get(normalizedType) || null;
}

export function listClientSessionModules() {
	return Array.from(moduleMap.values());
}

/**
 * Get the Svelte component for a given session type
 * Used by sv-window-manager integration to render session components in panes
 * @param {string} type - Session type (e.g., 'terminal', 'ai', 'file-editor')
 * @returns {import('svelte').SvelteComponent | null} - Svelte component or null
 */
export function getComponentForSessionType(type) {
	const module = getClientSessionModule(type);
	return module?.component || null;
}

// Register core session modules
registerClientSessionModules(
	terminalSessionModule,
	aiSessionModule,
	opencodeSessionModule,
	fileEditorSessionModule
);
