# Quickstart: Theme Support System

**Feature**: Theme Support System
**Audience**: Developers implementing and testing the theme system
**Estimated Time**: 30-45 minutes

## Prerequisites

- Dispatch development environment running (`npm run dev`)
- Terminal access to test server
- Sample theme files (provided in this guide)

## Quick Overview

This guide walks through implementing and verifying the theme support system:

1. **Backend Setup** (15 min): ThemeManager, parsers, API routes
2. **Frontend Setup** (15 min): ThemeState, ThemeSettings component
3. **Integration Testing** (15 min): Verify complete workflow

## Part 1: Backend Implementation

### Step 1.1: Create Theme Directory Structure

```bash
# Navigate to project root
cd /home/founder3/code/github/fwdslsh/dispatch

# Create theme directories
mkdir -p static/themes
mkdir -p src/lib/server/themes

# Create preset theme files
cat > static/themes/phosphor-green.json << 'EOF'
{
  "name": "Phosphor Green",
  "description": "Dispatch default theme with phosphorescent green accent",
  "background": "#0a0e0f",
  "foreground": "#39ff14",
  "cursor": "#39ff14",
  "cursorAccent": "#0a0e0f",
  "selectionBackground": "#39ff1440",
  "black": "#1a1a1a",
  "red": "#ff6b6b",
  "green": "#39ff14",
  "yellow": "#f1fa8c",
  "blue": "#6272a4",
  "magenta": "#bd93f9",
  "cyan": "#8be9fd",
  "white": "#f8f8f2",
  "brightBlack": "#6272a4",
  "brightRed": "#ff6655",
  "brightGreen": "#50fa7b",
  "brightYellow": "#ffff66",
  "brightBlue": "#8899ff",
  "brightMagenta": "#ff79c6",
  "brightCyan": "#66ddff",
  "brightWhite": "#ffffff"
}
EOF

cat > static/themes/dark.json << 'EOF'
{
  "name": "Dark",
  "description": "Professional dark theme with balanced contrast",
  "background": "#0d1117",
  "foreground": "#e6edf3",
  "cursor": "#58a6ff",
  "cursorAccent": "#0d1117",
  "selectionBackground": "#58a6ff40",
  "black": "#484f58",
  "red": "#ff7b72",
  "green": "#3fb950",
  "yellow": "#d29922",
  "blue": "#58a6ff",
  "magenta": "#bc8cff",
  "cyan": "#39c5cf",
  "white": "#b1bac4",
  "brightBlack": "#6e7681",
  "brightRed": "#ffa198",
  "brightGreen": "#56d364",
  "brightYellow": "#e3b341",
  "brightBlue": "#79c0ff",
  "brightMagenta": "#d2a8ff",
  "brightCyan": "#56d4dd",
  "brightWhite": "#f0f6fc"
}
EOF

cat > static/themes/light.json << 'EOF'
{
  "name": "Light",
  "description": "Professional light theme with soft colors",
  "background": "#ffffff",
  "foreground": "#24292f",
  "cursor": "#0969da",
  "cursorAccent": "#ffffff",
  "selectionBackground": "#0969da40",
  "black": "#24292f",
  "red": "#cf222e",
  "green": "#116329",
  "yellow": "#4d2d00",
  "blue": "#0969da",
  "magenta": "#8250df",
  "cyan": "#1b7c83",
  "white": "#6e7781",
  "brightBlack": "#57606a",
  "brightRed": "#a40e26",
  "brightGreen": "#1a7f37",
  "brightYellow": "#633c01",
  "brightBlue": "#0550ae",
  "brightMagenta": "#6639ba",
  "brightCyan": "#1b7c83",
  "brightWhite": "#8c959f"
}
EOF
```

### Step 1.2: Implement ThemeParser

Create `src/lib/server/themes/ThemeParser.js`:

```javascript
/**
 * Abstract ThemeParser class
 * Subclasses implement format-specific parsing
 */
export class ThemeParser {
	parse(fileContent) {
		throw new Error('parse() must be implemented by subclass');
	}

	validate(theme) {
		throw new Error('validate() must be implemented by subclass');
	}

	toCssVariables(theme) {
		throw new Error('toCssVariables() must be implemented by subclass');
	}
}

export default ThemeParser;
```

Create `src/lib/server/themes/XtermThemeParser.js`:

