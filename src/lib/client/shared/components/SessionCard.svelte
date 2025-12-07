<script>
	/**
	 * @component SessionCard
	 * @description
	 * Interactive card for displaying session information with selection and action capabilities.
	 * Shows session type icon, title, workspace path, last activity, and action button.
	 * Supports active/inactive visual states and keyboard navigation.
	 *
	 * @typedef {Object} SessionCardProps
	 * @property {Object} session - Session data object
	 * @property {string} session.id - Unique session identifier
	 * @property {string} session.type - Session type ('ai' or 'terminal')
	 * @property {string} session.title - Session display title
	 * @property {string} session.workspacePath - Associated workspace path
	 * @property {string|Date} session.lastActivity - Last activity timestamp
	 * @property {string|null} [selectedSession=null] - Currently selected session ID
	 * @property {(session: Object) => void} [onSelect] - Called when card is clicked
	 * @property {(session: Object) => void} [onAction] - Called when action button clicked
	 * @property {string} [actionLabel='Connect'] - Action button label
	 * @property {(date: string|Date) => string} [formatDate] - Date formatting function
	 * @property {boolean} [isActive=false] - Visual active state indicator
	 *
	 * @example
	 * ```svelte
	 * <SessionCard
	 *   {session}
	 *   selectedSession={currentSessionId}
	 *   onSelect={handleSelectSession}
	 *   onAction={handleConnectSession}
	 *   actionLabel="Resume"
	 *   formatDate={(d) => new Date(d).toLocaleString()}
	 *   isActive={session.status === 'running'}
	 * />
	 * ```
	 *
	 * @fires {Object} select - Fired when card is clicked with session object
	 * @fires {Object} action - Fired when action button clicked with session object
	 */
	import Button from './Button.svelte';
	import IconRobot from './Icons/IconRobot.svelte';
	import IconTerminal from './Icons/IconTerminal.svelte';

	// Props
	let {
		session,
		selectedSession = null,
		onSelect,
		onAction,
		actionLabel = 'Connect',
		formatDate,
		isActive = false
	} = $props();

	// Handle session selection
	function handleSelect() {
		onSelect?.(session);
	}

	// Handle action button click
	function handleAction(e) {
		e.stopPropagation();
		onAction?.(session);
	}

	// Handle keyboard navigation
	function handleKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleSelect();
		}
	}

	const sessionId = $derived(`#${session.id?.slice(0, 6) || 'unknown'}`);
</script>

<div
	class="card-base card-session interactive {isActive
		? 'is-active'
		: 'is-inactive'} {selectedSession === session.id ? 'is-selected' : ''}"
	onclick={handleSelect}
	role="button"
	tabindex="0"
	onkeydown={handleKeydown}
>
	<div class="header-layout">
		<div class="text-primary">
			{#if session.type === 'ai'}
				<IconRobot size={16} />
			{:else}
				<IconTerminal size={16} />
			{/if}
		</div>
		<div class="info-section">
			<div class="title-text text-base flex items-center gap-2">{session.title} ({sessionId})</div>
			<div class="meta-text flex flex-col gap-1 text-sm">
				<span
					class="workspace-path font-mono max-w-full block text-muted"
					title={session.workspacePath}
				>
					{session.workspacePath}
				</span>
				<span class="date-text text-dim">{formatDate(session.lastActivity)}</span>
			</div>
		</div>
		<Button variant="ghost" augmented="none" onclick={handleAction} class="action-button">
			{actionLabel}
		</Button>
	</div>
</div>

<style>
	/* Card base styles */
	.card-session {
		background: var(--bg);
		min-height: 100px;
		cursor: pointer;
		margin-bottom: var(--space-2);
		outline: none;
		width: 100%;
		position: relative;
		overflow: hidden;
	}

	.card-session:hover {
		background: var(--bg-light);
	}

	.card-session:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-glow-20);
	}

	.card-session.is-selected {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, transparent);
		box-shadow: 0 0 0 1px var(--primary-glow-20);
	}

	.card-session.is-active {
		border-color: var(--success);
		background: color-mix(in oklab, var(--success) 5%, transparent);
		box-shadow: 0 0 0 1px color-mix(in oklab, var(--success) 10%, transparent);
	}

	.card-session.is-active:hover {
		background: color-mix(in oklab, var(--success) 10%, transparent);
		box-shadow: 0 2px 12px color-mix(in oklab, var(--success) 20%, transparent);
	}

	.card-session.is-active.is-selected {
		border-color: var(--success);
		background: color-mix(in oklab, var(--success) 15%, transparent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--success) 30%, transparent);
	}

	.card-session.is-inactive {
		border-color: var(--surface-border);
		opacity: 0.9;
	}

	.card-session.is-inactive:hover {
		opacity: 1;
	}

	.card-session.is-inactive.is-selected {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, transparent);
		opacity: 1;
	}

	/* Layout patterns */
	.header-layout {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.info-section {
		flex: 1;
		min-width: 0;
	}

	.title-text {
		font-weight: 600;
		color: var(--text);
		margin-bottom: var(--space-1);
		line-height: 1.4;
		min-height: 1.5rem;
	}

	.meta-text {
		display: flex;
		gap: var(--space-3);
		font-size: var(--font-size-1);
		color: var(--muted);
		line-height: 1.3;
		min-height: 2.5rem;
	}

	.workspace-path {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.75rem;
		word-break: break-all;
	}

	.date-text {
		white-space: nowrap;
		flex-shrink: 0;
		font-size: 0.7rem;
	}
</style>
