/**
 * Core Settings Sections
 *
 * Non-session-specific settings that are part of the core application.
 * Session-specific settings (like Claude) are registered via session modules.
 */

import { registerSettingsSection } from './settings-registry.js';

// Core settings components
import ThemeSettings from '../sections/core/Themes.svelte';
import HomeDirectoryManager from '../sections/core/HomeDirectoryManager.svelte';
import WorkspaceEnvSettings from '../sections/core/WorkspaceEnv.svelte';
import DataManagement from '../sections/core/DataManagement.svelte';

// Auth settings components
import ApiKeysSettings from '../sections/auth/ApiKeys.svelte';
import OAuthSettings from '../sections/auth/OAuth.svelte';

// Connectivity settings components
import Tunnels from '../sections/connectivity/Tunnels.svelte';

// Icons
import IconFolder from '$lib/client/shared/components/Icons/IconFolder.svelte';
import IconUser from '$lib/client/shared/components/Icons/IconUser.svelte';
import IconCloud from '$lib/client/shared/components/Icons/IconCloud.svelte';
import IconArchive from '$lib/client/shared/components/Icons/IconArchive.svelte';
import IconKey from '$lib/client/shared/components/Icons/IconKey.svelte';
import IconAdjustmentsAlt from '$lib/client/shared/components/Icons/IconAdjustmentsAlt.svelte';
import IconSettings from '$lib/client/shared/components/Icons/IconSettings.svelte';

/**
 * Register all core settings sections
 * Called during app initialization
 */
export function registerCoreSettings() {
	// Appearance (order 10)
	registerSettingsSection({
		id: 'themes',
		label: 'Theme',
		category: 'core',
		navAriaLabel: 'Color themes and appearance settings',
		icon: IconAdjustmentsAlt,
		component: ThemeSettings,
		order: 10
	});

	// Workspace (order 20-30)
	registerSettingsSection({
		id: 'home',
		label: 'Home Directory',
		category: 'core',
		navAriaLabel: 'File browser and home directory manager',
		icon: IconFolder,
		component: HomeDirectoryManager,
		order: 20
	});

	registerSettingsSection({
		id: 'workspace-env',
		label: 'Environment',
		category: 'core',
		navAriaLabel: 'Environment settings for your workspace',
		icon: IconSettings,
		component: WorkspaceEnvSettings,
		order: 30
	});

	// Authentication (order 40-50)
	registerSettingsSection({
		id: 'keys',
		label: 'Keys',
		category: 'auth',
		navAriaLabel: 'API key management',
		icon: IconKey,
		component: ApiKeysSettings,
		order: 40
	});

	registerSettingsSection({
		id: 'authentication',
		label: 'OAuth',
		category: 'auth',
		navAriaLabel: 'Authentication and security settings',
		icon: IconUser,
		component: OAuthSettings,
		order: 50
	});

	// Connectivity (order 60)
	registerSettingsSection({
		id: 'tunnels',
		label: 'Connectivity',
		category: 'connectivity',
		navAriaLabel: 'Remote tunnel settings for external access',
		icon: IconCloud,
		component: Tunnels,
		order: 60
	});

	// Data Management (order 90)
	registerSettingsSection({
		id: 'data-management',
		label: 'Data & Storage',
		category: 'core',
		navAriaLabel: 'Data retention and storage management',
		icon: IconArchive,
		component: DataManagement,
		order: 90
	});
}

// NOTE: Claude settings are NOT registered here.
// Claude is a session type and registers its own settings section
// via the session module system in src/lib/client/claude/claude.js
