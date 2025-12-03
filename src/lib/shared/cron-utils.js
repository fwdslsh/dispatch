/**
 * Cron utilities for validation, parsing, and human-readable descriptions
 * Shared between client and server
 */

/**
 * Validate a cron expression (basic validation)
 * @param {string} expression - Cron expression to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateCronExpression(expression) {
	if (!expression || typeof expression !== 'string') {
		return { valid: false, error: 'Expression is required' };
	}

	const trimmed = expression.trim();
	const parts = trimmed.split(/\s+/);

	// Cron expressions should have 5 or 6 parts
	if (parts.length < 5 || parts.length > 6) {
		return {
			valid: false,
			error: `Invalid format. Expected 5 or 6 parts, got ${parts.length}`
		};
	}

	// Basic validation for each part
	const validations = [
		{ name: 'minute', min: 0, max: 59 },
		{ name: 'hour', min: 0, max: 23 },
		{ name: 'day of month', min: 1, max: 31 },
		{ name: 'month', min: 1, max: 12 },
		{ name: 'day of week', min: 0, max: 7 } // 0 and 7 both represent Sunday
	];

	for (let i = 0; i < Math.min(5, parts.length); i++) {
		const part = parts[i];
		const validation = validations[i];

		// Allow wildcards, ranges, lists, and steps
		if (part === '*' || part === '?') continue;

		// Check for step values (*/5, 1-10/2)
		if (part.includes('/')) {
			const [range, step] = part.split('/');
			if (!step || isNaN(step)) {
				return { valid: false, error: `Invalid step in ${validation.name}: ${part}` };
			}
			// Validate range part
			if (range !== '*' && !validateRange(range, validation.min, validation.max)) {
				return { valid: false, error: `Invalid range in ${validation.name}: ${range}` };
			}
			continue;
		}

		// Check for ranges (1-5)
		if (part.includes('-')) {
			if (!validateRange(part, validation.min, validation.max)) {
				return { valid: false, error: `Invalid range in ${validation.name}: ${part}` };
			}
			continue;
		}

		// Check for lists (1,2,3)
		if (part.includes(',')) {
			const values = part.split(',');
			for (const val of values) {
				if (!validateValue(val, validation.min, validation.max)) {
					return { valid: false, error: `Invalid value in ${validation.name}: ${val}` };
				}
			}
			continue;
		}

		// Check single value
		if (!validateValue(part, validation.min, validation.max)) {
			return { valid: false, error: `Invalid value for ${validation.name}: ${part}` };
		}
	}

	return { valid: true };
}

/**
 * Validate a single numeric value
 */
function validateValue(value, min, max) {
	const num = parseInt(value, 10);
	if (isNaN(num)) return false;
	return num >= min && num <= max;
}

/**
 * Validate a range (e.g., "1-5")
 */
function validateRange(range, min, max) {
	const parts = range.split('-');
	if (parts.length !== 2) return false;

	const start = parseInt(parts[0], 10);
	const end = parseInt(parts[1], 10);

	if (isNaN(start) || isNaN(end)) return false;
	if (start >= end) return false;
	if (start < min || end > max) return false;

	return true;
}

/**
 * Convert cron expression to human-readable description
 * @param {string} expression - Cron expression
 * @returns {string} Human-readable description
 */
export function cronToHuman(expression) {
	if (!expression) return 'Invalid expression';

	const parts = expression.trim().split(/\s+/);
	if (parts.length < 5) return 'Invalid expression format';

	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

	// Check for common patterns
	if (expression === '* * * * *') {
		return 'Every minute';
	}

	if (expression === '0 * * * *') {
		return 'Every hour';
	}

	if (expression === '0 0 * * *') {
		return 'Daily at midnight';
	}

	if (expression === '0 12 * * *') {
		return 'Daily at noon';
	}

	if (expression === '0 0 * * 0') {
		return 'Weekly on Sunday at midnight';
	}

	if (expression === '0 0 1 * *') {
		return 'Monthly on the 1st at midnight';
	}

	// Build description from parts
	let desc = 'At ';

	// Time part
	if (minute === '*' && hour === '*') {
		desc = 'Every minute';
	} else if (minute !== '*' && hour === '*') {
		if (minute.includes('/')) {
			const step = minute.split('/')[1];
			desc = `Every ${step} minutes`;
		} else {
			desc = `At minute ${minute} of every hour`;
		}
	} else if (minute === '0' && hour !== '*') {
		if (hour.includes('/')) {
			const step = hour.split('/')[1];
			desc = `Every ${step} hours`;
		} else if (hour.includes(',')) {
			desc = `At hours ${hour}`;
		} else {
			desc = `At ${formatHour(hour)}`;
		}
	} else if (minute !== '*' && hour !== '*') {
		desc = `At ${formatTime(hour, minute)}`;
	}

	// Day part
	if (dayOfMonth !== '*') {
		if (dayOfMonth.includes(',')) {
			desc += ` on days ${dayOfMonth}`;
		} else {
			desc += ` on day ${dayOfMonth}`;
		}
	}

	// Month part
	if (month !== '*') {
		desc += ` in ${formatMonth(month)}`;
	}

	// Day of week part
	if (dayOfWeek !== '*' && dayOfWeek !== '?') {
		desc += ` on ${formatDayOfWeek(dayOfWeek)}`;
	}

	return desc;
}

