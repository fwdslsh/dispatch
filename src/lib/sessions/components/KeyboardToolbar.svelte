<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Props
	let {
		onSpecialKey = (key) => {},
		onCommandPalette = () => {},
		visible = $bindable(false),
		isMobile = true
	} = $props();

	// State
	let keyboardHeight = $state(0);
	let toolbarConfig = $state([]);
	let cleanupFunctions = [];

	// Default toolbar configuration
	const defaultConfig = [
		{ key: 'cmd-palette', label: 'Cmd', code: 'F1', symbol: '⌘', isSpecial: true },
		{ key: 'Escape', label: 'Esc', code: 'Escape', symbol: '⎋' },
		{ key: 'Tab', label: 'Tab', code: 'Tab', symbol: '↹' },
		{ key: 'Control', label: 'Ctrl', code: 'ControlLeft', symbol: '^', isModifier: true },
		{ key: 'Alt', label: 'Alt', code: 'AltLeft', symbol: '⌥', isModifier: true },
		{ key: 'ArrowUp', label: '↑', code: 'ArrowUp', symbol: '↑' },
		{ key: 'ArrowDown', label: '↓', code: 'ArrowDown', symbol: '↓' },
		{ key: 'ArrowLeft', label: '←', code: 'ArrowLeft', symbol: '←' },
		{ key: 'ArrowRight', label: '→', code: 'ArrowRight', symbol: '→' },
		{ key: 'ctrl+c', label: 'Ctrl+C', code: 'KeyC', ctrlKey: true, symbol: '^C' },
		{ key: 'ctrl+z', label: 'Ctrl+Z', code: 'KeyZ', ctrlKey: true, symbol: '^Z' },
		{ key: 'pipe', label: '|', code: 'Backslash', shiftKey: true, symbol: '|' },
		{ key: 'tilde', label: '~', code: 'Backquote', shiftKey: true, symbol: '~' }
	];

	// Load configuration from localStorage
	function loadToolbarConfig() {
		if (!browser) return defaultConfig;

		try {
			const stored = localStorage.getItem('keyboardToolbarConfig');
			if (stored) {
				const config = JSON.parse(stored);
				return config.buttons || defaultConfig;
			}
		} catch (error) {
			console.warn('Failed to load keyboard toolbar config:', error);
		}
		return defaultConfig;
	}

	// Save configuration to localStorage
	function saveToolbarConfig(config) {
		if (!browser) return;

		try {
			localStorage.setItem(
				'keyboardToolbarConfig',
				JSON.stringify({
					buttons: config,
					version: 1
				})
			);
		} catch (error) {
			console.warn('Failed to save keyboard toolbar config:', error);
		}
	}

	// Handle keyboard visibility detection
	function setupKeyboardDetection() {
		if (!browser || !isMobile) return;

		let keyboardVisible = false;
		const threshold = 150; // Height difference threshold for keyboard detection

		// Visual Viewport API (preferred method)
		if (window.visualViewport) {
			const handleViewportChange = () => {
				const heightDiff = window.innerHeight - window.visualViewport.height;
				const wasVisible = keyboardVisible;
				keyboardVisible = heightDiff > threshold;
				keyboardHeight = heightDiff;

				if (keyboardVisible !== wasVisible) {
					visible = keyboardVisible;

					// Add/remove body class for CSS targeting
					if (keyboardVisible) {
						document.body.classList.add('keyboard-toolbar-visible');
					} else {
						document.body.classList.remove('keyboard-toolbar-visible');
					}
				}
			};

			window.visualViewport.addEventListener('resize', handleViewportChange);

			cleanupFunctions.push(() => {
				window.visualViewport.removeEventListener('resize', handleViewportChange);
				document.body.classList.remove('keyboard-toolbar-visible');
			});
		} else {
			// Fallback to window resize detection
			const initialHeight = window.innerHeight;

			const handleWindowResize = () => {
				const currentHeight = window.innerHeight;
				const heightDiff = initialHeight - currentHeight;
				const wasVisible = keyboardVisible;
				keyboardVisible = heightDiff > threshold;
				keyboardHeight = heightDiff;

				if (keyboardVisible !== wasVisible) {
					visible = keyboardVisible;

					if (keyboardVisible) {
						document.body.classList.add('keyboard-toolbar-visible');
					} else {
						document.body.classList.remove('keyboard-toolbar-visible');
					}
				}
			};

			window.addEventListener('resize', handleWindowResize);

			cleanupFunctions.push(() => {
				window.removeEventListener('resize', handleWindowResize);
				document.body.classList.remove('keyboard-toolbar-visible');
			});
		}
	}

	// Handle button press
	function handleButtonPress(button) {
		if (button.isSpecial && button.key === 'cmd-palette') {
			// Handle command palette button
			onCommandPalette();
		} else if (button.isModifier) {
			// Handle modifier keys - these might need special treatment
			// For now, we'll send them as regular key events
			sendKeyEvent(button);
		} else if (button.ctrlKey || button.altKey || button.shiftKey || button.metaKey) {
			// Handle key combinations
			sendKeyEvent(button);
		} else {
			// Handle special keys and regular keys
			sendKeyEvent(button);
		}
	}

	// Send key event to terminal
	function sendKeyEvent(button) {
		// Create appropriate key sequence for different key types
		let keySequence = '';

		switch (button.key) {
			case 'Escape':
				keySequence = '\u001b'; // ESC
				break;
			case 'Tab':
				keySequence = '\t';
				break;
			case 'ArrowUp':
				keySequence = '\u001b[A';
				break;
			case 'ArrowDown':
				keySequence = '\u001b[B';
				break;
			case 'ArrowRight':
				keySequence = '\u001b[C';
				break;
			case 'ArrowLeft':
				keySequence = '\u001b[D';
				break;
			case 'ctrl+c':
				keySequence = '\u0003'; // Ctrl+C
				break;
			case 'ctrl+z':
				keySequence = '\u001a'; // Ctrl+Z
				break;
			case 'pipe':
				keySequence = '|';
				break;
			case 'tilde':
				keySequence = '~';
				break;
			default:
				// For other keys, try to create a synthetic key event
				if (button.ctrlKey) {
					// Convert to control character
					const char = button.key.toLowerCase().charCodeAt(0) - 96;
					keySequence = String.fromCharCode(char);
				} else {
					keySequence = button.key;
				}
		}

		// Send to terminal via the callback
		onSpecialKey(keySequence);
	}

	onMount(() => {
		if (browser) {
			toolbarConfig = loadToolbarConfig();
			setupKeyboardDetection();

			// For testing: show keyboard toolbar on mobile by default
			// This can be removed once keyboard detection is working properly
			if (isMobile) {
				visible = true;
			}
		}
	});

	onDestroy(() => {
		cleanupFunctions.forEach((cleanup) => cleanup());
	});
