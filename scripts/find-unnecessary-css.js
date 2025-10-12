#!/usr/bin/env node

/**
 * Unnecessary CSS Detector
 *
 * Identifies CSS that duplicates global/theme styles and components that should
 * inherit default styles instead of defining custom ones.
 *
 * Features:
 * - Detects styles that duplicate global theme defaults (retro.css)
 * - Finds component styles that duplicate CSS variable values
 * - Identifies unnecessary overrides of HTML element defaults
 * - Suggests components that could inherit global styles
 * - Calculates "inheritance score" (how well components use global styles)
 *
 * Usage:
 *   node scripts/find-unnecessary-css.js [options]
 *
 * Options:
 *   --output <path>       Output file path (default: UNNECESSARY_CSS_REPORT.md)
 *   --css-dir <path>      CSS directory to scan (default: src/lib/client/shared/styles)
 *   --svelte-dir <path>   Svelte directory to scan (default: src)
 *   --theme-file <path>   Theme file to compare against (default: src/lib/client/shared/styles/retro.css)
 *   --vars-file <path>    Variables file (default: src/lib/client/shared/styles/variables.css)
 *   --verbose             Show detailed output
 *   --console             Output to console instead of file
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
	output: getArgValue('--output') || 'UNNECESSARY_CSS_REPORT.md',
	cssDir: getArgValue('--css-dir') || 'src/lib/client/shared/styles',
	svelteDir: getArgValue('--svelte-dir') || 'src',
	themeFile: getArgValue('--theme-file') || 'src/lib/client/shared/styles/retro.css',
	varsFile: getArgValue('--vars-file') || 'src/lib/client/shared/styles/variables.css',
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

// ============================================================================
// FILE SCANNING
// ============================================================================

/**
 * Recursively find files matching a pattern
 */
function findFiles(dir, pattern, ignore = []) {
	const results = [];

	function walk(currentPath) {
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
		} catch (_err) {
			// Skip directories we can't read
		}
	}

	walk(dir);
	return results;
}

/**
 * Extract CSS from Svelte <style> blocks
 */
function extractSvelteCSS(content) {
	const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
	const cssBlocks = [];
	let match;

	while ((match = styleRegex.exec(content)) !== null) {
		cssBlocks.push(match[1]);
	}

	return cssBlocks.join('\n\n');
}

// ============================================================================
// CSS PARSING
// ============================================================================

/**
 * Parse CSS content into rule objects
 */
class CSSParser {
	/**
	 * Parse CSS into rules
	 */
	static parse(css, filePath) {
		const rules = [];

		// Remove comments
		css = css.replace(/\/\*[\s\S]*?\*\//g, '');

		// Match rule blocks: selector { declarations }
		const ruleRegex = /([^{]+)\{([^}]+)\}/g;
		let match;

		while ((match = ruleRegex.exec(css)) !== null) {
			const selector = match[1].trim();
			const declarations = match[2].trim();

			if (selector && declarations) {
				const parsedDeclarations = this.parseDeclarations(declarations);

				rules.push({
					selector,
					declarations: parsedDeclarations,
					raw: match[0],
					file: filePath
				});
			}
		}

		return rules;
	}

	/**
	 * Parse declarations into key-value pairs
	 */
	static parseDeclarations(declarationsString) {
		const declarations = new Map();

		declarationsString
			.split(';')
			.map((decl) => decl.trim())
			.filter((decl) => decl.length > 0)
			.forEach((decl) => {
				const colonIndex = decl.indexOf(':');
				if (colonIndex > 0) {
					const property = decl.substring(0, colonIndex).trim();
					const value = decl.substring(colonIndex + 1).trim();
					declarations.set(property, value);
				}
			});

		return declarations;
	}

	/**
	 * Extract CSS variable definitions
	 */
	static extractVariables(css) {
		const variables = new Map();
		const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
		let match;

		while ((match = varRegex.exec(css)) !== null) {
			variables.set(match[1], match[2].trim());
		}

		return variables;
	}
}

// ============================================================================
// THEME ANALYSIS
// ============================================================================

/**
 * Load and analyze global theme styles
 */
class ThemeAnalyzer {
	constructor(themeFilePath, varsFilePath) {
		this.themeFile = themeFilePath;
		this.varsFile = varsFilePath;
		this.globalRules = new Map(); // selector -> declarations
		this.cssVariables = new Map(); // var name -> value
		this.htmlDefaults = new Map(); // HTML element -> declarations
	}

