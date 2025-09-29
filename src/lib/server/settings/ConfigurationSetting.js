/**
 * ConfigurationSetting Model
 * Represents individual configuration parameters with metadata and validation
 */

/**
 * Valid setting types
 */
export const SettingType = {
	STRING: 'string',
	NUMBER: 'number',
	BOOLEAN: 'boolean',
	URL: 'url',
	PATH: 'path'
};

export class ConfigurationSetting {
	/**
	 * Create a ConfigurationSetting instance
	 * @param {Object} data - Setting data
	 * @param {string} data.key - Setting key (unique identifier)
	 * @param {string} data.category_id - Foreign key to SettingsCategory
	 * @param {string} data.name - Display name
	 * @param {string} data.description - User-facing description
	 * @param {string} data.type - Data type (from SettingType enum)
	 * @param {string|null} data.current_value - Current value as string
	 * @param {string|null} data.default_value - Default value as string
	 * @param {string|null} data.env_var_name - Environment variable name
	 * @param {boolean} data.is_sensitive - Whether to mask in UI
	 * @param {boolean} data.is_required - Whether setting is required
	 * @param {string|null} data.validation_pattern - Regex pattern for validation
	 */
	constructor({
		key,
		category_id,
		name,
		description,
		type,
		current_value = null,
		default_value = null,
		env_var_name = null,
		is_sensitive = false,
		is_required = false,
		validation_pattern = null
	}) {
		this.key = key;
		this.category_id = category_id;
		this.name = name;
		this.description = description;
		this.type = type;
		this.current_value = current_value;
		this.default_value = default_value;
		this.env_var_name = env_var_name;
		this.is_sensitive = is_sensitive;
		this.is_required = is_required;
		this.validation_pattern = validation_pattern;
	}

	/**
	 * Validate setting data
	 * @returns {Array<string>} Array of validation errors (empty if valid)
	 */
	validate() {
		const errors = [];

		if (!this.key || typeof this.key !== 'string' || this.key.trim().length === 0) {
			errors.push('Setting key is required and must be a non-empty string');
		}

		if (!this.category_id || typeof this.category_id !== 'string') {
			errors.push('Category ID is required and must be a string');
		}

		if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
			errors.push('Setting name is required and must be a non-empty string');
		}

		if (!this.description || typeof this.description !== 'string') {
			errors.push('Setting description is required and must be a string');
		}

		if (!Object.values(SettingType).includes(this.type)) {
			errors.push(`Setting type must be one of: ${Object.values(SettingType).join(', ')}`);
		}

		if (typeof this.is_sensitive !== 'boolean') {
			errors.push('is_sensitive must be a boolean');
		}

		if (typeof this.is_required !== 'boolean') {
			errors.push('is_required must be a boolean');
		}

