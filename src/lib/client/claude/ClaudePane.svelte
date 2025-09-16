<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Markdown from '$lib/client/shared/components/Markdown.svelte';
	import ActivitySummary from './activity-summaries/ActivitySummary.svelte';
	import ClaudeCommands from './ClaudeCommands.svelte';
	import {
		IconFolder,
		IconMessage,
		IconAlertTriangle,
		IconSparkles,
		IconLoader,
		IconUser,
		IconUserCode,
		IconProgressDown
	} from '@tabler/icons-svelte';
	import LiveIconStrip from '$lib/client/shared/components/LiveIconStrip.svelte';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import { getIconForEvent } from '$lib/client/shared/icons/claudeEventIcons.js';
	import sessionSocketManager from '$lib/client/shared/components/SessionSocketManager';
	import IconClaude from '../shared/components/Icons/IconClaude.svelte';
	// Using global styles for inputs

	let {
		sessionId,
		claudeSessionId = null,
		shouldResume = false,
		workspacePath: initialWorkspacePath = ''
	} = $props();

	// Debug logging
	$effect(() => {
		console.log('[ClaudePane] Props received:', {
			sessionId,
			claudeSessionId,
			shouldResume,
			workspacePath: initialWorkspacePath
		});
	});

	/**
	 * @type {import("socket.io-client").Socket}
	 */
	let socket = $state();
	let messages = $state([]);
	let input = $state('');
	let loading = $state(false);
	let isWaitingForReply = $state(false);
	let isCatchingUp = $state(false);
	let messagesContainer = $state();
	let liveEventIcons = $state([]);
	let workspacePath = $state(initialWorkspacePath);
	let claudeCommandsApi = $state();
	let authStartRequested = $state(false);
	let authAwaitingCode = $state(false);
	let authInProgress = $state(false);
	let pendingAuthUrl = $state('');

	// Detect if user is on a mobile device
	let isMobile = $state(false);

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	const status = $derived.by(() => {
		if (authInProgress) return 'auth-in-progress';
		if (authAwaitingCode) return 'awaiting-auth-code';
		if (loading) return 'loading';
		if (isCatchingUp) return 'catching-up';
		if (isWaitingForReply) return 'thinking';
		return 'idle';
	});

	// Auto-scroll when messages change
	$effect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	});

	// Handle command insertion from ClaudeCommands component
	function handleCommandInsert(command) {
		input = command + ' ';
		// Focus the input after inserting
		const inputEl = /** @type {HTMLInputElement | null} */ (
			document.querySelector('.message-input')
		);
		if (inputEl) {
			inputEl.focus();
			// Move cursor to end
			inputEl.setSelectionRange(input.length, input.length);
		}
	}

	async function send(e) {
		e.preventDefault();
		// For Socket.IO communications, always use the unified sessionId
		// claudeSessionId is for display/resume purposes only
		console.log('ClaudePane send called with:', {
			sessionId,
			claudeSessionId,
			socketSessionId: sessionId, // This is what we send to Socket.IO
			input: input.trim(),
			socketConnected: socket?.connected
		});
		if (!input.trim()) return;
		if (!socket) {
			console.error('Socket not available');
			return;
		}
		if (!sessionId) {
			console.error('SessionId not available');
			return;
		}

		const userMessage = input.trim();
		authStartRequested = false; // reset per user turn

		// If we're awaiting an OAuth authorization code, route this input to the auth handler via WebSocket
		if (authAwaitingCode && userMessage) {
			try {
				const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
				// do not push a normal user message — treat this as out-of-band code
				authInProgress = true;
				const code = userMessage;
				input = '';
				// Emit auth code to server
				socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_CODE, { key, code });
				// Show a lightweight status message
				messages = [
					...messages,
					{
						role: 'assistant',
						text: 'Submitting authorization code…',
						timestamp: new Date(),
						id: Date.now()
					}
				];
				await scrollToBottom();
			} catch (err) {
				console.error('Failed to send auth code:', err);
			}
			return;
		}
		const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';

		// Add user message immediately
		messages = [
			...messages,
			{
				role: 'user',
				text: userMessage,
				timestamp: new Date(),
				id: Date.now()
			}
		];

		// Clear input and show waiting state
		input = '';
		isWaitingForReply = true;
		liveEventIcons = [];
		// no selection state in parent; handled by LiveIconStrip

		// Force immediate scroll to user message
		await scrollToBottom();

		console.log('Emitting claude.send with:', { key, id: sessionId, input: userMessage });
		socket.emit(SOCKET_EVENTS.CLAUDE_SEND, { key, id: sessionId, input: userMessage });
	}

	// Icon mapping is handled by getIconForEvent

	function pushLiveIcon(e) {
		// Enhanced event detection for live events
		let iconData = null;

		// Check for tool use in assistant messages
		if (e?.type === 'assistant' && e?.message?.content && Array.isArray(e.message.content)) {
			const toolUse = e.message.content.find((c) => c && c.type === 'tool_use');
			if (toolUse) {
				// Extract tool information and create appropriate icon
				const toolName = (toolUse.name || '').toString().toLowerCase();
				const toolInput = toolUse.input || {};

				// Create event object with tool details
				const toolEvent = {
					type: 'tool',
					tool: toolUse.name,
					name: toolUse.name,
					input: toolInput,
					id: toolUse.id
				};

				iconData = getIconForEvent(toolEvent);
				// Store the tool event for activity summary
				iconData.event = toolEvent;
			}
		}

		// If no icon data extracted yet, use default extraction
		if (!iconData) {
			iconData = getIconForEvent(e);
			iconData.event = e;
		}

		const { Icon, label, event } = iconData;

		// More aggressive duplicate prevention
		// Check if we already have this exact icon type in the last few icons
		const recentIcons = liveEventIcons.slice(-3);
		const isDuplicate = recentIcons.some((icon) => icon.label === label);

		// Also limit total icons to prevent overflow
		if (!isDuplicate && liveEventIcons.length < 20) {
			const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			// Store the full event data for display
			liveEventIcons = [
				...liveEventIcons,
				{
					id,
					Icon,
					label,
					event: event || e,
					timestamp: new Date()
				}
			];
			console.log('Added live icon:', { label, totalIcons: liveEventIcons.length });
		} else if (liveEventIcons.length >= 20) {
			console.log('Icon limit reached, not adding more icons');
		}
	}

	// Selection handled inside LiveIconStrip instances

	// ActivitySummary component handles event formatting with rich details

	async function loadPreviousMessages() {
		// Use claudeSessionId if available, otherwise use sessionId
		const sessionIdToLoad = claudeSessionId || sessionId;
		if (!sessionIdToLoad) return;

		loading = true;
		try {
			// Use the simplified session lookup endpoint that finds the session by ID alone
			console.log('Loading Claude history for session:', sessionIdToLoad);
			const response = await fetch(
				`/api/claude/session/${encodeURIComponent(sessionIdToLoad)}?full=1`
			);

			if (response.ok) {
				const data = await response.json();
				console.log('Session history loaded:', {
					sessionId: sessionIdToLoad,
					project: data.project,
					entryCount: (data.entries || []).length,
					summary: data.summary
				});

				// Extract workspace path from session data if available
				if (data.entries && data.entries.length > 0) {
					for (const entry of data.entries) {
						if (entry.cwd) {
							workspacePath = entry.cwd;
							break;
						}
					}
				}

				const previousMessages = [];

				// Helpers to build icon objects from entries
				function iconFromEntry(entry) {
					if (!entry) return null;
					try {
						if (entry.type === 'summary') {
							return { ...getIconForEvent({ type: 'summary' }), event: entry };
						}
						// assistant tool_use events
						if (
							entry.type === 'assistant' &&
							entry.message?.content &&
							Array.isArray(entry.message.content)
						) {
							const toolItems = entry.message.content.filter((c) => c && c.type === 'tool_use');
							if (toolItems.length > 0) {
								const toolUse = toolItems[0];
								const name = (toolUse.name || '').toString();
								const mapped = getIconForEvent({ type: 'tool', tool: name });
								// Provide a simplified event with tool metadata so ActivitySummary can render specifics
								const event = {
									type: 'tool',
									tool: toolUse.name,
									name: toolUse.name,
									input: toolUse.input,
									id: toolUse.id
								};
								return { ...mapped, event };
							}
						}
						// user tool_result events
						if (entry.type === 'user' && entry.message?.content) {
							const content = entry.message.content;
							const toolResultObj = Array.isArray(content)
								? content.find((c) => c && c.type === 'tool_result')
								: content && typeof content === 'object' && content.type === 'tool_result'
									? content
									: null;
							if (toolResultObj) {
								const mapped = getIconForEvent({ type: 'tool_result', name: 'tool_result' });
								// Use the specific tool_result object as event data, and ensure name/tool present
								const event = {
									...toolResultObj,
									name: toolResultObj.name || 'tool_result',
									tool: toolResultObj.name || 'tool_result'
								};
								return { ...mapped, event };
							}
						}
					} catch {}
					return null;
				}

				// Group entries into user turns with assistant results + icon trails
				let pendingIcons = [];
				for (let i = 0; i < (data.entries || []).length; i++) {
					const entry = data.entries[i];
					const ts = entry.timestamp
						? new Date(entry.timestamp)
						: new Date(Date.now() - (data.entries.length - i) * 60000);

					// User typed text
					if (
						entry.type === 'user' &&
						entry.message?.content &&
						Array.isArray(entry.message.content)
					) {
						const textContent = entry.message.content
							.filter((c) => c && c.type === 'text')
							.map((c) => c.text)
							.join('');
						if (textContent) {
							previousMessages.push({
								role: 'user',
								text: textContent,
								timestamp: ts,
								id: `prev_${i}_user`
							});
							pendingIcons = [];
							continue;
						}
					}

					// Accumulate non-text events as icons
					const ic = iconFromEntry(entry);
					if (ic) {
						const id = `${i}-${Math.random().toString(36).slice(2, 6)}`;
						pendingIcons = [
							...pendingIcons,
							{
								id,
								Icon: ic.Icon,
								label: ic.label,
								event: ic.event || entry,
								timestamp: ts
							}
						]; // Removed slice to keep all icons
						continue;
					}

					// Assistant final text result
					if (
						entry.type === 'assistant' &&
						entry.message?.content &&
						Array.isArray(entry.message.content)
					) {
						const textContent = entry.message.content
							.filter((c) => c && c.type === 'text')
							.map((c) => c.text)
							.join('');
						if (textContent) {
							previousMessages.push({
								role: 'assistant',
								text: textContent,
								timestamp: ts,
								id: `prev_${i}_assistant`,
								activityIcons: pendingIcons // Changed from iconTrail to activityIcons
							});
							pendingIcons = [];
						}
					}
				}

				messages = previousMessages;
				if (previousMessages.length > 0) {
					console.log('Loaded previous messages:', previousMessages.length);
					// Update commands via ClaudeCommands component
					if (claudeCommandsApi && claudeCommandsApi.updateCommands) {
						claudeCommandsApi.updateCommands(previousMessages);
					}
					// Scroll to bottom after history is loaded
					await scrollToBottom();
				} else {
					console.log('No previous messages found - this appears to be a new session');
				}
			} else {
				const errorText = await response.text();
				console.warn('Failed to load Claude session history:', {
					status: response.status,
					sessionId: sessionIdToLoad,
					error: errorText
				});
				// Don't fail silently - this could be a new session which is OK
				if (response.status !== 404) {
					console.error('Unexpected error loading session history');
				}
			}
		} catch (error) {
			console.error('Failed to load previous messages:', error);
			// Don't let this prevent the session from working
		} finally {
			loading = false;
		}
	}

	// Mobile detection with resize handling
	function checkMobile() {
		return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
	}

	// Effect for handling resize events
	$effect(() => {
		function handleResize() {
			isMobile = checkMobile();
		}

		if (typeof window !== 'undefined') {
			isMobile = checkMobile();
			window.addEventListener('resize', handleResize);

			return () => {
				window.removeEventListener('resize', handleResize);
			};
		}
	});

	onMount(async () => {
		console.log('ClaudePane mounting with:', { sessionId, claudeSessionId, shouldResume });

		// Get or create socket for this specific session FIRST
		// This ensures we don't miss any events while loading history
		// Use unified sessionId for socket management to align with message routing
		socket = sessionSocketManager.getSocket(sessionId);

		// Set up event listeners immediately before doing anything else
		// This ensures we capture any ongoing messages from active sessions
		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			console.log('Claude Socket.IO connected for session:', sessionId);
			// Don't automatically set isWaitingForReply for resumed sessions
			// Let the backend state determine if the session is actually processing
			if (shouldResume || claudeSessionId) {
				console.log('Reconnected to session - checking for ongoing activity');
				// Only set catching up flag temporarily
				isCatchingUp = true;
				// Don't set isWaitingForReply here - let actual messages trigger it
				// Clear the catching up flag after a short delay if no messages arrive
				setTimeout(() => {
					if (isCatchingUp && liveEventIcons.length === 0) {
						isCatchingUp = false;
						// Also ensure isWaitingForReply is false if no activity
						isWaitingForReply = false;
						console.log('No pending messages detected for session');
					}
				}, 2000);
			}
		});

		// Shared handler for Claude message delta (canonical + legacy)
		const handleClaudeMessageDelta = async (payload) => {
			// If we receive a message while catching up, clear the flag
			if (isCatchingUp) {
				isCatchingUp = false;
				console.log('Received message from active session - caught up');
			}

			// Set waiting for reply when we receive messages
			if (!isWaitingForReply && payload && payload.length > 0) {
				isWaitingForReply = true;
			}

			// payload is an array; in our setup typically of length 1
			for (const evt of payload || []) {
				// Skip empty or malformed events
				if (!evt || typeof evt !== 'object') continue;

				// Check if this is a text content event from assistant
				if (evt?.type === 'assistant' && evt?.message?.content) {
					// Extract text content if available
					const textContent = Array.isArray(evt.message.content)
						? evt.message.content
								.filter((c) => c && c.type === 'text')
								.map((c) => c.text)
								.join('')
						: evt.message.content.type === 'text'
							? evt.message.content.text
							: '';

					if (textContent) {
						// Create a new assistant message with accumulated activities
						messages = [
							...messages,
							{
								role: 'assistant',
								text: textContent,
								timestamp: new Date(),
								id: Date.now(),
								activityIcons: [...liveEventIcons] // Attach accumulated activities
							}
						];
						liveEventIcons = []; // Clear for next accumulation
						isWaitingForReply = true; // Keep waiting for more potential messages

						// Update commands via ClaudeCommands component
						if (claudeCommandsApi && claudeCommandsApi.updateCommands) {
							claudeCommandsApi.updateCommands(messages);
						}
					} else {
						// Non-text assistant content (tool use, etc.)
						// Only push if we have meaningful tool content
						if (
							evt.message.content.some &&
							evt.message.content.some((c) => c && c.type === 'tool_use')
						) {
							pushLiveIcon(evt);
						}
					}
				} else if (evt?.type === 'result') {
					// Final aggregated result. If is_error is set, display as an error message
					const isError = !!evt.is_error;

					// If this is an error result, remove assistant messages from the current turn
					if (isError && messages.length > 0) {
						let lastUserIdx = -1;
						for (let i = messages.length - 1; i >= 0; i--) {
							if (messages[i]?.role === 'user') {
								lastUserIdx = i;
								break;
							}
						}
						if (lastUserIdx >= 0) {
							messages = messages.filter(
								(m, idx) => !(idx > lastUserIdx && m?.role === 'assistant')
							);
						} else {
							// No user found; trim trailing assistant messages
							let cut = messages.length - 1;
							for (; cut >= 0 && messages[cut]?.role === 'assistant'; cut--) {}
							messages = messages.slice(0, cut + 1);
						}
					}

					// Decide whether to append a new message or update the last one
					const shouldAppend =
						isError ||
						liveEventIcons.length > 0 ||
						!messages.length ||
						messages[messages.length - 1].role !== 'assistant';

					if (shouldAppend) {
						messages = [
							...messages,
							{
								role: 'assistant',
								text: evt.result || '',
								timestamp: new Date(),
								id: Date.now(),
								// For error results, omit prior activity icons
								...(isError
									? { isError: true, errorIcon: IconAlertTriangle }
									: { activityIcons: [...liveEventIcons] })
							}
						];
					} else {
						// Update the last assistant message with the final result if needed
						const lastMessage = messages[messages.length - 1];
						if (lastMessage.role === 'assistant' && !lastMessage.text && evt.result) {
							messages[messages.length - 1] = {
								...lastMessage,
								text: evt.result,
								...(isError ? { isError: true, errorIcon: IconAlertTriangle } : {})
							};
						} else if (isError) {
							// If we already had assistant text and this is an error result,
							// append a distinct error message so it’s not dropped
							messages = [
								...messages,
								{
									role: 'assistant',
									text: evt.result || '',
									timestamp: new Date(),
									id: Date.now(),
									// Do not include activity icons for error results
									isError: true,
									errorIcon: IconAlertTriangle
								}
							];
						}
					}

					// If error indicates login is required, proactively trigger OAuth start via WebSockets
					try {
						const resultText = String(evt.result || '');
						const mentionsLogin =
							/please\s+run\s+\/login/i.test(resultText) || resultText.includes('/login');
						if (isError && mentionsLogin && socket && !authStartRequested) {
							authStartRequested = true;
							const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
							socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_START, { key });
						}
					} catch (e) {
						console.error('Failed to proactively start auth flow:', e);
					}

					// Clear waiting state since result indicates completion
					isWaitingForReply = false;
					isCatchingUp = false;
					liveEventIcons = []; // Clear for next conversation turn
				} else {
					// Other event types - be selective about what creates icons
					// Only create icons for meaningful events
					const eventType = (evt?.type || '').toLowerCase();
					const eventName = (evt?.name || evt?.tool || '').toLowerCase();

					// Skip certain event types that shouldn't create icons
					if (eventType === 'status' || eventType === 'progress' || eventType === 'ping') {
						continue;
					}

					// Only push icon for tool-related events or specific types
					if (
						eventType === 'tool' ||
						eventType === 'tool_use' ||
						eventType === 'tool_result' ||
						eventName.includes('read') ||
						eventName.includes('write') ||
						eventName.includes('bash') ||
						eventName.includes('grep') ||
						eventName.includes('edit') ||
						eventName.includes('glob')
					) {
						pushLiveIcon(evt);
					}
				}
			}
			// Scroll to show the latest state (icons or final message)
			await scrollToBottom();
		};

		// Attach both canonical and legacy event names to the same handler
		socket.on(SOCKET_EVENTS.CLAUDE_MESSAGE_DELTA, handleClaudeMessageDelta);

		// OAuth URL received from server — show link and prompt for code
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_URL, (payload) => {
			try {
				const url = String(payload?.url || '');
				pendingAuthUrl = url;
				authAwaitingCode = true;
				authInProgress = false;
				messages = [
					...messages,
					{
						role: 'assistant',
						text: `Login required.\n\nOpen this link to authenticate:\n\n${url}\n\n${payload?.instructions || 'Then paste the authorization code here.'}`,
						timestamp: new Date(),
						id: Date.now()
					}
				];
				// Also hint in the input placeholder
				const inputEl = /** @type {HTMLInputElement | null} */ (
					document.querySelector('.message-input')
				);
				if (inputEl) inputEl.placeholder = 'Paste authorization code and press Enter';
				scrollToBottom();
			} catch (e) {
				console.error('Failed to handle CLAUDE_AUTH_URL:', e);
			}
		});

		// OAuth completed
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE, () => {
			try {
				authAwaitingCode = false;
				authInProgress = false;
				messages = [
					...messages,
					{
						role: 'assistant',
						text: 'Authentication complete. You can retry your request.',
						timestamp: new Date(),
						id: Date.now()
					}
				];
				scrollToBottom();
			} catch {}
		});

		// OAuth error
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, (payload) => {
			try {
				authAwaitingCode = false;
				authInProgress = false;
				messages = [
					...messages,
					{
						role: 'assistant',
						text: `Authentication failed. ${payload?.error || ''}`,
						timestamp: new Date(),
						id: Date.now(),
						isError: true,
						errorIcon: IconAlertTriangle
					}
				];
				scrollToBottom();
			} catch {}
		});

		// Handle message completion to clear waiting state

		// Keep client session IDs in sync with server updates
		socket.on(SOCKET_EVENTS.SESSION_ID_UPDATED, (payload) => {
			try {
				if (!payload || payload.type !== 'claude') return;
				if (payload.sessionId !== sessionId) return; // Only handle our own pane
				if (payload.newTypeSpecificId) {
					console.log('Updating claudeSessionId from server event:', payload);
					claudeSessionId = payload.newTypeSpecificId;
					shouldResume = true;
				}
			} catch (e) {
				console.error('Failed to handle session.id.updated:', e);
			}
		});

		const handleClaudeMessageComplete = (data) => {
			console.log('Message complete received:', data);
			isWaitingForReply = false;
			isCatchingUp = false;
			// Clear any remaining live icons if they weren't attached to a message
			if (liveEventIcons.length > 0 && messages.length > 0) {
				const lastMessage = messages[messages.length - 1];
				if (lastMessage.role === 'assistant' && !lastMessage.activityIcons?.length) {
					// Attach any remaining icons to the last assistant message
					messages[messages.length - 1] = {
						...lastMessage,
						activityIcons: [...liveEventIcons]
					};
				}
			}
			liveEventIcons = [];
		};

		// Attach both canonical and legacy complete events
		socket.on(SOCKET_EVENTS.CLAUDE_MESSAGE_COMPLETE, handleClaudeMessageComplete);

		// Handle session catchup complete event
		socket.on(SOCKET_EVENTS.SESSION_CATCHUP_COMPLETE, (data) => {
			console.log('Session catchup complete:', data);
			isCatchingUp = false;
			// Update last message timestamp if provided
			if (data?.lastTimestamp) {
				sessionSocketManager.updateLastMessageTimestamp(sessionId, data.lastTimestamp);
			}
		});

		// Handle errors to clear typing indicator
		socket.on(SOCKET_EVENTS.ERROR, (error) => {
			console.error('Socket error:', error);
			isWaitingForReply = false;
			isCatchingUp = false;

			// Add error message if we were waiting for a reply
			if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
				messages = [
					...messages,
					{
						role: 'assistant',
						text: 'Sorry, I encountered an error processing your request. Please try again.',
						timestamp: new Date(),
						id: Date.now(),
						isError: true,
						errorIcon: IconAlertTriangle,
						activityIcons: [...liveEventIcons] // Preserve any activities that happened before error
					}
				];
			}
			liveEventIcons = [];
			// selection handled within LiveIconStrip component
		});

		socket.on(SOCKET_EVENTS.DISCONNECT, () => {
			console.log('Socket disconnected');
			isWaitingForReply = false;
			liveEventIcons = [];
		});

		// Mark this session as active and ensure connection
		// This must happen AFTER event listeners are set up but BEFORE loading history
		sessionSocketManager.handleSessionFocus(sessionId);

		// Now load previous messages after socket is ready and listening
		// This ensures we don't miss any events that might arrive while loading
		if (claudeSessionId || shouldResume) {
			await loadPreviousMessages();
			
			// After loading file-based history, also request buffered messages
			// This catches any messages that were sent while disconnected
			if (socket.connected) {
				console.log('Loading buffered messages from server for session:', sessionId);
				isCatchingUp = true;
				
				try {
					// Request messages buffered on the server
					// The server will replay them through normal channels
					const bufferedMessages = await sessionSocketManager.loadSessionHistory(sessionId);
					console.log(`Loaded ${bufferedMessages.length} buffered messages for session ${sessionId}`);
					
					// The messages will be replayed through normal event handlers
					// Just wait a bit for them to arrive
					if (bufferedMessages.length > 0) {
						// Give time for replayed messages to be processed
						await new Promise(resolve => setTimeout(resolve, 500));
					}
				} catch (error) {
					console.error('Failed to load buffered messages:', error);
				} finally {
					// Clear catching up state if no messages are actively arriving
					setTimeout(() => {
						if (isCatchingUp && !isWaitingForReply) {
							isCatchingUp = false;
						}
					}, 1000);
				}
			}
		}

		// Check if session has pending messages from the backend
		if (socket.connected && (shouldResume || claudeSessionId)) {
			console.log('Socket already connected - checking session activity state');
			// Query the backend for actual session state
			const hasPending = await sessionSocketManager.checkForPendingMessages(sessionId);
			if (hasPending) {
				console.log('Session has pending messages, setting waiting state');
				isWaitingForReply = true;
			} else {
				console.log('Session is idle, no pending messages');
				isWaitingForReply = false;
				isCatchingUp = false;
			}
		}
	});
	onDestroy(() => {
		// Don't disconnect the socket immediately as it might be used by other panes
		// The SessionSocketManager will handle cleanup when appropriate
		if (socket) {
			try {
				socket.off('session.id.updated');
			} catch {}
			socket.removeAllListeners();
		}
		// Resize listener cleanup is handled by the $effect
	});
