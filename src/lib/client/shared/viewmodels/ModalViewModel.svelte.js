/**
 * ModalViewModel.svelte.js
 *
 * ViewModel for modal state management using Svelte 5 runes.
 * Handles all modal-related state and business logic.
 */

/**
 * @typedef {Object} ModalState
 * @property {boolean} open
 * @property {string|null} type
 * @property {Object} data
 * @property {boolean} dismissible
 * @property {Function|null} onConfirm
 * @property {Function|null} onCancel
 */

export class ModalViewModel {
	constructor() {
		// Observable state using Svelte 5 runes
		this.activeModals = $state(new Map()); // modalId -> ModalState
		this.modalStack = $state([]); // Stack of modal IDs for layering
		this.globalOverlayVisible = $state(false);

		// Modal types
		this.modals = $state({
			terminal: {
				open: false,
				data: null
			},
			claude: {
				open: false,
				data: null
			},
			createSession: {
				open: false,
				data: { type: 'claude' }
			},
			settings: {
				open: false,
				data: null
			},
			confirmation: {
				open: false,
				data: null
			},
			error: {
				open: false,
				data: null
			},
			sessionMenu: {
				open: false,
				data: null
			}
		});

		// Derived state
		this.hasActiveModals = $derived(this.modalStack.length > 0);
		this.topModalId = $derived(
			this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1] : null
		);

		// Quick create state
		this.quickCreating = $state(false);
		this.quickCreateType = $state('claude');

