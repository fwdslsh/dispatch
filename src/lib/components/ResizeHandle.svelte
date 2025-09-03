<script>
  // Props
  let {
    direction = 'vertical', // 'vertical' | 'horizontal'
    position = { x: 0, y: 0 },
    minSize = 100,
    maxSize = 1000,
    paneId = null,
    onresizestart = () => {},
    onresize = () => {},
    onresizeend = () => {}
  } = $props();
  
  // Local state
  let handleElement = $state(null);
  let isResizing = $state(false);
  let startPosition = $state(null);
  let startSize = $state(null);
  let currentPosition = $state(null);
  
  // Handle mouse down
  function handleMouseDown(e) {
    isResizing = true;
    startPosition = {
      x: e.clientX,
      y: e.clientY
    };
    currentPosition = { ...startPosition };
    
    // Add global listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add resizing class to body
    document.body.classList.add('resizing');
    if (direction === 'vertical') {
      document.body.classList.add('resizing-ew');
    } else {
      document.body.classList.add('resizing-ns');
    }
    
    // Prevent text selection
    e.preventDefault();
    
    // Dispatch resize start event
    onresizestart({
      detail: {
        position: startPosition,
        direction,
        paneId
      }
    });
  }
  
  // Handle mouse move
  function handleMouseMove(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startPosition.x;
    const deltaY = e.clientY - startPosition.y;
    
    currentPosition = {
      x: e.clientX,
      y: e.clientY
    };
    
    // Calculate new size based on direction
    const delta = direction === 'vertical' ? deltaX : deltaY;
    const constrainedDelta = constrainDelta(delta);
    
    // Dispatch resize event
    onresize({
      detail: {
        delta: constrainedDelta,
        rawDelta: delta,
        position: currentPosition,
        direction,
        paneId
      }
    });
  }
  
  // Handle mouse up
  function handleMouseUp(e) {
    if (!isResizing) return;
    
    isResizing = false;
    
    // Remove global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Remove resizing classes from body
    document.body.classList.remove('resizing');
    document.body.classList.remove('resizing-ew');
    document.body.classList.remove('resizing-ns');
    
    // Dispatch resize end event
    onresizeend({
      detail: {
        position: currentPosition,
        direction,
        paneId
      }
    });
    
    // Reset state
    startPosition = null;
    currentPosition = null;
  }
  
  // Constrain delta to respect min/max sizes
  function constrainDelta(delta) {
    // This will be calculated based on actual pane sizes
    // For now, just return the delta
    // The parent component should handle the actual constraints
    return delta;
  }
  
  // Handle touch events for mobile
  function handleTouchStart(e) {
    const touch = e.touches[0];
    handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault()
    });
  }
  
  function handleTouchMove(e) {
    const touch = e.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  }
  
  function handleTouchEnd(e) {
    handleMouseUp({});
  }
  
  // Cleanup on destroy
  $effect(() => {
    return () => {
      if (isResizing) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.classList.remove('resizing');
        document.body.classList.remove('resizing-ew');
        document.body.classList.remove('resizing-ns');
      }
    };
  });
</script>

<div
  bind:this={handleElement}
  class="resize-handle {direction}"
  class:active={isResizing}
  style="
    {direction === 'vertical' ? `left: ${position.x}px` : ''};
    {direction === 'horizontal' ? `top: ${position.y}px` : ''};
  "
  onmousedown={handleMouseDown}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="separator"
  aria-orientation={direction}
  aria-label="Resize handle"
  tabindex="0"
>
  <div class="resize-handle-visual"></div>
</div>

<style>
  .resize-handle {
    position: absolute;
    z-index: 20;
    user-select: none;
    touch-action: none;
  }
  
  .resize-handle.vertical {
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    transform: translateX(-4px);
  }
  
  .resize-handle.horizontal {
    width: 100%;
    height: 8px;
    cursor: ns-resize;
    transform: translateY(-4px);
  }
  
  .resize-handle-visual {
    position: absolute;
    background: var(--primary, #00ff88);
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
  }
  
  .resize-handle.vertical .resize-handle-visual {
    width: 2px;
    height: 100%;
    left: 3px;
  }
  
  .resize-handle.horizontal .resize-handle-visual {
    width: 100%;
    height: 2px;
    top: 3px;
  }
  
  .resize-handle:hover .resize-handle-visual {
    opacity: 0.3;
  }
  
  .resize-handle.active .resize-handle-visual {
    opacity: 0.5;
    background: var(--primary, #00ff88);
  }
  
  .resize-handle:focus {
    outline: none;
  }
  
  .resize-handle:focus .resize-handle-visual {
    opacity: 0.4;
    background: var(--primary, #00ff88);
  }
  
  /* Mobile touch targets */
  @media (max-width: 768px) {
    .resize-handle.vertical {
      width: 12px;
      transform: translateX(-6px);
    }
    
    .resize-handle.horizontal {
      height: 12px;
      transform: translateY(-6px);
    }
    
    .resize-handle.vertical .resize-handle-visual {
      left: 5px;
    }
    
    .resize-handle.horizontal .resize-handle-visual {
      top: 5px;
    }
  }
  
  /* Global styles for resizing state */
  :global(body.resizing) {
    user-select: none !important;
  }
  
  :global(body.resizing-ew) {
    cursor: ew-resize !important;
  }
  
  :global(body.resizing-ns) {
    cursor: ns-resize !important;
  }
  
  /* Augmented UI integration */
  .resize-handle[data-augmented-ui] {
    --aug-border-bg: var(--primary);
    --aug-border-all: 1px;
  }
</style>