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
    // Always send enter key even if there's no message
    if (currentInput.trim()) {
      // Send the message if there's content
      onSendMessage();
    } else {
      // Send just enter key if no content (for prompts, confirmations, etc.)
      onSpecialKey("\r");
    }
  }

  function handleKeydown(event) {
    console.debug("MobileControls: handleKeydown called, key:", event.key);
    onKeydown(event);
  }
</script>

{#if isMobile || true}
  <div class="mobile-controls">
    <div class="controls-grid">
      <!-- grid cells: we'll place buttons in order; input spans bottom row -->
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
        on:click={() => onSpecialKey("\u0003")}
        title="Ctrl+C"
        aria-label="Send Ctrl+C"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <button
        class="key-button toggle-button"
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
        class="key-button send-button"
        on:click={handleSend}
        title="Send"
        aria-label="Send"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      </button>

      <!-- Input spans the entire bottom row -->
      <div class="input-wrapper">
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
    </div>
  </div>
{/if}

<style>
  .mobile-controls {
    border-top: 1px solid rgba(0, 255, 136, 0.2);
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1001;
    height: auto;
    backdrop-filter: blur(15px);
  }

  .controls-grid {
    display: grid;
    gap: var(--space-xs);
    padding: var(--space-md);
    width: 100%;
    height: 100%;
  }

  .mobile-input {
    width: 100%;
    background: rgba(42, 42, 42, 0.6);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 16px; /* Prevent zoom on iOS */
    line-height: 1.4;
    resize: none;
    min-height: 44px;
    height: 100%;
    padding: var(--space-sm);
    backdrop-filter: blur(10px);
    box-sizing: border-box;
  }

  .mobile-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2);
  }

  .mobile-input::placeholder {
    color: var(--primary-muted);
    animation: pulse-placeholder 2s ease-in-out infinite;
  }
  
  @keyframes pulse-placeholder {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* Desktop: 2 rows x 6 columns
     - grid-template: 2 rows of equal height, 6 columns
     Mobile: 3 rows x 3 columns
     - grid-template: 3 rows of equal height, 3 columns
  */
  @media (min-width: 800px) {
    .controls-grid {
      grid-template-columns: repeat(6, 1fr);
      grid-template-rows: repeat(2, 1fr);
      align-items: stretch;
      column-gap: var(--space-xs);
      row-gap: var(--space-xs);
    }

    /* Buttons occupy first row and first part of second row as needed */
    /* .controls-grid > .key-button:nth-child(1) { grid-column: 1; grid-row: 1; }
    .controls-grid > .key-button:nth-child(2) { grid-column: 2; grid-row: 1; }
    .controls-grid > .key-button:nth-child(3) { grid-column: 3; grid-row: 1; }
    .controls-grid > .key-button:nth-child(4) { grid-column: 4; grid-row: 1; }
    .controls-grid > .key-button:nth-child(5) { grid-column: 5; grid-row: 1; }
    .controls-grid > .key-button:nth-child(6) { grid-column: 6; grid-row: 1; } */

    /* Input spans entire bottom row */
    .controls-grid > .input-wrapper {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }

  @media (max-width: 800px) {
    .controls-grid {
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      column-gap: var(--space-xs);
      row-gap: var(--space-xs);
      align-items: stretch;
    }

    /* Place first 6 controls across first two rows (3 cols each)
       Buttons 1-3: row 1, cols 1-3
       Buttons 4-6: row 2, cols 1-3
       Input spans row 3 across all columns
    */
    /* .controls-grid > .key-button:nth-child(1) { grid-column: 1; grid-row: 1; }
    .controls-grid > .key-button:nth-child(2) { grid-column: 2; grid-row: 1; }
    .controls-grid > .key-button:nth-child(3) { grid-column: 3; grid-row: 1; }
    .controls-grid > .key-button:nth-child(4) { grid-column: 1; grid-row: 2; }
    .controls-grid > .key-button:nth-child(5) { grid-column: 2; grid-row: 2; }
    .controls-grid > .key-button:nth-child(6) { grid-column: 3; grid-row: 2; } */

    .controls-grid > .input-wrapper {
      grid-column: 1 / -1;
      grid-row: 3;
    }
  }

  .key-button {
    background: transparent !important;
    color: var(--text-secondary) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: var(--space-md) !important;
    width: 100% !important;
    height: 100% !important;
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
</style>
