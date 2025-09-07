Got it — here’s the updated, **JavaScript + JSDoc**, **mobile-first Svelte 5 (runes)** guide that **uses the Claude Code `/login` flow** (instead of wiring Anthropic OAuth yourself). You’ll run `claude-code`’s built-in login **once** in the same environment where your SvelteKit server runs, and the SDK will pick up stored credentials for API calls. This keeps auth simple, CLI-compatible, and production-ready. ([Anthropic][1])

---

# Claude Code Chat UI in Svelte 5 (JS + JSDoc, CLI `/login`, Mobile-first)

## What you’ll build

- A SvelteKit page composed of three runes-mode components:
  - `ChatMessages` – scrollable history with auto-scroll.
  - `ChatInput` – textarea + big “Send” button, Enter to send, Shift+Enter for newline.
  - `CommandsMenu` – touch-friendly list of **project slash commands** sourced from `.claude/commands/**.md`, with basic `$ARGUMENTS` / `$1…$n` prompting. ([Anthropic][2])

- A tiny backend:
  - `GET /api/commands` — reads `.claude/commands` from the working dir.
  - `POST /api/query` — calls the **Claude Code SDK**’s `query()` and returns the model’s text.

- **Authentication**: handled by **Claude Code’s built-in `/login`**. You (or your ops script) run it once on the server:
  `npx @anthropic-ai/claude-code login`
  Credentials are stored and reused by the SDK; no app-side OAuth needed. ([Anthropic][1])

---

## Prereqs

- Node 18+ (Claude Code SDK requires it). ([Anthropic][3])
- An existing SvelteKit app (Svelte 5).
- In the **same environment** where the Svelte server runs, complete login:

  ```bash
  npm i -D @anthropic-ai/claude-code
  npx @anthropic-ai/claude-code login
  ```

  > Tip: If you switch billing context (Pro/Max vs Console), run `/login` again to switch. ([Anthropic][1])

---

## Project structure

```
src/
  lib/components/
    ChatMessages.svelte
    ChatInput.svelte
    CommandsMenu.svelte
  routes/
    +page.svelte
    api/
      commands/+server.js
      query/+server.js
.claude/
  commands/
    optimize.md
    frontend/component.md
```

> Your `.claude/commands` Markdown files define custom slash commands; names are derived from filenames (and folders provide namespaces). ([Anthropic][2], [Anthropic][4])

---

## Backend: commands API (JS)

**`src/routes/api/commands/+server.js`**

```js
// Read project commands from ./.claude/commands
// Returns [{ name, scope, description, content }]
import fs from 'fs/promises';
import path from 'path';

/**
 * @returns {Promise<Response>}
 */
export async function GET() {
	const projectDir = process.cwd();
	const commandsDir = path.join(projectDir, '.claude', 'commands');
	/** @type {{name:string, scope:string, description:string, content:string}[]} */
	const commands = [];

	async function addFile(filePath, scope) {
		const content = await fs.readFile(filePath, 'utf-8');
		commands.push(formatCommand(path.relative(commandsDir, filePath), content, scope));
	}

	try {
		const stack = [commandsDir];
		while (stack.length) {
			const dir = stack.pop();
			const entries = await fs.readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				const p = path.join(dir, entry.name);
				if (entry.isDirectory()) stack.push(p);
				else if (entry.isFile() && entry.name.endsWith('.md')) {
					await addFile(p, 'project');
				}
			}
		}
	} catch (err) {
		// Directory missing or unreadable — return empty list rather than failing
		console.warn('commands: cannot read', err?.message);
	}

	return new Response(JSON.stringify(commands), {
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * @param {string} relPath - relative path inside .claude/commands (may include folders)
 * @param {string} content - markdown content
 * @param {string} scope - e.g. "project"
 */
function formatCommand(relPath, content, scope) {
	const base = relPath.replace(/\\/g, '/');
	const file = base.split('/').pop() || base;
	const name = '/' + file.replace(/\.md$/, '');
	/** @type {string} */
	let source = scope; // project or project:subdir
	if (base.includes('/')) {
		const folder = base.split('/')[0];
		source = `${scope}:${folder}`;
	}
	/** @type {string} */
	let description = '';
	const lines = content.trim().split('\n');
	if (lines[0]?.startsWith('---')) {
		const end = lines.indexOf('---', 1);
		const fm = lines.slice(1, end);
		const d = fm.find((l) => l.toLowerCase().startsWith('description:'));
		description = d ? d.split(':').slice(1).join(':').trim() : '';
		if (!description) {
			const first = lines.slice(end + 1).find((l) => l.trim());
			description = first || name;
		}
	} else {
		description = lines[0] || name;
	}
	return { name, scope: source, description, content };
}
```

