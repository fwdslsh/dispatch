
<script>
  import { onMount } from 'svelte';
  import { io } from 'socket.io-client';
  import TerminalPane from '$lib/components/TerminalPane.svelte';
  import ClaudePane from '$lib/components/ClaudePane.svelte';

  let sessions = [];
  let workspaceRoot = '/workspaces';
  let chosenWorkspace = '';
  let workspaces = [];

  // Session grid state
  let layoutPreset = '2up'; // '1up' | '2up' | '4up'
  let pinned = []; // array of session IDs to display in grid order
  $: cols = layoutPreset === '1up' ? 1 : layoutPreset === '2up' ? 2 : 2;
  $: visible = pinned.map(id => sessions.find(s => s.id === id)).filter(Boolean).slice(0, layoutPreset === '4up' ? 4 : (layoutPreset === '2up' ? 2 : 1));

  async function listWorkspaces() {
    const r = await fetch('/api/workspaces'); const j = await r.json(); return j.list;
  }
  
  async function loadSessions() {
    const r = await fetch('/api/sessions'); const j = await r.json(); return j.sessions;
  }
  async function openWorkspace(p) {
    chosenWorkspace = p; await fetch('/api/workspaces', { method:'POST', body: JSON.stringify({ action:'open', path:p }) });
  }
  async function create(type) {
    if (!chosenWorkspace) return;
    
    if (type === 'pty') {
      // Create terminal via Socket.IO
      const socket = io();
      const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
      
      socket.emit('terminal.start', { key, workspacePath: chosenWorkspace }, (response) => {
        if (response.success) {
          const s = { id: response.id, type, workspacePath: chosenWorkspace };
          sessions = [...sessions, s];
          // auto-pin newest into grid if there's room
          if (pinned.length < (layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1)) pinned = [...pinned, response.id];
        } else {
          console.error('Failed to create terminal:', response.error);
        }
        socket.disconnect();
      });
    } else {
      // Create Claude session via API (for now)
      const r = await fetch('/api/sessions', { method:'POST', headers: { 'content-type':'application/json' },
        body: JSON.stringify({ type, workspacePath: chosenWorkspace, options: {} }) });
      const { id } = await r.json();
      const s = { id, type, workspacePath: chosenWorkspace };
      sessions = [...sessions, s];
      // auto-pin newest into grid if there's room
      if (pinned.length < (layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1)) pinned = [...pinned, id];
    }
  }

  function togglePin(id) {
    pinned = pinned.includes(id) ? pinned.filter(x => x !== id) : [...pinned, id];
  }

  onMount(async () => { 
    workspaces = await listWorkspaces(); 
    sessions = await loadSessions();
  });
</script>

<section style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
  <label>Workspace</label>
  <select bind:value={chosenWorkspace} on:change={(e)=>openWorkspace(e.target.value)}>
    <option value="" disabled selected>Select…</option>
    {#each workspaces as w}<option value={w}>{w}</option>{/each}
  </select>
  <button on:click={() => create('pty')} disabled={!chosenWorkspace}>+ Terminal</button>
  <button on:click={() => create('claude')} disabled={!chosenWorkspace}>+ Claude</button>

  <div style="margin-left:auto; display:flex; gap:6px;">
    <span>Layout:</span>
    <button on:click={() => layoutPreset='1up'} aria-pressed={layoutPreset==='1up'}>1-up</button>
    <button on:click={() => layoutPreset='2up'} aria-pressed={layoutPreset==='2up'}>2-up</button>
    <button on:click={() => layoutPreset='4up'} aria-pressed={layoutPreset==='4up'}>4-up</button>
  </div>
</section>

<!-- Session switcher palette -->
<section style="margin-top:8px; border:1px solid #222; border-radius:10px; padding:8px;">
  <strong>Sessions</strong>
  <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
    {#each sessions as s}
      <button on:click={() => togglePin(s.id)} aria-pressed={pinned.includes(s.id)} title={`Pin/unpin ${s.type} in grid`}>
        {s.type}:{s.id.slice(0,10)} {pinned.includes(s.id) ? '📌' : ''}
      </button>
    {/each}
  </div>
</section>

<!-- Grid -->
<div class="grid" style={`--cols:${cols}; margin-top:12px;`}>
  {#each visible as s}
    <div class="tile">
      {#if s.type === 'pty'}
        <TerminalPane ptyId={s.id} />
      {:else}
        <ClaudePane sessionId={s.id} />
      {/if}
    </div>
  {/each}
</div>
