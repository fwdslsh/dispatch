/**
 * CommandMenuViewModel - ViewModel for command menu functionality
 * Extends BaseViewModel with command processing, search, and keyboard navigation logic
 * Uses Svelte 5 runes for reactive state management
 */
import { BaseViewModel } from '$lib/shared/contexts/BaseViewModel.svelte.js';

export class CommandMenuViewModel extends BaseViewModel {
	constructor(model, services = {}) {
		super(model, services);

		// Ensure we have a command service
		if (!services.commandService) {
			throw new Error('CommandService is required for CommandMenuViewModel');
		}

		// Ensure filteredCommands is initialized properly
		if (!this.state.filteredCommands) {
			this.updateField('filteredCommands', this.state.commands || []);
		}

		// Initialize derived state for command menu specific functionality
		this.hasCommands = $derived(this.state.filteredCommands?.length > 0);
		this.commandCount = $derived(this.state.filteredCommands?.length || 0);
		this.selectedCommand = $derived(
			this.state.filteredCommands?.[this.state.selectedIndex] || null
		);
		this.isVisible = $derived(this.state.visible);
		this.searchQuery = $derived(this.state.searchQuery || '');

		// Set up reactive effects
		this._setupEffects();
		
		// Load cached commands on initialization
		this.loadFromCache();
	}

	// ========================================
	// Search Functionality
	// ========================================

	/**
	 * Update search query and trigger search
	 * @param {string} query - Search query
	 */
	async updateSearchQuery(query) {
		if (this.isDisposed) return;

		try {
			this.clearError();
			this.updateField('searchQuery', query || '');
			
			// Use command service to search commands
			const filteredCommands = this.services.commandService.searchCommands(
				query || '',
				this.state.commands || []
			);
			
			this.updateField('filteredCommands', filteredCommands);
			
			// Reset selection to first result
			this.updateField('selectedIndex', 0);
			
		} catch (error) {
			console.error('Search failed:', error);
			this.setError('Search failed');
		}
	}

	/**
	 * Clear search query and show all commands
	 */
	clearSearch() {
		this.updateSearchQuery('');
	}

	// ========================================
	// Keyboard Navigation
	// ========================================

	/**
	 * Select next command in the list
	 */
	selectNext() {
		if (this.isDisposed || !this.hasCommands) return;

		const currentIndex = this.state.selectedIndex;
		const maxIndex = this.commandCount - 1;
		const nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
		
		this.updateField('selectedIndex', nextIndex);
	}

	/**
	 * Select previous command in the list
	 */
	selectPrevious() {
		if (this.isDisposed || !this.hasCommands) return;

		const currentIndex = this.state.selectedIndex;
		const maxIndex = this.commandCount - 1;
		const prevIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
		
		this.updateField('selectedIndex', prevIndex);
	}

	/**
	 * Select command by index
	 * @param {number} index - Command index
	 */
	selectCommand(index) {
		if (this.isDisposed || !this.hasCommands) return;
		
		if (index >= 0 && index < this.commandCount) {
			this.updateField('selectedIndex', index);
		}
	}

	// ========================================
	// Command Execution
	// ========================================

	/**
	 * Execute the currently selected command
	 */
	async executeSelected() {
		if (this.isDisposed || !this.selectedCommand) return;
		
		await this.executeCommand(this.selectedCommand);
	}

	/**
	 * Execute a specific command
	 * @param {Object} command - Command to execute
	 */
	async executeCommand(command) {
		if (this.isDisposed || !command) return;

		return this.withLoading(async () => {
			try {
				this.clearError();
				
				// Execute command via service
				await this.services.commandService.executeCommand(command);
				
				// Hide menu after successful execution
				this.hide();
				
				return true;
			} catch (error) {
				console.error('Command execution failed:', error);
				this.setError(error);
				return false;
			}
		});
	}

	// ========================================
	// Menu Visibility Management
	// ========================================

	/**
	 * Show the command menu
	 */
	show() {
		if (this.isDisposed) return;

		this.updateFields({
			visible: true,
			searchQuery: '',
			selectedIndex: 0
		});
		
		this.clearError();
		
		// Trigger search to refresh filtered commands
		this.updateSearchQuery('');
	}

	/**
	 * Hide the command menu
	 */
	hide() {
		if (this.isDisposed) return;

		this.updateField('visible', false);
	}

	/**
	 * Toggle menu visibility
	 */
	toggle() {
		if (this.isDisposed) return;

		if (this.state.visible) {
			this.hide();
		} else {
			this.show();
		}
	}

	// ========================================
	// Command Management
	// ========================================

	/**
	 * Set commands and update cache
	 * @param {Array} commands - Array of command objects
	 */
	setCommands(commands) {
		if (this.isDisposed) return;

		const validCommands = Array.isArray(commands) ? commands : [];
		this.updateField('commands', validCommands);
		
		// Update filtered commands if no search query
		if (!this.state.searchQuery) {
			this.updateField('filteredCommands', validCommands);
		} else {
			// Re-run search with current query
			this.updateSearchQuery(this.state.searchQuery);
		}
		
		// Save to cache if enabled
		if (this.state.cacheEnabled) {
			this.saveToCache();
		}
	}

	/**
	 * Add a single command
	 * @param {Object} command - Command object
	 */
	addCommand(command) {
		if (this.isDisposed || !command) return;

		// Register with service
		this.services.commandService.registerCommand(command);
		
		// Add to local commands
		const currentCommands = this.state.commands || [];
		const updatedCommands = [...currentCommands, command];
		this.setCommands(updatedCommands);
	}

