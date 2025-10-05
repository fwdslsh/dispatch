const UNKNOWN_FIELD_ERROR = 'Unknown field';

function applyDefault(rule) {
	if (rule.default === undefined) {
		return undefined;
	}

	return typeof rule.default === 'function' ? rule.default() : rule.default;
}

function coerceBoolean(value) {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'number') {
		return value !== 0;
	}

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
			return true;
		}
		if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
			return false;
		}
	}

	return value;
}

function coerceNumber(value) {
	if (typeof value === 'number') {
		return value;
	}

	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}

	return value;
}

function nestedPath(path, child) {
	return path ? `${path}.${child}` : child;
}

function normalizeRule(rule, defaultType) {
	if (!rule) {
		return { type: defaultType };
	}

	if (typeof rule === 'string') {
		return { type: rule };
	}

	if (typeof rule === 'function') {
		return { type: defaultType, transform: rule };
	}

	if (!rule.type) {
		return { ...rule, type: defaultType };
	}

	return { ...rule };
}

export function validateSchema(schema, payload = {}, options = {}) {
	const { allowUnknown = true, coerce = true, path = '' } = options;
	const errors = [];
	const result = {};
	const input = payload && typeof payload === 'object' ? payload : {};

	for (const [field, ruleDefinition] of Object.entries(schema || {})) {
		const rule = normalizeRule(ruleDefinition, 'any');
		const keyPath = nestedPath(path, field);
		const value = input[field];
		const hasValue = value !== undefined && value !== null;

		if (!hasValue) {
			const fallback = applyDefault(rule);
			if (fallback !== undefined) {
				result[field] = fallback;
				continue;
			}

			if (rule.required === false) {
				continue;
			}

			errors.push({ path: keyPath, message: rule.message || 'Field is required' });
			continue;
		}

		let processed = value;

		switch (rule.type) {
			case 'string': {
				if (coerce && typeof processed !== 'string') {
					processed = String(processed);
				}

				if (typeof processed !== 'string') {
					errors.push({ path: keyPath, message: rule.message || 'Expected string value' });
					continue;
				}

				if (rule.trim) {
					processed = processed.trim();
				}

				if (rule.minLength !== undefined && processed.length < rule.minLength) {
					errors.push({
						path: keyPath,
						message: rule.message || `Must contain at least ${rule.minLength} characters`
					});
					continue;
				}

				if (rule.maxLength !== undefined && processed.length > rule.maxLength) {
					errors.push({
						path: keyPath,
						message: rule.message || `Must contain at most ${rule.maxLength} characters`
					});
					continue;
				}

				if (rule.enum && !rule.enum.includes(processed)) {
					errors.push({ path: keyPath, message: rule.message || 'Invalid value' });
					continue;
				}

				if (rule.pattern && !rule.pattern.test(processed)) {
					errors.push({ path: keyPath, message: rule.message || 'Invalid format' });
					continue;
				}

				break;
			}

			case 'number': {
				if (coerce) {
					processed = coerceNumber(processed);
				}

				if (typeof processed !== 'number' || Number.isNaN(processed)) {
					errors.push({ path: keyPath, message: rule.message || 'Expected number value' });
					continue;
				}

				if (rule.integer && !Number.isInteger(processed)) {
					errors.push({ path: keyPath, message: rule.message || 'Expected integer value' });
					continue;
				}

				if (rule.min !== undefined && processed < rule.min) {
					errors.push({
						path: keyPath,
						message: rule.message || `Must be greater than or equal to ${rule.min}`
					});
					continue;
				}

				if (rule.max !== undefined && processed > rule.max) {
					errors.push({
						path: keyPath,
						message: rule.message || `Must be less than or equal to ${rule.max}`
					});
					continue;
				}

				break;
			}

			case 'boolean': {
				if (coerce) {
					processed = coerceBoolean(processed);
				}

				if (typeof processed !== 'boolean') {
					errors.push({ path: keyPath, message: rule.message || 'Expected boolean value' });
					continue;
				}

				break;
			}

			case 'array': {
				if (!Array.isArray(processed)) {
					errors.push({ path: keyPath, message: rule.message || 'Expected array value' });
					continue;
				}

				if (rule.items) {
					const itemSchema = rule.items;
					const parsedItems = [];

					for (let index = 0; index < processed.length; index += 1) {
						const item = processed[index];
						const validation = validateSchema(
							{ value: itemSchema },
							{ value: item },
							{ allowUnknown: false, coerce, path: `${keyPath}[${index}]` }
						);

						if (!validation.success) {
							validation.errors.forEach((issue) => errors.push(issue));
							continue;
						}

						parsedItems.push(validation.data.value);
					}

					if (errors.length) {
						continue;
					}

					processed = parsedItems;
				}

				break;
			}

			case 'object': {
				if (!processed || typeof processed !== 'object' || Array.isArray(processed)) {
					errors.push({ path: keyPath, message: rule.message || 'Expected object value' });
					continue;
				}

				if (rule.schema) {
					const validation = validateSchema(rule.schema, processed, {
						allowUnknown: rule.allowUnknown !== false,
						coerce,
						path: keyPath
					});

					if (!validation.success) {
						validation.errors.forEach((issue) => errors.push(issue));
						continue;
					}

					processed = validation.data;
				}

				break;
			}

			default:
				break;
		}

		if (rule.validate) {
			const validationResult = rule.validate(processed);
			if (validationResult !== true) {
				errors.push({
					path: keyPath,
					message:
						typeof validationResult === 'string'
							? validationResult
							: rule.message || 'Invalid value'
				});
				continue;
			}
		}

		if (rule.transform) {
			processed = rule.transform(processed);
		}

		result[field] = processed;
	}

	if (!allowUnknown) {
		for (const key of Object.keys(input)) {
			if (!Object.prototype.hasOwnProperty.call(schema, key)) {
				errors.push({ path: nestedPath(path, key), message: UNKNOWN_FIELD_ERROR });
			}
		}
	} else {
		for (const key of Object.keys(input)) {
			if (!Object.prototype.hasOwnProperty.call(schema, key)) {
				result[key] = input[key];
			}
		}
	}

	if (errors.length) {
		return { success: false, errors };
	}

	return { success: true, data: result };
}

export function string(options = {}) {
	return { type: 'string', ...options };
}

export function number(options = {}) {
	return { type: 'number', ...options };
}

export function boolean(options = {}) {
	return { type: 'boolean', ...options };
}

export function array(items, options = {}) {
	return { type: 'array', items, ...options };
}

export function object(schema, options = {}) {
	return { type: 'object', schema, ...options };
}

export function optional(rule) {
	return { ...normalizeRule(rule, 'any'), required: false };
}
