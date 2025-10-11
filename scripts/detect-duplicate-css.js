#!/usr/bin/env node

/**
 * CSS Duplicate Detector
 *
 * Detects duplicate and near-duplicate CSS patterns across the codebase.
 *
 * Features:
 * - Exact duplicate detection (identical CSS rule blocks)
 * - Near-duplicate detection (80%+ similarity)
 * - Pattern extraction (common patterns like flexbox center, card layouts)
 * - Duplication scoring (percentage of duplicate code)
 * - Actionable suggestions for refactoring
 *
 * Usage:
 *   node scripts/detect-duplicate-css.js
 *   node scripts/detect-duplicate-css.js --threshold 95
 *   node scripts/detect-duplicate-css.js --console --verbose
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI Arguments
const args = process.argv.slice(2);
const options = {
	output: getArg('--output', 'CSS_DUPLICATES_REPORT.md'),
	threshold: parseInt(getArg('--threshold', '80')),
	cssDir: getArg('--css-dir', 'src/lib/client/shared/styles'),
	svelteDir: getArg('--svelte-dir', 'src'),
	verbose: args.includes('--verbose'),
	console: args.includes('--console')
};

function getArg(name, defaultValue) {
	const index = args.indexOf(name);
	return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

// ============================================================================
// CSS PARSING AND NORMALIZATION
// ============================================================================

class CSSParser {
	/**
	 * Parse CSS content into rule objects
	 * @param {string} css - CSS content
	 * @param {string} filePath - Source file path
	 * @returns {Array<Object>} Array of rule objects
	 */
	static parse(css, filePath) {
		const rules = [];

		// Remove comments
		css = css.replace(/\/\*[\s\S]*?\*\//g, '');

		// Match rule blocks: selector { declarations }
		const ruleRegex = /([^{]+)\{([^}]+)\}/g;
		let match;
		let lineNumber = 1;

		while ((match = ruleRegex.exec(css)) !== null) {
			const selector = match[1].trim();
			const declarations = match[2].trim();

			// Calculate line number
			const precedingText = css.substring(0, match.index);
			lineNumber = (precedingText.match(/\n/g) || []).length + 1;

			if (selector && declarations) {
				rules.push({
					selector,
					declarations,
					normalized: this.normalize(declarations),
					file: filePath,
					line: lineNumber,
					raw: match[0]
				});
			}
		}

		return rules;
	}

	/**
	 * Normalize CSS declarations for comparison
	 * @param {string} declarations - CSS declarations
	 * @returns {string} Normalized declarations
	 */
	static normalize(declarations) {
		return declarations
			.split(';')
			.map((decl) => decl.trim())
			.filter((decl) => decl.length > 0)
			.map((decl) => {
				// Normalize whitespace
				return decl.replace(/\s+/g, ' ').trim();
			})
			.sort()
			.join('; ');
	}

	/**
	 * Extract declarations as an array
	 * @param {string} declarations - CSS declarations
	 * @returns {Array<string>} Array of individual declarations
	 */
	static extractDeclarations(declarations) {
		return declarations
			.split(';')
			.map((decl) => decl.trim())
			.filter((decl) => decl.length > 0)
			.map((decl) => decl.replace(/\s+/g, ' ').trim());
	}
}

// ============================================================================
// FILE SCANNING
// ============================================================================

class FileScanner {
	/**
	 * Recursively scan directory for files
	 * @param {string} dir - Directory to scan
	 * @param {string} ext - File extension (e.g., '.css')
	 * @returns {Array<string>} Array of file paths
	 */
	static scanDirectory(dir, ext) {
		const files = [];
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules and build directories
				if (
					entry.name === 'node_modules' ||
					entry.name === 'build' ||
					entry.name === '.svelte-kit'
				) {
					continue;
				}
				files.push(...this.scanDirectory(fullPath, ext));
			} else if (entry.isFile() && entry.name.endsWith(ext)) {
				files.push(fullPath);
			}
		}

		return files;
	}

	/**
	 * Extract CSS from Svelte <style> blocks
	 * @param {string} content - Svelte file content
	 * @returns {string} Extracted CSS
	 */
	static extractSvelteCSS(content) {
		const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
		const cssBlocks = [];
		let match;

		while ((match = styleRegex.exec(content)) !== null) {
			cssBlocks.push(match[1]);
		}

		return cssBlocks.join('\n\n');
	}
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

