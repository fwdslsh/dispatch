import { getAuthHeaders } from '$lib/shared/api-helpers.js';
import { SvelteURLSearchParams } from 'svelte/reactivity';

/**
 * DirectoryBrowserViewModel
 *
 * Model-View-ViewModel (MVVM) ViewModel for DirectoryBrowser component.
 * Manages all business logic, state, and API interactions for directory browsing.
 *
 * Uses Svelte 5 runes ($state, $derived) for reactive state management.
 */
export class DirectoryBrowserViewModel {
	// Core state
	currentPath = $state(null);
	loading = $state(false);
	error = $state('');
	entries = $state([]);
	breadcrumbs = $state([]);

	// Search and filtering
	query = $state('');
	showHidden = $state(false);

	// New directory state
	showNewDirInput = $state(false);
	newDirName = $state('');
	creatingDir = $state(false);

	// Clone directory state
	showCloneDirInput = $state(false);
	cloneSourcePath = $state('');
	cloneTargetPath = $state('');
	cloningDir = $state(false);
	cloneOverwrite = $state(false);

	// File upload state
	uploadFiles = $state(null);
	uploading = $state(false);

	// UI state
	triedFallback = $state(false);

	// Configuration (set via constructor)
	api = '/api/browse';
	rootFolder = '/';
	isInRoot = $derived.by(() => this.currentPath === this.rootFolder);

	/**
	 * Filtered entries based on search query
	 */
	filtered = $derived.by(() => {
		const q = this.query.trim().toLowerCase();
		return !q ? this.entries : this.entries.filter((e) => e.name.toLowerCase().includes(q));
	});

	/**
	 * Check if current path is at root boundary
	 */
	isAtRoot = $derived.by(() => {
		const normalizedRoot = this.rootFolder.endsWith('/')
			? this.rootFolder.slice(0, -1)
			: this.rootFolder;
		const normalizedPath = this.currentPath === '/' ? '/' : this.currentPath;
		return normalizedPath === normalizedRoot;
	});

	constructor(options = {}) {
		this.api = options.api || '/api/browse';
		this.rootFolder = options.rootFolder || '/';
		this.currentPath = options.startPath || null;
		this.showHidden = options.showHidden || false;
	}

	/**
	 * Parse path into breadcrumbs for navigation
	 * @param {string} path - Directory path to parse
	 */
	updateBreadcrumbs(path) {
		const normalizedRoot = this.rootFolder.endsWith('/')
			? this.rootFolder.slice(0, -1)
			: this.rootFolder;
		const parts = path.split('/').filter(Boolean);

		// Start breadcrumbs from the root folder
		if (normalizedRoot === '/') {
			this.breadcrumbs = [{ name: '/', path: '/' }];
		} else {
			// If we have a custom root folder, start from there
			const rootParts = normalizedRoot.split('/').filter(Boolean);
			this.breadcrumbs = [
				{
					name: rootParts[rootParts.length - 1] || '/',
					path: normalizedRoot
				}
			];
		}

		// Add breadcrumbs for parts beyond the root folder
		let accumulated = normalizedRoot === '/' ? '' : normalizedRoot;
		for (const part of parts) {
			// Skip parts that are already included in the root folder
			const testPath = accumulated + '/' + part;
			if (testPath.length > normalizedRoot.length) {
				accumulated = testPath;
				this.breadcrumbs.push({ name: part, path: accumulated });
			} else if (accumulated === '' || testPath === normalizedRoot) {
				accumulated = testPath;
			}
		}
	}