```javascript
import ThemeParser from './ThemeParser.js';

export class XtermThemeParser extends ThemeParser {
	parse(fileContent) {
		const theme = JSON.parse(fileContent);
		const validation = this.validate(theme);

		if (!validation.valid) {
			const error = new Error('Theme validation failed');
			error.validation = validation;
			throw error;
		}

		return {
			...theme,
			_validation: validation
		};
	}

	validate(theme) {
		const errors = [];
		const warnings = [];

		// Required fields
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

		// Color format validation
		const colorRegex = /^(#[0-9a-f]{6,8}|rgb\(|rgba\(|hsl\(|hsla\()/i;
		const colorFields = [
			...required,
			'cursor',
			'cursorAccent',
			'selectionBackground'
		];

		for (const field of colorFields) {
			if (theme[field] && !colorRegex.test(theme[field])) {
				errors.push(`Invalid color format for ${field}: ${theme[field]}`);
			}
		}

		// Optional field warnings
		if (!theme.name) warnings.push('Missing optional field: name');
		if (!theme.cursor)
			warnings.push('Missing optional field: cursor (will use foreground)');

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	toCssVariables(theme) {
		return {
			'--theme-background': theme.background,
			'--theme-foreground': theme.foreground,
			'--theme-cursor': theme.cursor || theme.foreground,
			'--theme-cursor-accent': theme.cursorAccent || theme.background,
			'--theme-selection-bg':
				theme.selectionBackground || `${theme.foreground}40`,

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

export default XtermThemeParser;
```

### Step 1.3: Test Parsers

Create `tests/server/themes/ThemeParser.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { XtermThemeParser } from '../../../src/lib/server/themes/XtermThemeParser.js';

describe('XtermThemeParser', () => {
	const parser = new XtermThemeParser();

	it('should parse valid theme', () => {
		const themeJson = JSON.stringify({
			name: 'Test',
			background: '#000000',
			foreground: '#ffffff',
			black: '#000000',
			red: '#ff0000',
			green: '#00ff00',
			yellow: '#ffff00',
			blue: '#0000ff',
			magenta: '#ff00ff',
			cyan: '#00ffff',
			white: '#ffffff',
			brightBlack: '#555555',
			brightRed: '#ff5555',
			brightGreen: '#55ff55',
			brightYellow: '#ffff55',
			brightBlue: '#5555ff',
			brightMagenta: '#ff55ff',
			brightCyan: '#55ffff',
			brightWhite: '#ffffff'
		});

		const theme = parser.parse(themeJson);
		expect(theme.name).toBe('Test');
		expect(theme._validation.valid).toBe(true);
	});

	it('should reject theme with missing required field', () => {
		const themeJson = JSON.stringify({
			background: '#000000',
			foreground: '#ffffff'
			// Missing ANSI colors
		});

		expect(() => parser.parse(themeJson)).toThrow('Theme validation failed');
	});

	it('should transform to CSS variables', () => {
		const theme = {
			background: '#000000',
			foreground: '#ffffff',
			black: '#000000',
			red: '#ff0000'
			// ... (other colors)
		};

		const cssVars = parser.toCssVariables(theme);
		expect(cssVars['--theme-background']).toBe('#000000');
		expect(cssVars['--theme-foreground']).toBe('#ffffff');
	});
});
```

Run tests:

```bash
npm run test -- tests/server/themes/ThemeParser.test.js
```

**Expected Result**: All tests pass ✅

### Step 1.4: Implement ThemeManager

Create `src/lib/server/themes/ThemeManager.js`:

