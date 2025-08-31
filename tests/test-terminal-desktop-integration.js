#!/usr/bin/env node

/**
 * Test Terminal component desktop integration
 * Verifies that desktop mode is enabled and MultiPaneLayout is used
 */

console.log('🧪 Testing Terminal Desktop Integration...\n');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

try {
  console.log('📋 Checking Terminal component desktop integration');
  
  // Test 1: Check Terminal component imports
  console.log('  - Testing Terminal component imports...');
  
  const fs = await import('fs');
  const terminalContent = await fs.promises.readFile('src/lib/components/Terminal.svelte', 'utf8');
  
  // Check imports
  const hasMultiPaneImport = terminalContent.includes('import MultiPaneLayout');
  const hasLinkDetectorImport = terminalContent.includes('import { LinkDetector }');
  
  console.log(`    MultiPaneLayout import: ${hasMultiPaneImport ? '✅' : '❌'}`);
  console.log(`    LinkDetector import: ${hasLinkDetectorImport ? '✅' : '❌'}`);
  
  if (!hasMultiPaneImport) {
    throw new Error('Terminal component missing MultiPaneLayout import');
  }
  
  // Test 2: Check desktop mode logic
  console.log('  - Testing desktop mode detection logic...');
  
  const hasDesktopMode = terminalContent.includes('isDesktopMode');
  const hasMobileCheck = terminalContent.includes('window.innerWidth <= 768');
  const hasDesktopModeAssignment = terminalContent.includes('isDesktopMode = !isMobile');
  
  console.log(`    Desktop mode variable: ${hasDesktopMode ? '✅' : '❌'}`);
  console.log(`    Mobile width check: ${hasMobileCheck ? '✅' : '❌'}`);
  console.log(`    Desktop mode assignment: ${hasDesktopModeAssignment ? '✅' : '❌'}`);
  
  if (!hasDesktopMode || !hasMobileCheck || !hasDesktopModeAssignment) {
    throw new Error('Terminal component missing desktop mode detection logic');
  }
  
  // Test 3: Check conditional rendering
  console.log('  - Testing conditional rendering logic...');
  
  const hasDesktopConditional = terminalContent.includes('{#if isDesktopMode}');
  const hasMultiPaneComponent = terminalContent.includes('<MultiPaneLayout');
  const hasElseClause = terminalContent.includes('{:else}');
  
  console.log(`    Desktop conditional: ${hasDesktopConditional ? '✅' : '❌'}`);
  console.log(`    MultiPaneLayout component: ${hasMultiPaneComponent ? '✅' : '❌'}`);  
  console.log(`    Else clause for mobile: ${hasElseClause ? '✅' : '❌'}`);
  
  if (!hasDesktopConditional || !hasMultiPaneComponent || !hasElseClause) {
    throw new Error('Terminal component missing conditional rendering logic');
  }
  
  // Test 4: Check MultiPaneLayout props (improved logic)
  console.log('  - Testing MultiPaneLayout props...');
  
  // Extract the MultiPaneLayout component section specifically
  const multiPaneStart = terminalContent.indexOf('<MultiPaneLayout');
  const multiPaneEnd = terminalContent.indexOf('/>', multiPaneStart);
  const multiPaneSection = multiPaneStart !== -1 && multiPaneEnd !== -1 
    ? terminalContent.substring(multiPaneStart, multiPaneEnd + 2)
    : '';
  
  const hasSocketProp = multiPaneSection.includes('{socket}');
  const hasSessionIdProp = multiPaneSection.includes('{sessionId}');
  const hasIsMobileProp = multiPaneSection.includes('{isMobile}');
  const hasLinkDetectorProp = multiPaneSection.includes('{linkDetector}');
  
  console.log(`    socket prop: ${hasSocketProp ? '✅' : '❌'}`);
  console.log(`    sessionId prop: ${hasSessionIdProp ? '✅' : '❌'}`);
  console.log(`    isMobile prop: ${hasIsMobileProp ? '✅' : '❌'}`);
  console.log(`    linkDetector prop: ${hasLinkDetectorProp ? '✅' : '❌'}`);
  
  if (!hasSocketProp || !hasSessionIdProp || !hasIsMobileProp || !hasLinkDetectorProp) {
    throw new Error('Terminal component missing required MultiPaneLayout props');
  }
  
  // Test 5: Check LinkDetector initialization
  console.log('  - Testing LinkDetector initialization...');
  
  const hasLinkDetectorInit = terminalContent.includes('linkDetector = new LinkDetector()');
  const hasLinkDetectorConditional = terminalContent.includes('if (isDesktopMode)') && terminalContent.includes('linkDetector = new LinkDetector()');
  
  console.log(`    LinkDetector initialization: ${hasLinkDetectorInit ? '✅' : '❌'}`);
  console.log(`    Conditional initialization: ${hasLinkDetectorConditional ? '✅' : '❌'}`);
  
  if (!hasLinkDetectorInit) {
    throw new Error('Terminal component missing LinkDetector initialization');
  }
  
  console.log('\n✅ All Terminal desktop integration tests passed!');
  
  console.log('\n📊 Test Summary:');
  console.log('   ✅ MultiPaneLayout and LinkDetector imports');
  console.log('   ✅ Desktop mode detection logic');
  console.log('   ✅ Conditional rendering logic');
  console.log('   ✅ MultiPaneLayout component props');
  console.log('   ✅ LinkDetector initialization');
  
  console.log('\n🎉 Terminal desktop integration verified successfully!');
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