	/**
	 * Load global theme data
	 */
	load() {
		// Load theme file
		const themeContent = fs.readFileSync(this.themeFile, 'utf-8');
		const themeRules = CSSParser.parse(themeContent, this.themeFile);

		// Store global rules and HTML defaults
		for (const rule of themeRules) {
			this.globalRules.set(rule.selector, rule.declarations);

			// Track HTML element defaults
			const htmlElements = [
				'html',
				'body',
				'h1',
				'h2',
				'h3',
				'h4',
				'h5',
				'h6',
				'p',
				'a',
				'button',
				'input',
				'select',
				'textarea',
				'table',
				'code',
				'pre',
				'small'
			];

			for (const element of htmlElements) {
				// Check if selector targets this element (exact match or comma-separated)
				const selectors = rule.selector.split(',').map((s) => s.trim());
				if (selectors.includes(element)) {
					if (!this.htmlDefaults.has(element)) {
						this.htmlDefaults.set(element, new Map());
					}
					// Merge declarations
					for (const [prop, value] of rule.declarations) {
						this.htmlDefaults.get(element).set(prop, value);
					}
				}
			}
		}

		// Load CSS variables
		const varsContent = fs.readFileSync(this.varsFile, 'utf-8');
		this.cssVariables = CSSParser.extractVariables(varsContent);

		logVerbose(`Loaded ${this.globalRules.size} global rules`, 'green');
		logVerbose(`Loaded ${this.cssVariables.size} CSS variables`, 'green');
		logVerbose(`Loaded ${this.htmlDefaults.size} HTML element defaults`, 'green');
	}

	/**
	 * Check if a value is effectively the same as a CSS variable
	 */
	isSameAsVariable(value, varName) {
		if (!this.cssVariables.has(varName)) return false;

		const varValue = this.cssVariables.get(varName);
		const normalizedValue = value.toLowerCase().replace(/\s+/g, ' ').trim();
		const normalizedVarValue = varValue.toLowerCase().replace(/\s+/g, ' ').trim();

		return normalizedValue === normalizedVarValue;
	}

	/**
	 * Find which CSS variable a value matches
	 */
	findMatchingVariable(value) {
		const normalizedValue = value.toLowerCase().replace(/\s+/g, ' ').trim();

		for (const [varName, varValue] of this.cssVariables) {
			const normalizedVarValue = varValue.toLowerCase().replace(/\s+/g, ' ').trim();
			if (normalizedValue === normalizedVarValue) {
				return varName;
			}
		}

		return null;
	}
}

// ============================================================================
// UNNECESSARY CSS DETECTION
// ============================================================================

/**
 * Detect unnecessary CSS patterns
 */
class UnnecessaryCSSDetector {
	constructor(themeAnalyzer) {
		this.theme = themeAnalyzer;
	}

