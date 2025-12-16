/**
 * OpenCode Session Prompt API Proxy
 *
 * Handles sending prompts to a session with optional file mentions
 */

import {
	handleApiError,
	ServiceUnavailableError,
	BadRequestError
} from '$lib/server/shared/utils/api-errors.js';
import { readFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

/**
 * Get OpenCode server URL from manager
 * @param {Object} locals
 * @returns {string}
 */
function getOpenCodeUrl(locals) {
	const status = locals.services.opencodeServerManager.getStatus();
	if (!status.url) {
		throw new ServiceUnavailableError('OpenCode server is not running', 'OPENCODE_UNAVAILABLE');
	}
	return status.url;
}

/**
 * Extract @filename mentions from text and expand them
 * Only files within the cwd are allowed (security)
 *
 * @param {string} text - Message text
 * @param {string} cwd - Working directory (containment boundary)
 * @returns {Promise<{text: string, files: Array}>} Expanded text and file references
 */
async function expandFileMentions(text, cwd) {
	const mentionPattern = /@([^\s@]+\.[a-zA-Z0-9]+)/g;
	const files = [];
	let expandedText = text;
	const matches = [...text.matchAll(mentionPattern)];

	for (const match of matches) {
		const mentionedPath = match[1];
		const absolutePath = resolve(cwd, mentionedPath);

		// Security: Ensure path is within cwd
		const relativePath = relative(cwd, absolutePath);
		if (relativePath.startsWith('..') || relativePath.startsWith('/')) {
			// Path escapes cwd - skip this mention
			continue;
		}

		try {
			const content = await readFile(absolutePath, 'utf-8');

			// Size limit: 100KB per file
			if (content.length > 100 * 1024) {
				files.push({
					path: relativePath,
					error: 'File too large (max 100KB)',
					truncated: true,
					content: content.slice(0, 100 * 1024) + '\n... [truncated]'
				});
			} else {
				files.push({
					path: relativePath,
					content
				});
			}
		} catch (err) {
			// File doesn't exist or can't be read - skip
			files.push({
				path: relativePath,
				error: err.message
			});
		}
	}

	return { text: expandedText, files };
}

/**
 * POST /api/opencode/sessions/[id]/prompt - Send a prompt to the session
 *
 * Supports @filename mentions which are expanded before sending
 */
export async function POST({ params, request, url, locals }) {
	try {
		const baseUrl = getOpenCodeUrl(locals);
		const { id } = params;
		const body = await request.json();
		const directory = url.searchParams.get('directory') || undefined;

		const { content, cwd, skipInference = false } = body;

		if (!content) {
			throw new BadRequestError('Content is required', 'MISSING_CONTENT');
		}

		// Expand file mentions if cwd is provided
		let parts = [{ type: 'text', text: content }];

		if (cwd) {
			const { text, files } = await expandFileMentions(content, cwd);

			// Add file contents as additional context
			if (files.length > 0) {
				const fileContext = files
					.filter((f) => f.content && !f.error)
					.map((f) => `\n\n--- File: ${f.path} ---\n${f.content}`)
					.join('');

				if (fileContext) {
					parts = [{ type: 'text', text: text + fileContext }];
				}
			}
		}

		const queryParams = new URLSearchParams();
		if (directory) queryParams.set('directory', directory);

		const response = await fetch(`${baseUrl}/session/${id}/prompt?${queryParams}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				skipInference,
				parts
			}),
			signal: AbortSignal.timeout(120000) // 2 minute timeout for long responses
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenCode API error: ${response.status} - ${error}`);
		}

		const result = await response.json();

		return new Response(JSON.stringify({ success: true, result }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		handleApiError(err, 'POST /api/opencode/sessions/[id]/prompt');
	}
}
