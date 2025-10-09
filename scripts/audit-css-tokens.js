#!/usr/bin/env node

/**
 * Audit CSS Tokens (Hardcoded Values)
 *
 * Finds hardcoded colors, spacing, and sizes that should use CSS variables.
 * Calculates tokenization score and suggests migrations to CSS variables.
 *
 * Usage:
 *   node scripts/audit-css-tokens.js [options]
 *
 * Options:
 *   --output <path>   Output file path (default: CSS_TOKENS_REPORT.md)
 *   --css-dir <path>  CSS directory to scan (default: src/lib/client/shared/styles)
 *   --svelte-dir <path> Svelte directory to scan (default: src)
 *   --verbose         Show detailed output
 *   --console         Output to console instead of file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
	output: getArgValue('--output') || 'CSS_TOKENS_REPORT.md',
	cssDir: getArgValue('--css-dir') || 'src/lib/client/shared/styles',
	svelteDir: getArgValue('--svelte-dir') || 'src',
	verbose: args.includes('--verbose'),
	console: args.includes('--console')
};

function getArgValue(flag) {
	const index = args.indexOf(flag);
	return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m'
};

function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function logVerbose(message, color = 'gray') {
	if (options.verbose) {
		log(message, color);
	}
}

/**
 * Recursively find files matching a pattern
 */
function findFiles(dir, pattern, ignore = []) {
	const results = [];

	function walk(currentPath) {
		// Skip ignored directories
		const relativePath = path.relative(PROJECT_ROOT, currentPath);
		for (const ignorePattern of ignore) {
			if (relativePath.includes(ignorePattern.replace(/\*\*/g, '').replace(/\*/g, ''))) {
				return;
			}
		}

		try {
			const entries = fs.readdirSync(currentPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(currentPath, entry.name);

				if (entry.isDirectory()) {
					walk(fullPath);
				} else if (entry.isFile() && entry.name.endsWith(pattern)) {
					results.push(fullPath);
				}
			}
		} catch (err) {
			// Skip directories we can't read
		}
	}

	walk(dir);
	return results;
}

/**
 * Extract CSS variable definitions from files
 */
function loadCSSVariables(files) {
	const variables = new Map();

	for (const file of files) {
		const content = fs.readFileSync(file, 'utf-8');
		const varDefRegex = /--([\w-]+)\s*:\s*([^;]+);/g;

		let match;
		while ((match = varDefRegex.exec(content)) !== null) {
			const varName = match[1];
			const value = match[2].trim();
			variables.set(varName, value);
		}
	}

	return variables;
}

/**
 * Find hardcoded color values
 */
function findHardcodedColors(content, filePath) {
	const colors = [];

	// Hex colors (#xxx, #xxxxxx, #xxxxxxxx)
	const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
	let match;
	while ((match = hexRegex.exec(content)) !== null) {
		colors.push({
			type: 'hex',
			value: match[0],
			context: getContext(content, match.index),
			file: filePath,
			position: match.index
		});
	}

	// RGB/RGBA
	const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/g;
	while ((match = rgbRegex.exec(content)) !== null) {
		// Skip if it's inside a var() or color-mix()
		if (!isInsideFunction(content, match.index, ['var', 'color-mix'])) {
			colors.push({
				type: 'rgb',
				value: match[0],
				context: getContext(content, match.index),
				file: filePath,
				position: match.index
			});
		}
	}

	// HSL/HSLA
	const hslRegex = /hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/g;
	while ((match = hslRegex.exec(content)) !== null) {
		if (!isInsideFunction(content, match.index, ['var', 'color-mix'])) {
			colors.push({
				type: 'hsl',
				value: match[0],
				context: getContext(content, match.index),
				file: filePath,
				position: match.index
			});
		}
	}

	// Named colors (common ones)
	const namedColors = [
		'transparent',
		'black',
		'white',
		'red',
		'green',
		'blue',
		'yellow',
		'orange',
		'purple',
		'pink',
		'gray',
		'grey'
	];

	for (const colorName of namedColors) {
		const namedRegex = new RegExp(`\\b${colorName}\\b`, 'gi');
		while ((match = namedRegex.exec(content)) !== null) {
			// Skip if inside a function or property name
			if (
				!isInsideFunction(content, match.index, ['var', 'color-mix']) &&
				!isPropertyName(content, match.index)
			) {
				colors.push({
					type: 'named',
					value: match[0],
					context: getContext(content, match.index),
					file: filePath,
					position: match.index
				});
			}
		}
	}

	return colors;
}