class DuplicateDetector {
	/**
	 * Find exact duplicates
	 * @param {Array<Object>} rules - Array of CSS rules
	 * @returns {Map<string, Array<Object>>} Map of normalized declarations to rules
	 */
	static findExactDuplicates(rules) {
		const duplicateMap = new Map();

		for (const rule of rules) {
			const key = rule.normalized;

			if (!duplicateMap.has(key)) {
				duplicateMap.set(key, []);
			}
			duplicateMap.get(key).push(rule);
		}

		// Filter to only duplicates (2+ occurrences)
		const exactDuplicates = new Map();
		for (const [key, rules] of duplicateMap) {
			if (rules.length > 1) {
				exactDuplicates.set(key, rules);
			}
		}

		return exactDuplicates;
	}

	/**
	 * Calculate similarity between two declaration sets
	 * @param {Array<string>} decls1 - First set of declarations
	 * @param {Array<string>} decls2 - Second set of declarations
	 * @returns {number} Similarity percentage (0-100)
	 */
	static calculateSimilarity(decls1, decls2) {
		const set1 = new Set(decls1);
		const set2 = new Set(decls2);

		const intersection = new Set([...set1].filter((x) => set2.has(x)));
		const union = new Set([...set1, ...set2]);

		if (union.size === 0) return 0;
		return (intersection.size / union.size) * 100;
	}

	/**
	 * Find near-duplicate rules
	 * @param {Array<Object>} rules - Array of CSS rules
	 * @param {number} threshold - Similarity threshold percentage
	 * @returns {Array<Object>} Array of near-duplicate pairs
	 */
	static findNearDuplicates(rules, threshold = 80) {
		const nearDuplicates = [];

		for (let i = 0; i < rules.length; i++) {
			for (let j = i + 1; j < rules.length; j++) {
				const rule1 = rules[i];
				const rule2 = rules[j];

				// Skip if already exact duplicates
				if (rule1.normalized === rule2.normalized) continue;

				const decls1 = CSSParser.extractDeclarations(rule1.declarations);
				const decls2 = CSSParser.extractDeclarations(rule2.declarations);

				const similarity = this.calculateSimilarity(decls1, decls2);

				if (similarity >= threshold) {
					nearDuplicates.push({
						rule1,
						rule2,
						similarity: Math.round(similarity * 10) / 10,
						commonDeclarations: this.getCommonDeclarations(decls1, decls2),
						uniqueToRule1: this.getUniqueDeclarations(decls1, decls2),
						uniqueToRule2: this.getUniqueDeclarations(decls2, decls1)
					});
				}
			}
		}

		return nearDuplicates;
	}

	/**
	 * Get common declarations between two sets
	 */
	static getCommonDeclarations(decls1, decls2) {
		const set2 = new Set(decls2);
		return decls1.filter((d) => set2.has(d));
	}

	/**
	 * Get declarations unique to first set
	 */
	static getUniqueDeclarations(decls1, decls2) {
		const set2 = new Set(decls2);
		return decls1.filter((d) => !set2.has(d));
	}
}

// ============================================================================
// PATTERN EXTRACTION
// ============================================================================

class PatternExtractor {
	static patterns = [
		{
			name: 'Flexbox Center',
			keywords: ['display: flex', 'align-items: center', 'justify-content: center'],
			minMatch: 3
		},
		{
			name: 'Flex Row',
			keywords: ['display: flex', 'flex-direction: row'],
			minMatch: 2
		},
		{
			name: 'Flex Column',
			keywords: ['display: flex', 'flex-direction: column'],
			minMatch: 2
		},
		{
			name: 'Absolute Position',
			keywords: ['position: absolute'],
			minMatch: 1
		},
		{
			name: 'Fixed Position',
			keywords: ['position: fixed'],
			minMatch: 1
		},
		{
			name: 'Card Layout',
			keywords: ['border-radius', 'box-shadow', 'padding'],
			minMatch: 3
		},
		{
			name: 'Text Truncation',
			keywords: ['overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap'],
			minMatch: 3
		},
		{
			name: 'Transition Effect',
			keywords: ['transition:'],
			minMatch: 1
		},
		{
			name: 'Transform',
			keywords: ['transform:'],
			minMatch: 1
		},
		{
			name: 'Grid Layout',
			keywords: ['display: grid'],
			minMatch: 1
		}
	];

