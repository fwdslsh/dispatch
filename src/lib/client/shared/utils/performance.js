/**
 * Performance utilities for the MVVM architecture
 * Provides debouncing, throttling, and performance monitoring
 */

/**
 * Debounce function calls to prevent excessive updates
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounce(func, wait, immediate = false) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			timeout = null;
			if (!immediate) func(...args);
		};
		const callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func(...args);
	};
}

/**
 * Throttle function calls to limit execution frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
	let inThrottle;
	return function (...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

/**
 * Batch multiple state updates to prevent cascading reactive updates
 */
export class StateBatcher {
	constructor() {
		this.pendingUpdates = [];
		this.batchTimeout = null;
	}

	/**
	 * Add an update to the batch
	 * @param {Function} updateFn - Function that performs the update
	 */
	batch(updateFn) {
		this.pendingUpdates.push(updateFn);

		if (!this.batchTimeout) {
			this.batchTimeout = setTimeout(() => {
				this.flush();
			}, 0);
		}
	}

	/**
	 * Execute all pending updates
	 */
	flush() {
		const updates = this.pendingUpdates.splice(0);
		this.batchTimeout = null;

		updates.forEach((updateFn) => {
			try {
				updateFn();
			} catch (error) {
				console.error('[StateBatcher] Error in batched update:', error);
			}
		});
	}
}

/**
 * Performance monitor for tracking state changes and rendering
 */
export class PerformanceMonitor {
	constructor() {
		this.metrics = {
			stateChanges: 0,
			lastStateChange: 0,
			renderCount: 0,
			lastRender: 0,
			slowOperations: []
		};
	}

	/**
	 * Record a state change
	 * @param {string} actionType - Type of action that caused the change
	 */
	recordStateChange(actionType) {
		this.metrics.stateChanges++;
		this.metrics.lastStateChange = performance.now();

		// Warn about excessive state changes
		if (this.metrics.stateChanges > 100) {
			console.warn(`[PerformanceMonitor] High state change count: ${this.metrics.stateChanges}`);
		}
	}

	/**
	 * Record a render operation
	 * @param {string} componentName - Name of component that rendered
	 */
	recordRender(componentName) {
		this.metrics.renderCount++;
		this.metrics.lastRender = performance.now();
	}

	/**
	 * Measure the performance of an operation
	 * @param {string} operationName - Name of the operation
	 * @param {Function} operation - Operation to measure
	 * @returns {Promise<any>} Result of the operation
	 */
	async measureOperation(operationName, operation) {
		const start = performance.now();

		try {
			const result = await operation();
			const duration = performance.now() - start;

			if (duration > 100) {
				this.metrics.slowOperations.push({
					name: operationName,
					duration,
					timestamp: Date.now()
				});
				console.warn(
					`[PerformanceMonitor] Slow operation: ${operationName} took ${duration.toFixed(2)}ms`
				);
			}

			return result;
		} catch (error) {
			const duration = performance.now() - start;
			console.error(
				`[PerformanceMonitor] Operation ${operationName} failed after ${duration.toFixed(2)}ms:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Get performance metrics
	 */
	getMetrics() {
		return {
			...this.metrics,
			slowOperations: this.metrics.slowOperations.slice(-10) // Last 10 slow operations
		};
	}

	/**
	 * Reset metrics
	 */
	reset() {
		this.metrics = {
			stateChanges: 0,
			lastStateChange: 0,
			renderCount: 0,
			lastRender: 0,
			slowOperations: []
		};
	}
}

/**
 * Shared performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Shared state batcher instance
 */
export const stateBatcher = new StateBatcher();