/**
 * Find hardcoded spacing values
 */
function findHardcodedSpacing(content, filePath) {
	const spacing = [];

	// Match px, rem, em values in spacing/sizing properties
	const spacingProps = [
		'padding',
		'margin',
		'gap',
		'top',
		'right',
		'bottom',
		'left',
		'inset',
		'grid-gap',
		'column-gap',
		'row-gap'
	];

	for (const prop of spacingProps) {
		// Match property: value pattern
		const propRegex = new RegExp(`${prop}[^:]*:\\s*([^;]+);`, 'gi');
		let match;

		while ((match = propRegex.exec(content)) !== null) {
			const value = match[1];

			// Find individual size values in the property value
			const sizeRegex = /(\d+(?:\.\d+)?)(px|rem|em)\b/g;
			let sizeMatch;

			while ((sizeMatch = sizeRegex.exec(value)) !== null) {
				// Skip if it's inside var()
				if (!isInsideFunction(content, match.index + sizeMatch.index, ['var', 'calc'])) {
					spacing.push({
						property: prop,
						value: sizeMatch[0],
						numericValue: parseFloat(sizeMatch[1]),
						unit: sizeMatch[2],
						context: getContext(content, match.index),
						file: filePath,
						position: match.index
					});
				}
			}
		}
	}

	return spacing;
}

/**
 * Find hardcoded size values
 */
function findHardcodedSizes(content, filePath) {
	const sizes = [];

	// Match size values in width, height, font-size properties
	const sizeProps = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'font-size'];

	for (const prop of sizeProps) {
		const propRegex = new RegExp(`${prop}[^:]*:\\s*([^;]+);`, 'gi');
		let match;

		while ((match = propRegex.exec(content)) !== null) {
			const value = match[1].trim();

			// Skip if it's already using a variable or calc
			if (!value.includes('var(') && !value.includes('clamp(') && !value.match(/^\d+%$/)) {
				const sizeRegex = /(\d+(?:\.\d+)?)(px|rem|em)\b/g;
				let sizeMatch;

				while ((sizeMatch = sizeRegex.exec(value)) !== null) {
					if (!isInsideFunction(content, match.index + sizeMatch.index, ['var', 'calc'])) {
						sizes.push({
							property: prop,
							value: sizeMatch[0],
							numericValue: parseFloat(sizeMatch[1]),
							unit: sizeMatch[2],
							context: getContext(content, match.index),
							file: filePath,
							position: match.index
						});
					}
				}
			}
		}
	}

	return sizes;
}

/**
 * Check if position is inside a function call
 */
function isInsideFunction(content, position, functionNames) {
	// Look backwards to find if we're inside a function
	let depth = 0;
	for (let i = position; i >= 0; i--) {
		if (content[i] === ')') depth++;
		if (content[i] === '(') {
			depth--;
			if (depth < 0) {
				// Found opening paren, check if it's one of our functions
				const before = content.substring(Math.max(0, i - 20), i);
				for (const funcName of functionNames) {
					if (before.endsWith(funcName)) {
						return true;
					}
				}
				break;
			}
		}
	}
	return false;
}

/**
 * Check if position is a property name (not a value)
 */
function isPropertyName(content, position) {
	// Look forward to see if there's a colon nearby
	const nextChars = content.substring(position, position + 20);
	return nextChars.includes(':');
}

/**
 * Get context around a position (the line it's on)
 */
function getContext(content, position) {
	const lines = content.split('\n');
	let charCount = 0;

	for (let i = 0; i < lines.length; i++) {
		charCount += lines[i].length + 1; // +1 for newline
		if (charCount > position) {
			return lines[i].trim();
		}
	}

	return '';
}

/**
 * Map hardcoded values to suggested CSS variables
 */
