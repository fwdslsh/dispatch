/**
 * TouchGestureService.js
 *
 * Service for handling touch gestures and swipe navigation.
 * Provides unified touch event handling for mobile interactions.
 */

/**
 * @typedef {Object} SwipeEvent
 * @property {'left'|'right'|'up'|'down'} direction
 * @property {number} distance
 * @property {number} velocity
 * @property {number} angle
 */

/**
 * @typedef {Object} GestureConfig
 * @property {number} swipeThreshold - Minimum distance for swipe (pixels)
 * @property {number} swipeVelocity - Minimum velocity for swipe (pixels/ms)
 * @property {number} tapThreshold - Maximum time for tap (ms)
 * @property {number} longPressThreshold - Minimum time for long press (ms)
 * @property {boolean} preventDefault - Prevent default touch behavior
 */

export class TouchGestureService {
	constructor() {
		// Default configuration
		this.config = {
			swipeThreshold: 50,
			swipeVelocity: 0.3,
			tapThreshold: 300,
			longPressThreshold: 500,
			preventDefault: true
		};

		// Touch state tracking
		this.touches = new Map();
		this.activeGestures = new Map();
	}

	/**
	 * Register touch handlers on an element
	 * @param {HTMLElement} element
	 * @param {Object} handlers
	 * @returns {Function} Cleanup function
	 */
	register(element, handlers = {}) {
		if (!element) return () => {};

		const touchStart = (e) => this.handleTouchStart(e, handlers);
		const touchMove = (e) => this.handleTouchMove(e, handlers);
		const touchEnd = (e) => this.handleTouchEnd(e, handlers);
		const touchCancel = (e) => this.handleTouchCancel(e, handlers);

		element.addEventListener('touchstart', touchStart, { passive: false });
		element.addEventListener('touchmove', touchMove, { passive: false });
		element.addEventListener('touchend', touchEnd, { passive: false });
		element.addEventListener('touchcancel', touchCancel, { passive: false });

		// Return cleanup function
		return () => {
			element.removeEventListener('touchstart', touchStart);
			element.removeEventListener('touchmove', touchMove);
			element.removeEventListener('touchend', touchEnd);
			element.removeEventListener('touchcancel', touchCancel);
		};
	}

	/**
	 * Handle touch start
	 * @param {TouchEvent} e
	 * @param {Object} handlers
	 */
	handleTouchStart(e, handlers) {
		if (this.config.preventDefault) {
			e.preventDefault();
		}

		const touch = e.touches[0];
		const touchData = {
			id: touch.identifier,
			startX: touch.clientX,
			startY: touch.clientY,
			startTime: Date.now(),
			currentX: touch.clientX,
			currentY: touch.clientY,
			element: e.target
		};

		this.touches.set(touch.identifier, touchData);

		// Start long press timer
		if (handlers.onLongPress) {
			const longPressTimer = setTimeout(() => {
				const data = this.touches.get(touch.identifier);
				if (data && !data.moved) {
					handlers.onLongPress({
						x: data.currentX,
						y: data.currentY,
						target: data.element
					});
					data.longPressed = true;
				}
			}, this.config.longPressThreshold);

			touchData.longPressTimer = longPressTimer;
		}

		// Call onTouchStart handler
		if (handlers.onTouchStart) {
			handlers.onTouchStart({
				x: touch.clientX,
				y: touch.clientY,
				target: e.target
			});
		}
	}

	/**
	 * Handle touch move
	 * @param {TouchEvent} e
	 * @param {Object} handlers
	 */
	handleTouchMove(e, handlers) {
		if (this.config.preventDefault) {
			e.preventDefault();
		}

		const touch = e.touches[0];
		const touchData = this.touches.get(touch.identifier);

		if (!touchData) return;

		touchData.currentX = touch.clientX;
		touchData.currentY = touch.clientY;

		const deltaX = touch.clientX - touchData.startX;
		const deltaY = touch.clientY - touchData.startY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Mark as moved if threshold exceeded
		if (distance > 10) {
			touchData.moved = true;

			// Cancel long press if moved
			if (touchData.longPressTimer) {
				clearTimeout(touchData.longPressTimer);
				touchData.longPressTimer = null;
			}
		}

		// Call onTouchMove handler
		if (handlers.onTouchMove) {
			handlers.onTouchMove({
				x: touch.clientX,
				y: touch.clientY,
				deltaX,
				deltaY,
				distance,
				target: e.target
			});
		}

		// Track swipe in progress
		if (handlers.onSwipeProgress && distance > 10) {
			const direction = this.getSwipeDirection(deltaX, deltaY);
			handlers.onSwipeProgress({
				direction,
				distance,
				deltaX,
				deltaY,
				progress: Math.min(1, distance / this.config.swipeThreshold)
			});
		}
	}

