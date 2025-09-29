/**
 * SettingsValidator Service
 * Comprehensive validation service for settings values and configurations
 */

import { SettingType } from './ConfigurationSetting.js';

export class SettingsValidator {
	constructor() {
		this.customValidators = new Map();
		this.setupCustomValidators();
	}

	/**
	 * Setup custom validation rules for specific settings
	 */
	setupCustomValidators() {
		// Terminal key validator
		this.customValidators.set('terminal_key', (value) => {
			const errors = [];

			if (!value || value.trim().length === 0) {
				errors.push('Terminal key is required');
				return errors;
			}

			if (value.length < 8) {
				errors.push('Terminal key must be at least 8 characters long');
			}

			if (value === 'change-me') {
				errors.push('Please change the default terminal key to a secure value');
			}

			// Check for common weak patterns
			const weakPatterns = [
				/^12345678/,
				/^password/i,
				/^admin/i,
				/^test/i,
				/^(.)\\1{7,}/ // Repeated characters
			];

			for (const pattern of weakPatterns) {
				if (pattern.test(value)) {
					errors.push('Terminal key appears to be weak, please use a stronger key');
					break;
				}
			}

			return errors;
		});

		// OAuth Client ID validator
		this.customValidators.set('oauth_client_id', (value) => {
			const errors = [];

			if (value && value.trim().length > 0) {
				if (value.length < 3) {
					errors.push('OAuth Client ID must be at least 3 characters');
				}

				// Basic format check (alphanumeric with common separators)
				if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
					errors.push('OAuth Client ID contains invalid characters');
				}
			}

			return errors;
		});