		return errors;
	}

	/**
	 * Validate a value against this setting's constraints
	 * @param {string} value - Value to validate
	 * @returns {Array<string>} Array of validation errors (empty if valid)
	 */
	validateValue(value) {
		const errors = [];

		// Check required
		if (this.is_required && (!value || value.trim().length === 0)) {
			errors.push(`${this.name} is required`);
			return errors;
		}

		// Skip validation for empty optional values
		if (!value || value.trim().length === 0) {
			return errors;
		}

		// Type-specific validation
		switch (this.type) {
			case SettingType.NUMBER:
				if (isNaN(Number(value))) {
					errors.push(`${this.name} must be a valid number`);
				}
				break;

			case SettingType.BOOLEAN:
				if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
					errors.push(`${this.name} must be true/false or 1/0`);
				}
				break;

			case SettingType.URL:
				try {
					new URL(value);
				} catch {
					errors.push(`${this.name} must be a valid URL`);
				}
				break;

			case SettingType.PATH:
				if (!value.startsWith('/')) {
					errors.push(`${this.name} must be an absolute path`);
				}
				break;
		}

		// Regex pattern validation
		if (this.validation_pattern) {
			try {
				const regex = new RegExp(this.validation_pattern);
				if (!regex.test(value)) {
					errors.push(`${this.name} does not match the required format`);
				}
			} catch (error) {
				errors.push(`Invalid validation pattern for ${this.name}`);
			}
		}

		// Special case validations
		if (this.key === 'terminal_key' && value.length < 8) {
			errors.push('Terminal key must be at least 8 characters long');
		}

		return errors;
	}

	/**
	 * Get the resolved value following priority hierarchy:
	 * 1. UI Configuration (current_value)
	 * 2. Environment Variable
	 * 3. Default Value
	 * @returns {string|null} Resolved value
	 */
	getResolvedValue() {
		// 1. Check UI-configured value
		if (this.current_value !== null && this.current_value !== '') {
			return this.current_value;
		}

		// 2. Check environment variable
		if (this.env_var_name && process.env[this.env_var_name]) {
			return process.env[this.env_var_name];
		}

		// 3. Use default value
		return this.default_value;
	}

	/**
	 * Get display value (masked for sensitive settings)
	 * @returns {string|null} Display-safe value
	 */
	getDisplayValue() {
		const value = this.getResolvedValue();

		if (!value) {
			return value;
		}

		if (this.is_sensitive && value.length > 0) {
			return '*'.repeat(Math.min(value.length, 12));
		}

		return value;
	}

	/**
	 * Convert to plain object for API responses
	 * @param {boolean} includeValue - Whether to include the actual value
	 * @returns {Object} Plain object representation
	 */
	toObject(includeValue = false) {
		const obj = {
			key: this.key,
			category_id: this.category_id,
			name: this.name,
			description: this.description,
			type: this.type,
			default_value: this.default_value,
			env_var_name: this.env_var_name,
			is_sensitive: this.is_sensitive,
			is_required: this.is_required,
			validation_pattern: this.validation_pattern
		};

		if (includeValue) {
			obj.current_value = this.current_value;
			obj.resolved_value = this.getResolvedValue();
			obj.display_value = this.getDisplayValue();
		}

		return obj;
	}

	/**
	 * Create ConfigurationSetting from database row
	 * @param {Object} row - Database row
	 * @returns {ConfigurationSetting}
	 */
	static fromRow(row) {
		return new ConfigurationSetting({
			key: row.key,
			category_id: row.category_id,
			name: row.name,
			description: row.description,
			type: row.type,
			current_value: row.current_value,
			default_value: row.default_value,
			env_var_name: row.env_var_name,
			is_sensitive: Boolean(row.is_sensitive),
			is_required: Boolean(row.is_required),
			validation_pattern: row.validation_pattern
		});
	}

	/**
	 * Database operations for ConfigurationSetting
	 */
	static createRepository(db) {
		return {
			/**
			 * Find all settings
			 * @returns {Array<ConfigurationSetting>}
			 */
			findAll() {
				const stmt = db.prepare(`
					SELECT key, category_id, name, description, type,
						   current_value, default_value, env_var_name,
						   is_sensitive, is_required, validation_pattern
					FROM configuration_settings
					ORDER BY category_id, name
				`);
				const rows = stmt.all();
				return rows.map((row) => ConfigurationSetting.fromRow(row));
			},

			/**
			 * Find settings by category
			 * @param {string} categoryId - Category ID
			 * @returns {Array<ConfigurationSetting>}
			 */
			findByCategory(categoryId) {
				const stmt = db.prepare(`
					SELECT key, category_id, name, description, type,
						   current_value, default_value, env_var_name,
						   is_sensitive, is_required, validation_pattern
					FROM configuration_settings
					WHERE category_id = ?
					ORDER BY name
				`);
				const rows = stmt.all(categoryId);
				return rows.map((row) => ConfigurationSetting.fromRow(row));
			},

			/**
			 * Find setting by key
			 * @param {string} key - Setting key
			 * @returns {ConfigurationSetting|null}
			 */
			findByKey(key) {
				const stmt = db.prepare(`
					SELECT key, category_id, name, description, type,
						   current_value, default_value, env_var_name,
						   is_sensitive, is_required, validation_pattern
					FROM configuration_settings
					WHERE key = ?
				`);
				const row = stmt.get(key);
				return row ? ConfigurationSetting.fromRow(row) : null;
			},

			/**
			 * Update setting value
			 * @param {string} key - Setting key
			 * @param {string|null} value - New value
			 * @returns {boolean} Success status
			 */
			updateValue(key, value) {
				const stmt = db.prepare(`
					UPDATE configuration_settings
					SET current_value = ?
					WHERE key = ?
				`);
				const result = stmt.run(value, key);
				return result.changes > 0;
			},

			/**
			 * Clear setting value (revert to env/default)
			 * @param {string} key - Setting key
			 * @returns {boolean} Success status
			 */
			clearValue(key) {
				const stmt = db.prepare(`
					UPDATE configuration_settings
					SET current_value = NULL
					WHERE key = ?
				`);
				const result = stmt.run(key);
				return result.changes > 0;
			},

			/**
			 * Update multiple settings in a transaction
			 * @param {Object} updates - Key-value pairs to update
			 * @returns {number} Number of settings updated
			 */
			updateMultiple(updates) {
				const updateStmt = db.prepare(`
					UPDATE configuration_settings
					SET current_value = ?
					WHERE key = ?
				`);

				const transaction = db.transaction((updates) => {
					let count = 0;
					for (const [key, value] of Object.entries(updates)) {
						const result = updateStmt.run(value, key);
						count += result.changes;
					}
					return count;
				});

				return transaction(updates);
			}
		};
	}
}

export default ConfigurationSetting;
