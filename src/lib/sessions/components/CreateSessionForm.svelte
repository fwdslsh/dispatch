<script>
	let { onCreate } = $props();

	let sessionName = $state('');
	let sessionMode = $state('shell');

	function handleSubmit(e) {
		e.preventDefault();
		if (!sessionName.trim()) {
			alert('Please enter a session name');
			return;
		}
		onCreate(sessionName.trim(), sessionMode);
		sessionName = '';
	}
</script>

<form onsubmit={handleSubmit}>
	<h3>New Session</h3>
	<input
		type="text"
		id="session-name"
		placeholder="Session name"
		bind:value={sessionName}
		required
	/>
	<select id="session-mode" bind:value={sessionMode}>
		<option value="shell">Shell</option>
		<option value="claude">Claude</option>
	</select>
	<button type="submit">Create Session</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid #333;
	}

	h3 {
		margin: 0 0 0.5rem 0;
	}
</style>