	/**
	 * Extract common patterns from rules
	 * @param {Array<Object>} rules - Array of CSS rules
	 * @returns {Map<string, Array<Object>>} Map of pattern names to matching rules
	 */
	static extractPatterns(rules) {
		const patternMap = new Map();

		for (const pattern of this.patterns) {
			patternMap.set(pattern.name, []);
		}

		for (const rule of rules) {
			const normalized = rule.normalized.toLowerCase();

			for (const pattern of this.patterns) {
				const matchCount = pattern.keywords.filter((keyword) =>
					normalized.includes(keyword.toLowerCase())
				).length;

				if (matchCount >= pattern.minMatch) {
					patternMap.get(pattern.name).push(rule);
				}
			}
		}

		// Filter out patterns with no matches
		for (const [name, rules] of patternMap) {
			if (rules.length === 0) {
				patternMap.delete(name);
			}
		}

		return patternMap;
	}
}

// ============================================================================
// STATISTICS
// ============================================================================

class Statistics {
	/**
	 * Calculate duplication statistics
	 * @param {Array<Object>} allRules - All CSS rules
	 * @param {Map} exactDuplicates - Exact duplicate map
	 * @param {Array} nearDuplicates - Near duplicate pairs
	 * @returns {Object} Statistics object
	 */
	static calculate(allRules, exactDuplicates, nearDuplicates) {
		let totalLines = 0;
		let duplicateLines = 0;

		// Count total lines
		for (const rule of allRules) {
			const lines = rule.raw.split('\n').length;
			totalLines += lines;
		}

		// Count duplicate lines
		for (const [_, rules] of exactDuplicates) {
			const ruleLines = rules[0].raw.split('\n').length;
			// Count duplicates beyond the first occurrence
			duplicateLines += ruleLines * (rules.length - 1);
		}

		const duplicationPercentage =
			totalLines > 0 ? Math.round((duplicateLines / totalLines) * 100 * 10) / 10 : 0;

		return {
			totalRules: allRules.length,
			totalLines,
			exactDuplicateGroups: exactDuplicates.size,
			exactDuplicateInstances: Array.from(exactDuplicates.values()).reduce(
				(sum, rules) => sum + rules.length,
				0
			),
			nearDuplicatePairs: nearDuplicates.length,
			duplicateLines,
			duplicationPercentage
		};
	}
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

class ReportGenerator {
	/**
	 * Generate markdown report
	 */
	static generateReport(stats, exactDuplicates, nearDuplicates, patterns, options) {
		const lines = [];

		// Header
		lines.push('# CSS Duplicate Detection Report');
		lines.push('');
		lines.push(`Generated: ${new Date().toISOString()}`);
		lines.push(`Similarity Threshold: ${options.threshold}%`);
		lines.push('');

		// Summary
		lines.push('## Summary Statistics');
		lines.push('');
		lines.push(`- **Total CSS Rules**: ${stats.totalRules}`);
		lines.push(`- **Total Lines**: ${stats.totalLines}`);
		lines.push(`- **Duplicate Lines**: ${stats.duplicateLines}`);
		lines.push(`- **Duplication Percentage**: ${stats.duplicationPercentage}%`);
		lines.push(`- **Exact Duplicate Groups**: ${stats.exactDuplicateGroups}`);
		lines.push(`- **Exact Duplicate Instances**: ${stats.exactDuplicateInstances}`);
		lines.push(
			`- **Near-Duplicate Pairs**: ${stats.nearDuplicatePairs} (≥${options.threshold}% similar)`
		);
		lines.push('');

		// Exact Duplicates
		if (exactDuplicates.size > 0) {
			lines.push('## Exact Duplicates');
			lines.push('');
			lines.push(
				'These CSS rule blocks are identical and can be consolidated into a single utility class or mixin.'
			);
			lines.push('');

			let groupNum = 1;
			for (const [normalized, rules] of exactDuplicates) {
				lines.push(`### Duplicate Group ${groupNum} (${rules.length} occurrences)`);
				lines.push('');
				lines.push('**Locations:**');
				for (const rule of rules) {
					const relPath = path.relative(process.cwd(), rule.file);
					lines.push(`- \`${relPath}:${rule.line}\` - \`${rule.selector}\``);
				}
				lines.push('');
				lines.push('**CSS:**');
				lines.push('```css');
				lines.push(rules[0].raw);
				lines.push('```');
				lines.push('');

				// Suggestion
				lines.push('**Suggested Refactoring:**');
				const className = this.suggestClassName(rules[0]);
				lines.push('```css');
				lines.push(`/* Create utility class */`);
				lines.push(`.${className} {`);
				const decls = CSSParser.extractDeclarations(rules[0].declarations);
				for (const decl of decls) {
					lines.push(`  ${decl};`);
				}
				lines.push(`}`);
				lines.push('```');
				lines.push('');

				groupNum++;
			}
		}

		// Near Duplicates
		if (nearDuplicates.length > 0) {
			lines.push('## Near Duplicates');
			lines.push('');
			lines.push(
				`These CSS rule blocks share significant similarity (≥${options.threshold}%). Consider extracting common patterns.`
			);
			lines.push('');

			// Sort by similarity descending
			nearDuplicates.sort((a, b) => b.similarity - a.similarity);

			for (let i = 0; i < Math.min(20, nearDuplicates.length); i++) {
				const dup = nearDuplicates[i];
				lines.push(`### Near-Duplicate Pair ${i + 1} (${dup.similarity}% similar)`);
				lines.push('');

				const relPath1 = path.relative(process.cwd(), dup.rule1.file);
				const relPath2 = path.relative(process.cwd(), dup.rule2.file);

				lines.push('**Rule 1:**');
				lines.push(`- Location: \`${relPath1}:${dup.rule1.line}\``);
				lines.push(`- Selector: \`${dup.rule1.selector}\``);
				lines.push('');

				lines.push('**Rule 2:**');
				lines.push(`- Location: \`${relPath2}:${dup.rule2.line}\``);
				lines.push(`- Selector: \`${dup.rule2.selector}\``);
				lines.push('');

				lines.push('**Common Declarations:**');
				lines.push('```css');
				for (const decl of dup.commonDeclarations) {
					lines.push(`  ${decl};`);
				}
				lines.push('```');
				lines.push('');

				if (dup.uniqueToRule1.length > 0) {
					lines.push('**Unique to Rule 1:**');
					lines.push('```css');
					for (const decl of dup.uniqueToRule1) {
						lines.push(`  ${decl};`);
					}
					lines.push('```');
					lines.push('');
				}

				if (dup.uniqueToRule2.length > 0) {
					lines.push('**Unique to Rule 2:**');
					lines.push('```css');
					for (const decl of dup.uniqueToRule2) {
						lines.push(`  ${decl};`);
					}
					lines.push('```');
					lines.push('');
				}
			}

			if (nearDuplicates.length > 20) {
				lines.push(`*... and ${nearDuplicates.length - 20} more near-duplicate pairs*`);
				lines.push('');
			}
		}

		// Patterns
		if (patterns.size > 0) {
			lines.push('## Common Patterns');
			lines.push('');
			lines.push('These patterns appear frequently and could benefit from utility classes.');
			lines.push('');

			for (const [name, rules] of patterns) {
				if (rules.length < 3) continue; // Only show patterns with 3+ occurrences

				lines.push(`### ${name} (${rules.length} occurrences)`);
				lines.push('');
				lines.push('**Example locations:**');
				for (let i = 0; i < Math.min(5, rules.length); i++) {
					const rule = rules[i];
					const relPath = path.relative(process.cwd(), rule.file);
					lines.push(`- \`${relPath}:${rule.line}\` - \`${rule.selector}\``);
				}
				if (rules.length > 5) {
					lines.push(`- ... and ${rules.length - 5} more`);
				}
				lines.push('');
			}
		}

		// Recommendations
		lines.push('## Recommendations');
		lines.push('');
		lines.push('### Quick Wins');
		lines.push('');

		if (stats.exactDuplicateGroups > 0) {
			lines.push(
				`1. **Extract ${stats.exactDuplicateGroups} exact duplicates** into utility classes`
			);
			lines.push('   - Create reusable classes in a utilities CSS file');
			lines.push('   - Replace duplicate rules with class references');
			lines.push(
				'   - Estimated reduction: ~' +
					Math.round((stats.duplicateLines / stats.totalLines) * 100) +
					'% of CSS'
			);
		}

		if (stats.nearDuplicatePairs > 5) {
			lines.push(`2. **Review ${stats.nearDuplicatePairs} near-duplicate pairs**`);
			lines.push('   - Identify common patterns worth extracting');
			lines.push('   - Consider CSS variables for shared values');
			lines.push('   - Use mixins or utility classes for repeated patterns');
		}

		if (patterns.size > 0) {
			lines.push('3. **Create utility classes for common patterns**');
			const frequentPatterns = Array.from(patterns.entries())
				.filter(([_, rules]) => rules.length >= 3)
				.sort((a, b) => b[1].length - a[1].length);

			if (frequentPatterns.length > 0) {
				lines.push('   - Top patterns to extract:');
				for (const [name, rules] of frequentPatterns.slice(0, 5)) {
					lines.push(`     - ${name}: ${rules.length} occurrences`);
				}
			}
		}

		lines.push('');
		lines.push('### Best Practices');
		lines.push('');
		lines.push('- Use CSS custom properties (variables) for repeated values');
		lines.push('- Create utility classes for common patterns');
		lines.push('- Consider a utility-first approach for frequently repeated styles');
		lines.push('- Extract component-specific styles to component files');
		lines.push('- Use CSS Grid/Flexbox utilities for layout patterns');
		lines.push('');

		return lines.join('\n');
	}