	/**
	 * Analyze a component's styles
	 */
	analyzeComponent(filePath, rules) {
		const issues = {
			file: filePath,
			duplicatesGlobalRules: [],
			duplicatesVariableValues: [],
			unnecessaryHTMLOverrides: [],
			totalDeclarations: 0,
			unnecessaryDeclarations: 0
		};

		for (const rule of rules) {
			const declarationCount = rule.declarations.size;
			issues.totalDeclarations += declarationCount;

			// Check for unnecessary HTML element overrides
			const htmlElement = this.extractHTMLElement(rule.selector);
			if (htmlElement && this.theme.htmlDefaults.has(htmlElement)) {
				const globalDefaults = this.theme.htmlDefaults.get(htmlElement);
				const unnecessary = [];

				for (const [prop, value] of rule.declarations) {
					if (globalDefaults.has(prop)) {
						const globalValue = globalDefaults.get(prop);
						if (this.valuesAreEquivalent(value, globalValue)) {
							unnecessary.push({ property: prop, value, globalValue });
							issues.unnecessaryDeclarations++;
						}
					}
				}

				if (unnecessary.length > 0) {
					issues.unnecessaryHTMLOverrides.push({
						selector: rule.selector,
						element: htmlElement,
						unnecessary
					});
				}
			}

			// Check for duplicate variable values
			for (const [prop, value] of rule.declarations) {
				// Skip if already using a variable
				if (value.includes('var(')) continue;

				const matchingVar = this.theme.findMatchingVariable(value);
				if (matchingVar) {
					issues.duplicatesVariableValues.push({
						selector: rule.selector,
						property: prop,
						value,
						suggestedVariable: `var(--${matchingVar})`,
						variableName: matchingVar
					});
					issues.unnecessaryDeclarations++;
				}
			}
		}

		return issues;
	}

