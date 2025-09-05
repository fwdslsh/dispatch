/**
 * DirectoryPickerViewModel - ViewModel for directory picker functionality
 * Extends BaseViewModel with file system navigation, path resolution, and selection state management
 * Uses Svelte 5 runes for reactive state management
 */
import { BaseViewModel } from '../contexts/BaseViewModel.svelte.js';

export class DirectoryPickerViewModel extends BaseViewModel {
	constructor(model, services = {}) {
		super(model, services);

		// Ensure we have a directory service
		if (!services.directoryService) {
			throw new Error('DirectoryService is required for DirectoryPickerViewModel');
		}

		// Initialize derived state for directory picker specific functionality
		this.hasDirectories = $derived(this.state.directories?.length > 0);
		this.directoryCount = $derived(this.state.directories?.length || 0);
		this.canGoBack = $derived(this.state.pathHistory?.length > 0);
		this.isAtRoot = $derived(!this.state.currentPath);
		this.isPickerOpen = $derived(this.state.isOpen);
		this.currentDirectory = $derived(this.state.currentPath || '/');
		this.hasSelection = $derived(!!this.state.selectedPath);

		// Set up reactive effects
		this._setupEffects();

		// Initialize breadcrumbs on construction
		this._updateBreadcrumbs();
	}

	// ========================================
	// Directory Loading Operations
	// ========================================

	/**
	 * Load directories for specified path
	 * @param {string} relativePath - Relative path to load
	 */
	async loadDirectories(relativePath = '') {
		if (this.isDisposed) return;

		return this.withLoading(async () => {
			try {
				this.clearError();

				// Check if we have required context
				if (!this.state.projectId) {
					throw new Error('Project ID is required for directory loading');
				}

				const result = await this.services.directoryService.listDirectories({
					projectId: this.state.projectId,
					relativePath,
					socketId: this.state.socketId
				});

				if (result.success) {
					this.updateFields({
						directories: result.directories || [],
						currentPath: relativePath,
						error: null
					});

					// Update breadcrumbs after path change
					this._updateBreadcrumbs();
				} else {
					throw new Error(result.error || 'Failed to load directories');
				}

			} catch (error) {
				console.error('Directory loading failed:', error);
				this.setError(error);
				this.updateFields({
					directories: [],
					currentPath: relativePath
				});
			}
		});
	}

	/**
	 * Reload current directory
	 */
	async reloadCurrentDirectory() {
		if (this.isDisposed) return;
		await this.loadDirectories(this.state.currentPath);
	}

	// ========================================
	// Path Navigation
	// ========================================

	/**
	 * Navigate to a subdirectory
	 * @param {string} dirName - Directory name to navigate to
	 */
	async navigateToDirectory(dirName) {
		if (this.isDisposed || !dirName) return;

		// Build new path
		const newPath = this.services.directoryService.joinPath(
			this.state.currentPath,
			dirName
		);

		// Add current path to history before navigating
		this._addToHistory(this.state.currentPath);

		// Load the new directory
		await this.loadDirectories(newPath);
	}

	/**
	 * Navigate back to previous directory in history
	 */
	async goBack() {
		if (this.isDisposed || !this.canGoBack) return;

		const previousPath = this.state.pathHistory.pop();
		this.updateField('pathHistory', [...this.state.pathHistory]);

		await this.loadDirectories(previousPath);
	}

	/**
	 * Navigate to parent directory
	 */
	async navigateToParent() {
		if (this.isDisposed || this.isAtRoot) return;

		const parentPath = this.services.directoryService.getParentPath(this.state.currentPath);
		this._addToHistory(this.state.currentPath);
		
		await this.loadDirectories(parentPath);
	}

	/**
	 * Navigate to breadcrumb path
	 * @param {number} breadcrumbIndex - Index of breadcrumb to navigate to
	 */
	async navigateToBreadcrumb(breadcrumbIndex) {
		if (this.isDisposed || !this.state.breadcrumbs) return;

		const breadcrumbs = this.state.breadcrumbs;
		if (breadcrumbIndex < 0 || breadcrumbIndex >= breadcrumbs.length) return;

		// Build path from breadcrumbs
		let newPath = '';
		if (breadcrumbIndex > 0) {
			newPath = breadcrumbs.slice(1, breadcrumbIndex + 1).join('/');
		}

		// Add current path to history
		this._addToHistory(this.state.currentPath);

		await this.loadDirectories(newPath);
	}

	/**
	 * Navigate to root directory
	 */
	async navigateToRoot() {
		if (this.isDisposed) return;

		this._addToHistory(this.state.currentPath);
		await this.loadDirectories('');
	}