---

## Backend: query API (JS) using Claude Code SDK

**`src/routes/api/query/+server.js`**

```js
// Streams Claude Code's response (simplified to buffered text for now)
import { query } from '@anthropic-ai/claude-code';

/**
 * @param {{ request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function POST({ request }) {
	/** @type {{prompt?:string}} */
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}
	const prompt = (body?.prompt || '').trim();
	if (!prompt) return new Response('No prompt provided', { status: 400 });

	// Auth: You must have run `npx @anthropic-ai/claude-code login` beforehand.
	// The SDK reads stored credentials; if missing/expired, it will error.

	/** @type {string} */
	let resultText = '';

	// Configure tool usage & behavior: allow safe defaults.
	// CLI enables a rich toolset (Read/Grep/Write/Bash/WebSearch etc.). :contentReference[oaicite:6]{index=6}
	const options = {
		allowedTools: ['Read', 'Grep', 'WriteFile', 'Bash', 'WebSearch'],
		permissionMode: 'default', // consider 'bypassPermissions' or 'acceptEdits' for trusted flows
		maxTurns: 5
	};

	try {
		for await (const msg of query({ prompt, options })) {
			if (msg.type === 'result') resultText += msg.result;
			// You could handle/forward other message types if needed.
		}
	} catch (err) {
		console.error('Claude query failed:', err);
		const hint = 'Is the server logged in? Run: npx @anthropic-ai/claude-code login';
		return new Response(`Error querying Claude Code. ${hint}`, { status: 500 });
	}

	return new Response(JSON.stringify({ text: resultText }), {
		headers: { 'Content-Type': 'application/json' }
	});
}
```

> Notes
> • This uses the SDK’s `query()` loop (async iterator) like the docs show. You can later upgrade this endpoint to **SSE** to stream partial chunks into the UI for type-as-it-writes behavior. ([Anthropic][3])
> • `permissionMode` is set to `"default"`, which mirrors CLI behavior (ask/guard sensitive ops). For a trusted, private environment, you can choose `"bypassPermissions"` (no prompts) or `"acceptEdits"` per your risk tolerance. ([Anthropic][5])

---

## Frontend components (Svelte 5, runes, JS + JSDoc)

> Mobile-first: Large tap targets, single-column layout, sticky bottom input bar, and scrollable history.

### `src/lib/components/ChatMessages.svelte`

```svelte
<script>
	import { afterUpdate } from 'svelte';
	/** @type {{ sender: 'user' | 'assistant', text: string }[]} */
	export let messages;

	let container;
	afterUpdate(() => {
		if (container) container.scrollTop = container.scrollHeight;
	});
</script>

<div bind:this={container} class="messages">
	{#each messages as msg}
		<div class="bubble {msg.sender}">
			<p>{msg.text}</p>
		</div>
	{/each}
</div>

<style>
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		background: var(--chat-bg, #f9f9f9);
	}
	.bubble {
		max-width: 80%;
		margin: 0.25rem 0;
		padding: 0.6rem 0.75rem;
		border-radius: 0.75rem;
		line-height: 1.3;
		word-wrap: break-word;
	}
	.bubble.user {
		margin-left: auto;
		background: #d1e7dd;
		text-align: right;
	}
	.bubble.assistant {
		margin-right: auto;
		background: #e9ecef;
	}
</style>
```

### `src/lib/components/ChatInput.svelte`

