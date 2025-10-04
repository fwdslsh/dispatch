# Theme Validation Contract

## Purpose

Defines the validation contract for theme files to ensure consistency across parsers and validators.

## Theme File Contract

### Required Fields

All theme files MUST contain:

```json
{
	"background": "<color>",
	"foreground": "<color>",
	"black": "<color>",
	"red": "<color>",
	"green": "<color>",
	"yellow": "<color>",
	"blue": "<color>",
	"magenta": "<color>",
	"cyan": "<color>",
	"white": "<color>",
	"brightBlack": "<color>",
	"brightRed": "<color>",
	"brightGreen": "<color>",
	"brightYellow": "<color>",
	"brightBlue": "<color>",
	"brightMagenta": "<color>",
	"brightCyan": "<color>",
	"brightWhite": "<color>"
}
```

### Optional Fields

Theme files MAY contain:

```json
{
	"name": "Theme Display Name",
	"description": "Theme description text",
	"cursor": "<color>",
	"cursorAccent": "<color>",
	"selectionBackground": "<color>"
}
```

### Color Format

Valid color formats (case-insensitive):

1. **Hex RGB**: `#rrggbb` (e.g., `#ff0000`, `#39ff14`)
2. **Hex RGBA**: `#rrggbbaa` (e.g., `#ff0000ff`, `#39ff1440`)
3. **RGB**: `rgb(r, g, b)` (e.g., `rgb(255, 0, 0)`)
4. **RGBA**: `rgba(r, g, b, a)` (e.g., `rgba(255, 0, 0, 0.5)`)
5. **HSL**: `hsl(h, s%, l%)` (e.g., `hsl(120, 100%, 50%)`)
6. **HSLA**: `hsla(h, s%, l%, a)` (e.g., `hsla(120, 100%, 50%, 0.5)`)

Where:

- `r`, `g`, `b`: 0-255
- `a`: 0.0-1.0 or 0-100%
- `h`: 0-360 (degrees)
- `s`, `l`: 0-100%

### File Constraints

- **Format**: Valid JSON
- **Size**: Maximum 5MB
- **Encoding**: UTF-8
- **Extension**: `.json`

## Validation Levels

### Level 1: Parse Validation

**Pass Criteria**:

- File is valid JSON
- File size ≤ 5MB

**Failure**: Reject with error "Invalid JSON syntax" or "File too large"

### Level 2: Structure Validation

**Pass Criteria**:

- All required fields present
- All field values are strings

**Failure**: Reject with error "Missing required field: {field}"

**Warnings**:

- Missing optional fields (name, description, cursor, etc.)
- Extra fields not in schema (not blocking)

### Level 3: Color Format Validation

**Pass Criteria**:

- All color values match one of the valid color formats

**Failure**: Reject with error "Invalid color format for {field}: {value}"

**Warnings**:

- Both background and foreground are same color
- Low contrast between foreground and background
- Missing cursor color (will use foreground as fallback)

## Validation Response Contract

```typescript
interface ValidationResult {
	valid: boolean; // Overall validation status
	errors: string[]; // Blocking errors (prevents upload/activation)
	warnings: string[]; // Non-blocking warnings (shown to user)
}
```

### Examples

#### Valid Theme (No Warnings)

```json
{
	"valid": true,
	"errors": [],
	"warnings": []
}
```

#### Valid Theme (With Warnings)

```json
{
	"valid": true,
	"errors": [],
	"warnings": [
		"Missing optional field: name (will use filename as display name)",
		"Missing optional field: cursor (will use foreground color)"
	]
}
```

#### Invalid Theme

```json
{
	"valid": false,
	"errors": ["Missing required field: brightBlue", "Invalid color format for red: not-a-color"],
	"warnings": []
}
```

## Parser Contract

All theme parsers MUST implement:

```typescript
abstract class ThemeParser {
	/**
	 * Parse theme file content to Theme object
	 * @throws Error if validation fails
	 */
	abstract parse(fileContent: string): Theme;

	/**
	 * Validate theme structure and colors
	 */
	validate(theme: object): ValidationResult;

	/**
	 * Transform theme to CSS variables
	 */
	toCssVariables(theme: Theme): CSSVariables;
}
```

### XtermThemeParser Contract