	// ========================================
	// Directory Selection
	// ========================================

	/**
	 * Select the current directory
	 * @param {Function} [onSelect] - Optional callback for selection event
	 */
	selectCurrentDirectory(onSelect = null) {
		if (this.isDisposed) return;

		const selectedPath = this.state.currentPath;
		this.updateFields({
			selectedPath,
			isOpen: false
		});

		// Trigger callback if provided
		if (typeof onSelect === 'function') {
			onSelect({ detail: { path: selectedPath } });
		}
	}

	/**
	 * Select a specific directory by name
	 * @param {string} dirName - Directory name to select
	 * @param {Function} [onSelect] - Optional callback for selection event
	 */
	selectDirectory(dirName, onSelect = null) {
		if (this.isDisposed || !dirName) return;

		const fullPath = this.services.directoryService.joinPath(
			this.state.currentPath,
			dirName
		);

		this.updateFields({
			selectedPath: fullPath,
			isOpen: false
		});

		// Trigger callback if provided
		if (typeof onSelect === 'function') {
			onSelect({ detail: { path: fullPath } });
		}
	}

	/**
	 * Clear directory selection
	 * @param {Function} [onSelect] - Optional callback for selection event
	 */
	clearSelection(onSelect = null) {
		if (this.isDisposed) return;

		this.updateFields({
			selectedPath: '',
			isOpen: false
		});

		// Trigger callback if provided
		if (typeof onSelect === 'function') {
			onSelect({ detail: { path: '' } });
		}
	}

	/**
	 * Set selected path directly
	 * @param {string} path - Path to set as selected
	 */
	setSelectedPath(path) {
		if (this.isDisposed) return;

		this.updateField('selectedPath', path || '');
	}

	// ========================================
	// Picker Visibility Management
	// ========================================

	/**
	 * Toggle picker open/closed state
	 */
	async togglePicker() {
		if (this.isDisposed) return;

		if (this.state.disabled) return;

		if (this.state.isOpen) {
			this.closePicker();
		} else {
			await this.openPicker();
		}
	}

	/**
	 * Open the directory picker
	 */
	async openPicker() {
		if (this.isDisposed || this.state.disabled) return;

		this.updateField('isOpen', true);
		
		// Load directories if needed
		if (!this.hasDirectories || this.state.currentPath !== '') {
			await this.loadDirectories('');
		}
	}

	/**
	 * Close the directory picker
	 */
	closePicker() {
		if (this.isDisposed) return;

		this.updateField('isOpen', false);
	}

	// ========================================
	// Path Validation and Resolution
	// ========================================

	/**
	 * Validate a directory path
	 * @param {string} path - Path to validate
	 * @returns {Promise<Object>} - Validation result
	 */
	async validatePath(path) {
		if (this.isDisposed) return { isValid: false, error: 'ViewModel disposed' };

		try {
			return this.services.directoryService.validatePath(path);
		} catch (error) {
			console.error('Path validation failed:', error);
			return {
				isValid: false,
				error: error.message || 'Path validation failed'
			};
		}
	}

	/**
	 * Resolve relative path against current path
	 * @param {string} relativePath - Relative path to resolve
	 * @returns {string} - Resolved path
	 */
	resolvePath(relativePath) {
		if (this.isDisposed) return '';

		return this.services.directoryService.resolvePath(
			this.state.currentPath,
			relativePath
		);
	}

	/**
	 * Get parent path of current directory
	 * @returns {string} - Parent path
	 */
	getParentPath() {
		if (this.isDisposed) return '';

		return this.services.directoryService.getParentPath(this.state.currentPath);
	}

	// ========================================
	// History Management
	// ========================================

	/**
	 * Add path to navigation history
	 * @param {string} path - Path to add to history
	 * @private
	 */
	_addToHistory(path) {
		if (!path && path !== '') return; // Don't add null/undefined
		
		const history = [...(this.state.pathHistory || [])];
		
		// Avoid duplicate consecutive entries
		if (history[history.length - 1] !== path) {
			history.push(path);
		}

		// Limit history size to prevent memory issues
		const maxHistorySize = 10;
		if (history.length > maxHistorySize) {
			history.splice(0, history.length - maxHistorySize);
		}

		this.updateField('pathHistory', history);
	}

	/**
	 * Clear navigation history
	 */
	clearHistory() {
		if (this.isDisposed) return;

		this.updateField('pathHistory', []);
	}

	/**
	 * Get navigation history
	 * @returns {Array<string>} - History of paths
	 */
	getHistory() {
		return [...(this.state.pathHistory || [])];
	}

	// ========================================
	// Breadcrumb Management
	// ========================================

