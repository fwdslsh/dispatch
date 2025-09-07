import { env } from '$env/dynamic/private';
import directoryManager from '$lib/shared/utils/directory-manager.server';

export async function load() {
	// Check if TERMINAL_KEY is set and not empty
	const hasTerminalKey = !!(env.TERMINAL_KEY && env.TERMINAL_KEY.trim() !== '');
	const projects = await directoryManager.listProjects();
	return {
		projects,
		hasTerminalKey,
		terminalKey: hasTerminalKey ? process.env.TERMINAL_KEY : ''
	};
}

export const ssr = false;