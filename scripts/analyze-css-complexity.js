#!/usr/bin/env node

/**
 * CSS Complexity Analyzer
 *
 * Analyzes CSS files for complexity metrics including specificity, nesting depth,
 * and identifies problem areas that may need refactoring.
 *
 * Usage:
 *   node scripts/analyze-css-complexity.js [options]
 *
 * Options:
 *   --output <path>     Output file path (default: CSS_COMPLEXITY_REPORT.md)
 *   --css-dir <path>    CSS directory to scan (default: src/lib/client/shared/styles)
 *   --threshold <num>   Complexity threshold (default: 7)
 *   --verbose           Show detailed output
 *   --console           Output to console instead of file
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
	output: getArgValue('--output') || 'CSS_COMPLEXITY_REPORT.md',
	cssDir: getArgValue('--css-dir') || 'src/lib/client/shared/styles',
	threshold: parseInt(getArgValue('--threshold') || '7', 10),
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
 * Parse CSS content and extract selectors with their rules
 */
function parseCSS(cssContent) {
	const selectors = [];

	// Remove comments
	cssContent = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

	// Match CSS rules (selector { ... })
	const ruleRegex = /([^{}]+)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

	let match;
	let nestingLevel = 0;

	// Split by rules and track nesting
	const lines = cssContent.split('\n');
	let currentSelector = '';
	let braceDepth = 0;
	let ruleStart = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		// Count opening and closing braces
		const openBraces = (line.match(/\{/g) || []).length;
		const closeBraces = (line.match(/\}/g) || []).length;

		if (line.includes('{') && !line.startsWith('@')) {
			// Start of a rule
			const selectorPart = line.split('{')[0].trim();
			if (selectorPart) {
				currentSelector = selectorPart;
				ruleStart = i;
			}
		}

		braceDepth += openBraces - closeBraces;

		if (braceDepth === 0 && currentSelector && ruleStart >= 0) {
			// End of a rule
			selectors.push({
				selector: currentSelector,
				line: ruleStart + 1,
				nesting: 0 // Will calculate separately
			});
			currentSelector = '';
			ruleStart = -1;
		}
	}

	return selectors;
}

/**
 * Calculate CSS specificity (a, b, c format)
 * a = number of IDs
 * b = number of classes, attributes, and pseudo-classes
 * c = number of elements and pseudo-elements
 */
function calculateSpecificity(selector) {
	// Remove pseudo-elements content
	selector = selector.replace(/::(before|after|first-line|first-letter)/g, ' ');

	let a = 0; // IDs
	let b = 0; // Classes, attributes, pseudo-classes
	let c = 0; // Elements, pseudo-elements

	// Count IDs
	a = (selector.match(/#[a-zA-Z][\w-]*/g) || []).length;

	// Count classes
	b += (selector.match(/\.[a-zA-Z][\w-]*/g) || []).length;

	// Count attributes
	b += (selector.match(/\[[^\]]+\]/g) || []).length;

	// Count pseudo-classes (but not pseudo-elements)
	b += (selector.match(/:[a-zA-Z][\w-]*(?!\()/g) || []).length;
	b += (selector.match(/:[a-zA-Z][\w-]*\([^)]*\)/g) || []).length;

	// Count elements
	const elements = selector.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g) || [];
	c += elements.length;

	// Handle universal selector (doesn't add to specificity but we track it)
	const hasUniversal = selector.includes('*');

	return {
		a,
		b,
		c,
		value: a * 100 + b * 10 + c,
		string: `${a},${b},${c}`,
		hasUniversal
	};
}

/**
 * Calculate nesting depth for a selector
 */
function calculateNestingDepth(selector) {
	// Count spaces, >, +, ~ combinators
	const parts = selector.split(/[\s>+~]+/).filter((p) => p.trim());
	return parts.length - 1;
}

/**
 * Detect problem patterns in selectors
 */
