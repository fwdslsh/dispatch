import KeysSettings from './sections/KeysSettings.svelte';
import IconKey from '$lib/client/shared/components/Icons/IconKey.svelte';

export const KEYS_SECTION = {
	id: 'keys',
	label: 'Keys',
	navAriaLabel: 'API key management',
	icon: IconKey,
	component: KeysSettings
};
