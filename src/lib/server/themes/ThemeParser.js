/**
 * ThemeParser Abstract Base Class
 *
 * Abstract base class for theme parsers. Concrete implementations must override
 * parse(), validate(), and toCssVariables() methods to handle specific theme formats.
 *
 * @abstract
 */
export class ThemeParser {
	/**
	 * Parse theme file content to theme object
	 *
	 * Subclasses must implement this method to parse theme file content into
	 * a structured theme object. The parser should handle format-specific details
	 * (JSON, YAML, CSS, etc.) and return a normalized theme object.
	 *
	 * @param {string} _fileContent - Raw theme file content
	 * @returns {object} Parsed theme object
	 * @throws {Error} if parsing fails or not implemented
	 */
	parse(_fileContent) {
		throw new Error('parse() must be implemented by subclass');
	}

	/**
	 * Validate theme structure and content
	 *
	 * Subclasses must implement this method to validate the theme object structure,
	 * required fields, color values, and other theme-specific requirements.
	 *
	 * @param {object} _theme - Theme object to validate
	 * @returns {{valid: boolean, errors: string[], warnings: string[]}} Validation result
	 * @throws {Error} if not implemented
	 */
	validate(_theme) {
		throw new Error('validate() must be implemented by subclass');
	}

	/**
	 * Transform theme to CSS variables
	 *
	 * Subclasses must implement this method to transform the validated theme object
	 * into CSS custom properties. Returns a key-value map where keys are CSS variable
	 * names (without --prefix) and values are the corresponding theme values.
	 *
	 * @param {object} _theme - Validated theme object
	 * @returns {object} CSS custom properties key-value map
	 * @throws {Error} if not implemented
	 */
	toCssVariables(_theme) {
		throw new Error('toCssVariables() must be implemented by subclass');
	}
}

export default ThemeParser;
