/**
 * CommandService - Service for command registration, search, and execution
 * Handles command registry, search functionality, and execution patterns
 * Provides caching and categorization features
 */
export class CommandService {
	constructor(options = {}) {
		this.options = {
			cacheEnabled: true,
			cacheTimeout: 5 * 60 * 1000, // 5 minutes
			maxHistorySize: 100,
			searchOptions: {
				caseSensitive: false,
				fuzzyThreshold: 0.6,
				maxResults: 50
			},
			onExecute: null,
			...options
		};

		this.commands = [];
		this.executionHistory = [];
		this.isDisposed = false;
		this.cleanupCallbacks = [];
	}

	// ========================================
	// Command Registration
	// ========================================

	/**
	 * Register a command with the service
	 * @param {Object} command - Command object
	 * @param {string} command.name - Command name (required)
	 * @param {string} [command.description=''] - Command description
	 * @param {string} [command.category='General'] - Command category
	 * @param {string|Function} [command.action=null] - Command action
	 * @param {string} [command.shortcut=''] - Keyboard shortcut
	 */
	registerCommand(command) {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		this._validateCommand(command);

		// Normalize command object
		const normalizedCommand = {
			name: command.name,
			description: command.description || '',
			category: command.category || 'General',
			action: command.action || null,
			shortcut: command.shortcut || '',
			...command
		};

		// Check if command already exists and update it
		const existingIndex = this.commands.findIndex(cmd => cmd.name === command.name);
		if (existingIndex >= 0) {
			this.commands[existingIndex] = normalizedCommand;
		} else {
			this.commands.push(normalizedCommand);
		}

		// Sort commands by category then name for consistent ordering
		this.commands.sort((a, b) => {
			if (a.category !== b.category) {
				return a.category.localeCompare(b.category);
			}
			return a.name.localeCompare(b.name);
		});
	}

	/**
	 * Unregister a command by name
	 * @param {string} commandName - Name of command to remove
	 * @returns {boolean} - True if command was removed, false if not found
	 */
	unregisterCommand(commandName) {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		const initialLength = this.commands.length;
		this.commands = this.commands.filter(cmd => cmd.name !== commandName);
		
		return this.commands.length < initialLength;
	}

	/**
	 * Clear all registered commands
	 */
	clearCommands() {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		this.commands = [];
	}

	/**
	 * Get all registered commands
	 * @returns {Array} - Array of command objects
	 */
	getCommands() {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		return [...this.commands];
	}

	// ========================================
	// Command Search
	// ========================================

	/**
	 * Search commands based on query
	 * @param {string} query - Search query
	 * @param {Array} [commandList] - Optional specific command list to search
	 * @returns {Array} - Array of matching commands sorted by relevance
	 */
	searchCommands(query, commandList = null) {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		const searchList = commandList || this.commands;
		const normalizedQuery = query?.toString().trim() || '';

		// Return all commands if query is empty
		if (!normalizedQuery) {
			return [...searchList];
		}

		// Filter and score commands
		const results = searchList
			.filter(cmd => this._isValidCommand(cmd))
			.map(cmd => ({
				command: cmd,
				score: this._calculateMatchScore(cmd, normalizedQuery)
			}))
			.filter(result => result.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, this.options.searchOptions.maxResults)
			.map(result => result.command);

		return results;
	}

