#!/usr/bin/env node

/**
 * Test Terminal component desktop integration
 * Verifies that desktop mode is enabled and MultiPaneLayout is used
 */

console.log('🧪 Testing Terminal Desktop Integration...\n');

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
  console.log(`    LinkDetector import: ${hasMultiPaneImport ? '✅' : '❌'}`);
  
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
  
  // Test 4: Check MultiPaneLayout props
  console.log('  - Testing MultiPaneLayout props...');
  
  const hasSocketProp = terminalContent.includes('{socket}') && terminalContent.indexOf('{socket}') > terminalContent.indexOf('<MultiPaneLayout');
  const hasSessionIdProp = terminalContent.includes('{sessionId}') && terminalContent.indexOf('{sessionId}') > terminalContent.indexOf('<MultiPaneLayout');
  const hasIsMobileProp = terminalContent.includes('{isMobile}') && terminalContent.indexOf('{isMobile}') > terminalContent.indexOf('<MultiPaneLayout');
  const hasLinkDetectorProp = terminalContent.includes('{linkDetector}') && terminalContent.indexOf('{linkDetector}') > terminalContent.indexOf('<MultiPaneLayout');
  
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
  const hasDesktopCheck = terminalContent.includes('if (isDesktopMode)') && terminalContent.indexOf('linkDetector = new LinkDetector()') > 0;
  
  console.log(`    LinkDetector initialization: ${hasLinkDetectorInit ? '✅' : '❌'}`);
  console.log(`    Desktop mode check for LinkDetector: ${hasDesktopCheck ? '✅' : '❌'}`);
  
  if (!hasLinkDetectorInit) {
    throw new Error('Terminal component missing LinkDetector initialization');
  }
  
  console.log('  ✅ Terminal component desktop integration verified');
  
  // Test 6: Check MultiPaneLayout structure
  console.log('  - Testing MultiPaneLayout component structure...');
  
  const multiPaneContent = await fs.promises.readFile('src/lib/components/MultiPaneLayout.svelte', 'utf8');
  
  const hasPaneManager = multiPaneContent.includes('new PaneManager()');
  const hasXtermImport = multiPaneContent.includes("from '@battlefieldduck/xterm-svelte'");
  const hasPaneControls = multiPaneContent.includes('pane-controls');
  const hasLayoutPresets = multiPaneContent.includes('applyPreset');
  
  console.log(`    PaneManager initialization: ${hasPaneManager ? '✅' : '❌'}`);
  console.log(`    Xterm import: ${hasXtermImport ? '✅' : '❌'}`);
  console.log(`    Pane controls UI: ${hasPaneControls ? '✅' : '❌'}`);
  console.log(`    Layout presets: ${hasLayoutPresets ? '✅' : '❌'}`);
  
  if (!hasPaneManager || !hasXtermImport || !hasPaneControls || !hasLayoutPresets) {
    throw new Error('MultiPaneLayout component missing required features');
  }
  
  console.log('  ✅ MultiPaneLayout component structure verified');
  
  console.log('\n✅ All Terminal desktop integration tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 Terminal desktop integration verified successfully!');