	/**
	 * Browse a directory path
	 * @param {string|null} path - Path to browse (null uses server default)
	 * @returns {Promise<void>}
	 */
	async browse(path) {
		this.loading = true;
		this.error = '';
		try {
			// If path is null, don't send it as a param - let the server use its default
			const params = new SvelteURLSearchParams({ showHidden: this.showHidden.toString() });
			if (path !== null && path !== undefined) {
				params.set('path', path);
			}

			const res = await fetch(`${this.api}?${params}`, {
				headers: getAuthHeaders()
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `HTTP ${res.status}`);
			}
			const data = await res.json();
			this.currentPath = data.path || path;
			this.entries = data.entries || [];
			this.updateBreadcrumbs(this.currentPath);
		} catch (e) {
			this.error = e.message || String(e);
			this.entries = [];
			// If the preferred start path was invalid, gracefully fall back to default base
			if (path && !this.triedFallback) {
				this.triedFallback = true;
				await this.browse(null); // Use null to get server's default
				return;
			}
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Navigate to a directory path
	 * @param {string} path - Directory path to navigate to
	 * @param {Function} onNavigate - Optional callback for navigation events
	 */
	navigateTo(path, onNavigate = null) {
		// Check if the target path is within the rootFolder boundary
		const normalizedRoot = this.rootFolder.endsWith('/')
			? this.rootFolder.slice(0, -1)
			: this.rootFolder;
		const normalizedPath = path === '/' ? '/' : path;

		// Only navigate if the path is within the root folder
		if (
			normalizedPath.length >= normalizedRoot.length &&
			normalizedPath.startsWith(normalizedRoot)
		) {
			this.query = '';
			this.browse(path);
			onNavigate?.(path);
		}
	}

	/**
	 * Navigate to parent directory
	 * @param {Function} onNavigate - Optional callback for navigation events
	 */
	goUp(onNavigate = null) {
		const parent = this.currentPath.split('/').slice(0, -1).join('/') || '/';
		// Check if the parent directory is within the rootFolder boundary
		const normalizedRoot = this.rootFolder.endsWith('/')
			? this.rootFolder.slice(0, -1)
			: this.rootFolder;
		const normalizedParent = parent === '/' ? '/' : parent;

		// Only navigate up if the parent is not outside the root folder
		if (
			normalizedParent.length >= normalizedRoot.length &&
			normalizedParent.startsWith(normalizedRoot)
		) {
			this.navigateTo(parent, onNavigate);
		}
	}

	/**
	 * Toggle hidden files visibility
	 */
	toggleHidden() {
		this.showHidden = !this.showHidden;
		this.browse(this.currentPath);
	}

	/**
	 * Toggle new directory input form
	 */
	toggleNewDirInput() {
		this.showNewDirInput = !this.showNewDirInput;
		if (!this.showNewDirInput) {
			this.newDirName = '';
			this.error = '';
		}
	}

	/**
	 * Create a new directory
	 * @returns {Promise<string|null>} Path of created directory or null on error
	 */
	async createNewDirectory() {
		if (!this.newDirName.trim()) {
			this.error = 'Directory name cannot be empty';
			return null;
		}

		this.creatingDir = true;
		this.error = '';
		const dirName = this.newDirName.trim();

		try {
			// Properly join paths, handling the case where currentPath ends with /
			const dirPath = this.currentPath.endsWith('/')
				? this.currentPath + dirName
				: this.currentPath + '/' + dirName;
			const res = await fetch('/api/browse/create', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({ path: dirPath })
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to create directory');
			}

			// Refresh the directory listing
			await this.browse(this.currentPath);

			// Clear the input and hide the form
			this.newDirName = '';
			this.showNewDirInput = false;

			// Return the path of the created directory
			const newDir = this.entries.find((e) => e.name === dirName);
			return newDir ? newDir.path : null;
		} catch (e) {
			this.error = e.message || 'Failed to create directory';
			return null;
		} finally {
			this.creatingDir = false;
		}
	}

	/**
	 * Toggle clone directory input form
	 */
	toggleCloneDirInput() {
		this.showCloneDirInput = !this.showCloneDirInput;
		if (!this.showCloneDirInput) {
			this.cloneSourcePath = '';
			this.cloneTargetPath = '';
			this.cloneOverwrite = false;
			this.error = '';
		} else {
			// When opening, initialize with current path
			if (!this.currentPath) {
				this.error = 'Please select a valid directory first';
			} else {
				this.initCloneFromCurrent();
			}
		}
	}

	/**
	 * Initialize clone form with current directory
	 */
	initCloneFromCurrent() {
		if (!this.currentPath) {
			this.error = 'Please select a valid directory first';
			return;
		}

		this.cloneSourcePath = this.currentPath;
		const baseName = this.currentPath.split('/').pop() || 'directory';
		this.cloneTargetPath = this.currentPath.endsWith('/')
			? `${this.currentPath}${baseName}-clone`
			: `${this.currentPath}-clone`;
		this.showCloneDirInput = true;
	}

	/**
	 * Clone a directory
	 * @returns {Promise<string|null>} Path of cloned directory or null on error
	 */
	async cloneDirectory() {
		if (!this.cloneSourcePath.trim() || !this.cloneTargetPath.trim()) {
			this.error = 'Both source and target paths are required';
			return null;
		}

		this.cloningDir = true;
		this.error = '';

		try {
			const res = await fetch('/api/browse/clone', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					sourcePath: this.cloneSourcePath.trim(),
					targetPath: this.cloneTargetPath.trim(),
					overwrite: this.cloneOverwrite
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to clone directory');
			}

			// Refresh the directory listing
			await this.browse(this.currentPath);

			// Clear the form and hide it
			this.cloneSourcePath = '';
			this.cloneTargetPath = '';
			this.cloneOverwrite = false;
			this.showCloneDirInput = false;

			// Return the path of the cloned directory
			const result = await res.json();
			const targetBaseName = result.targetPath.split('/').pop();
			const newDir = this.entries.find((e) => e.name === targetBaseName);
			return newDir ? newDir.path : null;
		} catch (e) {
			this.error = e.message || 'Failed to clone directory';
			return null;
		} finally {
			this.cloningDir = false;
		}
	}

	handleGitError(err, status = null) {
		if (status !== 404) this.error = err;
	}

	/**
	 * Handle file upload
	 * @param {FileList} files - Files to upload
	 * @param {Function} onFileUpload - Upload handler function
	 * @returns {Promise<void>}
	 */
	async handleFileUpload(files, onFileUpload) {
		if (!files || files.length === 0 || !onFileUpload) return;

		this.uploading = true;
		this.error = '';

		try {
			await onFileUpload(files, this.currentPath);
			this.uploadFiles = null;
			// Refresh directory after upload
			await this.browse(this.currentPath);
		} catch (e) {
			this.error = e.message || 'Failed to upload files';
		} finally {
			this.uploading = false;
		}
	}
}
