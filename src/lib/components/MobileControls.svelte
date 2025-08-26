<script>
  export let currentInput = "";
  export let onSendMessage = () => {};
  export let onKeydown = () => {};
  export let onSpecialKey = () => {};
  export let onToggleView = () => {};
  export let isTerminalView = true;
  export let isMobile = false;

  // Input handling functions
  function handleSend() {
    console.debug("MobileControls: handleSend called, input:", currentInput);
    onSendMessage();
  }

  function handleKeydown(event) {
    console.debug("MobileControls: handleKeydown called, key:", event.key);
    onKeydown(event);
  }
</script>

{#if isMobile || true}
  <div class="mobile-controls">
    <div class="mobile-input-wrapper">
      <textarea
        bind:value={currentInput}
        on:keydown={handleKeydown}
        placeholder="Type your command..."
        class="mobile-input"
        rows="1"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        inputmode="text"
        enterkeyhint="send"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      ></textarea>
    </div>
    <div class="mobile-toolbar">
      <button
        class="key-button {isTerminalView ? 'chat-button' : 'terminal-button'}"
        on:click={onToggleView}
        title={isTerminalView ? "Switch to Chat" : "Switch to Terminal"}
        aria-label={isTerminalView
          ? "Switch to Chat view"
          : "Switch to Terminal view"}
      >
        {#if isTerminalView}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        {/if}
      </button>
      <button
        class="key-button"
        on:click={() => onSpecialKey("\t")}
        title="Tab"
        aria-label="Send Tab key"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 10h6" />
        </svg>
      </button>
      <button
        class="key-button"
        on:click={() => onSpecialKey("\u0003")}
        title="Ctrl+C"
        aria-label="Send Ctrl+C"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <button
        class="key-button"
        on:click={() => onSpecialKey("\u001b[A")}
        title="Up arrow"
        aria-label="Send Up arrow"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
      <button
        class="key-button"
        on:click={() => onSpecialKey("\u001b[B")}
        title="Down arrow"
        aria-label="Send Down arrow"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </button>

      <button
        class="key-button"
        on:click={handleSend}
        aria-label="Send command"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .mobile-controls {
    background: rgba(26, 26, 26, 0.8);
    border-top: 1px solid rgba(0, 255, 136, 0.2);
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1001;
    min-height: 120px; /* Increased for input area */
    backdrop-filter: blur(15px);
    box-shadow:
      0 -4px 12px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .mobile-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    border-bottom: 1px solid var(--border);
  }

  .mobile-input {
    flex: 1;
    background: rgba(42, 42, 42, 0.6);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 16px; /* Prevent zoom on iOS */
    line-height: 1.4;
    resize: none;
    min-height: 40px;
    padding: var(--space-sm);
    backdrop-filter: blur(10px);
  }

  .mobile-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2);
  }

  .mobile-input::placeholder {
    color: var(--text-muted);
  }

  .mobile-send {
    background: var(--primary) !important;
    color: var(--bg-dark) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: var(--space-sm) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 44px;
    min-height: 44px;
    flex-shrink: 0;
  }

  .mobile-send:hover:not(:disabled) {
    background: var(--text-primary) !important;
    transform: scale(1.05);
  }

  .mobile-send:disabled {
    background: var(--text-muted) !important;
    cursor: not-allowed !important;
    opacity: 0.5;
  }

  .mobile-send svg {
    width: 20px;
    height: 20px;
  }

  .mobile-toolbar {
    display: flex;
    gap: var(--space-xs);
    padding: var(--space-md);
    justify-content: space-evenly;
  }

  .key-button {
    background: transparent !important;
    color: var(--text-secondary) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: var(--space-md) !important;
    min-width: 44px !important;
    min-height: 44px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
  }

  .key-button:hover,
  .key-button:active {
    background: rgba(0, 255, 136, 0.1) !important;
    color: var(--primary) !important;
    transform: none !important;
    text-shadow:
      0 0 8px var(--primary),
      0 0 16px rgba(0, 255, 136, 0.4) !important;
  }

  .key-button svg {
    width: 20px;
    height: 20px;
    stroke-width: 2;
  }

  .chat-button {
    color: var(--primary) !important;
  }

  .chat-button:hover {
    color: var(--text-primary) !important;
    background: rgba(0, 255, 136, 0.1) !important;
    text-shadow:
      0 0 8px var(--primary),
      0 0 16px rgba(0, 255, 136, 0.4) !important;
  }

  .terminal-button {
    color: var(--primary) !important;
  }

  .terminal-button:hover {
    color: var(--text-primary) !important;
    background: rgba(0, 255, 136, 0.1) !important;
    text-shadow:
      0 0 8px var(--primary),
      0 0 16px rgba(0, 255, 136, 0.4) !important;
  }
</style>