	/**
	 * Suggest a class name based on rule properties
	 */
	static suggestClassName(rule) {
		const decls = CSSParser.extractDeclarations(rule.declarations);

		// Check for common patterns
		if (decls.some((d) => d.includes('display: flex'))) {
			if (
				decls.some((d) => d.includes('align-items: center')) &&
				decls.some((d) => d.includes('justify-content: center'))
			) {
				return 'flex-center';
			}
			if (decls.some((d) => d.includes('flex-direction: column'))) {
				return 'flex-column';
			}
			return 'flex-row';
		}

		if (decls.some((d) => d.includes('display: grid'))) {
			return 'grid-layout';
		}

		if (decls.some((d) => d.includes('position: absolute'))) {
			return 'absolute';
		}

		if (decls.some((d) => d.includes('position: fixed'))) {
			return 'fixed';
		}

		// Default
		return 'utility-class';
	}

	/**
	 * Print report to console
	 */
	static printToConsole(report, stats, options) {
		console.log('');
		console.log('='.repeat(80));
		console.log('CSS DUPLICATE DETECTION');
		console.log('='.repeat(80));
		console.log('');
		console.log(`Total Rules:        ${stats.totalRules}`);
		console.log(`Total Lines:        ${stats.totalLines}`);
		console.log(`Duplicate Lines:    ${stats.duplicateLines} (${stats.duplicationPercentage}%)`);
		console.log(
			`Exact Duplicates:   ${stats.exactDuplicateGroups} groups, ${stats.exactDuplicateInstances} instances`
		);
		console.log(
			`Near Duplicates:    ${stats.nearDuplicatePairs} pairs (≥${options.threshold}% similar)`
		);
		console.log('');
		console.log(`Report saved to: ${options.output}`);
		console.log('');
		console.log('='.repeat(80));
		console.log('');
	}
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log('Scanning for CSS files...');

