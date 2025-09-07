import { env } from '$env/dynamic/private';

export function load() {
	// Check if TERMINAL_KEY is set and not empty
	const hasTerminalKey = !!(env.TERMINAL_KEY && env.TERMINAL_KEY.trim() !== '');

	return {
		hasTerminalKey,
		terminalKey: hasTerminalKey ? process.env.TERMINAL_KEY : ''
	};
}

export const ssr = false;