```typescript
class XtermThemeParser extends ThemeParser {
	parse(fileContent: string): Theme {
		// 1. Parse JSON
		const json = JSON.parse(fileContent);

		// 2. Validate structure
		const validation = this.validate(json);
		if (!validation.valid) {
			throw new Error(validation.errors.join(', '));
		}

		// 3. Return theme with validation warnings
		return {
			...json,
			_validation: validation
		};
	}

	validate(theme: object): ValidationResult {
		const errors = [];
		const warnings = [];

		// Check required fields
		const required = [
			'background',
			'foreground',
			'black',
			'red',
			'green',
			'yellow',
			'blue',
			'magenta',
			'cyan',
			'white',
			'brightBlack',
			'brightRed',
			'brightGreen',
			'brightYellow',
			'brightBlue',
			'brightMagenta',
			'brightCyan',
			'brightWhite'
		];

		for (const field of required) {
			if (!theme[field]) {
				errors.push(`Missing required field: ${field}`);
			}
		}

		// Check color formats
		const colorFields = [...required, 'cursor', 'cursorAccent', 'selectionBackground'];
		const colorRegex = /^(#[0-9a-f]{6,8}|rgb\(|rgba\(|hsl\(|hsla\()/i;

		for (const field of colorFields) {
			if (theme[field] && !colorRegex.test(theme[field])) {
				errors.push(`Invalid color format for ${field}: ${theme[field]}`);
			}
		}

		// Check optional fields
		if (!theme.name) warnings.push('Missing optional field: name');
		if (!theme.cursor) warnings.push('Missing optional field: cursor (will use foreground)');

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	toCssVariables(theme: Theme): CSSVariables {
		return {
			'--theme-background': theme.background,
			'--theme-foreground': theme.foreground,
			'--theme-cursor': theme.cursor || theme.foreground,
			'--theme-cursor-accent': theme.cursorAccent || theme.background,
			'--theme-selection-bg': theme.selectionBackground || `${theme.foreground}40`,

			'--theme-ansi-black': theme.black,
			'--theme-ansi-red': theme.red,
			'--theme-ansi-green': theme.green,
			'--theme-ansi-yellow': theme.yellow,
			'--theme-ansi-blue': theme.blue,
			'--theme-ansi-magenta': theme.magenta,
			'--theme-ansi-cyan': theme.cyan,
			'--theme-ansi-white': theme.white,

			'--theme-ansi-bright-black': theme.brightBlack,
			'--theme-ansi-bright-red': theme.brightRed,
			'--theme-ansi-bright-green': theme.brightGreen,
			'--theme-ansi-bright-yellow': theme.brightYellow,
			'--theme-ansi-bright-blue': theme.brightBlue,
			'--theme-ansi-bright-magenta': theme.brightMagenta,
			'--theme-ansi-bright-cyan': theme.brightCyan,
			'--theme-ansi-bright-white': theme.brightWhite
		};
	}
}
```

## Test Cases

### Valid Themes

1. **Minimal valid theme** (only required fields)
2. **Complete theme** (all fields including optional)
3. **Theme with RGBA colors**
4. **Theme with HSL colors**

### Invalid Themes

1. **Missing required field** (e.g., no `brightBlue`)
2. **Invalid color format** (e.g., `"red": "not a color"`)
3. **Invalid JSON syntax**
4. **File too large** (> 5MB)

### Edge Cases

1. **Empty theme file** (`{}`)
2. **Theme with extra unknown fields** (should warn but not fail)
3. **Theme with numeric color values** (should fail)
4. **Theme with null values** (should fail)

## Integration Contract

### Theme Upload Flow

```
1. Client uploads file
   ↓
2. Server receives multipart/form-data
   ↓
3. Check file size (< 5MB) → Reject if too large
   ↓
4. Parse file content → Reject if invalid JSON
   ↓
5. Validate theme structure → Reject if errors.length > 0
   ↓
6. Save to ~/.dispatch/themes/{filename}
   ↓
7. Return { theme, validation } with warnings
```

### Theme Activation Flow

```
1. Client requests theme activation
   ↓
2. Server validates theme exists
   ↓
3. Update user_preferences or workspace.theme_override
   ↓
4. Client triggers page reload
   ↓
5. Server resolves active theme (hierarchy)
   ↓
6. Transform to CSS variables
   ↓
7. Client applies CSS variables to :root
```

## Compatibility Guarantees

1. **xterm.js ITheme compatibility**: All valid xterm themes MUST parse successfully
2. **Forward compatibility**: New optional fields MAY be added without breaking existing themes
3. **Validation consistency**: Same theme file produces same validation result across parsers

## Performance Requirements

- **Parse time**: < 50ms for typical theme file (< 10KB)
- **Validation time**: < 100ms including all checks
- **CSS transformation**: < 20ms
- **Total upload processing**: < 200ms (excluding network transfer)
