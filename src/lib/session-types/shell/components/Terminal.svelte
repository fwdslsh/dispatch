<script>
	import { Xterm } from '@battlefieldduck/xterm-svelte';
	import { onMount } from 'svelte';
	import { TerminalViewModel } from './TerminalViewModel.svelte.js';

	let {
		socket = null,
		sessionId = null,
		projectId = null,
		onchatclick = () => {},
		initialHistory = '',
		onInputEvent = () => {},
		onOutputEvent = () => {},
		onBufferUpdate = () => {},
		terminalOptions = {}
	} = $props();

	let terminal = $state();
	let viewModel = $state(null);

	// Derived state from viewModel
	let isLoading = $derived(viewModel?.state?.isLoading ?? true);
	let error = $derived(viewModel?.state?.error ?? null);

	// Terminal options configured for proper input handling
	let options = $derived({
		convertEol: true,
		cursorBlink: true,
		fontFamily: 'Courier New, monospace',
		scrollback: 10000,
		disableStdin: false, // Enable input handling
		allowTransparency: false, // Better performance
		theme: {
			background: '#0a0a0a',
			foreground: '#ffffff',
			cursor: '#00ff88',
			cursorAccent: '#0a0a0a',
			selectionBackground: 'rgba(0, 255, 136, 0.3)',
			black: '#0a0a0a',
			red: '#ff6b6b',
			green: '#00ff88',
			yellow: '#ffeb3b',
			blue: '#2196f3',
			magenta: '#e91e63',
			cyan: '#00bcd4',
			white: '#ffffff',
			brightBlack: '#666666',
			brightRed: '#ff5252',
			brightGreen: '#69f0ae',
			brightYellow: '#ffff00',
			brightBlue: '#448aff',
			brightMagenta: '#ff4081',
			brightCyan: '#18ffff',
			brightWhite: '#ffffff'
		},
		...terminalOptions
	});

	onMount(() => {
		console.debug('Terminal mount - initializing ViewModel');

		// Create ViewModel
		viewModel = new TerminalViewModel();

		// Initialize ViewModel
		viewModel
			.initialize({
				socket,
				sessionId,
				projectId,
				initialHistory,
				terminalOptions: options,
				onInputEvent,
				onOutputEvent,
				onBufferUpdate,
				onChatClick: onchatclick
			})
			.then((initialized) => {
				if (!initialized) {
					console.error('Failed to initialize terminal');
					return;
				}
			});

		// Cleanup function
		return () => {
			console.debug('Terminal component destroying');

			if (viewModel) {
				viewModel.destroy();
				viewModel = null;
			}
		};
	});

	async function onLoad() {
		console.debug('Terminal component has loaded');

		if (!viewModel || !terminal) {
			console.debug('ViewModel or terminal not ready');
			return;
		}

		// Ensure terminal is ready for input
		console.debug('Terminal ready with options:', terminal.options);

		// Initialize terminal with ViewModel
		const terminalInitialized = await viewModel.initializeTerminal(terminal, options);

		if (!terminalInitialized) {
			console.error('Failed to initialize terminal');
			return;
		}

		console.debug('Terminal initialization complete');
	}
</script>

<div class="terminal-container">
	{#if isLoading}
		<div class="loading">Initializing terminal...</div>
	{:else if error}
		<div class="error">Error: {error}</div>
	{:else}
		<!-- Terminal -->
		<Xterm {options} bind:terminal {onLoad} />
	{/if}
</div>

<style>
	.terminal-container {
		display: flex;
		flex-direction: column;
		position: relative;
		width: 100%;
	}

	.loading,
	.error {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-family: 'Courier New', monospace;
		color: #ffffff;
		background: #0a0a0a;
	}

	.error {
		color: #ff6b6b;
	}
</style>
