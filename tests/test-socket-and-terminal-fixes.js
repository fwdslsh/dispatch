#!/usr/bin/env node

/**
 * Test socket connection and terminal fixes
 * Verifies WebSocket, LinkDetector, and terminal interaction fixes
 */

console.log('🧪 Testing Socket and Terminal Fixes...\n');

try {
  console.log('📋 Testing Socket Connection Fix');
  
  // Test 1: Check socket URL configuration
  console.log('  - Testing socket connection configuration...');
  
  const fs = await import('fs');
  const sessionPageContent = await fs.promises.readFile('src/routes/sessions/[id]/+page.svelte', 'utf8');
  
  const hasSocketUrl = sessionPageContent.includes('http://localhost:3030');
  const hasDevCheck = sessionPageContent.includes('import.meta.env.DEV');
  
  assert(hasSocketUrl, 'Should configure socket to connect to localhost:3030 in dev mode');
  assert(hasDevCheck, 'Should check for dev environment');
  
  console.log('  ✅ Socket connection properly configured for development');
  
  // Test 2: LinkDetector hover fix
  console.log('  - Testing LinkDetector hover safety...');
  
  const linkDetectorContent = await fs.promises.readFile('src/lib/services/link-detector.js', 'utf8');
  
  const hasHoverSafety = linkDetectorContent.includes('text || match[0] || \'link\'');
  const hasHoverFunction = linkDetectorContent.includes('hover: (event, text) =>');
  
  assert(hasHoverSafety, 'Should have null safety in hover function');
  assert(hasHoverFunction, 'Should accept event and text parameters');
  
  console.log('  ✅ LinkDetector hover function has proper null safety');
  
  // Test 3: Terminal focus improvements
  console.log('  - Testing terminal focus handling...');
  
  const multiPaneContent = await fs.promises.readFile('src/lib/components/MultiPaneLayout.svelte', 'utf8');
  
  const hasTerminalFocus = multiPaneContent.includes('terminal.focus()');
  const hasTryCatch = multiPaneContent.includes('try {') && multiPaneContent.includes('linkDetector.registerWithTerminal');
  const hasReducedTimeout = multiPaneContent.includes('setTimeout(() => {') && multiPaneContent.includes('50);');
  
  assert(hasTerminalFocus, 'Should explicitly focus terminals');
  assert(hasTryCatch, 'Should have error handling for link detector registration');
  
  console.log('  ✅ Terminal focus handling improved');
  
  // Test 4: Dimension calculation improvements
  console.log('  - Testing dimension calculation fixes...');
  
  const hasPageWrapper = multiPaneContent.includes('panesWrapper');
  const hasWrapperBinding = multiPaneContent.includes('bind:this={panesWrapper}');
  const hasWrapperObserver = multiPaneContent.includes('resizeObserver.observe(panesWrapper)');
  
  assert(hasPageWrapper, 'Should use panes wrapper for dimensions');
  assert(hasWrapperBinding, 'Should bind panes wrapper element');
  assert(hasWrapperObserver, 'Should observe panes wrapper for resize');
  
  console.log('  ✅ Dimension calculation uses correct container');
  
  // Test 5: Debug logging cleaned up
  console.log('  - Testing debug log cleanup...');
  
  const hasMinimalLogging = !multiPaneContent.includes('console.log(\'Pane clicked') &&
                           !multiPaneContent.includes('console.log(\'Panes wrapper dimensions') &&
                           !multiPaneContent.includes('console.log(\'Started observing');
                           
  // Should still have essential logging
  const hasEssentialLogging = multiPaneContent.includes('console.log(`Terminal loaded for pane');
  
  assert(hasMinimalLogging, 'Should remove excessive debug logging');
  assert(hasEssentialLogging, 'Should keep essential logging');
  
  console.log('  ✅ Debug logging appropriately cleaned up');
  
  console.log('\n✅ All socket and terminal fixes verified!');
  console.log('\n📊 Fix Summary:');
  console.log('   • Socket connects to correct port in dev: ✅');
  console.log('   • LinkDetector hover has null safety: ✅');
  console.log('   • Terminal focus handling improved: ✅');
  console.log('   • Dimension calculation fixed: ✅');
  console.log('   • Debug logging cleaned up: ✅');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('\n🎉 Socket and terminal fixes verified successfully!');