	/**
	 * Handle touch end
	 * @param {TouchEvent} e
	 * @param {Object} handlers
	 */
	handleTouchEnd(e, handlers) {
		if (this.config.preventDefault) {
			e.preventDefault();
		}

		const touch = e.changedTouches[0];
		const touchData = this.touches.get(touch.identifier);

		if (!touchData) return;

		// Clear long press timer
		if (touchData.longPressTimer) {
			clearTimeout(touchData.longPressTimer);
		}

		const endTime = Date.now();
		const duration = endTime - touchData.startTime;
		const deltaX = touchData.currentX - touchData.startX;
		const deltaY = touchData.currentY - touchData.startY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const velocity = distance / duration;

		// Detect tap
		if (!touchData.moved && !touchData.longPressed && duration < this.config.tapThreshold) {
			if (handlers.onTap) {
				handlers.onTap({
					x: touchData.currentX,
					y: touchData.currentY,
					target: touchData.element
				});
			}
		}

		// Detect swipe
		if (distance > this.config.swipeThreshold && velocity > this.config.swipeVelocity) {
			const direction = this.getSwipeDirection(deltaX, deltaY);
			const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

			if (handlers.onSwipe) {
				handlers.onSwipe({
					direction,
					distance,
					velocity,
					angle,
					deltaX,
					deltaY
				});
			}

			// Call specific direction handlers
			const directionHandler = handlers[`onSwipe${direction.charAt(0).toUpperCase() + direction.slice(1)}`];
			if (directionHandler) {
				directionHandler({
					distance,
					velocity,
					angle
				});
			}
		}

		// Call onTouchEnd handler
		if (handlers.onTouchEnd) {
			handlers.onTouchEnd({
				x: touchData.currentX,
				y: touchData.currentY,
				duration,
				target: touchData.element
			});
		}

		// Clean up touch data
		this.touches.delete(touch.identifier);
	}

	/**
	 * Handle touch cancel
	 * @param {TouchEvent} e
	 * @param {Object} handlers
	 */
	handleTouchCancel(e, handlers) {
		const touch = e.changedTouches[0];
		const touchData = this.touches.get(touch.identifier);

		if (touchData) {
			// Clear long press timer
			if (touchData.longPressTimer) {
				clearTimeout(touchData.longPressTimer);
			}

			// Call onTouchCancel handler
			if (handlers.onTouchCancel) {
				handlers.onTouchCancel({
					x: touchData.currentX,
					y: touchData.currentY,
					target: touchData.element
				});
			}

			// Clean up touch data
			this.touches.delete(touch.identifier);
		}
	}

	/**
	 * Get swipe direction from deltas
	 * @param {number} deltaX
	 * @param {number} deltaY
	 * @returns {'left'|'right'|'up'|'down'}
	 */
	getSwipeDirection(deltaX, deltaY) {
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);

		if (absX > absY) {
			return deltaX > 0 ? 'right' : 'left';
		} else {
			return deltaY > 0 ? 'down' : 'up';
		}
	}

	/**
	 * Configure the service
	 * @param {Partial<GestureConfig>} config
	 */
	configure(config) {
		Object.assign(this.config, config);
	}

	/**
	 * Create a Hammer.js compatible API wrapper
	 * @param {HTMLElement} element
	 * @returns {Object}
	 */
	createHammerWrapper(element) {
		const handlers = {};
		const cleanup = this.register(element, {
			onSwipeLeft: (e) => handlers.swipeleft?.(e),
			onSwipeRight: (e) => handlers.swiperight?.(e),
			onSwipeUp: (e) => handlers.swipeup?.(e),
			onSwipeDown: (e) => handlers.swipedown?.(e),
			onTap: (e) => handlers.tap?.(e),
			onLongPress: (e) => handlers.press?.(e)
		});

		return {
			on(event, handler) {
				handlers[event] = handler;
				return this;
			},
			off(event) {
				delete handlers[event];
				return this;
			},
			destroy() {
				cleanup();
				Object.keys(handlers).forEach(key => delete handlers[key]);
			}
		};
	}

	/**
	 * Check if touch is supported
	 * @returns {boolean}
	 */
	static isSupported() {
		if (typeof window === 'undefined') return false;
		return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		// Clear all touch data
		for (const touchData of this.touches.values()) {
			if (touchData.longPressTimer) {
				clearTimeout(touchData.longPressTimer);
			}
		}
		this.touches.clear();
		this.activeGestures.clear();
	}
}