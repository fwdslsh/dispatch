/**
 * Svelte action for handling click outside events
 * Usage: <div use:clickOutside on:clickOutside={handleClickOutside}>
 */

/**
 * Click outside action - dispatches 'clickOutside' event when user clicks outside the element
 * @param {HTMLElement} node - The DOM node to monitor
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.enabled=true] - Whether the action is enabled
 * @param {string} [options.eventName='clickOutside'] - Name of event to dispatch
 * @param {string[]} [options.excludeSelector] - CSS selectors to exclude from outside clicks
 */
export function clickOutside(node, options = {}) {
	const {
		enabled = true,
		eventName = 'clickOutside',
		excludeSelector = []
	} = options;

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
		node.dispatchEvent(new CustomEvent(eventName, {
			detail: { originalEvent: event }
		}));
	}

	// Add event listener if enabled
	if (enabled) {
		document.addEventListener('click', handleClick, true);
	}

	return {
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
 * Enhanced click outside action with escape key support
 * Usage: <div use:clickOutsideEscape on:clickOutside={handleClose} on:escape={handleClose}>
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
		
		node.dispatchEvent(new CustomEvent(clickEventName, {
			detail: { originalEvent: event, type: 'click' }
		}));
	}

	function handleKeydown(event) {
		if (!enabled) return;
		
		if (event.key === 'Escape' || event.keyCode === 27) {
			event.preventDefault();
			node.dispatchEvent(new CustomEvent(escapeEventName, {
				detail: { originalEvent: event, type: 'escape' }
			}));
		}
	}

	// Add event listeners if enabled
	if (enabled) {
		document.addEventListener('click', handleClick, true);
		document.addEventListener('keydown', handleKeydown);
	}

	return {
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