	/**
	 * Extract HTML element from selector if it's a simple element selector
	 */
	extractHTMLElement(selector) {
		// Simple element selector (e.g., "button", "input", "h1")
		const simpleElementMatch = selector.match(/^([a-z][a-z0-9]*)$/i);
		if (simpleElementMatch) {
			return simpleElementMatch[1].toLowerCase();
		}

		// Element with pseudo-class or attribute (e.g., "button:hover", "input[type='text']")
		const elementWithModifierMatch = selector.match(/^([a-z][a-z0-9]*)[[:]/i);
		if (elementWithModifierMatch) {
			return elementWithModifierMatch[1].toLowerCase();
		}

		return null;
	}

	/**
	 * Check if two CSS values are equivalent
	 */
	valuesAreEquivalent(value1, value2) {
		const normalize = (v) => v.toLowerCase().replace(/\s+/g, ' ').trim();
		return normalize(value1) === normalize(value2);
	}

	/**
	 * Calculate inheritance score for a file
	 */
	calculateInheritanceScore(issues) {
		if (issues.totalDeclarations === 0) return 100;

		const unnecessaryPercent = (issues.unnecessaryDeclarations / issues.totalDeclarations) * 100;
		return Math.round(100 - unnecessaryPercent);
	}
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate markdown report
 */
function generateMarkdownReport(allIssues, themeAnalyzer) {
	let markdown = '# Unnecessary CSS Report\n\n';
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown +=
		'> This report identifies CSS that duplicates global/theme styles and suggests simplifications.\n\n';

	// Calculate overall statistics
	const stats = calculateOverallStats(allIssues);

	// Summary
	markdown += '## Summary\n\n';
	markdown += `- **Files Analyzed:** ${stats.filesAnalyzed}\n`;
	markdown += `- **Total Declarations:** ${stats.totalDeclarations}\n`;
	markdown += `- **Unnecessary Declarations:** ${stats.unnecessaryDeclarations}\n`;
	markdown += `- **Inheritance Score:** ${stats.inheritanceScore}% `;
	markdown += `(${stats.inheritanceScore >= 80 ? '✅ Excellent' : stats.inheritanceScore >= 60 ? '⚠️ Good' : '❌ Needs Improvement'})\n`;
	markdown += `- **Files with Issues:** ${stats.filesWithIssues}\n`;
	markdown += `- **Potential CSS Reduction:** ${stats.potentialReduction}%\n\n`;

	markdown += '---\n\n';

	// Duplicate Variable Values
	const filesWithDuplicateVars = allIssues.filter((i) => i.duplicatesVariableValues.length > 0);
	if (filesWithDuplicateVars.length > 0) {
		markdown += '## Hardcoded Values That Match CSS Variables\n\n';
		markdown += 'These styles use hardcoded values that exactly match CSS variable definitions. ';
		markdown += 'Replace them with variables for consistency and maintainability.\n\n';
		markdown += `**Files affected:** ${filesWithDuplicateVars.length}\n\n`;

		// Group by variable name
		const byVariable = new Map();
		for (const issue of filesWithDuplicateVars) {
			for (const dup of issue.duplicatesVariableValues) {
				if (!byVariable.has(dup.variableName)) {
					byVariable.set(dup.variableName, []);
				}
				byVariable.get(dup.variableName).push({
					file: issue.file,
					...dup
				});
			}
		}

		// Sort by frequency
		const sortedVars = Array.from(byVariable.entries()).sort((a, b) => b[1].length - a[1].length);

		for (const [varName, occurrences] of sortedVars.slice(0, 15)) {
			markdown += `### \`--${varName}\` (${occurrences.length} occurrences)\n\n`;
			markdown += `**Replace:** \`${occurrences[0].value}\` → \`var(--${varName})\`\n\n`;

			markdown += '<details>\n<summary>Show occurrences</summary>\n\n';
			for (const occ of occurrences.slice(0, 10)) {
				const relativePath = path.relative(PROJECT_ROOT, occ.file);
				markdown += `- **${relativePath}**\n`;
				markdown += `  - Selector: \`${occ.selector}\`\n`;
				markdown += `  - Property: \`${occ.property}: ${occ.value}\`\n`;
			}
			if (occurrences.length > 10) {
				markdown += `\n... and ${occurrences.length - 10} more\n`;
			}
			markdown += '\n</details>\n\n';
		}

		if (sortedVars.length > 15) {
			markdown += `*... and ${sortedVars.length - 15} more variables*\n\n`;
		}
	}

	markdown += '---\n\n';

	// Unnecessary HTML Overrides
	const filesWithHTMLOverrides = allIssues.filter((i) => i.unnecessaryHTMLOverrides.length > 0);
	if (filesWithHTMLOverrides.length > 0) {
		markdown += '## Unnecessary HTML Element Overrides\n\n';
		markdown +=
			'These components override HTML element styles with the same values already defined globally in `retro.css`. ';
		markdown += 'Remove these declarations to reduce redundancy.\n\n';
		markdown += `**Files affected:** ${filesWithHTMLOverrides.length}\n\n`;

		for (const issue of filesWithHTMLOverrides.slice(0, 20)) {
			const relativePath = path.relative(PROJECT_ROOT, issue.file);
			markdown += `### ${relativePath}\n\n`;

			for (const override of issue.unnecessaryHTMLOverrides) {
				markdown += `**Element:** \`${override.element}\` (Selector: \`${override.selector}\`)\n\n`;
				markdown += '**Unnecessary declarations:**\n\n';
				markdown += '```css\n';
				for (const decl of override.unnecessary) {
					markdown += `${decl.property}: ${decl.value}; /* Already set globally */\n`;
				}
				markdown += '```\n\n';
				markdown += `*These ${override.unnecessary.length} declarations can be removed as they duplicate the global theme defaults.*\n\n`;
			}

			markdown += '---\n\n';
		}

		if (filesWithHTMLOverrides.length > 20) {
			markdown += `*... and ${filesWithHTMLOverrides.length - 20} more files*\n\n`;
		}
	}

	// Components That Should Inherit More
	markdown += '## Components That Should Use More Global Styles\n\n';
	markdown +=
		'Components with low inheritance scores that could benefit from relying more on global theme styles.\n\n';

	const filesWithScores = allIssues
		.map((issue) => ({
			file: issue.file,
			score: new UnnecessaryCSSDetector(themeAnalyzer).calculateInheritanceScore(issue),
			unnecessaryCount: issue.unnecessaryDeclarations,
			totalCount: issue.totalDeclarations
		}))
		.filter((f) => f.score < 90 && f.unnecessaryCount > 0);

	const sortedByScore = filesWithScores.sort((a, b) => a.score - b.score);

	if (sortedByScore.length > 0) {
		markdown += '| File | Inheritance Score | Unnecessary | Total | Action |\n';
		markdown += '|------|-------------------|-------------|-------|--------|\n';

		for (const file of sortedByScore.slice(0, 25)) {
			const relativePath = path.relative(PROJECT_ROOT, file.file);
			const scoreEmoji = file.score < 50 ? '❌' : file.score < 70 ? '⚠️' : '⚠️';
			markdown += `| \`${relativePath}\` | ${scoreEmoji} ${file.score}% | ${file.unnecessaryCount} | ${file.totalCount} | Review & simplify |\n`;
		}

		if (sortedByScore.length > 25) {
			markdown += `\n*... and ${sortedByScore.length - 25} more files*\n`;
		}
	} else {
		markdown += '*No components found with significant improvement opportunities. Excellent!*\n';
	}

	markdown += '\n---\n\n';

	// Recommendations
	markdown += '## Recommended Actions\n\n';

	if (stats.duplicateVariableOccurrences > 0) {
		markdown += '### 1. Replace Hardcoded Values with CSS Variables\n\n';
		markdown += `Found **${stats.duplicateVariableOccurrences}** hardcoded values that match CSS variables.\n\n`;
		markdown += '**Action:**\n';
		markdown += '- Use `var(--variable-name)` instead of hardcoded values\n';
		markdown += '- Ensures consistency with theme\n';
		markdown += '- Makes theme switching easier\n';
		markdown += '- Reduces maintenance burden\n\n';
		markdown += '**Priority:** High ⚠️\n\n';
	}

	if (stats.htmlOverrideCount > 0) {
		markdown += `### 2. Remove Unnecessary HTML Element Overrides\n\n`;
		markdown += `Found **${stats.htmlOverrideCount}** unnecessary HTML element style overrides.\n\n`;
		markdown += '**Action:**\n';
		markdown += '- Remove declarations that duplicate global theme defaults\n';
		markdown += '- Let components inherit from `retro.css` defaults\n';
		markdown += '- Only override when you need different styling\n\n';
		markdown += '**Priority:** Medium\n\n';
	}

	markdown += '### 3. Increase Reliance on Global Styles\n\n';
	markdown += `Current inheritance score: **${stats.inheritanceScore}%**\n\n`;
	markdown += '**Benefits of using global styles:**\n';
	markdown += '- Consistent design across the application\n';
	markdown += '- Easier theme maintenance and switching\n';
	markdown += '- Reduced CSS bundle size\n';
	markdown += '- Less component-specific styling to maintain\n\n';
	markdown += '**Priority:** Low (Continuous improvement)\n\n';

	markdown += '---\n\n';

	// Quick Wins
	markdown += '## Quick Wins\n\n';
	markdown += 'Start with these high-impact, low-effort improvements:\n\n';

	// Find most common duplicated variable
	if (stats.mostCommonDuplicateVar) {
		markdown += `1. **Replace all \`${stats.mostCommonDuplicateVar.value}\` with \`var(--${stats.mostCommonDuplicateVar.name})\`**\n`;
		markdown += `   - ${stats.mostCommonDuplicateVar.count} occurrences\n`;
		markdown += `   - Simple find & replace\n\n`;
	}

	// Find file with most issues
	if (stats.worstFile) {
		markdown += `2. **Simplify \`${path.relative(PROJECT_ROOT, stats.worstFile.file)}\`**\n`;
		markdown += `   - ${stats.worstFile.unnecessaryCount} unnecessary declarations\n`;
		markdown += `   - ${stats.worstFile.score}% inheritance score\n`;
		markdown += `   - High impact for single file\n\n`;
	}

	markdown += '---\n\n';

	// Examples
	markdown += '## Before/After Examples\n\n';

	if (filesWithDuplicateVars.length > 0) {
		const example = filesWithDuplicateVars[0].duplicatesVariableValues[0];
		markdown += '### Example 1: CSS Variable Replacement\n\n';
		markdown += '**Before:**\n```css\n';
		markdown += `.${example.selector.replace(/^\./, '')} {\n`;
		markdown += `  ${example.property}: ${example.value};\n`;
		markdown += '}\n```\n\n';
		markdown += '**After:**\n```css\n';
		markdown += `.${example.selector.replace(/^\./, '')} {\n`;
		markdown += `  ${example.property}: ${example.suggestedVariable};\n`;
		markdown += '}\n```\n\n';
	}

	if (filesWithHTMLOverrides.length > 0) {
		const example = filesWithHTMLOverrides[0].unnecessaryHTMLOverrides[0];
		markdown += '### Example 2: Remove Unnecessary Override\n\n';
		markdown += '**Before:**\n```css\n';
		markdown += `${example.selector} {\n`;
		for (const decl of example.unnecessary) {
			markdown += `  ${decl.property}: ${decl.value};\n`;
		}
		markdown += '}\n```\n\n';
		markdown += '**After:**\n```css\n';
		markdown += `/* Remove this rule - it duplicates global ${example.element} styles from retro.css */\n`;
		markdown += '```\n\n';
	}

	return markdown;
}

/**
 * Calculate overall statistics
 */
function calculateOverallStats(allIssues) {
	const stats = {
		filesAnalyzed: allIssues.length,
		filesWithIssues: 0,
		totalDeclarations: 0,
		unnecessaryDeclarations: 0,
		duplicateVariableOccurrences: 0,
		htmlOverrideCount: 0,
		inheritanceScore: 0,
		potentialReduction: 0,
		mostCommonDuplicateVar: null,
		worstFile: null
	};

	// Variable occurrence tracking
	const variableCounts = new Map();

	for (const issue of allIssues) {
		stats.totalDeclarations += issue.totalDeclarations;
		stats.unnecessaryDeclarations += issue.unnecessaryDeclarations;

		if (issue.unnecessaryDeclarations > 0) {
			stats.filesWithIssues++;
		}

		// Count duplicate variable occurrences
		stats.duplicateVariableOccurrences += issue.duplicatesVariableValues.length;
		for (const dup of issue.duplicatesVariableValues) {
			const key = dup.variableName;
			variableCounts.set(key, (variableCounts.get(key) || 0) + 1);
		}

		// Count HTML overrides
		for (const override of issue.unnecessaryHTMLOverrides) {
			stats.htmlOverrideCount += override.unnecessary.length;
		}
	}

	// Calculate overall scores
	if (stats.totalDeclarations > 0) {
		stats.inheritanceScore = Math.round(
			100 - (stats.unnecessaryDeclarations / stats.totalDeclarations) * 100
		);
		stats.potentialReduction = Math.round(
			(stats.unnecessaryDeclarations / stats.totalDeclarations) * 100
		);
	}

	// Find most common duplicate variable
	if (variableCounts.size > 0) {
		let maxCount = 0;
		let maxVar = null;
		for (const [varName, count] of variableCounts) {
			if (count > maxCount) {
				maxCount = count;
				maxVar = varName;
			}
		}

		if (maxVar) {
			// Find an example value
			for (const issue of allIssues) {
				for (const dup of issue.duplicatesVariableValues) {
					if (dup.variableName === maxVar) {
						stats.mostCommonDuplicateVar = {
							name: maxVar,
							value: dup.value,
							count: maxCount
						};
						break;
					}
				}
				if (stats.mostCommonDuplicateVar) break;
			}
		}
	}

	// Find worst file
	const detector = new UnnecessaryCSSDetector(null);
	let worstScore = 100;
	for (const issue of allIssues) {
		if (issue.unnecessaryDeclarations > 0) {
			const score = detector.calculateInheritanceScore(issue);
			if (score < worstScore) {
				worstScore = score;
				stats.worstFile = {
					file: issue.file,
					score,
					unnecessaryCount: issue.unnecessaryDeclarations
				};
			}
		}
	}

	return stats;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
	log('\n🔍 Analyzing unnecessary CSS...\n', 'cyan');

	// Load theme data
	log('📖 Loading global theme styles...', 'cyan');
	const themeFile = path.join(PROJECT_ROOT, options.themeFile);
	const varsFile = path.join(PROJECT_ROOT, options.varsFile);

	const themeAnalyzer = new ThemeAnalyzer(themeFile, varsFile);
	themeAnalyzer.load();
	log('');

	// Find all CSS and Svelte files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', [
		'node_modules',
		'.svelte-kit',
		'variables.css',
		'retro.css'
	]);

