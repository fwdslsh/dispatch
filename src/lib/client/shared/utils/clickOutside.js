/**
 * Svelte action for handling click outside events
 * Usage: <div use:clickOutside on:clickOutside={handleClickOutside}>
 */

/**
 * @typedef {Object} ClickOutsideOptions
 * @property {boolean} [enabled=true] - Whether the action is enabled
 * @property {string} [eventName='clickOutside'] - Name of event to dispatch
 * @property {string[]} [excludeSelector] - CSS selectors to exclude from outside clicks
 */

/**
 * Click outside action - dispatches 'clickOutside' event when user clicks outside the element
 * @param {HTMLElement} node - The DOM node to monitor
 * @param {ClickOutsideOptions} [options] - Configuration options
 */
export function clickOutside(node, options = {}) {
	const { enabled = true, eventName = 'clickOutside', excludeSelector = [] } = options;

	function handleClick(event) {
		if (!enabled) return;

		// Check if the clicked target is inside the node
		if (node.contains(event.target)) return;

		// Check if the clicked target matches any excluded selectors
		if (excludeSelector.length > 0) {
			for (const selector of excludeSelector) {
				if (event.target.closest(selector)) {
					return;
				}
			}
		}

		// Dispatch custom event
		node.dispatchEvent(
			new CustomEvent(eventName, {
				detail: { originalEvent: event }
			})
		);
	}

	// Add event listener if enabled
	if (enabled) {
		document.addEventListener('click', handleClick, true);
	}

	return {
		/** @param {ClickOutsideOptions} [newOptions] */
		update(newOptions = {}) {
			const newConfig = { ...options, ...newOptions };

			// Remove old listener
			document.removeEventListener('click', handleClick, true);

			// Add new listener if enabled
			if (newConfig.enabled) {
				document.addEventListener('click', handleClick, true);
			}

			// Update options
			Object.assign(options, newConfig);
		},

		destroy() {
			document.removeEventListener('click', handleClick, true);
		}
	};
}

/**
 * @typedef {Object} ClickOutsideEscapeOptions
 * @property {boolean} [enabled=true] - Whether the action is enabled
 * @property {string} [clickEventName='clickOutside'] - Name of click event to dispatch
 * @property {string} [escapeEventName='escape'] - Name of escape event to dispatch
 * @property {string[]} [excludeSelector] - CSS selectors to exclude from outside clicks
 */

/**
 * Enhanced click outside action with escape key support
 * Usage: <div use:clickOutsideEscape on:clickOutside={handleClose} on:escape={handleClose}>
 * @param {HTMLElement} node - The DOM node to monitor
 * @param {ClickOutsideEscapeOptions} [options] - Configuration options
 */
export function clickOutsideEscape(node, options = {}) {
	const {
		enabled = true,
		clickEventName = 'clickOutside',
		escapeEventName = 'escape',
		excludeSelector = []
	} = options;

	function handleClick(event) {
		if (!enabled) return;

		if (node.contains(event.target)) return;

		if (excludeSelector.length > 0) {
			for (const selector of excludeSelector) {
				if (event.target.closest(selector)) {
					return;
				}
			}
		}

		node.dispatchEvent(
			new CustomEvent(clickEventName, {
				detail: { originalEvent: event, type: 'click' }
			})
		);
	}

	function handleKeydown(event) {
		if (!enabled) return;

		if (event.key === 'Escape' || event.keyCode === 27) {
			event.preventDefault();
			node.dispatchEvent(
				new CustomEvent(escapeEventName, {
					detail: { originalEvent: event, type: 'escape' }
				})
			);
		}
	}

	// Add event listeners if enabled
	if (enabled) {
		document.addEventListener('click', handleClick, true);
		document.addEventListener('keydown', handleKeydown);
	}

	return {
		/** @param {ClickOutsideEscapeOptions} [newOptions] */
		update(newOptions = {}) {
			const newConfig = { ...options, ...newOptions };

			// Remove old listeners
			document.removeEventListener('click', handleClick, true);
			document.removeEventListener('keydown', handleKeydown);

			// Add new listeners if enabled
			if (newConfig.enabled) {
				document.addEventListener('click', handleClick, true);
				document.addEventListener('keydown', handleKeydown);
			}

			// Update options
			Object.assign(options, newConfig);
		},

		destroy() {
			document.removeEventListener('click', handleClick, true);
			document.removeEventListener('keydown', handleKeydown);
		}
	};
}
