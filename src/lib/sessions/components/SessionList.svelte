<script>
	let { sessions = [], activeSessionId = null, onAttach, onEnd } = $props();
</script>

<div class="sessions-list">
	{#if sessions.length === 0}
		<p>No sessions yet</p>
	{:else}
		<ul>
			{#each sessions as session}
				<li class:active={activeSessionId === session.id}>
					<div>
						<strong>{session.name}</strong>
						<small>{session.type || 'shell'} • {session.status || 'inactive'}</small>
					</div>
					<div>
						{#if session.status === 'active'}
							<button onclick={() => onAttach(session.id)}> Attach </button>
						{/if}
						<button onclick={() => onEnd(session.id)}> End </button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		border: 1px solid #333;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	li.active {
		background: #333;
	}

	small {
		display: block;
		opacity: 0.7;
	}

	button {
		margin-left: 0.5rem;
	}
</style>