	const svelteDir = path.join(PROJECT_ROOT, options.svelteDir);
	const svelteFiles = findFiles(svelteDir, '.svelte', ['node_modules', '.svelte-kit']);

	log(`Found ${cssFiles.length} CSS files`, 'blue');
	log(`Found ${svelteFiles.length} Svelte files`, 'blue');
	log('');

	// Analyze all files
	log('🔍 Analyzing component styles...', 'cyan');
	const detector = new UnnecessaryCSSDetector(themeAnalyzer);
	const allIssues = [];

	// Analyze CSS files
	for (const file of cssFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const rules = CSSParser.parse(content, file);

		if (rules.length > 0) {
			const issues = detector.analyzeComponent(file, rules);
			allIssues.push(issues);

			if (issues.unnecessaryDeclarations > 0) {
				logVerbose(
					`  ${path.relative(PROJECT_ROOT, file)} - ${issues.unnecessaryDeclarations} unnecessary`,
					'yellow'
				);
			}
		}
	}

	// Analyze Svelte files
	for (const file of svelteFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const css = extractSvelteCSS(content);

		if (css) {
			const rules = CSSParser.parse(css, file);
			if (rules.length > 0) {
				const issues = detector.analyzeComponent(file, rules);
				allIssues.push(issues);

				if (issues.unnecessaryDeclarations > 0) {
					logVerbose(
						`  ${path.relative(PROJECT_ROOT, file)} - ${issues.unnecessaryDeclarations} unnecessary`,
						'yellow'
					);
				}
			}
		}
	}