```javascript
import fs from 'fs/promises';
import path from 'path';
import { XtermThemeParser } from './XtermThemeParser.js';

// Hardcoded fallback theme (FR-029, FR-030)
const FALLBACK_THEME = {
	name: 'Phosphor Green',
	background: '#0a0e0f',
	foreground: '#39ff14'
	// ... (complete theme definition from phosphor-green.json)
};

export class ThemeManager {
	constructor(dataDir) {
		this.dataDir = dataDir;
		this.themesDir = path.join(dataDir, 'themes');
		this.staticThemesDir = path.join(process.cwd(), 'static', 'themes');
		this.parser = new XtermThemeParser();
		this.cache = new Map();
		this.lastCacheUpdate = 0;
		this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
	}

	async initialize() {
		// Ensure themes directory exists
		await fs.mkdir(this.themesDir, { recursive: true });

		// Copy preset themes on first run (FR-005)
		await this.ensurePresetsExist();

		// Load all themes into cache
		await this.loadThemes();
	}

	async ensurePresetsExist() {
		try {
			const presetFiles = await fs.readdir(this.staticThemesDir);

			for (const file of presetFiles) {
				if (!file.endsWith('.json')) continue;

				const destPath = path.join(this.themesDir, file);
				const exists = await fs
					.access(destPath)
					.then(() => true)
					.catch(() => false);

				if (!exists) {
					const srcPath = path.join(this.staticThemesDir, file);
					await fs.copyFile(srcPath, destPath);
					console.log(`Copied preset theme: ${file}`);
				}
			}
		} catch (error) {
			// If no presets found, recreate hardcoded fallback
			await this.recreateFallbackTheme();
		}
	}

	async recreateFallbackTheme() {
		const fallbackPath = path.join(this.themesDir, 'phosphor-green.json');
		await fs.writeFile(fallbackPath, JSON.stringify(FALLBACK_THEME, null, 2));
		console.log('Recreated fallback theme: phosphor-green.json');
	}

	async loadThemes() {
		this.cache.clear();

		const files = await fs.readdir(this.themesDir);

		for (const file of files) {
			if (!file.endsWith('.json')) continue;

			const filePath = path.join(this.themesDir, file);
			const content = await fs.readFile(filePath, 'utf-8');

			try {
				const theme = this.parser.parse(content);
				const stats = await fs.stat(filePath);

				const metadata = {
					id: path.basename(file, '.json'),
					name: theme.name || path.basename(file, '.json'),
					description: theme.description || '',
					source: 'custom', // All in user dir are custom
					filePath,
					cssVariables: this.parser.toCssVariables(theme),
					lastModified: stats.mtime
				};

				this.cache.set(metadata.id, metadata);
			} catch (error) {
				console.error(`Failed to load theme ${file}:`, error);
			}
		}

		this.lastCacheUpdate = Date.now();
	}

	async getTheme(themeId) {
		if (Date.now() - this.lastCacheUpdate > this.cacheTimeout) {
			await this.loadThemes();
		}

		return this.cache.get(themeId);
	}

	async getAllThemes() {
		if (Date.now() - this.lastCacheUpdate > this.cacheTimeout) {
			await this.loadThemes();
		}

		return Array.from(this.cache.values());
	}

	async uploadTheme(filename, fileContent) {
		// Validate file size (5MB max)
		if (Buffer.byteLength(fileContent) > 5 * 1024 * 1024) {
			throw new Error('File too large (max 5MB)');
		}

		// Parse and validate
		const theme = this.parser.parse(fileContent);

		// Save to disk
		const filePath = path.join(this.themesDir, filename);
		await fs.writeFile(filePath, fileContent);

		// Invalidate cache
		this.cache.clear();
		this.lastCacheUpdate = 0;

		return {
			id: path.basename(filename, '.json'),
			validation: theme._validation
		};
	}

	async deleteTheme(themeId) {
		const theme = await this.getTheme(themeId);
		if (!theme) {
			throw new Error('Theme not found');
		}

		await fs.unlink(theme.filePath);

		// Invalidate cache
		this.cache.delete(themeId);
	}
}

export default ThemeManager;
```

### Step 1.5: Create API Routes

Create `src/routes/api/themes/+server.js`:

```javascript
import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { validateAuthKey } from '$lib/server/shared/auth.js';

const themeManager = new ThemeManager(process.env.HOME + '/.dispatch');

export async function GET({ url }) {
	const authKey = url.searchParams.get('authKey');
	if (!validateAuthKey(authKey)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	await themeManager.initialize();
	const themes = await themeManager.getAllThemes();

	return json({ themes });
}

export async function POST({ request, url }) {
	const authKey = url.searchParams.get('authKey');
	if (!validateAuthKey(authKey)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get('file');

	if (!file) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	const fileContent = await file.text();

	try {
		const result = await themeManager.uploadTheme(file.name, fileContent);
		return json(result, { status: 201 });
	} catch (error) {
		return json(
			{
				error: error.message,
				validation: error.validation
			},
			{ status: 400 }
		);
	}
}
```

## Part 2: Frontend Implementation

### Step 2.1: Create ThemeState ViewModel

Create `src/lib/client/shared/state/ThemeState.svelte.js`:

```javascript
export class ThemeState {
	themes = $state([]);
	globalDefault = $state('phosphor-green');
	loading = $state(false);
	error = $state(null);

	presetThemes = $derived.by(() => this.themes.filter((t) => t.source === 'preset'));
	customThemes = $derived.by(() => this.themes.filter((t) => t.source === 'custom'));

	async loadThemes(apiClient) {
		this.loading = true;
		try {
			const response = await apiClient.get('/api/themes');
			this.themes = response.themes;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.loading = false;
		}
	}

	async activateTheme(apiClient, themeId) {
		await apiClient.put('/api/preferences', {
			category: 'themes',
			preferences: { globalDefault: themeId }
		});

		// Trigger page reload (FR-011)
		window.location.reload();
	}
}
```

