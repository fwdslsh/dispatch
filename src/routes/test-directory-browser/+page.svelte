<script>
	import DirectoryBrowser from '$lib/client/shared/components/DirectoryBrowser.svelte';
	import { onMount } from 'svelte';

	// Test data and state
	let selectedPath = $state('./');
	let logs = $state([]);
	let testMode = $state('basic');
	let showFileActions = $state(false);
	let isAlwaysOpen = $state(false);
	let mobileMenuOpen = $state(false);

	// Log helper
	function addLog(message) {
		logs = [...logs, `${new Date().toLocaleTimeString()}: ${message}`];
	}

	// Event handlers
	function onSelect(path) {
		addLog(`Selected: ${path}`);
		selectedPath = path;
	}

	function onNavigate(path) {
		addLog(`Navigated to: ${path}`);
	}

	function onFileOpen(file) {
		addLog(`File opened: ${file.name} at ${file.path}`);
	}

	function onFileUpload(files, currentDirectory) {
		addLog(`File upload attempted: ${files.length} files to ${currentDirectory}`);
		// Simulate upload
		return new Promise((resolve) => {
			setTimeout(() => {
				addLog(`Upload completed for ${files.length} files`);
				resolve();
			}, 1000);
		});
	}

	// Test configurations
	const testConfigs = {
		basic: {
			showFileActions: false,
			isAlwaysOpen: false,
			startPath: './',
			description: 'Basic directory browser with collapsible view'
		},
		alwaysOpen: {
			showFileActions: false,
			isAlwaysOpen: true,
			startPath: './',
			description: 'Always open directory browser'
		},
		withFileActions: {
			showFileActions: true,
			isAlwaysOpen: true,
			startPath: './',
			description: 'Directory browser with file operations enabled'
		},
		customStartPath: {
			showFileActions: false,
			isAlwaysOpen: true,
			startPath: '/workspace',
			description: 'Browser starting from /workspace'
		}
	};

	// Apply test configuration
	let selectedConfig = $state('basic');
	function applyTestConfig(configName) {
		selectedConfig = configName;
		const config = testConfigs[configName];
		if (config) {
			showFileActions = config.showFileActions;
			isAlwaysOpen = config.isAlwaysOpen;
			selectedPath = config.startPath;
			addLog(`Applied config: ${configName} - ${config.description}`);
		}
	}

	// Initialize
	onMount(() => {
		addLog('DirectoryBrowser test page loaded');
		applyTestConfig(testMode);
	});
</script>

<svelte:head>
	<title>DirectoryBrowser Test Page</title>
</svelte:head>

<main
	style="min-height: 100vh; overflow-y: auto; background: #1a1a1a; color: #ffffff; font-family: system-ui, sans-serif;"
>
	<div>
		<!-- Mobile header with toggle -->
		<div
			class="mobile-header"
		>
			<div style="display: flex; justify-content: space-between; align-items: center;">
				<h1 style="margin: 0; font-size: 18px; font-weight: bold;">DirectoryBrowser Test</h1>
				<button
					type="button"
					style="padding: 8px 12px; background: #444; color: white; border: 1px solid #666; border-radius: 4px; font-size: 14px; cursor: pointer;"
					onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				>
					{mobileMenuOpen ? 'Hide' : 'Show'} Options
				</button>
			</div>
		</div>

		<div class="main-container" style="display: flex; flex: 1;">
			<!-- Left Panel - Options -->
			<div
				class="options-panel {!mobileMenuOpen ? 'collapsed' : ''}"
				style="width: 300px; padding: 20px; border-right: 1px solid #333; background: #222; flex-shrink: 0;"
			>
				<h1 class="desktop-header" style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold;">
					DirectoryBrowser Test
				</h1>

				<!-- Test Configuration -->
				<div style="margin-bottom: 30px;">
					<h2 style="margin: 0 0 15px 0; font-size: 14px; font-weight: 600;">Configuration</h2>
					{#each Object.entries(testConfigs) as [configKey, config]}
						<button
							type="button"
							style="display: block; width: 100%; padding: 10px; margin-bottom: 8px; background: {testMode ===
							configKey
								? '#0066cc'
								: '#333'}; color: white; border: 1px solid {testMode === configKey
								? '#0066cc'
								: '#555'}; border-radius: 4px; text-align: left; cursor: pointer;"
							onclick={() => {
								testMode = configKey;
								applyTestConfig(configKey);
							}}
						>
							<div style="font-weight: 500; text-transform: capitalize;">{configKey}</div>
							<div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
								{config.description}
							</div>
						</button>
					{/each}
				</div>
