<script>
	import { onMount } from 'svelte';
	import MarkdownIt from 'markdown-it';

	let { content = '', class: className = '' } = $props();

	let markdownContainer = $state();
	let md;

	onMount(() => {
		// Initialize markdown-it with secure defaults
		md = new MarkdownIt({
			html: false, // Disable HTML tags in source for security
			xhtmlOut: true, // Use '/' to close single tags (<br />)
			breaks: true, // Convert '\n' in paragraphs into <br>
			linkify: true, // Autoconvert URL-like text to links
			typographer: true, // Enable smartquotes and other typographic replacements
			highlight: function (str, lang) {
				// Basic syntax highlighting support
				if (lang) {
					return `<pre class="language-${lang}"><code class="language-${lang}">${escapeHtml(str)}</code></pre>`;
				}
				return `<pre><code>${escapeHtml(str)}</code></pre>`;
			}
		});

		// Add custom rules for better security and styling
		// Open links in new tab with security attributes
		const defaultLinkRender =
			md.renderer.rules.link_open ||
			function (tokens, idx, options, env, self) {
				return self.renderToken(tokens, idx, options);
			};

		md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
			const aIndex = tokens[idx].attrIndex('target');
			if (aIndex < 0) {
				tokens[idx].attrPush(['target', '_blank']);
			} else {
				tokens[idx].attrs[aIndex][1] = '_blank';
			}

			// Add security attributes
			tokens[idx].attrPush(['rel', 'noopener noreferrer']);

			return defaultLinkRender(tokens, idx, options, env, self);
		};
	});

	function escapeHtml(str) {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	$effect(() => {
		if (md && markdownContainer && content) {
			// Render markdown content
			const rendered = md.render(content);
			markdownContainer.innerHTML = rendered;
		} else if (markdownContainer && !content) {
			markdownContainer.innerHTML = '';
		}
	});
</script>

<div
	bind:this={markdownContainer}
	class="markdown-content {className}"
	role="article"
	aria-label="Formatted message content"
></div>

<style>
	/* Base markdown styles */
	.markdown-content {
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		line-height: 1.6;
		color: var(--text);
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	/* Headings */
	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3),
	.markdown-content :global(h4),
	.markdown-content :global(h5),
	.markdown-content :global(h6) {
		font-family: var(--font-mono);
		font-weight: 700;
		margin-top: var(--space-4);
		margin-bottom: var(--space-3);
		color: var(--text);
		line-height: 1.25;
	}

	.markdown-content :global(h1) {
		font-size: var(--font-size-5);
	}
	.markdown-content :global(h2) {
		font-size: var(--font-size-4);
	}
	.markdown-content :global(h3) {
		font-size: var(--font-size-3);
	}
	.markdown-content :global(h4) {
		font-size: var(--font-size-2);
	}
	.markdown-content :global(h5) {
		font-size: var(--font-size-1);
	}
	.markdown-content :global(h6) {
		font-size: var(--font-size-0);
	}

	/* Paragraphs and basic elements */
	.markdown-content :global(p) {
		margin: var(--space-3) 0;
	}

	.markdown-content :global(p:first-child) {
		margin-top: 0;
	}

	.markdown-content :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Links */
	.markdown-content :global(a) {
		color: var(--primary);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
		transition: all 0.2s ease;
	}

	.markdown-content :global(a:hover) {
		color: var(--primary-bright);
		text-decoration-thickness: 2px;
		text-shadow: 0 0 8px var(--primary-glow);
	}

	/* Lists */
	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin: var(--space-3) 0;
		padding-left: var(--space-5);
	}

	.markdown-content :global(li) {
		margin: var(--space-2) 0;
	}

	.markdown-content :global(ul ul),
	.markdown-content :global(ul ol),
	.markdown-content :global(ol ul),
	.markdown-content :global(ol ol) {
		margin: var(--space-1) 0;
	}

	/* Code blocks */
	.markdown-content :global(pre) {
		display: block;
		margin: var(--space-3) 0;
		padding: var(--space-4);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--bg) 95%, var(--primary) 5%),
			color-mix(in oklab, var(--bg) 98%, var(--primary) 2%)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 12px;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
		box-shadow:
			inset 0 2px 8px rgba(0, 0, 0, 0.1),
			0 2px 12px -4px rgba(0, 0, 0, 0.1);
		scrollbar-width: thin;
		scrollbar-color: var(--primary) transparent;
	}

	.markdown-content :global(pre::-webkit-scrollbar) {
		height: 6px;
	}

	.markdown-content :global(pre::-webkit-scrollbar-thumb) {
		background: color-mix(in oklab, var(--primary) 40%, transparent);
		border-radius: 3px;
	}

	.markdown-content :global(pre code) {
		display: block;
		color: var(--text);
		background: none;
		border: none;
		padding: 0;
		font-size: inherit;
		line-height: inherit;
		border-radius: 0;
		white-space: pre;
		word-break: normal;
		word-wrap: normal;
		overflow-wrap: normal;
	}

	/* Inline code */
	.markdown-content :global(code) {
		display: inline;
		padding: var(--space-1) var(--space-2);
		background: color-mix(in oklab, var(--primary) 15%, transparent);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 6px;
		font-family: var(--font-mono);
		font-size: 0.9em;
		color: var(--primary);
		white-space: break-spaces;
		word-break: break-word;
	}

	/* Blockquotes */
	.markdown-content :global(blockquote) {
		margin: var(--space-3) 0;
		padding: var(--space-3) var(--space-4);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
		);
		border-left: 4px solid var(--primary);
		border-radius: 0 8px 8px 0;
		font-style: italic;
		color: var(--text);
		opacity: 0.9;
	}

	.markdown-content :global(blockquote p:first-child) {
		margin-top: 0;
	}

	.markdown-content :global(blockquote p:last-child) {
		margin-bottom: 0;
	}

	/* Tables */
	.markdown-content :global(table) {
		width: 100%;
		margin: var(--space-3) 0;
		border-collapse: collapse;
		overflow-x: auto;
		display: block;
	}

	.markdown-content :global(th),
	.markdown-content :global(td) {
		padding: var(--space-2) var(--space-3);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		text-align: left;
	}

	.markdown-content :global(th) {
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		font-weight: 700;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.markdown-content :global(tr:nth-child(even)) {
		background: color-mix(in oklab, var(--surface) 95%, transparent);
	}

	/* Horizontal rules */
	.markdown-content :global(hr) {
		margin: var(--space-5) 0;
		border: none;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in oklab, var(--primary) 30%, transparent),
			transparent
		);
	}

	/* Strong and emphasis */
	.markdown-content :global(strong) {
		font-weight: 700;
		color: var(--text);
	}

	.markdown-content :global(em) {
		font-style: italic;
		color: var(--text);
	}

	/* Images */
	.markdown-content :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 8px;
		margin: var(--space-3) 0;
	}

	/* Task lists */
	.markdown-content :global(input[type='checkbox']) {
		margin-right: var(--space-2);
		cursor: default;
		accent-color: var(--primary);
	}

	/* Definition lists */
	.markdown-content :global(dl) {
		margin: var(--space-3) 0;
	}

	.markdown-content :global(dt) {
		font-weight: 700;
		margin-top: var(--space-3);
		color: var(--primary);
	}

	.markdown-content :global(dd) {
		margin-left: var(--space-5);
		margin-top: var(--space-2);
	}

	/* Keyboard input */
	.markdown-content :global(kbd) {
		display: inline-block;
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.9em;
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 4px;
		box-shadow:
			inset 0 -1px 0 var(--surface-border),
			0 1px 2px rgba(0, 0, 0, 0.1);
	}

	/* Abbreviations */
	.markdown-content :global(abbr) {
		text-decoration: underline dotted;
		cursor: help;
	}

	/* Subscript and superscript */
	.markdown-content :global(sub),
	.markdown-content :global(sup) {
		font-size: 0.75em;
		line-height: 0;
		position: relative;
		vertical-align: baseline;
	}

	.markdown-content :global(sub) {
		bottom: -0.25em;
	}

	.markdown-content :global(sup) {
		top: -0.5em;
	}

	/* Line breaks */
	.markdown-content :global(br) {
		display: block;
		content: '';
		margin-top: var(--space-2);
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.markdown-content {
			font-size: var(--font-size-1);
		}

		.markdown-content :global(pre) {
			padding: var(--space-3);
			font-size: var(--font-size-0);
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.markdown-content :global(code) {
			border-width: 2px;
		}

		.markdown-content :global(blockquote) {
			border-left-width: 6px;
		}
	}

	/* Print styles */
	@media print {
		.markdown-content :global(pre) {
			page-break-inside: avoid;
		}

		.markdown-content :global(a) {
			text-decoration: none;
		}

		.markdown-content :global(a[href^='http']:after) {
			content: ' (' attr(href) ')';
		}
	}
</style>
