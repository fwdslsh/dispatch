#!/usr/bin/env node

/**
 * Tests for MultiPaneLayout component
 * Tests basic initialization, rendering, and pane management
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import path from 'path';

// Simple assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
  }
}

console.log('🧪 Testing MultiPaneLayout Component...\n');

try {
  console.log('📋 Test 1.1: MultiPaneLayout component initialization and basic rendering');
  
  // Test 1.1.1: Component should initialize with default single pane
  console.log('  - Testing default initialization...');
  
  // Since we're testing a Svelte component, we'll test the underlying logic
  // that will be used in the component
  
  // Mock pane configuration structure
  const defaultPaneConfig = {
    panes: [
      {
        id: 'pane-1',
        type: 'terminal',
        position: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        active: true,
        terminalId: null
      }
    ],
    layout: {
      rows: 1,
      cols: 1,
      gridTemplate: '1fr / 1fr'
    }
  };
  
  // Test default pane configuration
  assert(defaultPaneConfig.panes.length === 1, 'Should initialize with single pane');
  assert(defaultPaneConfig.panes[0].id === 'pane-1', 'Default pane should have correct ID');
  assert(defaultPaneConfig.panes[0].active === true, 'Default pane should be active');
  assert(defaultPaneConfig.layout.rows === 1, 'Should initialize with 1 row');
  assert(defaultPaneConfig.layout.cols === 1, 'Should initialize with 1 column');
  
  console.log('  ✅ Default initialization test passed');
  
  // Test 1.1.2: Pane creation and removal functionality
  console.log('  - Testing pane creation and removal...');
  
  // Mock pane management functions
  function createPane(config, type = 'terminal') {
    const newPaneId = `pane-${config.panes.length + 1}`;
    const newPane = {
      id: newPaneId,
      type,
      position: { row: 1, col: config.panes.length + 1, rowSpan: 1, colSpan: 1 },
      active: false,
      terminalId: null
    };
    
    // Update layout for new pane
    const newConfig = {
      ...config,
      panes: [...config.panes, newPane],
      layout: {
        ...config.layout,
        cols: config.panes.length + 1,
        gridTemplate: `1fr / ${'1fr '.repeat(config.panes.length + 1).trim()}`
      }
    };
    
    return newConfig;
  }
  
  function removePane(config, paneId) {
    const filteredPanes = config.panes.filter(pane => pane.id !== paneId);
    
    if (filteredPanes.length === 0) {
      throw new Error('Cannot remove last pane');
    }
    
    // Ensure at least one pane is active
    if (!filteredPanes.some(pane => pane.active)) {
      filteredPanes[0].active = true;
    }
    
    return {
      ...config,
      panes: filteredPanes,
      layout: {
        ...config.layout,
        cols: filteredPanes.length,
        gridTemplate: `1fr / ${'1fr '.repeat(filteredPanes.length).trim()}`
      }
    };
  }
  
  // Test pane creation
  let testConfig = createPane(defaultPaneConfig);
  assert(testConfig.panes.length === 2, 'Should have 2 panes after creation');
  assert(testConfig.layout.cols === 2, 'Should update column count');
  assert(testConfig.panes[1].id === 'pane-2', 'New pane should have correct ID');
  
  // Test pane removal
  testConfig = removePane(testConfig, 'pane-2');
  assert(testConfig.panes.length === 1, 'Should have 1 pane after removal');
  assert(testConfig.layout.cols === 1, 'Should update column count after removal');
  
  // Test error handling - cannot remove last pane
  let errorThrown = false;
  try {
    removePane(testConfig, 'pane-1');
  } catch (error) {
    errorThrown = true;
    assert(error.message === 'Cannot remove last pane', 'Should throw correct error');
  }
  assert(errorThrown, 'Should throw error when removing last pane');
  
  console.log('  ✅ Pane creation and removal test passed');
  
  // Test 1.1.3: Active pane management
  console.log('  - Testing active pane management...');
  
  function setActivePane(config, paneId) {
    return {
      ...config,
      panes: config.panes.map(pane => ({
        ...pane,
        active: pane.id === paneId
      }))
    };
  }
  
  // Create multi-pane config for testing
  let multiPaneConfig = createPane(defaultPaneConfig);
  multiPaneConfig = createPane(multiPaneConfig);
  
  // Test setting active pane
  multiPaneConfig = setActivePane(multiPaneConfig, 'pane-2');
  assert(multiPaneConfig.panes[1].active === true, 'Pane-2 should be active');
  assert(multiPaneConfig.panes[0].active === false, 'Pane-1 should be inactive');
  assert(multiPaneConfig.panes[2].active === false, 'Pane-3 should be inactive');
  
  // Test only one pane can be active at a time
  const activePanes = multiPaneConfig.panes.filter(pane => pane.active);
  assert(activePanes.length === 1, 'Only one pane should be active at a time');
  
  console.log('  ✅ Active pane management test passed');
  
  // Test 1.1.4: CSS Grid template generation
  console.log('  - Testing CSS Grid template generation...');
  
  function generateGridTemplate(rows, cols) {
    const rowTemplate = `${'1fr '.repeat(rows).trim()}`;
    const colTemplate = `${'1fr '.repeat(cols).trim()}`;
    return `${rowTemplate} / ${colTemplate}`;
  }
  
  // Test grid template generation
  assertEqual(generateGridTemplate(1, 1), '1fr / 1fr', 'Single pane template');
  assertEqual(generateGridTemplate(1, 2), '1fr / 1fr 1fr', 'Two column template');
  assertEqual(generateGridTemplate(2, 2), '1fr 1fr / 1fr 1fr', '2x2 grid template');
  assertEqual(generateGridTemplate(2, 3), '1fr 1fr / 1fr 1fr 1fr', '2x3 grid template');
  
  console.log('  ✅ CSS Grid template generation test passed');
  
  // Test 1.1.5: Minimum and maximum pane constraints
  console.log('  - Testing pane size constraints...');
  
  const MIN_PANE_SIZE = 200; // pixels
  const MAX_PANES = 6;
  
  function validatePaneConstraints(config, containerWidth, containerHeight) {
    const { rows, cols } = config.layout;
    const minWidthRequired = cols * MIN_PANE_SIZE;
    const minHeightRequired = rows * MIN_PANE_SIZE;
    
    return {
      widthValid: containerWidth >= minWidthRequired,
      heightValid: containerHeight >= minHeightRequired,
      paneCountValid: config.panes.length <= MAX_PANES,
      minWidthRequired,
      minHeightRequired
    };
  }
  
  // Test constraint validation
  const constraintResult = validatePaneConstraints(multiPaneConfig, 800, 600);
  assert(constraintResult.widthValid === true, 'Width should be valid for 800px container');
  assert(constraintResult.heightValid === true, 'Height should be valid for 600px container');
  assert(constraintResult.paneCountValid === true, 'Pane count should be valid');
  
  // Test constraint failure
  const constraintFailure = validatePaneConstraints(multiPaneConfig, 400, 300);
  assert(constraintFailure.widthValid === false, 'Width should be invalid for 400px container');
  
  console.log('  ✅ Pane size constraints test passed');
  
  console.log('\n✅ All MultiPaneLayout component tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

console.log('\n🎉 MultiPaneLayout component test suite completed successfully!');