<!-- Component State -->
				<div
					style="margin-top: 20px; padding: 15px; background: #333; border: 1px solid #555; border-radius: 4px; font-size: 13px;"
				>
					<div style="margin-bottom: 8px; font-weight: 600;">Component State:</div>
					<div style="opacity: 0.8; line-height: 1.4;">
						<div>
							Selected: <code style="padding: 2px 4px; background: #444; border-radius: 2px;"
								>{selectedPath || 'none'}</code
							>
						</div>
						<div>
							Mode: <code style="padding: 2px 4px; background: #444; border-radius: 2px;"
								>{testMode}</code
							>
						</div>
					</div>
				</div>
				<!-- Current Settings -->
				<div style="margin-bottom: 30px;">
					<h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Current Settings</h3>
					<div style="font-size: 12px; line-height: 1.5; opacity: 0.8;">
						<div><strong>Selected:</strong> {selectedPath}</div>
						<div><strong>File Actions:</strong> {showFileActions}</div>
						<div><strong>Always Open:</strong> {isAlwaysOpen}</div>
					</div>
				</div>

				<!-- Event Log -->
				<div>
					<div
						style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"
					>
						<h3 style="margin: 0; font-size: 14px; font-weight: 600;">Event Log</h3>
						<button
							type="button"
							style="padding: 4px 8px; font-size: 11px; background: #444; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;"
							onclick={() => (logs = [])}
						>
							Clear
						</button>
					</div>
					<div
						class="event-log"
						style="height: 200px; padding: 8px; background: #111; border: 1px solid #333; border-radius: 4px; overflow-y: auto; font-family: monospace; font-size: 11px;"
					>
						{#if logs.length === 0}
							<div style="opacity: 0.5; font-style: italic;">No events...</div>
						{:else}
							{#each logs as log}
								<div style="margin-bottom: 2px; word-break: break-all;">{log}</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>

			<!-- Right Panel - Component -->
			<div class="component-panel" style="flex: 1; padding: 20px; overflow-y: auto;">
				<h2 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">
					DirectoryBrowser Component
				</h2>

				<div
					style="padding: 20px; background: #2a2a2a; border: 1px solid #444; border-radius: 6px;"
				>
					<DirectoryBrowser
						bind:selected={selectedPath}
						{onSelect}
						{onNavigate}
						{onFileOpen}
						{onFileUpload}
						{showFileActions}
						{isAlwaysOpen}
						startPath={testConfigs[testMode].startPath}
						placeholder="Select a directory..."
					/>
				</div>

				
			</div>
		</div>
	</div>
</main>

<style>
	/* Adjust component panel padding */
	.component-panel {
		padding: 15px !important;
		max-height: calc(100vh);
	}
	@media (max-width: 768px) {
		/* Show mobile header */
		.mobile-header {
			display: block !important;
		}

		/* Hide desktop header in left panel */
		.desktop-header {
			display: none !important;
		}

		/* Stack layout vertically on mobile */
		.main-container {
			flex-direction: column !important;
		}

		/* Make left panel full width and collapsible */
		.options-panel {
			width: 100% !important;
			border-right: none !important;
			border-bottom: 1px solid #333;
		}

		.options-panel.collapsed {
			display: none !important;
		}

		/* Adjust component panel padding */
		.component-panel {
			padding: 15px !important;
			max-height: calc(100vh - 200px);
		}

		/* Smaller text on mobile */
		h2 {
			font-size: 16px !important;
		}

		h3 {
			font-size: 14px !important;
		}

		/* Full width buttons on mobile */
		button {
			min-height: 44px; /* Better touch target */
		}

		/* Adjust event log height */
		.event-log {
			height: 150px !important;
		}
	}

	/* Desktop styles */
	@media (min-width: 769px) {
		.mobile-header {
			display: none !important;
		}
	}
</style>