		// Initialize
		this.initialize();
	}

	/**
	 * Initialize the view model
	 */
	initialize() {
		this.setupKeyboardListeners();
		this.setupGlobalClickHandler();
	}

	/**
	 * Setup global keyboard listeners for modal handling
	 */
	setupKeyboardListeners() {
		if (typeof document === 'undefined') return;

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.hasActiveModals) {
				this.closeTopModal();
			}
		});
	}

	/**
	 * Setup global click handler for backdrop clicks
	 */
	setupGlobalClickHandler() {
		if (typeof document === 'undefined') return;

		document.addEventListener('click', (e) => {
			// Handle backdrop clicks for dismissible modals
			if (e.target?.classList.contains('modal-backdrop')) {
				const modalId = e.target.getAttribute('data-modal-id');
				if (modalId && this.isModalDismissible(modalId)) {
					this.closeModal(modalId);
				}
			}
		});
	}

	/**
	 * Open a modal
	 * @param {string} modalId
	 * @param {Object} options
	 */
	openModal(modalId, options = {}) {
		const {
			data = null,
			dismissible = true,
			onConfirm = null,
			onCancel = null,
			replace = false
		} = options;

		// Close existing modal if replace is true
		if (replace && this.modals[modalId]?.open) {
			this.closeModal(modalId);
		}

		// Update modal state
		if (this.modals[modalId]) {
			this.modals[modalId].open = true;
			this.modals[modalId].data = data;
		}

		// Add to active modals
		this.activeModals.set(modalId, {
			open: true,
			type: modalId,
			data,
			dismissible,
			onConfirm,
			onCancel
		});

		// Add to stack if not already present
		if (!this.modalStack.includes(modalId)) {
			this.modalStack.push(modalId);
		}

		// Update global overlay
		this.updateGlobalOverlay();

		// Prevent body scroll
		this.setBodyScroll(false);
	}

	/**
	 * Close a modal
	 * @param {string} modalId
	 */
	closeModal(modalId) {
		// Update modal state
		if (this.modals[modalId]) {
			this.modals[modalId].open = false;
			this.modals[modalId].data = null;
		}

		// Remove from active modals
		this.activeModals.delete(modalId);

		// Remove from stack
		this.modalStack = this.modalStack.filter(id => id !== modalId);

		// Update global overlay
		this.updateGlobalOverlay();

		// Enable body scroll if no modals are open
		if (!this.hasActiveModals) {
			this.setBodyScroll(true);
		}
	}

	/**
	 * Close the top modal
	 */
	closeTopModal() {
		if (this.topModalId) {
			this.closeModal(this.topModalId);
		}
	}

	/**
	 * Close all modals
	 */
	closeAllModals() {
		const modalIds = [...this.modalStack];
		modalIds.forEach(id => this.closeModal(id));
	}

	/**
	 * Check if modal is dismissible
	 * @param {string} modalId
	 * @returns {boolean}
	 */
	isModalDismissible(modalId) {
		const modal = this.activeModals.get(modalId);
		return modal ? modal.dismissible : true;
	}

	/**
	 * Check if modal is open
	 * @param {string} modalId
	 * @returns {boolean}
	 */
	isModalOpen(modalId) {
		return this.modals[modalId]?.open || false;
	}

	/**
	 * Get modal data
	 * @param {string} modalId
	 * @returns {*}
	 */
	getModalData(modalId) {
		return this.modals[modalId]?.data || null;
	}

	/**
	 * Update global overlay visibility
	 */
	updateGlobalOverlay() {
		this.globalOverlayVisible = this.hasActiveModals;
	}

	/**
	 * Set body scroll state
	 * @param {boolean} enabled
	 */
	setBodyScroll(enabled) {
		if (typeof document === 'undefined') return;

		if (enabled) {
			document.body.style.overflow = '';
		} else {
			document.body.style.overflow = 'hidden';
		}
	}

	/**
	 * Confirm a modal action
	 * @param {string} modalId
	 * @param {*} result
	 */
	confirmModal(modalId, result = null) {
		const modal = this.activeModals.get(modalId);
		if (modal?.onConfirm) {
			modal.onConfirm(result);
		}
		this.closeModal(modalId);
	}

	/**
	 * Cancel a modal action
	 * @param {string} modalId
	 */
	cancelModal(modalId) {
		const modal = this.activeModals.get(modalId);
		if (modal?.onCancel) {
			modal.onCancel();
		}
		this.closeModal(modalId);
	}

	// Specific modal convenience methods

	/**
	 * Open terminal modal
	 * @param {Object} data
	 */
	openTerminalModal(data = null) {
		this.openModal('terminal', { data });
	}

	/**
	 * Open Claude modal
	 * @param {Object} data
	 */
	openClaudeModal(data = null) {
		this.openModal('claude', { data });
	}

	/**
	 * Open create session modal
	 * @param {string} type
	 */
	openCreateSessionModal(type = 'claude') {
		this.openModal('createSession', {
			data: { type },
			dismissible: true
		});
	}

	/**
	 * Open settings modal
	 */
	openSettingsModal() {
		this.openModal('settings', { dismissible: true });
	}

	/**
	 * Open confirmation modal
	 * @param {Object} options
	 */
	openConfirmationModal({
		title = 'Confirm',
		message = 'Are you sure?',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		onConfirm = null,
		onCancel = null
	}) {
		this.openModal('confirmation', {
			data: {
				title,
				message,
				confirmText,
				cancelText
			},
			dismissible: false,
			onConfirm,
			onCancel
		});
	}

	/**
	 * Open error modal
	 * @param {string|Error} error
	 */
	openErrorModal(error) {
		const message = typeof error === 'string' ? error : error.message;
		this.openModal('error', {
			data: { message },
			dismissible: true
		});
	}

	/**
	 * Open session menu modal (mobile)
	 * @param {Object} data
	 */
	openSessionMenuModal(data = null) {
		this.openModal('sessionMenu', {
			data,
			dismissible: true
		});
	}

	/**
	 * Quick create session
	 * @param {string} type
	 * @param {string} workspacePath
	 */
	async startQuickCreate(type, workspacePath) {
		this.quickCreating = true;
		this.quickCreateType = type;

		try {
			// The actual session creation would be handled by SessionViewModel
			// This just manages the UI state
			return { type, workspacePath };
		} catch (error) {
			this.openErrorModal(error);
			throw error;
		} finally {
			this.quickCreating = false;
		}
	}

	/**
	 * Get modal z-index based on stack position
	 * @param {string} modalId
	 * @returns {number}
	 */
	getModalZIndex(modalId) {
		const index = this.modalStack.indexOf(modalId);
		return index >= 0 ? 1000 + index * 10 : 0;
	}

	/**
	 * Get modal classes
	 * @param {string} modalId
	 * @returns {string[]}
	 */
	getModalClasses(modalId) {
		const classes = ['modal'];

		if (this.isModalOpen(modalId)) {
			classes.push('open');
		}

		if (this.topModalId === modalId) {
			classes.push('top');
		}

		classes.push(`modal-${modalId}`);

		return classes;
	}

	/**
	 * Get overlay classes
	 * @returns {string[]}
	 */
	getOverlayClasses() {
		const classes = ['modal-overlay'];

		if (this.globalOverlayVisible) {
			classes.push('visible');
		}

		return classes;
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			activeModals: this.activeModals.size,
			modalStack: this.modalStack.length,
			topModal: this.topModalId,
			overlayVisible: this.globalOverlayVisible,
			quickCreating: this.quickCreating,
			openModals: Object.entries(this.modals)
				.filter(([, modal]) => modal.open)
				.map(([id]) => id)
		};
	}

	/**
	 * Reset all modal state
	 */
	reset() {
		this.closeAllModals();
		this.quickCreating = false;
		this.quickCreateType = 'claude';

		// Reset individual modal states
		Object.keys(this.modals).forEach(modalId => {
			this.modals[modalId].open = false;
			this.modals[modalId].data = null;
		});
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.reset();
		this.setBodyScroll(true);

		// Remove event listeners would go here if we stored references
		// For now, the listeners will be garbage collected with the instance
	}
}