	/**
	 * Remove a command by name
	 * @param {string} commandName - Name of command to remove
	 */
	removeCommand(commandName) {
		if (this.isDisposed || !commandName) return;

		// Unregister from service
		this.services.commandService.unregisterCommand(commandName);
		
		// Remove from local commands
		const currentCommands = this.state.commands || [];
		const updatedCommands = currentCommands.filter(cmd => cmd.name !== commandName);
		this.setCommands(updatedCommands);
	}

	/**
	 * Clear all commands
	 */
	clearCommands() {
		if (this.isDisposed) return;

		this.updateFields({
			commands: [],
			filteredCommands: [],
			selectedIndex: 0
		});
	}

	// ========================================
	// Cache Management
	// ========================================

	/**
	 * Load commands from cache
	 */
	async loadFromCache() {
		if (this.isDisposed || !this.state.cacheEnabled) return;

		try {
			const sessionId = this.state.sessionId || 'default';
			const cachedCommands = this.services.commandService.loadCache(sessionId);
			
			if (Array.isArray(cachedCommands) && cachedCommands.length > 0) {
				this.updateField('commands', cachedCommands);
				
				// Update filtered commands if no search query
				if (!this.state.searchQuery) {
					this.updateField('filteredCommands', cachedCommands);
				}
			}
		} catch (error) {
			console.warn('Failed to load command cache:', error);
		}
	}

	/**
	 * Save commands to cache
	 */
	async saveToCache() {
		if (this.isDisposed || !this.state.cacheEnabled) return;

		try {
			const sessionId = this.state.sessionId || 'default';
			const commands = this.state.commands || [];
			this.services.commandService.saveCache(sessionId, commands);
		} catch (error) {
			console.warn('Failed to save command cache:', error);
		}
	}

	/**
	 * Clear command cache
	 */
	async clearCache() {
		if (this.isDisposed) return;

		try {
			const sessionId = this.state.sessionId || 'default';
			this.services.commandService.clearCache(sessionId);
			
			// Clear local commands as well
			this.clearCommands();
		} catch (error) {
			console.warn('Failed to clear command cache:', error);
		}
	}

	// ========================================
	// Keyboard Event Handling
	// ========================================

	/**
	 * Handle keyboard events for navigation
	 * @param {KeyboardEvent} event - Keyboard event
	 */
	handleKeyboardEvent(event) {
		if (this.isDisposed || !this.state.visible) return false;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				this.selectNext();
				return true;
				
			case 'ArrowUp':
				event.preventDefault();
				this.selectPrevious();
				return true;
				
			case 'Enter':
				event.preventDefault();
				this.executeSelected();
				return true;
				
			case 'Escape':
				event.preventDefault();
				this.hide();
				return true;
				
			default:
				return false;
		}
	}

	/**
	 * Handle global keyboard shortcuts
	 * @param {KeyboardEvent} event - Keyboard event
	 */
	handleGlobalShortcut(event) {
		if (this.isDisposed) return false;

		// Global shortcut: Ctrl+K or Cmd+K
		if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();
			this.show();
			return true;
		}

		return false;
	}

	// ========================================
	// State Validation and Effects
	// ========================================

	/**
	 * Setup reactive effects for command menu
	 * @protected
	 */
	_setupEffects() {
		super._setupEffects();

		// Effect for handling filtered command changes
		$effect(() => {
			if (this.isDisposed) return;
			
			// When filtered commands change, ensure selected index is valid
			const commandCount = this.commandCount;
			const selectedIndex = this.state.selectedIndex;
			
			if (selectedIndex >= commandCount && commandCount > 0) {
				this.updateField('selectedIndex', 0);
			} else if (commandCount === 0) {
				this.updateField('selectedIndex', 0);
			}
		});

		// Effect for auto-saving cache when commands change
		$effect(() => {
			if (this.isDisposed || !this.state.cacheEnabled) return;
			
			// Track commands changes
			this.state.commands;
			
			// Debounced cache save
			const timeoutId = setTimeout(() => {
				this.saveToCache();
			}, 1000);
			
			// Cleanup function
			this.addCleanup(() => clearTimeout(timeoutId));
		});
	}

	/**
	 * Validate command menu state
	 * @returns {boolean} - True if state is valid
	 */
	validateState() {
		if (this.isDisposed) return false;

		const state = this.state;
		
		// Validate basic state structure
		if (typeof state.visible !== 'boolean') {
			this.setValidationError('visible', 'visible must be a boolean');
			return false;
		}
		
		if (typeof state.searchQuery !== 'string') {
			this.setValidationError('searchQuery', 'searchQuery must be a string');
			return false;
		}
		
		if (!Number.isInteger(state.selectedIndex) || state.selectedIndex < 0) {
			this.setValidationError('selectedIndex', 'selectedIndex must be a non-negative integer');
			return false;
		}
		
		if (!Array.isArray(state.commands)) {
			this.setValidationError('commands', 'commands must be an array');
			return false;
		}
		
		if (!Array.isArray(state.filteredCommands)) {
			this.setValidationError('filteredCommands', 'filteredCommands must be an array');
			return false;
		}

		return true;
	}

	// ========================================
	// Disposal and Cleanup
	// ========================================

	/**
	 * Dispose ViewModel and clean up resources
	 */
	dispose() {
		if (this.isDisposed) return;

		// Save cache before disposal if needed
		if (this.state.cacheEnabled) {
			this.saveToCache();
		}

		// Call parent disposal
		super.dispose();
	}
}