	const projectRoot = path.resolve(__dirname, '..');
	const cssDir = path.resolve(projectRoot, options.cssDir);
	const svelteDir = path.resolve(projectRoot, options.svelteDir);

	// Scan for CSS files
	const cssFiles = FileScanner.scanDirectory(cssDir, '.css');
	const svelteFiles = FileScanner.scanDirectory(svelteDir, '.svelte');

	if (options.verbose) {
		console.log(`Found ${cssFiles.length} CSS files`);
		console.log(`Found ${svelteFiles.length} Svelte files`);
	}

	// Parse all CSS
	const allRules = [];

	for (const file of cssFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const rules = CSSParser.parse(content, file);
		allRules.push(...rules);
	}

	for (const file of svelteFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const css = FileScanner.extractSvelteCSS(content);
		if (css) {
			const rules = CSSParser.parse(css, file);
			allRules.push(...rules);
		}
	}

	if (options.verbose) {
		console.log(`Parsed ${allRules.length} CSS rules`);
	}

	// Detect duplicates
	console.log('Detecting duplicates...');
	const exactDuplicates = DuplicateDetector.findExactDuplicates(allRules);
	const nearDuplicates = DuplicateDetector.findNearDuplicates(allRules, options.threshold);

	// Extract patterns
	console.log('Extracting patterns...');
	const patterns = PatternExtractor.extractPatterns(allRules);

	// Calculate statistics
	const stats = Statistics.calculate(allRules, exactDuplicates, nearDuplicates);

	// Generate report
	console.log('Generating report...');
	const report = ReportGenerator.generateReport(
		stats,
		exactDuplicates,
		nearDuplicates,
		patterns,
		options
	);

	// Output
	if (!options.console) {
		const outputPath = path.resolve(projectRoot, options.output);
		fs.writeFileSync(outputPath, report, 'utf-8');
		console.log(`\nReport written to: ${outputPath}`);
	}

	// Print summary
	ReportGenerator.printToConsole(report, stats, options);

	// Exit with appropriate code
	if (stats.duplicationPercentage > 10) {
		console.log('⚠️  High duplication detected (>10%). Consider refactoring.');
		process.exit(0); // Still exit successfully
	} else {
		console.log('✓ Duplication is within acceptable range.');
		process.exit(0);
	}
}

// Run
main().catch((err) => {
	console.error('Error:', err.message);
	if (options.verbose) {
		console.error(err.stack);
	}
	process.exit(1);
});
