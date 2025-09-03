<script>
  import { sidebarState, panelStore, viewportStore } from '$lib/stores/panel-store.js';
  import Hammer from 'hammerjs';
  
  let { 
    sessions = [],
    currentSessionId = null,
    onSessionSelect = () => {},
    onNewSession = () => {}
  } = $props();
  
  let sidebarElement = $state();
  let backdropElement = $state();
  let hammerInstance = $state();
  let cleanupFunctions = $state([]);
  
  // Sidebar state
  let isVisible = $state(false);
  let isAnimating = $state(false);
  
  $effect(() => {
    // Subscribe to sidebar state
    const unsubscribeSidebar = sidebarState.subscribe(state => {
      isVisible = state.visible;
      isAnimating = state.animating;
    });
    
    cleanupFunctions.push(unsubscribeSidebar);
    
    // Set up hammer.js for gesture detection
    setupGestureDetection();
    
    // Cleanup function
    return () => {
      // Clean up subscriptions and event listeners
      cleanupFunctions.forEach(fn => fn());
      
      // Clean up hammer instance
      if (hammerInstance) {
        hammerInstance.destroy();
      }
      
      // Remove edge zone element
      const edgeZone = document.querySelector('[data-edge-zone]');
      if (edgeZone) {
        edgeZone.remove();
      }
    };
  });
  
  function setupGestureDetection() {
    // Set up left edge swipe detection
    const edgeZone = document.createElement('div');
    edgeZone.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 20px;
      height: 100vh;
      z-index: 150;
      pointer-events: auto;
      background: transparent;
    `;
    document.body.appendChild(edgeZone);
    
    // Hammer.js instance for edge zone
    const edgeHammer = new Hammer(edgeZone);
    edgeHammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
    
    edgeHammer.on('swiperight', () => {
      if (!isVisible) {
        panelStore.showPanel('sidebar');
      }
    });
    
    // Hammer.js instance for sidebar
    if (sidebarElement) {
      hammerInstance = new Hammer(sidebarElement);
      hammerInstance.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
      
      hammerInstance.on('swipeleft', () => {
        if (isVisible) {
          panelStore.hidePanel('sidebar');
        }
      });
    }
    
    cleanupFunctions.push(() => {
      if (edgeHammer) {
        edgeHammer.destroy();
      }
      if (hammerInstance) {
        hammerInstance.destroy();
      }
      if (edgeZone && edgeZone.parentNode) {
        edgeZone.parentNode.removeChild(edgeZone);
      }
    });
  }
  
  function handleBackdropClick() {
    if (isVisible && !isAnimating) {
      panelStore.hidePanel('sidebar');
    }
  }
  
  function handleSessionClick(sessionId) {
    onSessionSelect(sessionId);
    panelStore.hidePanel('sidebar');
  }
  
  function handleNewSessionClick() {
    onNewSession();
    panelStore.hidePanel('sidebar');
  }
  
  function handleAnimationEnd() {
    panelStore.setAnimating('sidebar', false);
  }
  
  // Format session for display
  function formatSessionName(session) {
    return session.name || session.meta?.name || `Session ${session.id.slice(0, 8)}`;
  }
  
  function formatSessionTime(session) {
    if (!session.createdAt) return '';
    const date = new Date(session.createdAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
</script>

<!-- Backdrop -->
{#if isVisible}
  <div 
    class="sidebar-backdrop"
    class:animating={isAnimating}
    bind:this={backdropElement}
    onclick={handleBackdropClick}
    ontransitionend={handleAnimationEnd}
  ></div>
{/if}

<!-- Sidebar -->
<div 
  class="mobile-sidebar"
  class:visible={isVisible}
  class:animating={isAnimating}
  bind:this={sidebarElement}
  ontransitionend={handleAnimationEnd}
>
  <div class="sidebar-header">
    <h2>Sessions</h2>
    <button 
      class="close-button"
      onclick={() => panelStore.hidePanel('sidebar')}
      aria-label="Close sidebar"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
  
  <div class="sidebar-content">
    <!-- New session button -->
    <button 
      class="new-session-button"
      onclick={handleNewSessionClick}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      New Session
    </button>
    
    <!-- Sessions list -->
    <div class="sessions-list">
      {#each sessions as session}
        <button 
          class="session-item"
          class:current={session.id === currentSessionId}
          onclick={() => handleSessionClick(session.id)}
        >
          <div class="session-info">
            <div class="session-name">{formatSessionName(session)}</div>
            <div class="session-time">{formatSessionTime(session)}</div>
          </div>
          <div class="session-status" class:active={session.status === 'active'}>
            {session.status === 'active' ? '●' : '○'}
          </div>
        </button>
      {/each}
      
      {#if sessions.length === 0}
        <div class="empty-state">
          <p>No sessions found</p>
          <p class="empty-hint">Create a new session to get started</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
    opacity: 0;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(2px);
  }
  
  .sidebar-backdrop.animating {
    opacity: 1;
  }
  
  .mobile-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    max-width: 80vw;
    background: var(--bg-darker, #0a0a0a);
    border-right: 1px solid var(--border, rgba(0, 255, 136, 0.2));
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
  }
  
  .mobile-sidebar.visible {
    transform: translateX(0);
  }
  
  .mobile-sidebar.animating {
    transition-duration: 0.3s;
  }
  
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border, rgba(0, 255, 136, 0.2));
    background: var(--bg-primary, #1a1a1a);
  }
  
  .sidebar-header h2 {
    color: var(--text-primary, #ffffff);
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }
  
  .close-button {
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    padding: var(--space-xs);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    background: rgba(0, 255, 136, 0.1);
    color: var(--primary, #00ff88);
  }
  
  .close-button svg {
    width: 20px;
    height: 20px;
    stroke-width: 2;
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .new-session-button {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--primary, #00ff88);
    color: var(--bg-darker, #0a0a0a);
    border: none;
    padding: var(--space-sm) var(--space-md);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9rem;
  }
  
  .new-session-button:hover {
    background: var(--primary-bright, #00ff99);
    transform: translateY(-1px);
  }
  
  .new-session-button svg {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }
  
  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-primary, #1a1a1a);
    border: 1px solid var(--border, rgba(0, 255, 136, 0.2));
    border-radius: 8px;
    padding: var(--space-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }
  
  .session-item:hover {
    background: rgba(0, 255, 136, 0.05);
    border-color: var(--primary, #00ff88);
  }
  
  .session-item.current {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--primary, #00ff88);
  }
  
  .session-info {
    flex: 1;
    min-width: 0;
  }
  
  .session-name {
    color: var(--text-primary, #ffffff);
    font-weight: 500;
    font-size: 0.9rem;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .session-time {
    color: var(--text-secondary, #888);
    font-size: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .session-status {
    color: var(--text-secondary, #888);
    font-size: 1.2rem;
    margin-left: var(--space-sm);
  }
  
  .session-status.active {
    color: var(--primary, #00ff88);
  }
  
  .empty-state {
    text-align: center;
    padding: var(--space-xl) var(--space-md);
    color: var(--text-secondary, #888);
  }
  
  .empty-state p {
    margin: 0 0 var(--space-xs) 0;
  }
  
  .empty-hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }
  
  /* Mobile optimizations */
  @media (max-width: 400px) {
    .mobile-sidebar {
      width: 100vw;
      max-width: 100vw;
    }
  }
  
  /* Desktop: hide on large screens */
  @media (min-width: 1025px) {
    .mobile-sidebar,
    .sidebar-backdrop {
      display: none;
    }
  }
  
  /* Smooth scrolling */
  .sidebar-content {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }
  
  /* Performance optimizations */
  .mobile-sidebar {
    will-change: transform;
    contain: layout style;
  }
  
  .mobile-sidebar.animating {
    will-change: transform;
  }
  
  .sidebar-backdrop {
    will-change: opacity;
  }
</style>