```svelte
<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
	/** @type {string} */
	let userInput = $state('');

	function send() {
		const t = userInput.trim();
		if (!t) return;
		dispatch('send', t);
		userInput = '';
	}

	/** @param {KeyboardEvent} e */
	function onKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<div class="input">
	<textarea
		bind:value={userInput}
		rows="1"
		placeholder="Type your message or /command…"
		on:keydown={onKeydown}
	/>
	<button class="send" on:click={send}>Send</button>
</div>

<style>
	.input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-top: 1px solid #ddd;
		background: #fff;
	}
	textarea {
		flex: 1;
		resize: none;
		padding: 0.6rem 0.7rem;
		font-size: 1rem;
	}
	.send {
		padding: 0.6rem 1rem;
		font-size: 1rem;
	}
</style>
```

### `src/lib/components/CommandsMenu.svelte`

```svelte
<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
	/** @type {{name:string, scope:string, description:string, content?:string}[]} */
	export let commands = [];
	let open = $state(false);

	function pick(cmd) {
		dispatch('commandSelected', cmd);
		open = false;
	}
</script>

<div class="menu">
	<button class="toggle" on:click={() => (open = !open)}>⋮ Commands</button>
	{#if open}
		<div class="list">
			{#if commands.length === 0}
				<p class="empty">No commands</p>
			{:else}
				{#each commands as cmd}
					<button class="item" on:click={() => pick(cmd)}>
						<strong>{cmd.name}</strong> <small>({cmd.scope})</small>
						<div class="desc">{cmd.description}</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.menu {
		position: relative;
	}
	.toggle {
		padding: 0.45rem 0.65rem;
		font-size: 0.95rem;
	}
	.list {
		position: absolute;
		bottom: 100%;
		left: 0;
		width: min(85vw, 260px);
		max-height: 50vh;
		overflow: auto;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
		z-index: 9;
	}
	.item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.6rem 0.7rem;
		border: 0;
		border-bottom: 1px solid #f1f1f1;
		background: transparent;
	}
	.item:hover {
		background: #f6f8fa;
	}
	.desc {
		font-size: 0.85rem;
		color: #555;
	}
	.empty {
		padding: 0.6rem 0.7rem;
		font-style: italic;
	}
</style>
```

---

## The Page: glue it together

**`src/routes/+page.svelte`**

```svelte
<script>
	import ChatMessages from '$lib/components/ChatMessages.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import CommandsMenu from '$lib/components/CommandsMenu.svelte';
	import { onMount } from 'svelte';

	/** @type {{name:string, scope:string, description:string, content:string}[]} */
	let commands = $state([]);
	/** @type {{sender:'user'|'assistant', text:string}[]} */
	let messages = $state([]);

	onMount(async () => {
		try {
			const r = await fetch('/api/commands');
			if (r.ok) commands = await r.json();
		} catch (e) {
			console.warn('Failed to load commands', e);
		}
	});

	/**
	 * @param {string} text
	 */
	async function sendToClaude(text) {
		messages = [...messages, { sender: 'user', text }];
		try {
			const r = await fetch('/api/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: text })
			});
			if (!r.ok) {
				const t = await r.text();
				messages = [...messages, { sender: 'assistant', text: `*(Error)* ${t}` }];
				return;
			}
			const { text: reply } = await r.json();
			messages = [...messages, { sender: 'assistant', text: reply }];
		} catch (e) {
			messages = [...messages, { sender: 'assistant', text: '*(Network error)*' }];
		}
	}

	/**
	 * Prompt-for-args and execute a selected slash command.
	 * @param {{name:string, content:string}} cmd
	 */
	async function runCommand(cmd) {
		let prompt = cmd.content || '';
		// Basic argument substitution: $ARGUMENTS or $1..$n
		if (/\$[0-9]+/.test(prompt) || prompt.includes('$ARGUMENTS')) {
			const input = window.prompt(`Arguments for ${cmd.name}:`);
			if (input == null) return; // cancelled
			if (prompt.includes('$ARGUMENTS')) {
				prompt = prompt.replaceAll('$ARGUMENTS', input);
			} else {
				const parts = input.split(/\s+/);
				parts.forEach((arg, i) => (prompt = prompt.replaceAll(`$${i + 1}`, arg)));
			}
		}
		await sendToClaude(prompt);
	}
</script>

<div class="chat">
	<ChatMessages {messages} />
	<div class="bar">
		<CommandsMenu {commands} on:commandSelected={(e) => runCommand(e.detail)} />
		<ChatInput on:send={(e) => sendToClaude(e.detail)} />
	</div>
</div>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		max-width: 640px;
		margin: 0 auto;
		height: 100dvh;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-top: 1px solid #ddd;
		background: #fff;
	}
	@media (min-width: 720px) {
		.chat {
			border-left: 1px solid #eee;
			border-right: 1px solid #eee;
		}
	}
</style>
```