	log('');

	// Generate report
	log('📝 Generating report...', 'cyan');
	const markdown = generateMarkdownReport(allIssues, themeAnalyzer);

	// Output
	if (options.console) {
		console.log('\n' + markdown);
	} else {
		const outputPath = path.join(PROJECT_ROOT, options.output);
		fs.writeFileSync(outputPath, markdown, 'utf-8');
		log(`✅ Report saved to: ${options.output}`, 'green');
	}

	// Summary
	const stats = calculateOverallStats(allIssues);

	log('\n' + '='.repeat(60), 'cyan');
	log('📊 Summary', 'cyan');
	log('='.repeat(60), 'cyan');

	log(`Files analyzed: ${stats.filesAnalyzed}`, 'blue');
	log(
		`Files with issues: ${stats.filesWithIssues}`,
		stats.filesWithIssues > 0 ? 'yellow' : 'green'
	);
	log(
		`Inheritance score: ${stats.inheritanceScore}%`,
		stats.inheritanceScore >= 80 ? 'green' : stats.inheritanceScore >= 60 ? 'yellow' : 'red'
	);
	log(
		`Unnecessary declarations: ${stats.unnecessaryDeclarations}/${stats.totalDeclarations}`,
		'yellow'
	);
	log(
		`Potential CSS reduction: ${stats.potentialReduction}%`,
		stats.potentialReduction > 10 ? 'yellow' : 'green'
	);

	if (stats.unnecessaryDeclarations > 0) {
		log(
			`\n💡 Found ${stats.unnecessaryDeclarations} unnecessary declarations across ${stats.filesWithIssues} files`,
			'yellow'
		);
	} else {
		log('\n✅ No unnecessary CSS found! Excellent theme inheritance!', 'green');
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
