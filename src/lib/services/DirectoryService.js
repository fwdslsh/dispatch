/**
 * DirectoryService - Service for directory navigation and file system operations
 * Handles directory listing, path validation, and navigation logic
 * Integrates with Socket.IO for real-time directory operations
 */
export class DirectoryService {
	constructor(options = {}) {
		this.options = {
			maxPathLength: 1024,
			allowedExtensions: null, // null means all extensions allowed
			restrictToProject: true,
			cacheTimeout: 30 * 1000, // 30 seconds
			maxCacheSize: 100,
			...options
		};

		this.cache = new Map();
		this.isDisposed = false;
		this.cleanupCallbacks = [];
	}

	// ========================================
	// Directory Listing Operations
	// ========================================

	/**
	 * List directories at specified path via Socket.IO
	 * @param {Object} params - Parameters for directory listing
	 * @param {string} params.projectId - Project identifier
	 * @param {string} params.relativePath - Relative path within project
	 * @param {string} [params.socketId] - Socket identifier for communication
	 * @returns {Promise<Object>} - Directory listing result
	 */
	async listDirectories(params) {
		if (this.isDisposed) {
			throw new Error('DirectoryService has been disposed');
		}

		const { projectId, relativePath = '', socketId } = params;

		if (!projectId) {
			throw new Error('Project ID is required for directory listing');
		}

		// Check cache first
		const cacheKey = `${projectId}:${relativePath}`;
		const cached = this._getCachedResult(cacheKey);
		if (cached) {
			return cached;
		}

		try {
			// Validate path before making request
			const pathValidation = this.validatePath(relativePath);
			if (!pathValidation.isValid) {
				return {
					success: false,
					error: pathValidation.error || 'Invalid path'
				};
			}

			const result = await this._makeSocketRequest('list-project-directories', {
				projectId,
				relativePath,
				options: {
					includeHidden: false,
					sortBy: 'name',
					sortOrder: 'asc'
				}
			}, socketId);

			// Normalize and validate result
			const normalizedResult = this._normalizeDirectoryResult(result);
			
			// Cache successful results
			if (normalizedResult.success) {
				this._setCachedResult(cacheKey, normalizedResult);
			}

			return normalizedResult;

		} catch (error) {
			console.error('Directory listing failed:', error);
			return {
				success: false,
				error: error.message || 'Failed to load directories',
				directories: []
			};
		}
	}

	/**
	 * Normalize directory listing result
	 * @param {Object} result - Raw result from socket
	 * @returns {Object} - Normalized result
	 * @private
	 */
	_normalizeDirectoryResult(result) {
		if (!result || typeof result !== 'object') {
			return {
				success: false,
				error: 'Invalid response from directory service',
				directories: []
			};
		}

		const directories = Array.isArray(result.directories) ? result.directories : [];
		
		// Normalize directory entries
		const normalizedDirectories = directories
			.filter(dir => dir && typeof dir.name === 'string')
			.map(dir => ({
				name: dir.name,
				type: dir.type || 'directory',
				path: dir.path || dir.name,
				size: dir.size || 0,
				modified: dir.modified || null,
				permissions: dir.permissions || 'readable'
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		return {
			success: result.success !== false,
			directories: normalizedDirectories,
			error: result.error || null,
			totalCount: normalizedDirectories.length,
			path: result.path || ''
		};
	}

	/**
	 * Make Socket.IO request with timeout and error handling
	 * @param {string} event - Socket event name
	 * @param {Object} data - Request data
	 * @param {string} [socketId] - Optional socket identifier
	 * @returns {Promise<Object>} - Socket response
	 * @private
	 */
	async _makeSocketRequest(event, data, socketId = null) {
		// This would be injected or configured based on the actual socket implementation
		// For now, we'll simulate the socket behavior
		if (!this.socket && !socketId) {
			throw new Error('No socket connection available');
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Request timeout'));
			}, 10000); // 10 second timeout

			// Simulate socket emit call
			const socket = this.socket || { emit: () => {} };
			
			try {
				socket.emit(event, data, (response) => {
					clearTimeout(timeout);
					resolve(response);
				});
			} catch (error) {
				clearTimeout(timeout);
				reject(error);
			}
		});
	}

	// ========================================
	// Path Operations and Validation
	// ========================================