---

## Usage & operational notes

1. **Login first (server-side):**
   On the host where SvelteKit runs:

   ```bash
   npx @anthropic-ai/claude-code login
   ```

   Follow the browser flow. Credentials are stored and “stick,” so subsequent API calls succeed without extra work. Use `/login` later to switch account/billing when needed. ([Anthropic][1])

2. **Create commands:**
   Put Markdown files under `.claude/commands`. A file `optimize.md` becomes `/optimize`. Folders add namespaces. First line or `description:` in YAML front-matter is shown in the menu. ([Anthropic][2])

3. **Run the app:**

   ```bash
   npm run dev
   ```

   Open your app, type messages or tap **⋮ Commands** and pick one. The backend calls the Claude Code SDK’s `query()` and returns the result. ([Anthropic][3])

---

## Production hardening checklist

- **Streaming UI:** Convert `/api/query` to **SSE** so the chat paints tokens as they arrive (use the SDK’s iterator to flush partials). ([Anthropic][3])
- **Permissions UX:** If you keep `permissionMode: "default"`, surface permission prompts (e.g., “Allow running Bash?”) as modal dialogs and send the user’s decision back (or switch to `"acceptEdits"` / `"bypassPermissions"` for trusted internal use). ([Anthropic][5])
- **Markdown rendering:** Parse assistant replies for Markdown + fenced code; add syntax highlighting.
- **Command UX:** Replace `prompt()` with a small args form (parse placeholders from the md).
- **Security:** If you allow `Bash` or `WriteFile`, keep this app scoped to trusted repos/users; log tool uses for audit.
- **Environments:** Run `/login` per environment (dev/stage/prod). If your server runs headless, execute the login where a browser is available, or run the CLI locally then copy the stored credentials file to the server (path depends on platform).
- **Fallback:** If `/api/query` throws auth errors, show a banner “Server not logged in to Claude Code” with the exact CLI command to run.

---

## Why this design

- **No custom OAuth:** We leverage Claude Code’s official **`/login`** path so your web UI matches the CLI’s auth flow and account semantics (Pro/Max vs Console workspace). ([Anthropic][1])
- **SDK-native:** We call the **Claude Code SDK** exactly like the docs demonstrate (`for await … of query()`), gaining the agent harness & tools Claude Code provides. ([Anthropic][3])
- **First-class commands:** `.claude/commands` is a core productivity feature; surfacing it in a touch menu mirrors the CLI’s slash commands list. ([Anthropic][2])

---

### References

- Claude Code **Quickstart** — login and account context (/login) guidance. ([Anthropic][1])
- Claude Code **Slash commands** — command file locations, naming, arguments. ([Anthropic][2])
- Claude Code **SDK (TypeScript)** — `query()` usage & options (mirrors our JS usage). ([Anthropic][3])
- Claude Code **Settings/Permissions** — configuring tools & permission modes. ([Anthropic][5])

If you want, I can extend this to add **SSE streaming** and a **permission prompt modal** in one pass.

[1]: https://docs.anthropic.com/en/docs/claude-code/quickstart?utm_source=chatgpt.com 'Quickstart - Claude Code'
[2]: https://docs.anthropic.com/en/docs/claude-code/slash-commands?utm_source=chatgpt.com 'Slash commands'
[3]: https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript?utm_source=chatgpt.com 'TypeScript'
[4]: https://www.anthropic.com/engineering/claude-code-best-practices?utm_source=chatgpt.com 'Claude Code: Best practices for agentic coding'
[5]: https://docs.anthropic.com/en/docs/claude-code/settings?utm_source=chatgpt.com 'Claude Code settings'