function suggestVariable(value, type, cssVariables) {
	const suggestions = [];

	if (type === 'color') {
		// Color mapping
		const colorMap = {
			'#2ee66b': 'var(--primary)',
			'#4eff82': 'var(--primary-bright)',
			'#1ea851': 'var(--primary-dim)',
			'#0c1210': 'var(--bg)',
			'#121a17': 'var(--surface)',
			'#18231f': 'var(--elev)',
			'#cfe7d8': 'var(--text)',
			'#d9ffe6': 'var(--text)',
			'#8aa699': 'var(--muted)',
			'#92b3a4': 'var(--muted)',
			'#26d07c': 'var(--ok)',
			'#ffb703': 'var(--warn)',
			'#ef476f': 'var(--err)',
			'#00c2ff': 'var(--info)',
			'#ffd166': 'var(--accent-amber)',
			'#ff6b9d': 'var(--accent-magenta)',
			'#ff8c42': 'var(--accent-warning)',
			'transparent': 'transparent',
			'black': 'var(--bg)',
			'white': 'var(--text)'
		};

		const normalized = value.toLowerCase();
		if (colorMap[normalized]) {
			suggestions.push(colorMap[normalized]);
		}

		// Check if it's close to an existing color variable
		for (const [varName, varValue] of cssVariables) {
			if (varValue.toLowerCase() === normalized) {
				suggestions.push(`var(--${varName})`);
			}
		}
	} else if (type === 'spacing') {
		// Spacing mapping (common px values to spacing scale)
		const spacingMap = {
			'2px': 'var(--space-0)',
			'4px': 'var(--space-1)',
			'8px': 'var(--space-2)',
			'12px': 'var(--space-3)',
			'16px': 'var(--space-4)',
			'24px': 'var(--space-5)',
			'32px': 'var(--space-6)'
		};

		if (spacingMap[value]) {
			suggestions.push(spacingMap[value]);
		}
	} else if (type === 'size') {
		// Font size mapping
		const fontSizeMap = {
			'12px': 'var(--font-size-0)',
			'14px': 'var(--font-size-1)',
			'16px': 'var(--font-size-2)',
			'18px': 'var(--font-size-3)',
			'22px': 'var(--font-size-4)',
			'28px': 'var(--font-size-5)'
		};

		if (fontSizeMap[value]) {
			suggestions.push(fontSizeMap[value]);
		}
	}

	return suggestions.length > 0 ? suggestions[0] : null;
}

/**
 * Calculate tokenization score
 */