### Step 2.2: Create ThemeSettings Component

Create `src/lib/client/settings/ThemeSettings.svelte`:

```svelte
<script>
	import { ThemeState } from '$lib/client/shared/state/ThemeState.svelte.js';

	let themeState = new ThemeState();
	let apiClient = /* inject from context */;

	$effect(() => {
		themeState.loadThemes(apiClient);
	});
</script>

<div class="theme-settings">
	<h2>Theme Settings</h2>

	<section class="theme-grid">
		{#each themeState.themes as theme}
			<div class="theme-card">
				<h3>{theme.name}</h3>
				<p>{theme.description}</p>
				<button on:click={() => themeState.activateTheme(apiClient, theme.id)}>
					Activate
				</button>
			</div>
		{/each}
	</section>
</div>
```

## Part 3: Integration Testing

### Step 3.1: Manual Testing Checklist

```bash
# Start development server
npm run dev

# Open browser to http://localhost:5173
```

**Test Scenario 1: View Available Themes**

1. Navigate to Settings → Themes
2. ✅ Verify 3 preset themes visible (Phosphor Green, Dark, Light)
3. ✅ Verify theme cards show name and description

**Test Scenario 2: Activate Theme**

1. Click "Activate" on Dark theme
2. ✅ Page refreshes automatically
3. ✅ Terminal colors change to dark theme
4. ✅ UI colors update to match theme

**Test Scenario 3: Upload Custom Theme**

1. Create test theme file `test-theme.json`
2. Upload via theme settings
3. ✅ Theme appears in list
4. ✅ Can activate uploaded theme

**Test Scenario 4: Workspace Override**

1. Create two workspaces
2. Set workspace 1 to Dark theme
3. Set workspace 2 to Light theme
4. ✅ Each workspace shows different theme when active

### Step 3.2: E2E Test

Create `e2e/theme-management.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('theme upload and activation', async ({ page }) => {
	await page.goto('http://localhost:5173');

	// Navigate to theme settings
	await page.click('text=Settings');
	await page.click('text=Themes');

	// Verify preset themes loaded
	await expect(page.locator('text=Phosphor Green')).toBeVisible();
	await expect(page.locator('text=Dark')).toBeVisible();
	await expect(page.locator('text=Light')).toBeVisible();

	// Activate dark theme
	await page.locator('.theme-card:has-text("Dark") button:has-text("Activate")').click();

	// Wait for page reload
	await page.waitForLoadState('networkidle');

	// Verify theme applied (check CSS variables)
	const bgColor = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--theme-background')
	);

	expect(bgColor.trim()).toBe('#0d1117');
});
```

Run E2E tests:

```bash
npm run test:e2e -- theme-management
```

## Success Criteria

After completing this quickstart, you should have:

✅ **Backend**:

- ThemeManager loading/caching themes
- XtermThemeParser validating and transforming themes
- API routes for listing, uploading themes
- Database schema update for workspace overrides

✅ **Frontend**:

- ThemeState ViewModel managing theme data
- ThemeSettings component displaying themes
- Theme activation triggering page reload
- CSS variables applied to UI

✅ **Integration**:

- Themes persist across app restarts
- Workspace-specific themes work correctly
- Upload validation catches errors
- Fallback theme prevents breakage

## Next Steps

1. Implement remaining API endpoints (delete, can-delete check)
2. Add drag-and-drop file upload UI
3. Create theme preview component with live colors
4. Add onboarding theme selection step
5. Write comprehensive unit tests for all parsers/validators

## Troubleshooting

**Issue**: Themes not loading

```bash
# Check themes directory exists
ls ~/.dispatch/themes/

# Verify preset themes copied
cat ~/.dispatch/themes/phosphor-green.json
```

**Issue**: Theme activation fails

```bash
# Check database has preferences table
sqlite3 ~/.dispatch/data/workspace.db "SELECT * FROM user_preferences WHERE category = 'themes';"
```

**Issue**: CSS variables not applied

```javascript
// In browser console, check CSS variables
console.log(getComputedStyle(document.documentElement).getPropertyValue('--theme-background'));
```

## Estimated Completion Time

- **Backend**: 15 minutes
- **Frontend**: 15 minutes
- **Testing**: 15 minutes
- **Total**: 45 minutes

Ready to implement? Start with Part 1: Backend Implementation!