	/**
	 * Update breadcrumbs based on current path
	 * @private
	 */
	_updateBreadcrumbs() {
		if (this.isDisposed) return;

		const breadcrumbs = this.services.directoryService.generateBreadcrumbs(
			this.state.currentPath
		);
		
		this.updateField('breadcrumbs', breadcrumbs);
	}

	/**
	 * Get current breadcrumbs
	 * @returns {Array<string>} - Breadcrumb segments
	 */
	getBreadcrumbs() {
		return [...(this.state.breadcrumbs || [])];
	}

	// ========================================
	// State Validation and Effects
	// ========================================

	/**
	 * Setup reactive effects for directory picker
	 * @protected
	 */
	_setupEffects() {
		super._setupEffects();

		// Effect for handling current path changes
		$effect(() => {
			if (this.isDisposed) return;
			
			// Track current path changes
			this.state.currentPath;
			
			// Update breadcrumbs when path changes
			this._updateBreadcrumbs();
		});

		// Effect for handling directory service availability
		$effect(() => {
			if (this.isDisposed) return;

			// Ensure directory service is available
			if (!this.services.directoryService) {
				this.setError('Directory service not available');
			} else {
				// Set up service with socket if available
				if (this.state.socketId && this.services.directoryService.setSocket) {
					// This would be handled by the parent component/context
				}
			}
		});
	}

	/**
	 * Validate directory picker state
	 * @returns {boolean} - True if state is valid
	 */
	validateState() {
		if (this.isDisposed) return false;

		const state = this.state;
		
		// Validate basic state structure
		if (typeof state.isOpen !== 'boolean') {
			this.setValidationError('isOpen', 'isOpen must be a boolean');
			return false;
		}
		
		if (typeof state.currentPath !== 'string') {
			this.setValidationError('currentPath', 'currentPath must be a string');
			return false;
		}
		
		if (typeof state.selectedPath !== 'string') {
			this.setValidationError('selectedPath', 'selectedPath must be a string');
			return false;
		}
		
		if (!Array.isArray(state.directories)) {
			this.setValidationError('directories', 'directories must be an array');
			return false;
		}
		
		if (!Array.isArray(state.pathHistory)) {
			this.setValidationError('pathHistory', 'pathHistory must be an array');
			return false;
		}
		
		if (!Array.isArray(state.breadcrumbs)) {
			this.setValidationError('breadcrumbs', 'breadcrumbs must be an array');
			return false;
		}

		return true;
	}

	// ========================================
	// Utility Methods
	// ========================================

	/**
	 * Get directory by name from current listing
	 * @param {string} name - Directory name
	 * @returns {Object|null} - Directory object or null
	 */
	getDirectoryByName(name) {
		if (this.isDisposed || !name) return null;

		return this.state.directories.find(dir => dir.name === name) || null;
	}

	/**
	 * Check if directory exists in current listing
	 * @param {string} name - Directory name
	 * @returns {boolean} - True if directory exists
	 */
	hasDirectory(name) {
		return !!this.getDirectoryByName(name);
	}

	/**
	 * Filter directories by name pattern
	 * @param {string|RegExp} pattern - Pattern to match against
	 * @returns {Array} - Filtered directory list
	 */
	filterDirectories(pattern) {
		if (this.isDisposed) return [];

		const regex = typeof pattern === 'string' 
			? new RegExp(pattern, 'i') 
			: pattern;

		return this.state.directories.filter(dir => 
			regex.test(dir.name)
		);
	}

	// ========================================
	// Configuration
	// ========================================

	/**
	 * Set project context for directory operations
	 * @param {string} projectId - Project identifier
	 * @param {string} [socketId] - Socket identifier
	 */
	setProjectContext(projectId, socketId = null) {
		if (this.isDisposed) return;

		this.updateFields({
			projectId,
			socketId: socketId || this.state.socketId
		});

		// Clear cache when project context changes
		if (this.services.directoryService.clearCache) {
			this.services.directoryService.clearCache();
		}
	}

	/**
	 * Set disabled state
	 * @param {boolean} disabled - Whether picker should be disabled
	 */
	setDisabled(disabled) {
		if (this.isDisposed) return;

		this.updateField('disabled', !!disabled);
		
		// Close picker if being disabled
		if (disabled && this.state.isOpen) {
			this.closePicker();
		}
	}

	// ========================================
	// Disposal and Cleanup
	// ========================================

	/**
	 * Dispose ViewModel and clean up resources
	 */
	dispose() {
		if (this.isDisposed) return;

		// Clear any pending operations
		this.clearHistory();

		// Call parent disposal
		super.dispose();
	}
}