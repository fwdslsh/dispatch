import AuthenticationSettingsSection from './AuthenticationSettingsSection.svelte';
import ThemeSettings from './ThemeSettings.svelte';
import WorkspaceEnvSettings from './sections/WorkspaceEnvSettings.svelte';
import HomeDirectoryManager from './sections/HomeDirectoryManager.svelte';
import Tunnels from './sections/Tunnels.svelte';
import Claude from './sections/Claude.svelte';
import DataManagement from './sections/DataManagement.svelte';
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
		id: 'themes',
		label: 'Theme',
		navAriaLabel: 'Color themes and appearance settings',
		icon: IconAdjustmentsAlt,
		component: ThemeSettings
	},
	{
		id: 'home',
		label: 'Home Directory',
		navAriaLabel: 'File browser and home directory manager',
		icon: IconUser,
		component: HomeDirectoryManager
	},
	{
		id: 'workspace-env',
		label: 'Environment',
		navAriaLabel: 'Environment settings for your workspace',
		icon: IconFolder,
		component: WorkspaceEnvSettings
	},
	{
		id: 'authentication',
		label: 'Authentication',
		navAriaLabel: 'Authentication and security settings',
		icon: IconKey,
		component: AuthenticationSettingsSection
	},
	{
		id: 'tunnels',
		label: 'Connectivity',
		navAriaLabel: 'Remote tunnel settings for external access',
		icon: IconCloud,
		component: Tunnels
	},
	{
		id: 'data-management',
		label: 'Data & Storage',
		navAriaLabel: 'Data retention and storage management',
		icon: IconArchive,
		component: DataManagement
	},
	{
		id: 'claude',
		label: 'Claude',
		navAriaLabel: 'Claude authentication and session settings',
		icon: IconRobot,
		component: Claude
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
