#!/usr/bin/env node

/**
 * Test desktop mode fixes
 * Verifies LinkDetector and terminal interaction fixes
 */

console.log('🧪 Testing Desktop Mode Fixes...\n');

try {
  console.log('📋 Testing LinkDetector fixes');
  
  // Test 1: LinkDetector should not use deprecated APIs
  console.log('  - Testing LinkDetector implementation...');
  
  const { LinkDetector } = await import('../src/lib/services/link-detector.js');
  
  const linkDetector = new LinkDetector();
  assert(linkDetector instanceof LinkDetector, 'Should create LinkDetector instance');
  
  // Check that file content doesn't contain deprecated methods
  const fs = await import('fs');
  const linkDetectorContent = await fs.promises.readFile('src/lib/services/link-detector.js', 'utf8');
  
  const hasDeprecatedMethod = linkDetectorContent.includes('terminal.registerLinkMatcher');
  assert(!hasDeprecatedMethod, 'Should not use deprecated registerLinkMatcher method');
  
  const hasModernAPI = linkDetectorContent.includes('registerLinkProvider');
  assert(hasModernAPI, 'Should use modern registerLinkProvider API');
  
  console.log('  ✅ LinkDetector uses modern xterm.js API');
  
  // Test 2: LinkDetector patterns should work
  console.log('  - Testing link pattern matching...');
  
  const testResults = linkDetector.testString('Visit https://example.com or email test@domain.com');
  assert(testResults.url.length > 0, 'Should detect URLs');
  assert(testResults.email.length > 0, 'Should detect emails');
  
  console.log('  ✅ Link pattern matching works');
  
  // Test 3: Terminal component integration should be correct
  console.log('  - Testing Terminal component integration...');
  
  const terminalContent = await fs.promises.readFile('src/lib/components/Terminal.svelte', 'utf8');
  
  // Should use Terminal instead of TerminalReadonly in session page
  const sessionPageContent = await fs.promises.readFile('src/routes/sessions/[id]/+page.svelte', 'utf8');
  const usesTerminal = sessionPageContent.includes('<Terminal ') && sessionPageContent.includes('{socket}');
  const hasTerminalReadonlyCommented = sessionPageContent.includes('<!-- <TerminalReadonly');
  
  assert(usesTerminal, 'Session page should use Terminal component');
  assert(hasTerminalReadonlyCommented, 'Session page should have TerminalReadonly commented out');
  
  console.log('  ✅ Session page uses correct Terminal component');
  
  // Test 4: MultiPaneLayout socket handling should be fixed
  console.log('  - Testing MultiPaneLayout socket handling...');
  
  const multiPaneContent = await fs.promises.readFile('src/lib/components/MultiPaneLayout.svelte', 'utf8');
  
  const hasSessionIdCheck = multiPaneContent.includes('sessionId') && multiPaneContent.includes('socket.emit(\'attach\'');
  const hasCreateLogic = multiPaneContent.includes('socket.emit(\'create\'');
  
  assert(hasSessionIdCheck, 'Should handle existing sessionId');
  assert(hasCreateLogic, 'Should create new sessions for additional panes');
  
  console.log('  ✅ MultiPaneLayout socket handling fixed');
  
  console.log('\n✅ All desktop mode fixes verified!');
  console.log('\n📊 Fix Summary:');
  console.log('   • LinkDetector uses modern xterm.js API: ✅');
  console.log('   • Link pattern matching functional: ✅');
  console.log('   • Session page uses Terminal component: ✅');
  console.log('   • MultiPaneLayout socket handling fixed: ✅');
  
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

console.log('\n🎉 Desktop mode fixes verified successfully!');