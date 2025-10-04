import GlobalSettingsSection from './GlobalSettingsSection.svelte';
import AuthenticationSettingsSection from './AuthenticationSettingsSection.svelte';
import PreferencesPanel from './PreferencesPanel.svelte';
import RetentionSettings from './RetentionSettings.svelte';
import ThemeSettings from './ThemeSettings.svelte';
import WorkspaceEnvSettings from './sections/WorkspaceEnvSettings.svelte';
import HomeDirectoryManager from './sections/HomeDirectoryManager.svelte';
import TunnelControl from './sections/TunnelControl.svelte';
import VSCodeTunnelControl from './sections/VSCodeTunnelControl.svelte';
import ClaudeAuth from './sections/ClaudeAuth.svelte';
import ClaudeDefaults from './sections/ClaudeDefaults.svelte';
import StorageSettings from './sections/StorageSettings.svelte';

import IconSettings from '$lib/client/shared/components/Icons/IconSettings.svelte';
import IconFolder from '$lib/client/shared/components/Icons/IconFolder.svelte';
import IconUser from '$lib/client/shared/components/Icons/IconUser.svelte';
import IconCloud from '$lib/client/shared/components/Icons/IconCloud.svelte';
import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
import IconTrash from '$lib/client/shared/components/Icons/IconTrash.svelte';
import IconArchive from '$lib/client/shared/components/Icons/IconArchive.svelte';
import IconKey from '$lib/client/shared/components/Icons/IconKey.svelte';
import IconAdjustmentsAlt from '$lib/client/shared/components/Icons/IconAdjustmentsAlt.svelte';

const SETTINGS_SECTIONS = [
	{
		id: 'global',
		label: 'Global',
		navAriaLabel: 'Global application settings',
		icon: IconSettings,
		component: GlobalSettingsSection
	},
	{
		id: 'authentication',
		label: 'Authentication',
		navAriaLabel: 'Authentication and security settings',
		icon: IconKey,
		component: AuthenticationSettingsSection
	},
	{
		id: 'workspace-env',
		label: 'Environment',
		navAriaLabel: 'Environment settings for your workspace',
		icon: IconFolder,
		component: WorkspaceEnvSettings
	},
	{
		id: 'home',
		label: 'Home Directory',
		navAriaLabel: 'Home Directory manager',
		icon: IconUser,
		component: HomeDirectoryManager
	},
	{
		id: 'tunnel',
		label: 'Tunnel',
		navAriaLabel: 'Tunnel settings for local access',
		icon: IconCloud,
		component: TunnelControl
	},
	{
		id: 'vscode-tunnel',
		label: 'VS Code Tunnel',
		navAriaLabel: 'VS Code Tunnel connection settings',
		icon: IconCloud,
		component: VSCodeTunnelControl
	},
	{
		id: 'claude-auth',
		label: 'Claude Auth',
		navAriaLabel: 'Claude Auth authentication settings',
		icon: IconCloud,
		component: ClaudeAuth
	},
	{
		id: 'claude-defaults',
		label: 'Claude Defaults',
		navAriaLabel: 'Claude Defaults session settings',
		icon: IconRobot,
		component: ClaudeDefaults
	},
	{
		id: 'storage',
		label: 'Storage',
		navAriaLabel: 'Storage management settings',
		icon: IconTrash,
		component: StorageSettings
	},
	{
		id: 'themes',
		label: 'Themes',
		navAriaLabel: 'Theme and appearance settings',
		icon: IconAdjustmentsAlt,
		component: ThemeSettings
	},
	{
		id: 'preferences',
		label: 'User Preferences',
		navAriaLabel: 'User Preferences settings',
		icon: IconUser,
		component: PreferencesPanel
	},
	{
		id: 'retention',
		label: 'Data Retention',
		navAriaLabel: 'Data Retention settings',
		icon: IconArchive,
		component: RetentionSettings
	}
];

const SECTION_LABEL_LOOKUP = new Map(
	SETTINGS_SECTIONS.map((section) => [section.id, section.label])
);

export function getSettingsSections() {
	return SETTINGS_SECTIONS.map((section) => ({ ...section }));
}

export function createSettingsPageState(options = {}) {
	const sections = getSettingsSections();
	const defaultSectionId = sections[0]?.id ?? null;
	const initialSectionId = sections.some((section) => section.id === options.initialSection)
		? options.initialSection
		: defaultSectionId;

	return {
		sections,
		activeSection: initialSectionId,
		savedMessage: null,
		error: null
	};
}

export function setActiveSection(state, sectionId) {
	if (!state || !Array.isArray(state.sections)) return state?.activeSection ?? null;
	const exists = state.sections.some((section) => section.id === sectionId);
	if (!exists) {
		return state.activeSection;
	}
	state.activeSection = sectionId;
	state.savedMessage = null;
	state.error = null;
	return state.activeSection;
}

export function recordSaveMessage(state, message) {
	if (!state) return message;
	state.savedMessage = message;
	state.error = null;
	return message;
}

export function recordError(state, message) {
	if (!state) return message;
	state.error = message;
	state.savedMessage = null;
	return message;
}

export function translateSettingsError(error) {
	if (!error) {
		return 'An unexpected settings error occurred. Please try again.';
	}

	if (typeof error === 'string') {
		return error;
	}

	const sectionLabel = error.sectionId ? SECTION_LABEL_LOOKUP.get(error.sectionId) : null;

	switch (error.type) {
		case 'component-load':
			return `We couldn't load the ${sectionLabel ?? error.sectionId ?? 'requested'} section. Try refreshing the page or checking your connection.`;
		case 'missing-preferences':
			return 'Unable to load user preferences. Try resetting to defaults or restoring from a backup.';
		case 'section-not-found':
			return `The ${error.sectionId} section is not available. Contact support if you need help restoring it.`;
		default:
			return error.message ?? 'An unexpected settings error occurred. Please try again.';
	}
}
