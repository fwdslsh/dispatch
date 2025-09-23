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
	/* Component-specific overrides only */
	.markdown-content {
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	/* Custom language highlighting */
	.markdown-content :global(.language-bash),
	.markdown-content :global(.language-shell) {
		border-left-color: var(--accent-amber);
	}

	.markdown-content :global(.language-javascript),
	.markdown-content :global(.language-js) {
		border-left-color: var(--accent-warning);
	}

	.markdown-content :global(.language-python) {
		border-left-color: var(--accent-cyan);
	}

	.markdown-content :global(.language-css) {
		border-left-color: var(--accent-magenta);
	}
</style>
