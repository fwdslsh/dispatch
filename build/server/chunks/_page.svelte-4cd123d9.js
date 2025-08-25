import { c as create_ssr_component, v as validate_component } from './ssr-b31c518b.js';

const TerminalWrapper = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `${`<div class="h-[70vh] w-full rounded-lg overflow-hidden border bg-black flex items-center justify-center" data-svelte-h="svelte-16j12ht"><p class="text-white">Loading terminal...</p></div>`}`;
});
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `${$$result.head += `<!-- HEAD_svelte-1kq4bdm_START -->${$$result.title = `<title>Dispatch - SvelteKit PTY + Claude Code</title>`, ""}<script src="https://cdn.tailwindcss.com" data-svelte-h="svelte-1g08bst"><\/script><!-- HEAD_svelte-1kq4bdm_END -->`, ""} <div class="container mx-auto px-4 py-6 max-w-6xl"><h1 class="text-2xl font-semibold mb-6" data-svelte-h="svelte-1j9wsps">Dispatch Terminal</h1> <p class="text-gray-600 mb-6" data-svelte-h="svelte-8dyctd">Interactive PTY sessions with Claude Code in Docker</p> ${validate_component(TerminalWrapper, "TerminalWrapper").$$render($$result, {}, {}, {})}</div>`;
});

export { Page as default };
//# sourceMappingURL=_page.svelte-4cd123d9.js.map