function calculateTokenizationScore(files) {
	let totalValues = 0;
	let varUsages = 0;

	for (const file of files) {
		const content = fs.readFileSync(file, 'utf-8');

		// Count var() usages
		const varRegex = /var\(--[\w-]+(?:\s*,\s*[^)]+)?\)/g;
		const varMatches = content.match(varRegex);
		if (varMatches) {
			varUsages += varMatches.length;
		}

		// Count hardcoded values (colors, spacing, sizes)
		const hexMatches = content.match(/#[0-9a-fA-F]{3,8}\b/g);
		const rgbMatches = content.match(/rgba?\([^)]+\)/g);
		const pxMatches = content.match(/\d+px\b/g);
		const remMatches = content.match(/\d+rem\b/g);

		totalValues += (hexMatches?.length || 0) + (rgbMatches?.length || 0) + (pxMatches?.length || 0) + (remMatches?.length || 0);
	}

	totalValues += varUsages;

	return totalValues > 0 ? ((varUsages / totalValues) * 100).toFixed(1) : 0;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(data) {
	let markdown = '# CSS Tokens Audit Report\n\n';
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown += '> This report identifies hardcoded values that should use CSS variables (design tokens).\n\n';

	// Summary
	markdown += '## Summary\n\n';
	markdown += `- **Tokenization Score:** ${data.tokenizationScore}% (${data.tokenizationScore >= 70 ? '✅ Good' : data.tokenizationScore >= 50 ? '⚠️ Fair' : '❌ Needs Improvement'})\n`;
	markdown += `- **Files Scanned:** ${data.filesScanned}\n`;
	markdown += `- **Hardcoded Colors:** ${data.hardcodedColors.length}\n`;
	markdown += `- **Hardcoded Spacing:** ${data.hardcodedSpacing.length}\n`;
	markdown += `- **Hardcoded Sizes:** ${data.hardcodedSizes.length}\n`;
	markdown += `- **Total Hardcoded Values:** ${data.hardcodedColors.length + data.hardcodedSpacing.length + data.hardcodedSizes.length}\n\n`;

	markdown += '---\n\n';

	// Hardcoded Colors
	if (data.hardcodedColors.length > 0) {
		markdown += '## Hardcoded Colors\n\n';
		markdown += `Found ${data.hardcodedColors.length} hardcoded color values:\n\n`;

		// Group by value
		const colorsByValue = new Map();
		for (const color of data.hardcodedColors) {
			const key = color.value.toLowerCase();
			if (!colorsByValue.has(key)) {
				colorsByValue.set(key, []);
			}
			colorsByValue.get(key).push(color);
		}

		// Sort by frequency
		const sortedColors = Array.from(colorsByValue.entries()).sort((a, b) => b[1].length - a[1].length);

		for (const [value, occurrences] of sortedColors) {
			const suggestion = suggestVariable(value, 'color', data.cssVariables);
			markdown += `### \`${value}\` (${occurrences.length} occurrence${occurrences.length > 1 ? 's' : ''})\n\n`;

			if (suggestion) {
				markdown += `**Suggested replacement:** \`${suggestion}\`\n\n`;
			} else {
				markdown += '**Suggested replacement:** Consider adding to design system\n\n';
			}

			markdown += '<details>\n<summary>Show occurrences</summary>\n\n';
			for (const occurrence of occurrences.slice(0, 10)) {
				const relativePath = path.relative(PROJECT_ROOT, occurrence.file);
				markdown += `- **${relativePath}**\n`;
				markdown += `  \`\`\`css\n  ${occurrence.context}\n  \`\`\`\n`;
			}
			if (occurrences.length > 10) {
				markdown += `\n... and ${occurrences.length - 10} more\n`;
			}
			markdown += '\n</details>\n\n';
		}
	}

	// Hardcoded Spacing
	if (data.hardcodedSpacing.length > 0) {
		markdown += '## Hardcoded Spacing\n\n';
		markdown += `Found ${data.hardcodedSpacing.length} hardcoded spacing values:\n\n`;

		// Group by value
		const spacingByValue = new Map();
		for (const spacing of data.hardcodedSpacing) {
			if (!spacingByValue.has(spacing.value)) {
				spacingByValue.set(spacing.value, []);
			}
			spacingByValue.get(spacing.value).push(spacing);
		}

		// Sort by frequency
		const sortedSpacing = Array.from(spacingByValue.entries()).sort((a, b) => b[1].length - a[1].length);

		for (const [value, occurrences] of sortedSpacing) {
			const suggestion = suggestVariable(value, 'spacing', data.cssVariables);
			markdown += `### \`${value}\` (${occurrences.length} occurrence${occurrences.length > 1 ? 's' : ''})\n\n`;

			if (suggestion) {
				markdown += `**Suggested replacement:** \`${suggestion}\`\n\n`;
			}

			markdown += '<details>\n<summary>Show occurrences</summary>\n\n';
			for (const occurrence of occurrences.slice(0, 10)) {
				const relativePath = path.relative(PROJECT_ROOT, occurrence.file);
				markdown += `- **${relativePath}** (${occurrence.property})\n`;
				markdown += `  \`\`\`css\n  ${occurrence.context}\n  \`\`\`\n`;
			}
			if (occurrences.length > 10) {
				markdown += `\n... and ${occurrences.length - 10} more\n`;
			}
			markdown += '\n</details>\n\n';
		}
	}

	// Hardcoded Sizes
	if (data.hardcodedSizes.length > 0) {
		markdown += '## Hardcoded Sizes\n\n';
		markdown += `Found ${data.hardcodedSizes.length} hardcoded size values:\n\n`;

		// Group by value
		const sizesByValue = new Map();
		for (const size of data.hardcodedSizes) {
			if (!sizesByValue.has(size.value)) {
				sizesByValue.set(size.value, []);
			}
			sizesByValue.get(size.value).push(size);
		}

		// Sort by frequency
		const sortedSizes = Array.from(sizesByValue.entries()).sort((a, b) => b[1].length - a[1].length);

		for (const [value, occurrences] of sortedSizes) {
			const suggestion = suggestVariable(value, 'size', data.cssVariables);
			markdown += `### \`${value}\` (${occurrences.length} occurrence${occurrences.length > 1 ? 's' : ''})\n\n`;

			if (suggestion) {
				markdown += `**Suggested replacement:** \`${suggestion}\`\n\n`;
			}

			markdown += '<details>\n<summary>Show occurrences</summary>\n\n';
			for (const occurrence of occurrences.slice(0, 10)) {
				const relativePath = path.relative(PROJECT_ROOT, occurrence.file);
				markdown += `- **${relativePath}** (${occurrence.property})\n`;
				markdown += `  \`\`\`css\n  ${occurrence.context}\n  \`\`\`\n`;
			}
			if (occurrences.length > 10) {
				markdown += `\n... and ${occurrences.length - 10} more\n`;
			}
			markdown += '\n</details>\n\n';
		}
	}

	// Auto-migration script
	markdown += '## Auto-Migration Snippets\n\n';
	markdown += 'Use these commands to automatically replace hardcoded values:\n\n';
	markdown += '```bash\n';
	markdown += '# Color replacements\n';

	// Generate sed commands for top colors
	const colorsByValue = new Map();
	for (const color of data.hardcodedColors) {
		const key = color.value.toLowerCase();
		if (!colorsByValue.has(key)) {
			colorsByValue.set(key, []);
		}
		colorsByValue.get(key).push(color);
	}

	const topColors = Array.from(colorsByValue.entries())
		.sort((a, b) => b[1].length - a[1].length)
		.slice(0, 5);

	for (const [value, occurrences] of topColors) {
		const suggestion = suggestVariable(value, 'color', data.cssVariables);
		if (suggestion && !suggestion.includes('Consider')) {
			markdown += `find src -name "*.css" -o -name "*.svelte" | xargs sed -i 's/${value}/${suggestion}/g'\n`;
		}
	}

	markdown += '\n# Spacing replacements\n';

	// Generate sed commands for top spacing values
	const spacingByValue = new Map();
	for (const spacing of data.hardcodedSpacing) {
		if (!spacingByValue.has(spacing.value)) {
			spacingByValue.set(spacing.value, []);
		}
		spacingByValue.get(spacing.value).push(spacing);
	}

	const topSpacing = Array.from(spacingByValue.entries())
		.sort((a, b) => b[1].length - a[1].length)
		.slice(0, 5);

	for (const [value, occurrences] of topSpacing) {
		const suggestion = suggestVariable(value, 'spacing', data.cssVariables);
		if (suggestion) {
			// Escape special regex characters
			const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			markdown += `find src -name "*.css" -o -name "*.svelte" | xargs sed -i 's/${escaped}/${suggestion}/g'\n`;
		}
	}

	markdown += '```\n\n';

	markdown += '⚠️ **Warning:** Always review changes before committing. Test thoroughly after running migrations.\n\n';

	// Before/After Examples
	markdown += '## Before/After Examples\n\n';

	if (data.hardcodedColors.length > 0) {
		const example = data.hardcodedColors[0];
		const suggestion = suggestVariable(example.value, 'color', data.cssVariables);

		if (suggestion) {
			markdown += '### Color Example\n\n';
			markdown += '**Before:**\n```css\n';
			markdown += example.context + '\n';
			markdown += '```\n\n';
			markdown += '**After:**\n```css\n';
			markdown += example.context.replace(example.value, suggestion) + '\n';
			markdown += '```\n\n';
		}
	}

	if (data.hardcodedSpacing.length > 0) {
		const example = data.hardcodedSpacing[0];
		const suggestion = suggestVariable(example.value, 'spacing', data.cssVariables);

		if (suggestion) {
			markdown += '### Spacing Example\n\n';
			markdown += '**Before:**\n```css\n';
			markdown += example.context + '\n';
			markdown += '```\n\n';
			markdown += '**After:**\n```css\n';
			markdown += example.context.replace(example.value, suggestion) + '\n';
			markdown += '```\n\n';
		}
	}

	return markdown;
}