</script>

{#if isMobile}
	<div
		class="keyboard-toolbar"
		data-testid="keyboard-toolbar"
		style="bottom: {keyboardHeight > 0
			? `calc(env(safe-area-inset-bottom) + ${Math.max(keyboardHeight - 50, 0)}px)`
			: 'calc(env(safe-area-inset-bottom) + 0px)'}"
	>
		<div class="toolbar-content">
			<div class="toolbar-buttons">
				{#each toolbarConfig as button}
					<button
						class="toolbar-button"
						data-key={button.key}
						onclick={() => handleButtonPress(button)}
						title={button.label}
						aria-label={`Send ${button.label}`}
					>
						<span class="button-text">
							{button.symbol || button.label}
						</span>
					</button>
				{/each}
			</div>

			<!-- Settings/customize button -->
			<button
				class="toolbar-button settings-button"
				onclick={() => {
					/* Placeholder for future customization feature */
				}}
				title="Customize toolbar"
				aria-label="Customize keyboard toolbar"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<circle cx="12" cy="12" r="3" />
					<path
						d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"
					/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.keyboard-toolbar {
		position: fixed;
		left: 0;
		right: 0;
		z-index: 1002; /* Above mobile controls */
		background: rgba(26, 26, 26, 0.95);
		backdrop-filter: blur(10px);
		border-top: 1px solid rgba(0, 255, 136, 0.2);
		padding: 8px;
		box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
	}

	.toolbar-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 100%;
		margin: 0 auto;
	}

	.toolbar-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex: 1;
		overflow-x: auto;
		padding-right: 8px;
	}

	.toolbar-button {
		background: rgba(42, 42, 42, 0.8);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 6px;
		color: var(--text-secondary, #ccc);
		padding: 8px 12px;
		min-width: 44px; /* Minimum touch target size */
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono, 'Courier New', monospace);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		user-select: none;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.toolbar-button:hover,
	.toolbar-button:active {
		background: rgba(0, 255, 136, 0.1);
		border-color: var(--primary, #00ff88);
		color: var(--primary, #00ff88);
		transform: scale(0.98);
	}

	.toolbar-button:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.3);
	}

	.button-text {
		display: inline-block;
		line-height: 1;
	}

	.settings-button {
		background: rgba(60, 60, 60, 0.8);
		border-color: rgba(255, 255, 255, 0.2);
		min-width: 44px;
		flex-shrink: 0;
	}

	.settings-button svg {
		width: 16px;
		height: 16px;
		stroke-width: 2;
	}

	.settings-button:hover,
	.settings-button:active {
		background: rgba(80, 80, 80, 0.9);
		border-color: rgba(255, 255, 255, 0.4);
		color: rgba(255, 255, 255, 0.9);
	}

	/* Responsive adjustments */
	@media (max-width: 360px) {
		.toolbar-button {
			padding: 6px 8px;
			min-width: 40px;
			min-height: 40px;
			font-size: 11px;
		}

		.toolbar-buttons {
			gap: 4px;
		}

		.keyboard-toolbar {
			padding: 6px;
		}
	}

	@media (min-width: 768px) {
		.keyboard-toolbar {
			display: none; /* Hide on desktop as it's mobile-specific */
		}
	}

	/* Hide scrollbars but keep functionality */
	.toolbar-buttons::-webkit-scrollbar {
		height: 2px;
	}

	.toolbar-buttons::-webkit-scrollbar-track {
		background: transparent;
	}

	.toolbar-buttons::-webkit-scrollbar-thumb {
		background: rgba(0, 255, 136, 0.3);
		border-radius: 1px;
	}

	.toolbar-buttons::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 255, 136, 0.5);
	}
</style>