function detectProblems(selector, specificity, nesting) {
	const problems = [];

	// Universal selector
	if (specificity.hasUniversal) {
		problems.push({ type: 'universal', message: 'Uses universal selector (*)' });
	}

	// High specificity
	if (specificity.a > 0 || specificity.b > 3) {
		problems.push({ type: 'high-specificity', message: `High specificity (${specificity.string})` });
	}

	// Deep nesting
	if (nesting > 4) {
		problems.push({ type: 'deep-nesting', message: `Deep nesting (${nesting} levels)` });
	}

	// Overly long selector
	if (selector.length > 100) {
		problems.push({ type: 'long-selector', message: `Long selector (${selector.length} chars)` });
	}

	// Qualified class selectors (e.g., div.class)
	if (/[a-zA-Z][\w-]*\.[a-zA-Z]/.test(selector)) {
		problems.push({ type: 'qualified-class', message: 'Qualified class selector' });
	}

	return problems;
}

/**
 * Analyze a single CSS file
 */
function analyzeCSSFile(filePath) {
	const cssContent = fs.readFileSync(filePath, 'utf-8');
	const selectors = parseCSS(cssContent);

	logVerbose(`  Analyzing ${selectors.length} selectors...`, 'gray');

	const analysis = {
		file: filePath,
		fileSize: cssContent.length,
		ruleCount: selectors.length,
		selectors: [],
		specificities: [],
		nestingDepths: [],
		problems: []
	};

	for (const selectorData of selectors) {
		const { selector, line } = selectorData;
		const specificity = calculateSpecificity(selector);
		const nesting = calculateNestingDepth(selector);
		const problems = detectProblems(selector, specificity, nesting);

		analysis.selectors.push({
			selector,
			line,
			specificity,
			nesting,
			problems
		});

		analysis.specificities.push(specificity.value);
		analysis.nestingDepths.push(nesting);

		if (problems.length > 0) {
			analysis.problems.push({
				selector,
				line,
				problems
			});
		}
	}

	// Calculate statistics
	const avgSpecificity = analysis.specificities.length > 0
		? analysis.specificities.reduce((a, b) => a + b, 0) / analysis.specificities.length
		: 0;

	const maxNesting = analysis.nestingDepths.length > 0
		? Math.max(...analysis.nestingDepths)
		: 0;

	const complexSelectors = analysis.selectors.filter(
		(s) => s.specificity.a > 0 || s.specificity.b > 3
	).length;

	// Calculate complexity score (1-10)
	// Formula: (avg_specificity / 10 * 2) + (max_nesting / 4 * 1.5) + (problem_selectors / total * 10 * 0.5)
	const specificityScore = (avgSpecificity / 10) * 2;
	const nestingScore = (maxNesting / 4) * 1.5;
	const problemScore = (analysis.problems.length / Math.max(analysis.ruleCount, 1)) * 5;

	const complexityScore = Math.min(10, specificityScore + nestingScore + problemScore);

	return {
		...analysis,
		avgSpecificity,
		maxNesting,
		complexSelectors,
		complexityScore: parseFloat(complexityScore.toFixed(2))
	};
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(analyses) {
	let markdown = '# CSS Complexity Analysis Report\n\n';
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown += '> This report analyzes CSS complexity metrics including specificity, nesting depth, and problem patterns.\n\n';

	// Summary statistics
	const totalFiles = analyses.length;
	const totalRules = analyses.reduce((sum, a) => sum + a.ruleCount, 0);
	const avgComplexity = analyses.reduce((sum, a) => sum + a.complexityScore, 0) / totalFiles;
	const highComplexityFiles = analyses.filter((a) => a.complexityScore > options.threshold);

	markdown += '## Summary\n\n';
	markdown += `- **Total CSS Files:** ${totalFiles}\n`;
	markdown += `- **Total CSS Rules:** ${totalRules}\n`;
	markdown += `- **Average Complexity Score:** ${avgComplexity.toFixed(2)}/10\n`;
	markdown += `- **High Complexity Files:** ${highComplexityFiles.length} (threshold: ${options.threshold})\n\n`;

	// Complexity overview table
	markdown += '## Complexity Overview\n\n';
	markdown += '| File | Complexity | Avg Specificity | Max Nesting | Rules | Problems |\n';
	markdown += '|------|------------|-----------------|-------------|-------|----------|\n';

	const sortedByComplexity = [...analyses].sort((a, b) => b.complexityScore - a.complexityScore);

	for (const analysis of sortedByComplexity) {
		const relativePath = path.relative(PROJECT_ROOT, analysis.file);
		const fileName = path.basename(analysis.file);
		const complexityIndicator = analysis.complexityScore > options.threshold ? ' ⚠️' : '';

		markdown += `| \`${fileName}\` | **${analysis.complexityScore.toFixed(1)}**/10${complexityIndicator} | `;
		markdown += `${analysis.avgSpecificity.toFixed(1)} | `;
		markdown += `${analysis.maxNesting} | `;
		markdown += `${analysis.ruleCount} | `;
		markdown += `${analysis.problems.length} |\n`;
	}

	markdown += '\n---\n\n';

	// High complexity files warning
	if (highComplexityFiles.length > 0) {
		markdown += `## ⚠️ High Complexity Files (Score > ${options.threshold})\n\n`;
		markdown += 'These files should be prioritized for refactoring:\n\n';

		for (const analysis of highComplexityFiles) {
			const relativePath = path.relative(PROJECT_ROOT, analysis.file);

			markdown += `### ${relativePath}\n\n`;
			markdown += `**Complexity Score:** ${analysis.complexityScore.toFixed(1)}/10\n\n`;
			markdown += `**Metrics:**\n`;
			markdown += `- Average Specificity: ${analysis.avgSpecificity.toFixed(2)}\n`;
			markdown += `- Max Nesting Depth: ${analysis.maxNesting}\n`;
			markdown += `- Complex Selectors: ${analysis.complexSelectors}\n`;
			markdown += `- Problem Selectors: ${analysis.problems.length}\n`;
			markdown += `- File Size: ${(analysis.fileSize / 1024).toFixed(1)} KB\n\n`;
		}

		markdown += '---\n\n';
	}

	// Problem selectors
	markdown += '## Problem Selectors\n\n';

	const allProblems = analyses.flatMap((a) =>
		a.problems.map((p) => ({ file: a.file, ...p }))
	);

	if (allProblems.length === 0) {
		markdown += '✅ No problem selectors detected!\n\n';
	} else {
		markdown += `Found ${allProblems.length} selectors with potential issues:\n\n`;

		// Group by file
		const problemsByFile = new Map();
		for (const problem of allProblems) {
			const fileName = path.basename(problem.file);
			if (!problemsByFile.has(fileName)) {
				problemsByFile.set(fileName, []);
			}
			problemsByFile.get(fileName).push(problem);
		}

		for (const [fileName, problems] of problemsByFile) {
			markdown += `### ${fileName}\n\n`;

			for (const problem of problems) {
				markdown += `**Line ${problem.line}:** \`${problem.selector}\`\n\n`;

				for (const issue of problem.problems) {
					markdown += `- ⚠️ ${issue.message}\n`;
				}

				markdown += '\n';
			}
		}

		markdown += '---\n\n';
	}

	// Detailed file analysis
	markdown += '## Detailed File Analysis\n\n';

	for (const analysis of sortedByComplexity) {
		const relativePath = path.relative(PROJECT_ROOT, analysis.file);
		const fileName = path.basename(analysis.file);

		markdown += `### ${relativePath}\n\n`;
		markdown += `**Complexity Score:** ${analysis.complexityScore.toFixed(1)}/10\n\n`;

		markdown += '**Metrics:**\n\n';
		markdown += `- File Size: ${(analysis.fileSize / 1024).toFixed(1)} KB\n`;
		markdown += `- Total Rules: ${analysis.ruleCount}\n`;
		markdown += `- Average Specificity: ${analysis.avgSpecificity.toFixed(2)}\n`;
		markdown += `- Max Nesting Depth: ${analysis.maxNesting}\n`;
		markdown += `- Complex Selectors: ${analysis.complexSelectors}\n`;
		markdown += `- Problem Selectors: ${analysis.problems.length}\n\n`;

		if (analysis.problems.length > 0) {
			markdown += '<details>\n';
			markdown += '<summary>Show problems</summary>\n\n';

			for (const problem of analysis.problems) {
				markdown += `**Line ${problem.line}:** \`${problem.selector}\`\n\n`;
				for (const issue of problem.problems) {
					markdown += `- ${issue.message}\n`;
				}
				markdown += '\n';
			}

			markdown += '</details>\n\n';
		}

		markdown += '---\n\n';
	}

	// Recommendations
	markdown += '## Refactoring Recommendations\n\n';
	markdown += '### Priority Actions\n\n';

	if (highComplexityFiles.length > 0) {
		markdown += '1. **Focus on High Complexity Files**\n';
		markdown += '   - Start with files scoring > ' + options.threshold + '\n';
		markdown += '   - Break down complex selectors into simpler ones\n\n';
	}

	if (allProblems.length > 0) {
		const problemTypes = new Map();
		for (const problem of allProblems) {
			for (const issue of problem.problems) {
				problemTypes.set(issue.type, (problemTypes.get(issue.type) || 0) + 1);
			}
		}

		markdown += '2. **Address Common Issues**\n';
		for (const [type, count] of problemTypes) {
			markdown += `   - ${type}: ${count} occurrences\n`;
		}
		markdown += '\n';
	}

	markdown += '3. **General Best Practices**\n';
	markdown += '   - Keep specificity low (prefer classes over IDs)\n';
	markdown += '   - Limit nesting to 3-4 levels maximum\n';
	markdown += '   - Use utility classes for common patterns\n';
	markdown += '   - Avoid universal selectors in production\n';
	markdown += '   - Consider BEM or similar naming conventions\n\n';

	return markdown;
}

/**
 * Main execution
 */
async function main() {
	log('\n📊 Analyzing CSS complexity...\n', 'cyan');

	// Find all CSS files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', ['node_modules', '.svelte-kit']);

	log(`Found ${cssFiles.length} CSS files in ${options.cssDir}`, 'blue');
	log('');

	// Analyze each file
	log('🔍 Analyzing files...', 'cyan');
	const analyses = [];

	for (const cssFile of cssFiles) {
		const relativePath = path.relative(PROJECT_ROOT, cssFile);
		log(`  ${relativePath}`, 'gray');

		const analysis = analyzeCSSFile(cssFile);
		analyses.push(analysis);

		const scoreColor =
			analysis.complexityScore > options.threshold
				? 'red'
				: analysis.complexityScore > options.threshold - 2
					? 'yellow'
					: 'green';

		logVerbose(`    Complexity: ${analysis.complexityScore.toFixed(1)}/10`, scoreColor);
	}

	log('');

	// Generate report
	log('📝 Generating report...', 'cyan');
	const markdown = generateMarkdownReport(analyses);

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

	const avgComplexity =
		analyses.reduce((sum, a) => sum + a.complexityScore, 0) / analyses.length;
	const highComplexity = analyses.filter((a) => a.complexityScore > options.threshold).length;
	const totalProblems = analyses.reduce((sum, a) => sum + a.problems.length, 0);

	log(`CSS files analyzed: ${analyses.length}`, 'blue');
	log(`Average complexity: ${avgComplexity.toFixed(2)}/10`, avgComplexity > options.threshold ? 'yellow' : 'green');
	log(`High complexity files: ${highComplexity}`, highComplexity > 0 ? 'yellow' : 'green');
	log(`Problem selectors: ${totalProblems}`, totalProblems > 0 ? 'yellow' : 'green');

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