/**
 * Main execution
 */
async function main() {
	log('\n🎨 Auditing CSS tokens (hardcoded values)...\n', 'cyan');

	// Find all CSS and Svelte files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', ['node_modules', '.svelte-kit']);

	const svelteDir = path.join(PROJECT_ROOT, options.svelteDir);
	const svelteFiles = findFiles(svelteDir, '.svelte', ['node_modules', '.svelte-kit']);

	const allFiles = [...cssFiles, ...svelteFiles];

	log(`Found ${cssFiles.length} CSS files in ${options.cssDir}`, 'blue');
	log(`Found ${svelteFiles.length} Svelte files in ${options.svelteDir}`, 'blue');
	log(`Scanning ${allFiles.length} total files`, 'blue');
	log('');

	// Load CSS variables
	log('📊 Loading CSS variables...', 'cyan');
	const cssVariables = loadCSSVariables(cssFiles);
	log(`Found ${cssVariables.size} CSS variables`, 'green');
	log('');

	// Find hardcoded values
	log('🔍 Finding hardcoded colors...', 'cyan');
	const hardcodedColors = [];
	for (const file of allFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const colors = findHardcodedColors(content, file);
		hardcodedColors.push(...colors);
		if (colors.length > 0) {
			logVerbose(`  ${path.relative(PROJECT_ROOT, file)} - ${colors.length} colors`, 'gray');
		}
	}
	log(`Found ${hardcodedColors.length} hardcoded colors`, hardcodedColors.length > 0 ? 'yellow' : 'green');

	log('🔍 Finding hardcoded spacing...', 'cyan');
	const hardcodedSpacing = [];
	for (const file of allFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const spacing = findHardcodedSpacing(content, file);
		hardcodedSpacing.push(...spacing);
		if (spacing.length > 0) {
			logVerbose(`  ${path.relative(PROJECT_ROOT, file)} - ${spacing.length} spacing values`, 'gray');
		}
	}
	log(`Found ${hardcodedSpacing.length} hardcoded spacing values`, hardcodedSpacing.length > 0 ? 'yellow' : 'green');

	log('🔍 Finding hardcoded sizes...', 'cyan');
	const hardcodedSizes = [];
	for (const file of allFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const sizes = findHardcodedSizes(content, file);
		hardcodedSizes.push(...sizes);
		if (sizes.length > 0) {
			logVerbose(`  ${path.relative(PROJECT_ROOT, file)} - ${sizes.length} size values`, 'gray');
		}
	}
	log(`Found ${hardcodedSizes.length} hardcoded size values`, hardcodedSizes.length > 0 ? 'yellow' : 'green');
	log('');

	// Calculate tokenization score
	log('📊 Calculating tokenization score...', 'cyan');
	const tokenizationScore = calculateTokenizationScore(allFiles);
	log(`Tokenization score: ${tokenizationScore}%`, tokenizationScore >= 70 ? 'green' : tokenizationScore >= 50 ? 'yellow' : 'red');
	log('');

	// Generate report
	log('📝 Generating report...', 'cyan');
	const reportData = {
		tokenizationScore,
		filesScanned: allFiles.length,
		hardcodedColors,
		hardcodedSpacing,
		hardcodedSizes,
		cssVariables
	};

	const markdown = generateMarkdownReport(reportData);

	// Output
	if (options.console) {
		console.log('\n' + markdown);
	} else {
		const outputPath = path.join(PROJECT_ROOT, options.output);
		fs.writeFileSync(outputPath, markdown, 'utf-8');
		log(`✅ Report saved to: ${options.output}`, 'green');
	}

	// Summary
	log('\n' + '='.repeat(60), 'cyan');
	log('📊 Summary', 'cyan');
	log('='.repeat(60), 'cyan');

	log(`Tokenization Score: ${tokenizationScore}%`, tokenizationScore >= 70 ? 'green' : tokenizationScore >= 50 ? 'yellow' : 'red');
	log(`Hardcoded Colors: ${hardcodedColors.length}`, hardcodedColors.length > 0 ? 'yellow' : 'green');
	log(`Hardcoded Spacing: ${hardcodedSpacing.length}`, hardcodedSpacing.length > 0 ? 'yellow' : 'green');
	log(`Hardcoded Sizes: ${hardcodedSizes.length}`, hardcodedSizes.length > 0 ? 'yellow' : 'green');

	const totalHardcoded = hardcodedColors.length + hardcodedSpacing.length + hardcodedSizes.length;
	if (totalHardcoded > 0) {
		log(`\n💡 ${totalHardcoded} hardcoded values found that could use CSS variables`, 'yellow');
	} else {
		log('\n✅ No hardcoded values found! Great tokenization!', 'green');
	}

	if (!options.console) {
		log(`\nReport: ${options.output}`, 'cyan');
	}

	log('');
}

// Run the script
main().catch((error) => {
	log(`\n❌ Error: ${error.message}`, 'red');
	if (options.verbose) {
		console.error(error);
	}
	process.exit(1);
});