</script>

<div class="claude-pane">
	<!-- Chat Header with AI Status -->
	<div class="chat-header">
		<div
			class="ai-status {status}"
			title={isWaitingForReply ? 'thinking...' : loading ? 'loading...' : 'idle'}
		>
			<div class="ai-avatar">
				{#if isCatchingUp}
					<IconLoader size={16} class="ai-icon spinning" />
					<span class="catching-up">Reconnecting to active session...</span>
				{:else if loading}
					<IconProgressDown size={16} class="ai-icon" />
				{:else if isWaitingForReply}
					<IconSparkles size={16} class="ai-icon glowing" />
				{:else}
					<IconClaude size={16} />
				{/if}
			</div>
			<div class="ai-info">
				<div class="ai-name">Claude</div>
				<!--<div class="ai-state">
					 {#if isCatchingUp}
						<span class="catching-up">Reconnecting to active session...</span>
					{:else if loading}
						Processing...
					{:else if isWaitingForReply}
						Thinking...
					{:else}
						Ready
					{/if}
				</div> -->
			</div>
		</div>
		<div class="chat-stats">
			{#if workspacePath}
				<div class="stat-item ai-cwd" title={workspacePath}>
					<span class="cwd-icon"><IconFolder size={16} /></span>
					<span class="cwd-path">{workspacePath.split('/').filter(Boolean).pop() || '/'}</span>
				</div>
			{/if}
			<div class="stat-item">
				<span class="stat-icon"><IconMessage size={16} /></span>
				<span class="stat-value">{messages.length}</span>
			</div>
		</div>
	</div>

	<!-- Enhanced Messages Container -->
	<div
		class="messages"
		role="log"
		aria-live="polite"
		aria-label="Chat messages"
		bind:this={messagesContainer}
	>
		{#if loading && messages.length === 0}
			<div class="loading-message" transition:fly={{ y: 20, duration: 300 }}>
				<div class="loading-indicator">
					<div class="pulse-ring"></div>
					<div class="pulse-ring"></div>
					<div class="pulse-ring"></div>
				</div>
				<div class="loading-text">Loading previous conversation...</div>
			</div>
		{/if}

		{#each messages as m, index (m.id || `msg-${index}`)}
			<div
				class="message message--{m.role} {m.isError ? 'message--error' : ''}"
				transition:fly={{ y: 20, duration: 400 }}
				role="article"
				aria-label="{m.role} message"
			>
				<div class="message-wrapper">
					<div class="message-avatar">
						{#if m.role === 'user'}
							<div class="user-avatar">
								<IconUserCode size={16} />
							</div>
						{:else}
							<div class="ai-avatar-small">
								<IconClaude size={16} />
							</div>
						{/if}
					</div>
					<div class="message-content">
						<div class="message-header">
							<span class="message-role">{m.role === 'user' ? 'You' : 'Claude'}</span>
							<span class="message-time">
								{m.timestamp
									? new Date(m.timestamp).toLocaleTimeString('en-US', {
											hour: '2-digit',
											minute: '2-digit'
										})
									: '--:--'}
							</span>
						</div>
						<div class="message-text">
							{#if m.isError && m.errorIcon}
								{@const ErrorIcon = m.errorIcon}
								<div class="error-icon-wrapper">
									<ErrorIcon size={20} />
								</div>
							{/if}
							<Markdown content={m.text} />
						</div>
						{#if m.activityIcons && m.activityIcons.length > 0}
							<div class="activity-icons-container">
								<LiveIconStrip icons={m.activityIcons} title="Agent activity" staticMode={true} />
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}

		{#if isWaitingForReply}
			<div
				class="message message--assistant typing-indicator"
				transition:fly={{ y: 20, duration: 300 }}
			>
				<div class="message-wrapper">
					<div class="message-avatar">
						<div class="ai-avatar-small">
							<IconClaude size={16} />
						</div>
					</div>
					<div class="message-content">
						<div class="message-header">
							<span class="message-role">Claude</span>
							<span class="message-time typing-status">--:--</span>
						</div>
						<div class="typing-animation">
							<span class="typing-dot"></span>
							<span class="typing-dot"></span>
							<span class="typing-dot"></span>
						</div>
						{#if liveEventIcons.length > 0}
							<LiveIconStrip icons={liveEventIcons} title="Live agent activity" />
						{/if}
					</div>
				</div>
			</div>
		{/if}

		{#if messages.length === 0 && !loading}
			<div class="welcome-message" transition:fly={{ y: 30, duration: 500 }}>
				<div class="welcome-icon">
					<img src="/favicon.png" alt="" />
				</div>
				<h3>Welcome to Claude</h3>
				<p>
					Start a conversation with your AI assistant. Ask questions, get help with coding, or
					discuss ideas!
				</p>
			</div>
		{/if}
	</div>

	<!-- Enhanced Input Form -->
	<form onsubmit={send} class="input-form">
		<div class="input-container">
			<div class="message-input-wrapper" data-augmented-ui="tl-clip br-clip both">
				<textarea
					bind:value={input}
					placeholder={isMobile
						? 'Tap Send button to send'
						: 'Press Enter to send, Shift+Enter for new line'}
					class="message-input"
					disabled={loading}
					aria-label="Type your message"
					autocomplete="off"
					onkeydown={(e) => {
						// On desktop: Enter sends, Shift+Enter adds newline
						// On mobile: Enter always adds newline (send via button)
						if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
							e.preventDefault();
							send(e);
						}
					}}
					rows="2"
				></textarea>
			</div>
			<div class="input-actions">
				<ClaudeCommands
					{socket}
					{workspacePath}
					{sessionId}
					{claudeSessionId}
					onCommandInsert={handleCommandInsert}
					disabled={loading}
					bind={claudeCommandsApi}
				/>
				<Button
					type="submit"
					text={isWaitingForReply ? 'Send' : loading ? 'Sending...' : 'Send'}
					variant="primary"
					augmented="tr-clip bl-clip both"
					disabled={!input.trim() || loading}
					ariaLabel="Send message"
				/>
			</div>
		</div>
	</form>
</div>

<style>
	@import '../shared/styles/animations.css';

	/* AWARD-WINNING CHAT INTERFACE 2025
	   Features: Advanced glass-morphism, spatial design, micro-interactions,
	   professional typography, and cutting-edge UX patterns */

	.claude-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0; /* Important for proper flex sizing */
		background: radial-gradient(
			ellipse at top left,
			color-mix(in oklab, var(--bg) 95%, var(--primary) 5%),
			var(--bg)
		);
		color: var(--text);
		overflow: hidden;
		position: relative;
		container-type: inline-size;
		/* Ensure stable layout during transitions */
		contain: layout style;
	}

	/* INTELLIGENT CHAT HEADER */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: var(--space-4);
		padding-block: var(--space-1);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 92%, var(--primary) 8%),
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
		);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		backdrop-filter: blur(16px) saturate(120%);
		position: relative;
		z-index: 10;
		box-shadow:
			0 2px 20px -8px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.ai-status {
		display: flex;
		align-items: center;
		gap: var(--space-4);

		&.thinking {
			color: var(--accent-cyan);
		}
	}

	.ai-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: radial-gradient(
			ellipse at center,
			color-mix(in oklab, var(--primary) 15%, transparent),
			color-mix(in oklab, var(--primary) 5%, transparent)
		);
		border: 2px solid color-mix(in oklab, var(--primary) 30%, transparent);
		border-radius: 50%;
		color: var(--primary);
		backdrop-filter: blur(8px);
		box-shadow:
			0 8px 32px -12px var(--primary-glow),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
			0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent);
		transition: all 0.3s ease;
		animation: avatarPulse 4s ease-in-out infinite;
	}

	.thinking > .ai-avatar {
		background: radial-gradient(
			ellipse at center,
			color-mix(in oklab, var(--accent-cyan) 15%, transparent),
			color-mix(in oklab, var(--accent-cyan) 5%, transparent)
		);
		border: 2px solid color-mix(in oklab, var(--accent-cyan) 30%, transparent);
		border-radius: 50%;
		color: var(--accent-cyan);
		backdrop-filter: blur(8px);
		box-shadow:
			0 8px 32px -12px var(--accent-cyan-glow),
			inset 0 2px 4px color-mix(in oklab, var(--accent-cyan) 15%, transparent),
			0 0 0 1px color-mix(in oklab, var(--accent-cyan) 10%, transparent);
	}

	.ai-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		flex: 1;
		min-width: 0; /* Allow text truncation */
	}

	.ai-name {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: var(--font-size-3);
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		letter-spacing: 0.05em;
	}

	.ai-state {
		font-family: var(--font-sans);
		font-size: var(--font-size-1);
		color: var(--muted);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.ai-cwd {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		max-width: 350px;
	}

	.stat-item.ai-cwd {
		padding: var(--space-1) var(--space-2);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 8%, transparent),
			color-mix(in oklab, var(--primary) 4%, transparent)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 15%, transparent);
		border-radius: 12px;
	}

	.cwd-icon {
		font-size: 0.9em;
		opacity: 0.8;
	}

	.cwd-path {
		color: var(--primary);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.02em;
	}

	.catching-up {
		color: var(--accent-amber);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.chat-stats {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 10%, transparent),
			color-mix(in oklab, var(--primary) 5%, transparent)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 20px;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 600;
		backdrop-filter: blur(4px);
	}

	.stat-value {
		color: var(--primary);
		font-weight: 700;
	}

	/* ADVANCED MESSAGES CONTAINER */
	.messages {
		flex: 1;
		min-height: 0; /* Critical for flex children to shrink properly */
		overflow-y: auto;
		overflow-x: hidden;
		padding: var(--space-6) var(--space-6) var(--space-4);
		scroll-behavior: smooth;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--primary) 30%, transparent) transparent;
		position: relative;
		background: linear-gradient(
			180deg,
			transparent 0%,
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%) 10%,
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%) 90%,
			transparent 100%
		);
		/* Fix touch scrolling on mobile devices */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		/* Prevent layout shift during navigation */
		will-change: contents;
		contain: size layout;
	}

	.messages::-webkit-scrollbar {
		width: 8px;
	}

	.messages::-webkit-scrollbar-thumb {
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--primary) 40%, transparent),
			color-mix(in oklab, var(--primary) 20%, transparent)
		);
		border-radius: 12px;
		border: 2px solid transparent;
		background-clip: padding-box;
	}

	.messages::-webkit-scrollbar-track {
		background: color-mix(in oklab, var(--surface) 95%, transparent);
		border-radius: 12px;
	}

	/* LOADING STATE */
	.loading-message {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-6);
		margin: var(--space-4) 0;
		background: radial-gradient(
			ellipse at left,
			color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 24px;
		backdrop-filter: blur(8px);
		box-shadow:
			0 8px 32px -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.loading-indicator {
		display: flex;
		gap: var(--space-1);
		align-items: center;
	}

	.pulse-ring {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary);
		animation: pulseRing 1.5s ease-in-out infinite;
	}

	.pulse-ring:nth-child(2) {
		animation-delay: 0.2s;
	}

	.pulse-ring:nth-child(3) {
		animation-delay: 0.4s;
	}

	.loading-text {
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		color: var(--muted);
		font-style: italic;
	}

	/* MESSAGE BUBBLES - REVOLUTIONARY DESIGN */
	.message {
		margin-bottom: var(--space-5);
		opacity: 0;
		animation: messageSlideIn 0.5s ease-out forwards;
	}

	.message-wrapper {
		display: flex;
		gap: var(--space-4);
		align-items: flex-start;
		max-width: 90%;
	}

	.message--user .message-wrapper {
		flex-direction: row-reverse;
		margin-left: auto;
		margin-right: 0;
	}

	.message--assistant .message-wrapper {
		margin-right: auto;
		margin-left: 0;
	}

	/* AVATAR DESIGNS */
	.message-avatar {
		flex-shrink: 0;
		margin-top: var(--space-2);
	}

	.user-avatar,
	.ai-avatar-small {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid transparent;
		backdrop-filter: blur(8px);
		transition: all 0.3s ease;
	}

	.user-avatar {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--accent-amber) 20%, transparent),
			color-mix(in oklab, var(--accent-amber) 10%, transparent)
		);
		border-color: color-mix(in oklab, var(--accent-amber) 40%, transparent);
		color: var(--accent-amber);
		box-shadow:
			0 4px 16px -8px rgba(255, 209, 102, 0.3),
			inset 0 1px 2px rgba(255, 255, 255, 0.1);
	}

	.ai-avatar-small {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 20%, transparent),
			color-mix(in oklab, var(--primary) 10%, transparent)
		);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		color: var(--primary);
		box-shadow:
			0 4px 16px -8px var(--primary-glow),
			inset 0 1px 2px rgba(255, 255, 255, 0.1);
	}

	/* MESSAGE CONTENT */
	.message-content {
		flex: 1;
		min-width: 0;
	}

	.message-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-3);
		gap: var(--space-3);
	}

	.message-role {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.message--user .message-role {
		color: var(--accent-amber);
	}

	.message--assistant .message-role {
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.message-time {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
	}

	.message-text {
		padding: var(--space-5);
		border-radius: 24px;
		line-height: 1.6;
		word-wrap: break-word;
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		backdrop-filter: blur(8px);
		position: relative;
		box-shadow:
			0 8px 32px -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
		transition: all 0.3s ease;
	}

	/* Activity icons container - transparent background */
	.activity-icons-container {
		margin-top: var(--space-2);
		background: transparent;
	}

	/* Overlay container for event details (works for live and history) */

	.message--user .message-text {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--accent-amber) 15%, var(--surface)),
			color-mix(in oklab, var(--accent-amber) 8%, var(--surface))
		);
		border: 1px solid color-mix(in oklab, var(--accent-amber) 25%, transparent);
		color: var(--text);
		border-bottom-right-radius: 8px;
	}

	.message--assistant .message-text {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 12%, var(--surface)),
			color-mix(in oklab, var(--primary) 6%, var(--surface))
		);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		color: var(--text);
		border-bottom-left-radius: 8px;
	}

	.message-text:hover {
		box-shadow:
			0 12px 40px -16px rgba(0, 0, 0, 0.15),
			inset 0 2px 4px rgba(255, 255, 255, 0.08);
	}

	/* WELCOME MESSAGE */
	.welcome-message {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-8);
		margin-block: var(--space-8);
		margin-inline: auto;
		min-height: 200px;
		max-width: 480px;
		background: radial-gradient(
			ellipse at center,
			color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 32px;
		backdrop-filter: blur(12px);
		box-shadow:
			0 16px 64px -24px rgba(0, 0, 0, 0.2),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.welcome-icon {
		font-size: 4rem;
		margin-bottom: var(--space-2);
		animation: fadeInOut 10s ease-in-out infinite;
		opacity: 0.05;
		position: absolute;
		inset: 0;
		display: none;
	}

	.welcome-message h3 {
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 800;
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		margin: 0 0 var(--space-4);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.welcome-message p {
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		color: var(--muted);
		line-height: 1.6;
		margin: 0;
	}

	/* REVOLUTIONARY INPUT INTERFACE */
	.input-form {
		padding: var(--space-3);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 88%, var(--primary) 12%),
			color-mix(in oklab, var(--surface) 92%, var(--primary) 8%)
		);
		border-top: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		backdrop-filter: blur(16px) saturate(120%);
		position: relative;
		z-index: 10;
		box-shadow:
			0 -8px 32px -16px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
		flex-shrink: 0; /* Prevent input form from shrinking */
		margin-top: auto; /* Push to bottom */
	}

	.input-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-5); /* Increased gap for more vertical spacing */
		position: relative;
	}

	.input-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	/* Message input wrapper with augmented-ui styling */
	.message-input-wrapper {
		width: 100%;
		position: relative;
		--aug-border: 2px;
		--aug-border-bg: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		--aug-border-fallback-color: var(--primary);
		--aug-tl: 12px;
		--aug-br: 12px;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 93%, var(--primary) 7%),
			color-mix(in oklab, var(--surface) 96%, var(--primary) 4%)
		);
		backdrop-filter: blur(12px) saturate(120%);
		box-shadow:
			inset 0 2px 12px rgba(0, 0, 0, 0.08),
			0 4px 32px -8px rgba(0, 0, 0, 0.15),
			0 0 0 1px color-mix(in oklab, var(--primary) 15%, transparent);
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.message-input-wrapper:focus-within {
		--aug-border: 3px;
		--aug-border-bg: linear-gradient(135deg, var(--accent-cyan), var(--primary));
		background: radial-gradient(
			ellipse at center,
			color-mix(in oklab, var(--surface) 88%, var(--primary) 12%),
			color-mix(in oklab, var(--surface) 94%, var(--primary) 6%)
		);
		box-shadow:
			inset 0 2px 16px rgba(0, 0, 0, 0.05),
			0 0 0 4px color-mix(in oklab, var(--primary) 25%, transparent),
			0 0 60px var(--primary-glow),
			0 20px 80px -20px var(--primary-glow);
	}

	:global(.message-input button) {
		width: 100%;
	}

	.message-input {
		width: 100%;
		height: 100%;
		padding: var(--space-5) var(--space-5); /* Increased vertical padding */
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		font-weight: 500;
		background: transparent;
		border: none;
		color: var(--text);
		position: relative;
		overflow: hidden;
		min-height: 100px; /* Increased minimum height */
		max-height: 200px;
		resize: vertical;
		line-height: 1.6;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--primary) 30%, transparent) transparent;
		outline: none;
	}

	.message-input::-webkit-scrollbar {
		width: 6px;
	}

	.message-input::-webkit-scrollbar-thumb {
		background: color-mix(in oklab, var(--primary) 40%, transparent);
		border-radius: 3px;
	}

	.message-input:focus {
		outline: none !important;
		border: none !important;
		box-shadow: none !important;
	}

	.message-input::placeholder {
		color: color-mix(in oklab, var(--muted) 80%, var(--primary) 20%);
		font-style: italic;
		opacity: 0.7;
	}

	.message-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	/* Buttons in the actions area */
	.input-actions :global(.button) {
		min-width: 120px;
		justify-content: center;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Commands button - compact size */
	.input-actions :global(button:first-child) {
		min-width: unset;
		flex-shrink: 0; /* Keep commands button at its natural size */
	}

	/* Send button - take up remaining space */
	.input-actions :global(.button[type='submit']) {
		flex: 1; /* Take up remaining space */
		min-width: 120px; /* Keep minimum width for usability */
	}

	.help-text {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	/* RESPONSIVE DESIGN */
	@container (max-width: 480px) {
		.chat-header {
			padding: var(--space-3) var(--space-4);
		}

		.ai-avatar {
			width: 40px;
			height: 40px;
		}

		.messages {
			padding: var(--space-4) var(--space-4) var(--space-3);
		}

		.message-wrapper {
			max-width: 95%;
		}

		.message-text {
			padding: var(--space-4);
			font-size: var(--font-size-1);
			border-radius: 20px;
		}

		.input-form {
			padding: var(--space-4);
		}

		.input-container {
			gap: var(--space-4); /* Maintain good vertical spacing on mobile */
		}

		.message-input-wrapper {
			--aug-tl: 8px;
			--aug-br: 8px;
		}

		.message-input {
			min-height: 80px; /* Increased height on mobile too */
			padding: var(--space-4) var(--space-4);
			font-size: var(--font-size-1);
		}

		.input-actions :global(.button) {
			min-width: 80px;
			font-size: var(--font-size-1);
		}
	}

	/* MOBILE & TOUCH DEVICE OPTIMIZATIONS */
	@media (max-width: 768px) {
		.claude-pane {
			/* Ensure full height on mobile */
			height: 100%;
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.messages {
			/* Improve touch scrolling on mobile */
			-webkit-overflow-scrolling: touch;
			overscroll-behavior-y: contain;
			/* Prevent elastic scrolling issues on iOS */
			position: relative;
			touch-action: pan-y;
			/* Ensure proper height calculation */
			flex: 1 1 auto;
			min-height: 0;
			height: 100%;
			contain: none; /* Remove contain on mobile for better scrolling */
		}

		.chat-header {
			padding: var(--space-3) var(--space-4);
		}

		.ai-avatar {
			width: 40px;
			height: 40px;
		}

		.message-wrapper {
			max-width: 95%;
		}
	}

	/* Touch-specific optimizations */
	@media (hover: none) and (pointer: coarse) {
		.messages {
			/* Force hardware acceleration for smooth scrolling */
			transform: translateZ(0);
			will-change: scroll-position;
		}

		/* Increase tap targets for touch while keeping visual size small */
	}

	/* ACCESSIBILITY ENHANCEMENTS */
	@media (prefers-reduced-motion: reduce) {
		.message,
		.ai-avatar,
		.welcome-icon,
		.pulse-ring {
			animation: none;
		}

		.message-text:hover {
			transform: none;
		}

		.message-input:focus {
			transform: none;
		}
	}

	@media (prefers-color-scheme: light) {
		.message-text {
			box-shadow:
				0 4px 20px -12px rgba(0, 0, 0, 0.15),
				inset 0 1px 2px rgba(255, 255, 255, 0.5);
		}
	}

	/* HIGH CONTRAST MODE */
	@media (prefers-contrast: high) {
		.message-text {
			border-width: 2px;
		}

		.message-input {
			border-width: 3px;
		}

		.ai-avatar,
		.user-avatar,
		.ai-avatar-small {
			border-width: 3px;
		}
	}

	/* TYPING INDICATOR ANIMATION */
	.typing-indicator {
		opacity: 1;
		animation: none; /* Override default message animation */
	}

	.typing-status {
		color: var(--muted);
		font-weight: 600;
		animation: typingPulse 1.5s ease-in-out infinite;
	}

	.typing-animation {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 12%, var(--surface)),
			color-mix(in oklab, var(--primary) 6%, var(--surface))
		);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 24px;
		border-bottom-left-radius: 8px;
		min-height: 48px;
		box-shadow:
			0 8px 32px -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
	}

	.typing-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--primary);
		opacity: 0.4;
		animation: typingBounce 1.4s ease-in-out infinite;
		box-shadow: 0 2px 8px -2px var(--primary-glow);
	}

	.typing-dot:nth-child(1) {
		animation-delay: 0s;
	}

	.typing-dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	/* Smooth scroll to show typing indicator */
	.typing-indicator {
		scroll-margin-bottom: var(--space-6);
	}

	/* Message text container - Markdown component handles content styles */

	.error-icon-wrapper {
		display: inline-flex;
		align-items: center;
		margin-right: var(--space-2);
		color: var(--error, #ff6b6b);
		vertical-align: middle;
	}

	/* ERROR MESSAGE STYLING */
	.message--error .message-text {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--error, #ff6b6b) 15%, var(--surface)),
			color-mix(in oklab, var(--error, #ff6b6b) 8%, var(--surface))
		);
		border-color: color-mix(in oklab, var(--error, #ff6b6b) 35%, transparent);
		color: var(--error, #ff6b6b);
	}

	.message--error .ai-avatar-small {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--error, #ff6b6b) 20%, transparent),
			color-mix(in oklab, var(--error, #ff6b6b) 10%, transparent)
		);
		border-color: color-mix(in oklab, var(--error, #ff6b6b) 40%, transparent);
		color: var(--error, #ff6b6b);
	}

	.message--error .message-role {
		color: var(--error, #ff6b6b);
	}
</style>
