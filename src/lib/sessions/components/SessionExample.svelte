<!-- 
  Example usage of the simplified session architecture
  
  Shows how easy it is to use - just pick a session type and render the component!
-->
<script>
  import { SessionTypeSelector } from '../../components/index.js';

  // Simple state - no complex configuration needed
  let selectedSessionType = $state('shell');
  let projectId = $state('example-project');
  let sessionOptions = $state({
    name: 'Example Session',
    cols: 80,
    rows: 24
  });

  function handleSessionCreated(event) {
    console.log('Session created:', event);
  }

  function handleSessionEnded(event) {
    console.log('Session ended:', event);
  }
</script>

<div class="session-example">
  <div class="controls">
    <h2>Simple Session Type Selection</h2>
    
    <div class="session-type-picker">
      <label>
        <input 
          type="radio" 
          bind:group={selectedSessionType} 
          value="shell"
        />
        🐚 Shell Terminal
      </label>
      
      <label>
        <input 
          type="radio" 
          bind:group={selectedSessionType} 
          value="claude"
        />
        🤖 Claude Chat
      </label>
    </div>
  </div>

  <div class="session-container">
    <!-- This is all you need! No complex configuration or registration. -->
    <SessionTypeSelector
      sessionType={selectedSessionType}
      {projectId}
      {sessionOptions}
      onSessionCreated={handleSessionCreated}
      onSessionEnded={handleSessionEnded}
    />
  </div>
</div>

<style>
  .session-example {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .controls {
    padding: 1rem;
    background: var(--surface-variant, #f5f5f5);
    border-bottom: 1px solid var(--border, #ddd);
  }

  .controls h2 {
    margin: 0 0 1rem 0;
    color: var(--primary, #0066cc);
  }

  .session-type-picker {
    display: flex;
    gap: 1rem;
  }

  .session-type-picker label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--surface, #fff);
    border: 1px solid var(--border, #ccc);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .session-type-picker label:hover {
    background: var(--primary-light, #e3f2fd);
  }

  .session-type-picker input[type="radio"]:checked + span {
    font-weight: 600;
  }

  .session-container {
    flex: 1;
    overflow: hidden;
  }
</style>