		// OAuth Redirect URI validator
		this.customValidators.set('oauth_redirect_uri', (value) => {
			const errors = [];

			if (value && value.trim().length > 0) {
				try {
					const url = new URL(value);

					// Must be HTTPS in production
					if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
						errors.push('OAuth Redirect URI must use HTTPS in production');
					}

					// Common OAuth provider requirements
					if (url.pathname === '/') {
						errors.push('OAuth Redirect URI should include a specific path');
					}
				} catch {
					errors.push('OAuth Redirect URI must be a valid URL');
				}
			}

			return errors;
		});

		// Workspace root validator
		this.customValidators.set('workspaces_root', (value) => {
			const errors = [];

			if (!value || value.trim().length === 0) {
				errors.push('Workspaces root is required');
				return errors;
			}

			if (!value.startsWith('/')) {
				errors.push('Workspaces root must be an absolute path');
			}

			// Security check - prevent dangerous paths
			const dangerousPaths = [
				'/etc',
				'/usr',
				'/var',
				'/bin',
				'/sbin',
				'/boot',
				'/dev',
				'/proc',
				'/sys'
			];
			if (dangerousPaths.some((path) => value.startsWith(path))) {
				errors.push('Workspaces root cannot be in system directories');
			}

			return errors;
		});

		// Theme validator
		this.customValidators.set('theme', (value) => {
			const errors = [];
			const validThemes = ['light', 'dark', 'auto'];

			if (value && !validThemes.includes(value)) {
				errors.push(`Theme must be one of: ${validThemes.join(', ')}`);
			}

			return errors;
		});
	}

	/**
	 * Validate a single setting value
	 * @param {ConfigurationSetting} setting - Setting definition
	 * @param {string} value - Value to validate
	 * @returns {Object} Validation result
	 */
	validateSetting(setting, value) {
		const errors = [];
		const warnings = [];

		// Basic required check
		if (setting.is_required && (!value || value.trim().length === 0)) {
			errors.push(`${setting.name} is required`);
			return { valid: false, errors, warnings };
		}

		// Skip further validation for empty optional values
		if (!value || value.trim().length === 0) {
			return { valid: true, errors, warnings };
		}

		// Type validation
		const typeErrors = this.validateType(setting.type, value, setting.name);
		errors.push(...typeErrors);

		// Pattern validation
		if (setting.validation_pattern) {
			const patternErrors = this.validatePattern(value, setting.validation_pattern, setting.name);
			errors.push(...patternErrors);
		}

		// Custom validation
		if (this.customValidators.has(setting.key)) {
			const customErrors = this.customValidators.get(setting.key)(value);
			errors.push(...customErrors);
		}

		// Security warnings
		const securityWarnings = this.checkSecurityConcerns(setting, value);
		warnings.push(...securityWarnings);

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Validate value type
	 * @param {string} type - Setting type
	 * @param {string} value - Value to validate
	 * @param {string} name - Setting name for error messages
	 * @returns {Array<string>} Validation errors
	 */
	validateType(type, value, name) {
		const errors = [];

		switch (type) {
			case SettingType.STRING:
				// Strings are always valid, but check for suspicious content
				if (value.includes('<script>') || value.includes('javascript:')) {
					errors.push(`${name} contains potentially dangerous content`);
				}
				break;

			case SettingType.NUMBER:
				if (isNaN(Number(value))) {
					errors.push(`${name} must be a valid number`);
				} else {
					const num = Number(value);
					if (!Number.isFinite(num)) {
						errors.push(`${name} must be a finite number`);
					}
				}
				break;

			case SettingType.BOOLEAN:
				const validBooleans = ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'];
				if (!validBooleans.includes(value.toLowerCase())) {
					errors.push(`${name} must be a boolean value (true/false, 1/0, yes/no, on/off)`);
				}
				break;

			case SettingType.URL:
				try {
					const url = new URL(value);
					if (!['http:', 'https:'].includes(url.protocol)) {
						errors.push(`${name} must use HTTP or HTTPS protocol`);
					}
				} catch {
					errors.push(`${name} must be a valid URL`);
				}
				break;

			case SettingType.PATH:
				if (!value.startsWith('/')) {
					errors.push(`${name} must be an absolute path starting with /`);
				}

				// Check for path traversal attempts
				if (value.includes('..') || value.includes('//')) {
					errors.push(`${name} contains invalid path characters`);
				}
				break;

			default:
				errors.push(`Unknown setting type: ${type}`);
		}

		return errors;
	}

	/**
	 * Validate against regex pattern
	 * @param {string} value - Value to validate
	 * @param {string} pattern - Regex pattern
	 * @param {string} name - Setting name for error messages
	 * @returns {Array<string>} Validation errors
	 */
	validatePattern(value, pattern, name) {
		const errors = [];

		try {
			const regex = new RegExp(pattern);
			if (!regex.test(value)) {
				errors.push(`${name} does not match the required format`);
			}
		} catch (error) {
			errors.push(`Invalid validation pattern for ${name}: ${error.message}`);
		}

		return errors;
	}

	/**
	 * Check for security concerns
	 * @param {ConfigurationSetting} setting - Setting definition
	 * @param {string} value - Value to check
	 * @returns {Array<string>} Security warnings
	 */
	checkSecurityConcerns(setting, value) {
		const warnings = [];

		// Check for sensitive data in non-sensitive fields
		if (!setting.is_sensitive) {
			const sensitivePatterns = [
				/password/i,
				/secret/i,
				/token/i,
				/key.*=.*[a-zA-Z0-9]{16,}/, // Looks like an API key
				/[a-f0-9]{32,}/i // Looks like a hash
			];

			for (const pattern of sensitivePatterns) {
				if (pattern.test(value)) {
					warnings.push(`${setting.name} may contain sensitive information`);
					break;
				}
			}
		}

		// Check for default values that should be changed
		if (setting.key === 'terminal_key' && value === 'change-me') {
			warnings.push('Using default terminal key is not secure');
		}

		// Check for localhost URLs in production
		if (setting.type === SettingType.URL && process.env.NODE_ENV === 'production') {
			if (value.includes('localhost') || value.includes('127.0.0.1')) {
				warnings.push(`${setting.name} uses localhost in production environment`);
			}
		}

		return warnings;
	}

	/**
	 * Validate multiple settings as a batch
	 * @param {Array<Object>} settingValuePairs - Array of {setting, value} objects
	 * @returns {Object} Batch validation result
	 */
	validateBatch(settingValuePairs) {
		const results = {};
		const allErrors = [];
		const allWarnings = [];

		for (const { setting, value } of settingValuePairs) {
			const result = this.validateSetting(setting, value);
			results[setting.key] = result;

			allErrors.push(...result.errors);
			allWarnings.push(...result.warnings);
		}

		return {
			valid: allErrors.length === 0,
			errors: allErrors,
			warnings: allWarnings,
			details: results
		};
	}

	/**
	 * Validate settings configuration consistency
	 * @param {Array<ConfigurationSetting>} settings - All settings
	 * @returns {Object} Consistency validation result
	 */
	validateConsistency(settings) {
		const errors = [];
		const warnings = [];

		// Check OAuth configuration consistency
		const oauthSettings = settings.filter((s) => s.key.startsWith('oauth_'));
		const oauthValues = {};

		for (const setting of oauthSettings) {
			oauthValues[setting.key] = setting.getResolvedValue();
		}

		const hasOauthId = Boolean(oauthValues.oauth_client_id);
		const hasOauthSecret = Boolean(oauthValues.oauth_client_secret);
		const hasOauthUri = Boolean(oauthValues.oauth_redirect_uri);

		if (
			(hasOauthId || hasOauthSecret || hasOauthUri) &&
			!(hasOauthId && hasOauthSecret && hasOauthUri)
		) {
			warnings.push(
				'OAuth configuration is incomplete - all OAuth fields should be configured together'
			);
		}

		// Check for conflicting settings
		const sslEnabled = settings.find((s) => s.key === 'ssl_enabled')?.getResolvedValue() === 'true';
		const oauthRedirectUri = oauthValues.oauth_redirect_uri;

		if (sslEnabled && oauthRedirectUri && !oauthRedirectUri.startsWith('https:')) {
			warnings.push('SSL is enabled but OAuth redirect URI is not HTTPS');
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Add custom validator for a setting
	 * @param {string} settingKey - Setting key
	 * @param {Function} validator - Validator function that returns array of errors
	 */
	addCustomValidator(settingKey, validator) {
		this.customValidators.set(settingKey, validator);
	}
}

export default SettingsValidator;
