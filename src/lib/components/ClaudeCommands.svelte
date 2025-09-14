<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
import { SOCKET_EVENTS } from '$lib/shared/utils/socket-events.js';

	let {
		socket = null,
		workspacePath = '',
		sessionId = '',
		claudeSessionId = null,
		onCommandInsert = () => {},
		disabled = false,
		bind = null
	} = $props();

	// State
	let availableCommands = $state([]);
	let commandMenuOpen = $state(false);
	let commandMenuButton = $state();
	let lastParsedMessages = $state([]);

	// Utility: shallow compare command lists by name/title to avoid redundant writes
	function commandsEqual(a, b) {
		if (a === b) return true;
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			const ai = a[i] || {};
			const bi = b[i] || {};
			if (ai.name !== bi.name) return false;
			if (ai.title !== bi.title) return false;
		}
		return true;
	}

	/**
	 * Normalize session ID to handle multiple formats from server
	 * Strips 'claude_' prefix and converts to string for consistent comparison
	 * @param {string|number} id - Session ID from server or client
	 * @returns {string|null} Normalized session ID or null for invalid inputs
	 */
	function normalizeSessionId(id) {
		if (id === null || id === undefined) return null;
		return String(id).replace(/^claude_/, '');
	}

	/**
	 * Check if two session IDs match after normalization
	 * @param {string|number} id1 - First session ID
	 * @param {string|number} id2 - Second session ID
	 * @returns {boolean} True if IDs match after normalization
	 */
	function sessionIdsMatch(id1, id2) {
		const normalized1 = normalizeSessionId(id1);
		const normalized2 = normalizeSessionId(id2);

		// Return false if either normalized result is null (from null/undefined inputs)
		if (normalized1 === null || normalized2 === null) {
			return false;
		}

		return normalized1 === normalized2;
	}

	/**
	 * Determine if a WebSocket event payload is intended for a specific session
	 * @param {Object} payload - WebSocket event payload containing sessionId
	 * @param {string|number} sessionId - Our session ID
	 * @param {string|number} claudeSessionId - Our Claude session ID (optional)
	 * @returns {boolean} True if payload is for our session
	 */
	function isEventForSession(payload, sessionId, claudeSessionId = null) {
		if (!payload || payload.sessionId === null || payload.sessionId === undefined) return false;

		// Check if we have any session IDs (note: 0 is a valid session ID)
		const hasSessionId = sessionId !== null && sessionId !== undefined;
		const hasClaudeId = claudeSessionId !== null && claudeSessionId !== undefined;
		if (!hasSessionId && !hasClaudeId) return false;

		const payloadId = normalizeSessionId(payload.sessionId);
		if (payloadId === null) return false;

		// Check against app session ID if provided
		if (hasSessionId) {
			const ourAppId = normalizeSessionId(sessionId);
			if (ourAppId !== null && sessionIdsMatch(payloadId, ourAppId)) {
				return true;
			}
		}

		// Check against Claude session ID if provided
		if (hasClaudeId) {
			const ourClaudeId = normalizeSessionId(claudeSessionId);
			if (ourClaudeId !== null && sessionIdsMatch(payloadId, ourClaudeId)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Parse slash commands from text content
	 * @param {string} message - Text to parse for commands
	 * @returns {Array} Array of command objects
	 */
	function extractCommandsFromMessage(message) {
		console.log('[ClaudeCommands] Extracting commands from message:', message);
		const commands = [];
		if (!message || typeof message !== 'string') return commands;

		// Common formats: lines starting with `/command`, or markdown codeblocks with commands
		const lines = message.split('\n').map((l) => l.trim());
		for (const l of lines) {
			if (!l) continue;

			// Direct slash command
			if (l.startsWith('/')) {
				const parts = l.split(' ');
				const cmd = parts[0].trim();
				const description = parts.slice(1).join(' ').trim();
				commands.push({
					name: cmd,
					title: cmd,
					description: description || `Execute ${cmd}`
				});
				continue;
			}

			// "Command: /run-tests" style
			const match = l.match(/Command:\s*(\/?[A-Za-z0-9_\-\/]+)/);
			if (match && match[1].startsWith('/')) {
				const cmd = match[1];
				commands.push({
					name: cmd,
					title: cmd,
					description: `Execute ${cmd}`
				});
			}
		}

		// Deduplicate by name
		const seen = new Set();
		return commands.filter((c) => {
			if (seen.has(c.name)) return false;
			seen.add(c.name);
			return true;
		});
	}

	/**
	 * Update available commands from various sources
	 */
	async function updateAvailableCommands(messages = []) {
		let newCommands = [];

		// Extract from messages (prioritizing first assistant message)
		for (const msg of messages) {
			if (msg.role === 'assistant' && msg.text) {
				const commands = extractCommandsFromMessage(msg.text);
				if (commands.length > 0) {
					newCommands.push(...commands);
					break; // Use first message with commands
				}
			}
		}

		// Check cache if no commands found yet
		if (newCommands.length === 0 && workspacePath) {
			try {
				const cached = localStorage.getItem(`claude-commands-${workspacePath}`);
				if (cached) {
					const cachedCommands = JSON.parse(cached) || [];
					newCommands.push(...cachedCommands);
				}
			} catch (error) {
				console.error('Failed to load cached commands:', error);
			}
		}

		// Deduplicate
		const seen = new Set();
		const deduped = newCommands.filter((c) => {
			if (!c.name || seen.has(c.name)) return false;
			seen.add(c.name);
			return true;
		});
		// Only update state if it actually changed
		if (!commandsEqual(availableCommands, deduped)) {
			availableCommands = deduped;
			// Cache the results when we update
			if (workspacePath && availableCommands.length > 0) {
				try {
					localStorage.setItem(
						`claude-commands-${workspacePath}`,
						JSON.stringify(availableCommands)
					);
				} catch (error) {
					console.error('Failed to cache commands:', error);
				}
			}
		}
	}

	/**
	 * Handle commands from WebSocket claude.tools.available event
	 */
	function handleToolsList(payload) {
		try {
    console.log('[ClaudeCommands] Received tools.available event:', payload);
			if (!payload) return;

			// Check if this event is for our session using normalized session IDs
			// Backend emits with both Claude session ID and app session ID
			// We need to accept events that match either our sessionId or claudeSessionId
			console.log('[ClaudeCommands] Event filtering debug:', {
				payloadSessionId: payload.sessionId,
				normalizedPayloadId: normalizeSessionId(payload.sessionId),
				ourSessionId: sessionId,
				ourClaudeSessionId: claudeSessionId,
				normalizedOurSessionId: normalizeSessionId(sessionId),
				normalizedOurClaudeId: normalizeSessionId(claudeSessionId)
			});

			if (!isEventForSession(payload, sessionId, claudeSessionId)) {
				console.log(
					`[ClaudeCommands] Ignoring tools.available for different session: ${payload.sessionId} (normalized: ${normalizeSessionId(payload.sessionId)}) !== our IDs: ${sessionId} or ${claudeSessionId}`
				);
				return;
			} else {
				console.log(`[ClaudeCommands] Accepting tools.available for our session`);
			}

			// Add debug logging before processing commands
			console.log('[ClaudeCommands] Processing commands:', {
				currentAvailableCount: availableCommands.length,
				newCommandsCount: Array.isArray(payload.commands) ? payload.commands.length : 0,
				newCommandsSample: Array.isArray(payload.commands)
					? payload.commands.slice(0, 3).map((c) => c.name || c.title || c)
					: 'not-array'
			});

			const commands = Array.isArray(payload.commands) ? payload.commands : [];
			console.log(`[ClaudeCommands] Received ${commands.length} commands for session ${sessionId}`);

			if (commands.length > 0) {
				const normalized = commands.map((c) => {
					// Normalize shape { name, title, description }
					if (typeof c === 'string') {
						return { name: c, title: c, description: `Execute ${c}` };
					}
					return {
						name: c.name || c.title || '',
						title: c.title || c.name || '',
						description: c.description || `Execute ${c.name || c.title || ''}`
					};
				});
				if (!commandsEqual(availableCommands, normalized)) {
					console.log('[ClaudeCommands] Commands are different, updating availableCommands:', {
						oldCount: availableCommands.length,
						newCount: normalized.length,
						oldSample: availableCommands.slice(0, 3).map((c) => c.name || c.title),
						newSample: normalized.slice(0, 3).map((c) => c.name || c.title)
					});
					availableCommands = normalized;
					console.log(
						`[ClaudeCommands] Updated available commands to ${availableCommands.length} items`
					);
					console.log('[ClaudeCommands] Final availableCommands state:', availableCommands);
					// Cache commands when updated
					if (workspacePath) {
						try {
							localStorage.setItem(
								`claude-commands-${workspacePath}`,
								JSON.stringify(availableCommands)
							);
						} catch (error) {
							console.error('Failed to cache WebSocket commands:', error);
						}
					}
					// Close menu so user can re-open to see new list
					commandMenuOpen = false;
				} else {
					console.log('[ClaudeCommands] Commands are equal, no update needed:', {
						currentCount: availableCommands.length,
						incomingCount: normalized.length
					});
				}
			}
		} catch (error) {
			console.error('Failed to handle tools.available payload:', error);
		}
	}

	/**
	 * Insert command into message input
	 */
	function insertCommand(command) {
		onCommandInsert('/' + command);
		commandMenuOpen = false;
	}

	/**
	 * Toggle command menu
	 */
	function toggleCommandMenu() {
		if (disabled) return;

		commandMenuOpen = !commandMenuOpen;
		if (commandMenuOpen) {
			// If we have no commands, request a refresh from the server
			if (availableCommands.length === 0 && socket && (sessionId || claudeSessionId)) {
				const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
				const querySessionId = sessionId || claudeSessionId;

				console.log(
					`[ClaudeCommands] No commands available, requesting refresh for session: ${querySessionId}`
				);
				socket.emit(
					SOCKET_EVENTS.CLAUDE_COMMANDS_REFRESH,
					{
						key,
						sessionId: querySessionId
					},
					(response) => {
						console.log(`[ClaudeCommands] claude.commands.refresh response:`, response);
						if (response && response.success && Array.isArray(response.commands)) {
							// Handle the refreshed commands
							handleToolsList({
								sessionId: querySessionId,
								commands: response.commands
							});
						}
					}
				);
			}

			// Focus first menu item after render
			tick().then(() => {
				const first = document.querySelector('.claude-commands-dropdown button');
				if (first) first.focus();
			});
		}
	}

	/**
	 * Close menu when clicking outside
	 */
	function handleClickOutside(event) {
		if (commandMenuOpen && commandMenuButton && !commandMenuButton.contains(event.target)) {
			const menu = event.target.closest('.claude-commands-dropdown');
			if (!menu) {
				commandMenuOpen = false;
			}
		}
	}

	// // Update commands when messages change
	// $effect(() => {
	// 	if (lastParsedMessages !== lastParsedMessages) {
	// 		updateAvailableCommands(lastParsedMessages);
	// 	}
	// });

	// // Update commands when workspace changes
	// $effect(() => {
	// 	if (workspacePath) {
	// 		updateAvailableCommands(lastParsedMessages);
	// 	}
	// });

	onMount(() => {
		console.log(
			`[ClaudeCommands] Component mounted - sessionId: ${sessionId}, claudeSessionId: ${claudeSessionId}`
		);
		console.log(`[ClaudeCommands] Socket state:`, {
			exists: !!socket,
			connected: socket?.connected,
			id: socket?.id
		});

		// Set up WebSocket listeners
		if (socket) {
			console.log(`[ClaudeCommands] Setting up tools listeners for sessionId: ${sessionId}`);
			socket.on(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, handleToolsList);

			// Query session status for existing commands
			const querySessionId = sessionId || claudeSessionId;
			if (querySessionId) {
				const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
				console.log(`[ClaudeCommands] Querying session.status for sessionId: ${querySessionId}`);
				socket.emit(SOCKET_EVENTS.SESSION_STATUS, { key, sessionId: querySessionId }, (response) => {
					console.log(`[ClaudeCommands] session.status response:`, response);
					try {
						if (
							response &&
							Array.isArray(response.availableCommands) &&
							response.availableCommands.length > 0
						) {
							const normalized = response.availableCommands.map((c) => {
								if (typeof c === 'string') {
									return { name: c, title: c, description: `Execute ${c}` };
								}
								return {
									name: c.name || c.title || '',
									title: c.title || c.name || '',
									description: c.description || `Execute ${c.name || c.title || ''}`
								};
							});
							if (!commandsEqual(availableCommands, normalized)) {
								availableCommands = normalized;
								if (workspacePath) {
									try {
										localStorage.setItem(
											`claude-commands-${workspacePath}`,
											JSON.stringify(availableCommands)
										);
									} catch (error) {
										console.error('Failed to cache session commands:', error);
									}
								}
							}
						}
					} catch (error) {
						console.error('Failed to parse session.status response:', error);
					}
				});
			}
		}

		// Global click handling
		document.addEventListener('click', handleClickOutside);

		// Initial load
		updateAvailableCommands(lastParsedMessages);
	});

	onDestroy(() => {
		if (socket) {
			socket.off(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, handleToolsList);
			try {
				socket.off('session.id.updated');
			} catch {}
		}
		document.removeEventListener('click', handleClickOutside);
	});

	// Expose methods for parent component
	const api = {
		updateCommands: (messages) => {
			lastParsedMessages = messages;
			updateAvailableCommands(messages);
		},
		getCommands: () => availableCommands,
		clearCache: () => {
			if (workspacePath) {
				try {
					localStorage.removeItem(`claude-commands-${workspacePath}`);
					if (!(Array.isArray(availableCommands) && availableCommands.length === 0)) {
						availableCommands = [];
					}
				} catch (error) {
					console.error('Failed to clear command cache:', error);
				}
			}
		}
	};

	// Export API for parent access
	$effect(() => {
		if (typeof bind === 'function') {
			bind(api);
		}
	});
</script>

<div class="claude-commands" class:disabled>
	<button
		bind:this={commandMenuButton}
		type="button"
		class="command-menu-button"
		class:active={commandMenuOpen}
		aria-label="Open command menu"
		onclick={toggleCommandMenu}
		{disabled}
		title={disabled ? 'Commands unavailable' : 'Show available commands'}
	>
		<span class="command-icon">/</span>
		{#if availableCommands.length > 0}
			<span class="command-count">{availableCommands.length}</span>
		{/if}
	</button>

	{#if commandMenuOpen}
		<div
			class="claude-commands-dropdown"
			transition:fly={{ y: -6, duration: 120 }}
			role="menu"
			aria-label="Available commands"
		>
			<div class="dropdown-header">
				<span class="dropdown-title">Slash Commands</span>
				<span class="dropdown-subtitle">{availableCommands.length} available</span>
				{#if socket && (sessionId || claudeSessionId)}
					<button
						type="button"
						class="refresh-button"
						onclick={() => {
							const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
							const querySessionId = sessionId || claudeSessionId;
							console.log(
								`[ClaudeCommands] Manual refresh requested for session: ${querySessionId}`
							);
						socket.emit(
							SOCKET_EVENTS.CLAUDE_COMMANDS_REFRESH,
							{
								key,
								sessionId: querySessionId
							},
								(response) => {
									console.log(`[ClaudeCommands] claude.commands.refresh response:`, response);
									if (response && response.success && Array.isArray(response.commands)) {
										handleToolsList({
											sessionId: querySessionId,
											commands: response.commands
										});
									}
								}
							);
						}}
						title="Refresh commands"
						aria-label="Refresh commands"
					>
						↻
					</button>
				{/if}
			</div>

			{#if availableCommands.length > 0}
				<div class="commands-list">
					{#each availableCommands as cmd}
						<button
							type="button"
							class="command-item"
							onclick={() => insertCommand(cmd.name || cmd.title || '')}
							role="menuitem"
							title={cmd.description}
						>
							<span class="command-name">{cmd.title || cmd.name}</span>
							{#if cmd.description && cmd.description !== cmd.name && cmd.description !== cmd.title}
								<span class="command-description">{cmd.description}</span>
							{/if}
						</button>
					{/each}
				</div>
			{:else}
				<div class="commands-empty">
					<span class="empty-icon">📝</span>
					<span class="empty-text">No commands available</span>
					<span class="empty-hint">Commands will appear from Claude's responses</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.claude-commands {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.claude-commands.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.command-menu-button {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 10%, transparent),
			color-mix(in oklab, var(--primary) 5%, transparent)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 8px;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 40px;
		height: 36px;
		justify-content: center;
	}

	.command-menu-button:hover {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 15%, transparent),
			color-mix(in oklab, var(--primary) 8%, transparent)
		);
		border-color: color-mix(in oklab, var(--primary) 30%, transparent);
		color: var(--primary);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px -4px var(--primary-glow);
	}

	.command-menu-button.active {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 20%, transparent),
			color-mix(in oklab, var(--primary) 12%, transparent)
		);
		border-color: var(--primary);
		color: var(--primary);
		box-shadow:
			0 0 0 2px color-mix(in oklab, var(--primary) 25%, transparent),
			0 4px 16px -6px var(--primary-glow);
	}

	.command-menu-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.command-icon {
		font-size: 1.2em;
		line-height: 1;
	}

	.command-count {
		font-size: 0.75em;
		padding: 2px 4px;
		background: var(--primary);
		color: var(--surface);
		border-radius: 4px;
		min-width: 16px;
		text-align: center;
	}

	.claude-commands-dropdown {
		position: absolute;
		bottom: calc(100% + var(--space-2));
		left: 0;
		min-width: 280px;
		max-width: 420px;
		max-height: 400px;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 12px;
		box-shadow:
			0 12px 40px -8px rgba(0, 0, 0, 0.15),
			0 4px 20px -4px var(--primary-glow),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(16px) saturate(120%);
		overflow: hidden;
		z-index: 50;
	}

	.dropdown-header {
		padding: var(--space-4) var(--space-4) var(--space-3);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 15%, transparent);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 8%, transparent),
			color-mix(in oklab, var(--primary) 4%, transparent)
		);
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.dropdown-title {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 700;
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.dropdown-subtitle {
		display: block;
		font-family: var(--font-sans);
		font-size: var(--font-size-0);
		color: var(--muted);
		margin-top: var(--space-1);
	}

	.refresh-button {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		width: 24px;
		height: 24px;
		border-radius: 6px;
		background: transparent;
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		color: var(--primary);
		font-size: 14px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.refresh-button:hover {
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		transform: rotate(90deg);
	}

	.refresh-button:active {
		transform: rotate(180deg);
	}

	.commands-list {
		max-height: 300px;
		overflow-y: auto;
		padding: var(--space-2);
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--primary) 30%, transparent) transparent;
	}

	.commands-list::-webkit-scrollbar {
		width: 6px;
	}

	.commands-list::-webkit-scrollbar-thumb {
		background: color-mix(in oklab, var(--primary) 40%, transparent);
		border-radius: 3px;
	}

	.command-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-1);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		color: inherit;
	}

	.command-item:hover {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 12%, transparent),
			color-mix(in oklab, var(--primary) 6%, transparent)
		);
		border-color: color-mix(in oklab, var(--primary) 25%, transparent);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px -6px var(--primary-glow);
	}

	.command-item:active {
		transform: translateY(0);
	}

	.command-name {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: var(--font-size-1);
		color: var(--primary);
		margin-bottom: var(--space-1);
	}

	.command-description {
		font-family: var(--font-sans);
		font-size: var(--font-size-0);
		color: var(--muted);
		line-height: 1.4;
		overflow-wrap: break-word;
	}

	.commands-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-6) var(--space-4);
		text-align: center;
		gap: var(--space-2);
	}

	.empty-icon {
		font-size: 2rem;
		opacity: 0.3;
	}

	.empty-text {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--muted);
		font-size: var(--font-size-1);
	}

	.empty-hint {
		font-family: var(--font-sans);
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
		font-style: italic;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.claude-commands-dropdown {
			min-width: 240px;
			max-width: calc(100vw - var(--space-6));
			left: 0;
		}

		.command-item {
			padding: var(--space-2) var(--space-3);
		}

		.commands-empty {
			padding: var(--space-4) var(--space-3);
		}
	}
</style>