	/**
	 * Validate directory path for security and format
	 * @param {string} path - Path to validate
	 * @returns {Object} - Validation result
	 */
	validatePath(path) {
		if (typeof path !== 'string') {
			return {
				isValid: false,
				error: 'Path must be a string'
			};
		}

		// Basic path validation
		if (path.length > this.options.maxPathLength) {
			return {
				isValid: false,
				error: `Path too long (max ${this.options.maxPathLength} characters)`
			};
		}

		// Check for dangerous path patterns
		const dangerousPatterns = [
			/\.\./,           // Parent directory traversal
			/\/\.\./,         // Parent directory traversal
			/^\/+/,           // Absolute paths
			/[<>:"|?*]/,      // Invalid filename characters
			/\0/              // Null bytes
		];

		for (const pattern of dangerousPatterns) {
			if (pattern.test(path)) {
				return {
					isValid: false,
					error: 'Path contains invalid or dangerous characters'
				};
			}
		}

		// Normalize path
		const normalizedPath = this._normalizePath(path);

		return {
			isValid: true,
			normalizedPath,
			originalPath: path
		};
	}

	/**
	 * Normalize path by removing redundant separators and empty segments
	 * @param {string} path - Path to normalize
	 * @returns {string} - Normalized path
	 * @private
	 */
	_normalizePath(path) {
		if (!path) return '';
		
		return path
			.split('/')
			.filter(segment => segment && segment !== '.')
			.join('/');
	}

	/**
	 * Resolve relative path against base path
	 * @param {string} basePath - Base directory path
	 * @param {string} relativePath - Relative path to resolve
	 * @returns {string} - Resolved absolute path
	 */
	resolvePath(basePath, relativePath) {
		if (!basePath) basePath = '';
		if (!relativePath) return basePath;

		// Handle absolute-style relative paths
		if (relativePath.startsWith('/')) {
			return this._normalizePath(relativePath.substring(1));
		}

		// Resolve relative segments
		const baseSegments = basePath.split('/').filter(Boolean);
		const relativeSegments = relativePath.split('/').filter(Boolean);

		const resolvedSegments = [...baseSegments];

		for (const segment of relativeSegments) {
			if (segment === '..') {
				if (resolvedSegments.length > 0) {
					resolvedSegments.pop();
				}
			} else if (segment !== '.') {
				resolvedSegments.push(segment);
			}
		}

		return resolvedSegments.join('/');
	}

	/**
	 * Get parent directory path
	 * @param {string} path - Current path
	 * @returns {string} - Parent path
	 */
	getParentPath(path) {
		if (!path) return '';
		
		const segments = path.split('/').filter(Boolean);
		if (segments.length <= 1) return '';
		
		return segments.slice(0, -1).join('/');
	}

	/**
	 * Generate breadcrumb navigation array
	 * @param {string} path - Current path
	 * @returns {Array<string>} - Breadcrumb segments
	 */
	generateBreadcrumbs(path) {
		if (!path) return ['/'];
		
		const segments = path.split('/').filter(Boolean);
		return ['/', ...segments];
	}

	/**
	 * Join path segments safely
	 * @param {...string} segments - Path segments to join
	 * @returns {string} - Joined path
	 */
	joinPath(...segments) {
		return segments
			.filter(segment => segment)
			.map(segment => String(segment))
			.join('/')
			.replace(/\/+/g, '/'); // Remove duplicate slashes
	}

	// ========================================
	// Cache Management
	// ========================================

	/**
	 * Get cached directory result
	 * @param {string} key - Cache key
	 * @returns {Object|null} - Cached result or null
	 * @private
	 */
	_getCachedResult(key) {
		const cached = this.cache.get(key);
		if (!cached) return null;

		// Check if cache entry has expired
		if (Date.now() - cached.timestamp > this.options.cacheTimeout) {
			this.cache.delete(key);
			return null;
		}

		return cached.data;
	}

	/**
	 * Set cached directory result
	 * @param {string} key - Cache key
	 * @param {Object} data - Data to cache
	 * @private
	 */
	_setCachedResult(key, data) {
		// Limit cache size
		if (this.cache.size >= this.options.maxCacheSize) {
			// Remove oldest entry
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			data,
			timestamp: Date.now()
		});
	}

	/**
	 * Clear directory cache
	 * @param {string} [pattern] - Optional pattern to match keys for selective clearing
	 */
	clearCache(pattern = null) {
		if (!pattern) {
			this.cache.clear();
			return;
		}

		const regex = new RegExp(pattern);
		for (const [key] of this.cache.entries()) {
			if (regex.test(key)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Get cache statistics
	 * @returns {Object} - Cache statistics
	 */
	getCacheStats() {
		return {
			size: this.cache.size,
			maxSize: this.options.maxCacheSize,
			timeout: this.options.cacheTimeout,
			entries: Array.from(this.cache.keys())
		};
	}

	// ========================================
	// Configuration and Setup
	// ========================================

	/**
	 * Set socket instance for directory operations
	 * @param {Object} socket - Socket.IO instance
	 */
	setSocket(socket) {
		this.socket = socket;
	}

	/**
	 * Update service options
	 * @param {Object} newOptions - New option values
	 */
	updateOptions(newOptions) {
		if (this.isDisposed) return;
		
		this.options = {
			...this.options,
			...newOptions
		};

		// Clear cache if cache timeout changed
		if (newOptions.cacheTimeout !== undefined) {
			this.clearCache();
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
				console.error('Directory service cleanup callback failed:', error);
			}
		});
		this.cleanupCallbacks = [];

		// Clear cache and references
		this.clearCache();
		this.socket = null;
		this.options = null;
	}
}