	/**
	 * Calculate match score for a command against query
	 * @param {Object} command - Command object
	 * @param {string} query - Search query
	 * @returns {number} - Match score (higher is better)
	 * @private
	 */
	_calculateMatchScore(command, query) {
		const caseSensitive = this.options.searchOptions.caseSensitive;
		const normalize = caseSensitive ? (str) => str : (str) => str.toLowerCase();
		
		const normalizedQuery = normalize(query);
		const name = normalize(command.name || '');
		const description = normalize(command.description || '');
		const category = normalize(command.category || '');
		const shortcut = normalize(command.shortcut || '');

		let score = 0;

		// Exact name match gets highest score
		if (name === normalizedQuery) {
			score += 1000;
		}
		// Name starts with query
		else if (name.startsWith(normalizedQuery)) {
			score += 800;
		}
		// Name contains query
		else if (name.includes(normalizedQuery)) {
			score += 600;
		}
		// Fuzzy match in name
		else if (this._fuzzyMatch(name, normalizedQuery)) {
			score += 400;
		}

		// Description matches (lower score for case sensitive to prefer exact matches)
		if (description.includes(normalizedQuery)) {
			score += caseSensitive ? 150 : 300;
		}

		// Category matches
		if (category.includes(normalizedQuery)) {
			score += 200;
		}

		// Shortcut matches
		if (shortcut.includes(normalizedQuery)) {
			score += 150;
		}

		// Bonus for exact word matches
		const queryWords = normalizedQuery.split(/\s+/);
		const nameWords = name.split(/\s+/);
		const descWords = description.split(/\s+/);

		queryWords.forEach(queryWord => {
			if (nameWords.some(word => word === queryWord)) {
				score += 100;
			}
			if (descWords.some(word => word === queryWord)) {
				score += 50;
			}
		});

		// Bonus for multiple word matches
		const matchingWords = queryWords.filter(queryWord =>
			nameWords.some(word => word.includes(queryWord)) ||
			descWords.some(word => word.includes(queryWord))
		);
		
		if (matchingWords.length > 1) {
			score += matchingWords.length * 25;
		}

		return score;
	}

	/**
	 * Simple fuzzy matching algorithm
	 * @param {string} str - String to search in
	 * @param {string} query - Query to search for
	 * @returns {boolean} - True if fuzzy match found
	 * @private
	 */
	_fuzzyMatch(str, query) {
		if (!str || !query) return false;
		
		let strIndex = 0;
		let queryIndex = 0;
		let matches = 0;

		while (strIndex < str.length && queryIndex < query.length) {
			if (str[strIndex] === query[queryIndex]) {
				matches++;
				queryIndex++;
			}
			strIndex++;
		}

		const matchRatio = matches / query.length;
		return matchRatio >= this.options.searchOptions.fuzzyThreshold;
	}

	// ========================================
	// Command Execution
	// ========================================

	/**
	 * Execute a command
	 * @param {Object} command - Command to execute
	 * @returns {Promise} - Promise resolving to execution result
	 */
	async executeCommand(command) {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		if (!this._isValidCommand(command)) {
			throw new Error('Invalid command object');
		}

		try {
			// Record execution in history
			this._addToHistory(command);

			// Execute via callback if available
			if (this.options.onExecute) {
				return await this.options.onExecute(command);
			}

			// Default execution - just return the command action
			return command.action;

		} catch (error) {
			console.error('Command execution failed:', error);
			throw error;
		}
	}

	/**
	 * Execute a command by name
	 * @param {string} commandName - Name of command to execute
	 * @returns {Promise} - Promise resolving to execution result
	 */
	async executeCommandByName(commandName) {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		const command = this.commands.find(cmd => cmd.name === commandName);
		if (!command) {
			throw new Error(`Command not found: ${commandName}`);
		}

		return this.executeCommand(command);
	}

	/**
	 * Get command execution history
	 * @returns {Array} - Array of execution history entries
	 */
	getExecutionHistory() {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		return [...this.executionHistory];
	}

	/**
	 * Clear execution history
	 */
	clearHistory() {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		this.executionHistory = [];
	}

	/**
	 * Add command execution to history
	 * @param {Object} command - Command that was executed
	 * @private
	 */
	_addToHistory(command) {
		const entry = {
			command: command.name,
			timestamp: Date.now(),
			category: command.category
		};

		this.executionHistory.unshift(entry);

		// Limit history size
		if (this.executionHistory.length > this.options.maxHistorySize) {
			this.executionHistory = this.executionHistory.slice(0, this.options.maxHistorySize);
		}
	}

	// ========================================
	// Command Categories
	// ========================================

	/**
	 * Get all unique categories
	 * @returns {Array} - Array of category names
	 */
	getCategories() {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		const categories = [...new Set(this.commands.map(cmd => cmd.category || 'General'))];
		return categories.sort();
	}