/**
 * Format hour as 12-hour time
 */
function formatHour(hour) {
	const h = parseInt(hour, 10);
	if (h === 0) return '12 AM';
	if (h === 12) return '12 PM';
	if (h < 12) return `${h} AM`;
	return `${h - 12} PM`;
}

/**
 * Format time as HH:MM AM/PM
 */
function formatTime(hour, minute) {
	const h = parseInt(hour, 10);
	const m = minute.padStart(2, '0');

	if (h === 0) return `12:${m} AM`;
	if (h === 12) return `12:${m} PM`;
	if (h < 12) return `${h}:${m} AM`;
	return `${h - 12}:${m} PM`;
}

/**
 * Format month name
 */
function formatMonth(month) {
	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const m = parseInt(month, 10);
	if (m >= 1 && m <= 12) {
		return months[m - 1];
	}

	return month;
}

/**
 * Format day of week name
 */
function formatDayOfWeek(day) {
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	if (day.includes(',')) {
		return day
			.split(',')
			.map((d) => {
				const dayNum = parseInt(d, 10);
				return days[dayNum % 7] || d;
			})
			.join(', ');
	}

	const dayNum = parseInt(day, 10);
	return days[dayNum % 7] || day;
}

/**
 * Common cron expression presets
 */
export const CRON_PRESETS = [
	{ label: 'Every minute', value: '* * * * *' },
	{ label: 'Every 5 minutes', value: '*/5 * * * *' },
	{ label: 'Every 15 minutes', value: '*/15 * * * *' },
	{ label: 'Every 30 minutes', value: '*/30 * * * *' },
	{ label: 'Every hour', value: '0 * * * *' },
	{ label: 'Every 2 hours', value: '0 */2 * * *' },
	{ label: 'Every 6 hours', value: '0 */6 * * *' },
	{ label: 'Every 12 hours', value: '0 */12 * * *' },
	{ label: 'Daily at midnight', value: '0 0 * * *' },
	{ label: 'Daily at 6 AM', value: '0 6 * * *' },
	{ label: 'Daily at noon', value: '0 12 * * *' },
	{ label: 'Daily at 6 PM', value: '0 18 * * *' },
	{ label: 'Weekly on Sunday', value: '0 0 * * 0' },
	{ label: 'Weekly on Monday', value: '0 0 * * 1' },
	{ label: 'Monthly on 1st', value: '0 0 1 * *' },
	{ label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
	{ label: 'Weekends at 10 AM', value: '0 10 * * 0,6' }
];

/**
 * Calculate next run time from cron expression (client-side approximation)
 * @param {string} expression - Cron expression
 * @returns {Date|null} Next run date or null if invalid
 */
export function getNextRunTime(expression) {
	// This is a simplified client-side version
	// For accurate calculation, use the backend API
	try {
		const validation = validateCronExpression(expression);
		if (!validation.valid) return null;

		// Return approximate next run (1 hour from now)
		// Real calculation happens on backend
		return new Date(Date.now() + 3600000);
	} catch (error) {
		return null;
	}
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
	if (!ms || ms < 0) return '0ms';

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	if (seconds > 0) return `${seconds}s`;
	return `${ms}ms`;
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago", "in 5 minutes")
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time string
 */
export function formatRelativeTime(timestamp) {
	if (!timestamp) return 'Never';

	const now = Date.now();
	const diff = timestamp - now;
	const absDiff = Math.abs(diff);

	const seconds = Math.floor(absDiff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	const isPast = diff < 0;

	if (days > 0) {
		return isPast ? `${days}d ago` : `in ${days}d`;
	}
	if (hours > 0) {
		return isPast ? `${hours}h ago` : `in ${hours}h`;
	}
	if (minutes > 0) {
		return isPast ? `${minutes}m ago` : `in ${minutes}m`;
	}
	if (seconds > 0) {
		return isPast ? `${seconds}s ago` : `in ${seconds}s`;
	}
	return 'Just now';
}
