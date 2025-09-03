<script>
  let {
    sessions = [],
    activeSessions = [],
    activeSessionId = null,
    onSessionSelect = () => {},
    onSessionCreate = () => {},
    onSessionEnd = () => {}
  } = $props();
</script>

<div class="sessions-panel">
  <div class="panel-header">
    <h2>Sessions</h2>
    <button class="btn-create" onclick={onSessionCreate}>
      New Session
    </button>
  </div>

  <div class="sessions-list">
    {#if activeSessions.length === 0}
      <div class="no-sessions">
        <p>No active sessions</p>
        <p class="hint">Create a session to get started</p>
      </div>
    {:else}
      {#each activeSessions as session (session.id)}
        <div 
          class="session-item" 
          class:active={session.id === activeSessionId}
          onclick={() => onSessionSelect(session.id)}
        >
          <div class="session-info">
            <span class="session-name">{session.name || session.id}</span>
            <span class="session-mode">{session.mode}</span>
          </div>
          <button 
            class="btn-end"
            onclick={(e) => {
              e.stopPropagation();
              onSessionEnd(session.id);
            }}
          >
            End
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .sessions-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-darker);
    border-right: 1px solid var(--border);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border);
  }

  .panel-header h2 {
    margin: 0;
    color: var(--text);
    font-size: 1.1rem;
  }

  .btn-create {
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .sessions-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm);
  }

  .no-sessions {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .no-sessions .hint {
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }

  .session-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .session-item:hover {
    border-color: var(--accent);
  }

  .session-item.active {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--accent);
  }

  .session-info {
    display: flex;
    flex-direction: column;
  }

  .session-name {
    font-weight: 500;
    color: var(--text);
  }

  .session-mode {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .btn-end {
    padding: 0.25rem 0.5rem;
    background: rgba(255, 99, 99, 0.1);
    color: var(--error);
    border: 1px solid rgba(255, 99, 99, 0.3);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-end:hover {
    background: rgba(255, 99, 99, 0.2);
  }
</style>