	/**
	 * Get commands by category
	 * @param {string} category - Category name
	 * @returns {Array} - Array of commands in the category
	 */
	getCommandsByCategory(category) {
		if (this.isDisposed) {
			throw new Error('CommandService has been disposed');
		}

		return this.commands.filter(cmd => cmd.category === category);
	}

	// ========================================
	// Cache Management
	// ========================================

	/**
	 * Save commands to cache
	 * @param {string} sessionId - Session identifier
	 * @param {Array} commands - Commands to cache
	 */
	saveCache(sessionId, commands) {
		if (this.isDisposed || !this.options.cacheEnabled) {
			return;
		}

		if (typeof localStorage === 'undefined') {
			return;
		}

		try {
			const cacheKey = `command-cache-${sessionId}`;
			const cacheData = {
				commands: Array.isArray(commands) ? commands : [],
				timestamp: Date.now()
			};

			localStorage.setItem(cacheKey, JSON.stringify(cacheData));
		} catch (error) {
			console.warn('Failed to save command cache:', error);
		}
	}

	/**
	 * Load commands from cache
	 * @param {string} sessionId - Session identifier
	 * @returns {Array} - Cached commands or empty array
	 */
	loadCache(sessionId) {
		if (this.isDisposed || !this.options.cacheEnabled) {
			return [];
		}

		if (typeof localStorage === 'undefined') {
			return [];
		}

		try {
			const cacheKey = `command-cache-${sessionId}`;
			const cachedData = localStorage.getItem(cacheKey);

			if (!cachedData) {
				return [];
			}

			const parsed = JSON.parse(cachedData);
			
			// Check if cache is still valid (not expired)
			const isExpired = Date.now() - parsed.timestamp > this.options.cacheTimeout;
			if (isExpired) {
				this.clearCache(sessionId);
				return [];
			}

			return Array.isArray(parsed.commands) ? parsed.commands : [];

		} catch (error) {
			console.warn('Failed to load command cache:', error);
			return [];
		}
	}

	/**
	 * Clear command cache
	 * @param {string} sessionId - Session identifier
	 */
	clearCache(sessionId) {
		if (this.isDisposed || !this.options.cacheEnabled) {
			return;
		}

		if (typeof localStorage === 'undefined') {
			return;
		}

		try {
			const cacheKey = `command-cache-${sessionId}`;
			localStorage.removeItem(cacheKey);
		} catch (error) {
			console.warn('Failed to clear command cache:', error);
		}
	}

	// ========================================
	// Validation and Utilities
	// ========================================

	/**
	 * Validate command object structure
	 * @param {Object} command - Command to validate
	 * @throws {Error} - If command is invalid
	 * @private
	 */
	_validateCommand(command) {
		if (!command || typeof command !== 'object') {
			throw new Error('Command must be an object');
		}

		if (!command.name) {
			throw new Error('Command must have a name');
		}

		if (typeof command.name !== 'string') {
			throw new Error('Command name must be a string');
		}

		if (!command.name.trim()) {
			throw new Error('Command name cannot be empty');
		}
	}

	/**
	 * Check if command object is valid for operations
	 * @param {Object} command - Command to check
	 * @returns {boolean} - True if valid
	 * @private
	 */
	_isValidCommand(command) {
		try {
			this._validateCommand(command);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Add cleanup callback
	 * @param {Function} callback - Cleanup function
	 */
	addCleanup(callback) {
		if (typeof callback === 'function') {
			this.cleanupCallbacks.push(callback);
		}
	}

	// ========================================
	// Service Disposal
	// ========================================

	/**
	 * Dispose service and clean up resources
	 */
	dispose() {
		if (this.isDisposed) return;

		this.isDisposed = true;

		// Run cleanup callbacks
		this.cleanupCallbacks.forEach((callback) => {
			try {
				callback();
			} catch (error) {
				console.error('Cleanup callback failed:', error);
			}
		});
		this.cleanupCallbacks = [];

		// Clear data
		this.commands = [];
		this.executionHistory = [];
		this.options = null;
	}
}