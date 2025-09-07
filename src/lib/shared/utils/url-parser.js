/**
 * Strips ANSI escape sequences from terminal text
 * @param {string} text - Raw terminal text with ANSI sequences
 * @returns {string} Clean text without ANSI sequences
 */
function stripAnsiSequences(text) {
	// Remove ANSI escape sequences (ESC[...m, ESC[?...h, etc.)
	return text.replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '');
}

/**
 * Extracts URLs from terminal text that may contain ANSI escape sequences
 * @param {string} terminalText - Raw terminal output with ANSI sequences
 * @returns {string[]} Array of extracted URLs
 */
export function parseUrlsFromTerminalText(terminalText) {
	if (!terminalText || typeof terminalText !== 'string') {
		return [];
	}

	// Strip ANSI escape sequences first
	const cleanText = stripAnsiSequences(terminalText);

	// URL regex pattern - matches http/https URLs
	const urlPattern = /https?:\/\/[^\s\r\n\t<>"'()[\]{}]+/gi;

	// Find all matches
	const matches = cleanText.match(urlPattern) || [];

	// Clean up any trailing punctuation that might be included
	return matches.map((url) => {
		// Remove trailing punctuation that's not part of the URL
		return url.replace(/[.,;:!?'")\]}]+$/, '');
	});
}

/**
 * Extracts the first URL from terminal text
 * @param {string} terminalText - Raw terminal output with ANSI sequences
 * @returns {string|null} First URL found or null if none
 */
export function parseFirstUrlFromTerminalText(terminalText) {
	const urls = parseUrlsFromTerminalText(terminalText);
	return urls.length > 0 ? urls[0] : null;
}
