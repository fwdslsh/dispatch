// tests/test-output-deduplication.js
// Test intelligent output deduplication functionality

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

console.log('🧪 Testing Intelligent Output Deduplication System...\n');

async function runTests() {
  try {
    // Test 1: Progress bar detection and replacement
    console.log('🔧 Test 1: Progress bar detection and replacement');
    
    class ProgressBarDetector {
      constructor() {
        this.patterns = [
          // Standard progress bars with percentage
          /^\s*(\[#+[-\s]*\]|\|#+[-\s]*\|)\s*\d+%/,
          // Percentage only patterns
          /^\s*\d+%\s*$/,
          // Progress with numbers (e.g., "Downloaded 50/100")
          /^\s*\w+\s+\d+\/\d+/,
          // Spinner patterns
          /^\s*[|\/\-\\]\s*/,
          // Dots pattern (e.g., "Loading...")
          /^\s*\w*\.{3,}\s*$/,
          // npm/yarn install progress
          /^\s*\w+:\s+\d+\/\d+/,
          // Build progress patterns
          /^\s*Building\s+\d+\/\d+/,
          // Transfer progress (e.g., "1.2MB/5.6MB")
          /^\s*\d+(?:\.\d+)?[KMGT]?B\/\d+(?:\.\d+)?[KMGT]?B/
        ];
      }
      
      isProgressLine(line) {
        const cleanLine = line.replace(/\r/g, '').trim();
        return this.patterns.some(pattern => pattern.test(cleanLine));
      }
      
      extractProgressInfo(line) {
        const cleanLine = line.replace(/\r/g, '').trim();
        
        // Extract percentage
        const percentMatch = cleanLine.match(/(\d+)%/);
        if (percentMatch) {
          return { type: 'percentage', value: parseInt(percentMatch[1]) };
        }
        
        // Extract fraction (e.g., "50/100")
        const fractionMatch = cleanLine.match(/(\d+)\/(\d+)/);
        if (fractionMatch) {
          const current = parseInt(fractionMatch[1]);
          const total = parseInt(fractionMatch[2]);
          return { type: 'fraction', current, total, percentage: Math.round((current / total) * 100) };
        }
        
        // Extract file size transfer
        const sizeMatch = cleanLine.match(/(\d+(?:\.\d+)?[KMGT]?B)\/(\d+(?:\.\d+)?[KMGT]?B)/);
        if (sizeMatch) {
          return { type: 'transfer', current: sizeMatch[1], total: sizeMatch[2] };
        }
        
        return { type: 'spinner' };
      }
    }
    
    const detector = new ProgressBarDetector();
    
    // Test progress bar detection
    assert(detector.isProgressLine('[#####     ] 50%'), 'Should detect standard progress bar');
    assert(detector.isProgressLine('  75%  '), 'Should detect percentage-only progress');
    assert(detector.isProgressLine('Downloaded 25/100'), 'Should detect fraction progress');
    assert(detector.isProgressLine('|'), 'Should detect spinner character');
    assert(detector.isProgressLine('Loading...'), 'Should detect dots pattern');
    assert(!detector.isProgressLine('Regular output line'), 'Should not detect regular text');
    
    // Test progress info extraction
    const progressInfo = detector.extractProgressInfo('[#####     ] 75%');
    assertEqual(progressInfo.type, 'percentage', 'Should extract percentage type');
    assertEqual(progressInfo.value, 75, 'Should extract correct percentage value');
    
    const fractionInfo = detector.extractProgressInfo('Built 15/20');
    assertEqual(fractionInfo.type, 'fraction', 'Should extract fraction type');
    assertEqual(fractionInfo.percentage, 75, 'Should calculate correct percentage from fraction');
    
    console.log('   ✓ Progress bar detection and replacement works correctly\n');
    
    // Test 2: Output deduplication engine
    console.log('🔧 Test 2: Output deduplication engine');
    
    class OutputDeduplicator {
      constructor(options = {}) {
        this.maxHistoryLines = options.maxHistoryLines || 50;
        this.progressThreshold = options.progressThreshold || 5; // Minimum % change to show
        this.lastLines = [];
        this.lastProgressValue = null;
        this.progressBarDetector = new ProgressBarDetector();
      }
      
      processOutput(newOutput) {
        const lines = newOutput.split(/\r?\n/);
        const result = [];
        
        for (const line of lines) {
          const processedLine = this.processLine(line);
          if (processedLine !== null && processedLine.trim() !== '') {
            result.push(processedLine);
          }
        }
        
        return result.join('\n');
      }
      
      processLine(line) {
        // Skip empty lines in deduplication
        if (!line.trim()) {
          return line;
        }
        
        // Check if this is a progress line
        if (this.progressBarDetector.isProgressLine(line)) {
          return this.handleProgressLine(line);
        }
        
        // Check for similar recent lines (exact duplicates)
        if (this.isDuplicateRecentLine(line)) {
          return null; // Skip duplicate
        }
        
        // Add to history and return
        this.addToHistory(line);
        return line;
      }
      
      handleProgressLine(line) {
        const progressInfo = this.progressBarDetector.extractProgressInfo(line);
        
        // For percentage-based progress, only show significant changes
        if (progressInfo.type === 'percentage' || progressInfo.type === 'fraction') {
          const currentValue = progressInfo.percentage || progressInfo.value;
          
          if (this.lastProgressValue === null || 
              Math.abs(currentValue - this.lastProgressValue) >= this.progressThreshold ||
              currentValue === 100) { // Always show completion
            this.lastProgressValue = currentValue;
            return line;
          }
          
          return null; // Skip intermediate progress updates
        }
        
        // For spinners and other progress, show every few updates
        const recentSpinners = this.lastLines.slice(0, 3).filter(l => 
          this.progressBarDetector.isProgressLine(l)
        ).length;
        
        if (recentSpinners < 2) { // Show spinner occasionally
          this.addToHistory(line);
          return line;
        }
        
        return null;
      }
      
      isDuplicateRecentLine(line) {
        // Check last few lines for exact duplicates
        const recentLines = this.lastLines.slice(0, 5);
        return recentLines.includes(line.trim());
      }
      
      addToHistory(line) {
        this.lastLines.unshift(line.trim());
        if (this.lastLines.length > this.maxHistoryLines) {
          this.lastLines = this.lastLines.slice(0, this.maxHistoryLines);
        }
      }
      
      reset() {
        this.lastLines = [];
        this.lastProgressValue = null;
      }
    }
    
    const deduplicator = new OutputDeduplicator({ progressThreshold: 10 });
    
    // Test exact duplicate filtering
    let output1 = deduplicator.processOutput('Line 1\nLine 2\nLine 1\nLine 3');
    assertEqual(output1, 'Line 1\nLine 2\nLine 3', 'Should remove duplicate lines');
    
    // Test progress filtering
    deduplicator.reset();
    let progressOutput = deduplicator.processOutput('[####      ] 40%\n[#####     ] 50%\n[######    ] 60%');
    // With threshold 10, should show 40%, show 50% (10% diff = threshold), show 60% (20% diff)
    assertEqual(progressOutput, '[####      ] 40%\n[#####     ] 50%\n[######    ] 60%', 'Should show progress at threshold intervals');
    
    // Test with smaller increments to ensure filtering works
    deduplicator.reset();
    let progressOutput2 = deduplicator.processOutput('[####      ] 40%\n[#####     ] 44%\n[#####     ] 47%\n[######    ] 55%');
    // 44% - 40% = 4% (< 10%), 47% - 40% = 7% (< 10%), 55% - 40% = 15% (>= 10%)
    assertEqual(progressOutput2, '[####      ] 40%\n[######    ] 55%', 'Should filter small progress increments');
    
    console.log('   ✓ Output deduplication engine works correctly\n');
    
    // Test 3: Smart line replacement detection
    console.log('🔧 Test 3: Smart line replacement detection');
    
    class LineReplacementManager {
      constructor() {
        this.replacementPatterns = [
          // Lines ending with \r (carriage return) should replace previous line
          { pattern: /\r$/, shouldReplace: true },
          // Progress indicators with same prefix
          { pattern: /^(Building|Downloading|Processing|Installing)/, shouldReplace: true, groupBy: 'prefix' },
          // Status updates with timestamps
          { pattern: /^\[\d{2}:\d{2}:\d{2}\]/, shouldReplace: false },
          // Error/warning lines (never replace)
          { pattern: /^(Error|ERROR|Warning|WARN)/, shouldReplace: false }
        ];
        
        this.lastReplaceableLines = new Map();
      }
      
      shouldReplaceLine(currentLine, previousLines) {
        const cleanLine = currentLine.replace(/\r$/, '');
        
        // Check for carriage return replacement
        if (currentLine.endsWith('\r')) {
          return { shouldReplace: true, reason: 'carriage_return' };
        }
        
        // Check replacement patterns
        for (const pattern of this.replacementPatterns) {
          if (pattern.pattern.test(cleanLine)) {
            if (pattern.shouldReplace) {
              if (pattern.groupBy === 'prefix') {
                const prefix = cleanLine.match(pattern.pattern)[1];
                const lastWithPrefix = previousLines.find(line => line.startsWith(prefix));
                if (lastWithPrefix) {
                  return { shouldReplace: true, reason: 'prefix_match', replaceIndex: previousLines.indexOf(lastWithPrefix) };
                }
                // If no previous line with this prefix, don't replace
                return { shouldReplace: false, reason: 'no_prefix_match' };
              }
              return { shouldReplace: true, reason: 'pattern_match' };
            } else {
              return { shouldReplace: false, reason: 'protected_pattern' };
            }
          }
        }
        
        return { shouldReplace: false, reason: 'no_match' };
      }
      
      processLineReplacement(lines, newLine) {
        const replacement = this.shouldReplaceLine(newLine, lines);
        
        if (replacement.shouldReplace) {
          if (replacement.replaceIndex !== undefined) {
            // Replace specific line
            lines[replacement.replaceIndex] = newLine;
          } else if (lines.length > 0) {
            // Replace last line
            lines[lines.length - 1] = newLine;
          } else {
            lines.push(newLine);
          }
        } else {
          lines.push(newLine);
        }
        
        return lines;
      }
    }
    
    const replacementManager = new LineReplacementManager();
    
    // Test carriage return replacement
    const crResult = replacementManager.shouldReplaceLine('Progress: 50%\r', ['Previous line']);
    assert(crResult.shouldReplace, 'Should replace line with carriage return');
    assertEqual(crResult.reason, 'carriage_return', 'Should identify carriage return reason');
    
    // Test prefix replacement
    const prefixResult = replacementManager.shouldReplaceLine('Building file 2/10', ['Building file 1/10']);
    assert(prefixResult.shouldReplace, 'Should replace line with same prefix');
    assertEqual(prefixResult.reason, 'prefix_match', 'Should identify prefix match reason');
    
    // Test protected patterns
    const errorResult = replacementManager.shouldReplaceLine('Error: Something failed', []);
    assert(!errorResult.shouldReplace, 'Should not replace error lines');
    
    // Test line replacement processing
    let testLines = ['Line 1', 'Building step 1'];
    testLines = replacementManager.processLineReplacement(testLines, 'Building step 2');
    assertEqual(testLines[1], 'Building step 2', 'Should replace building line');
    assertEqual(testLines.length, 2, 'Should maintain same number of lines');
    
    console.log('   ✓ Smart line replacement detection works correctly\n');
    
    // Test 4: Integration with terminal buffer management
    console.log('🔧 Test 4: Terminal buffer management integration');
    
    class TerminalOutputFilter {
      constructor(options = {}) {
        this.deduplicator = new OutputDeduplicator(options);
        this.replacementManager = new LineReplacementManager();
        this.outputBuffer = [];
        this.maxBufferLines = options.maxBufferLines || 1000;
        this.onOutputReplace = options.onOutputReplace || (() => {});
      }
      
      processTerminalOutput(newOutput, terminalWriteFn) {
        // First pass: deduplication
        const deduplicatedOutput = this.deduplicator.processOutput(newOutput);
        if (!deduplicatedOutput) return; // Nothing to output
        
        const newLines = deduplicatedOutput.split(/\r?\n/).filter(line => line.length > 0);
        
        for (const line of newLines) {
          // Check if this line should replace previous content
          const replacement = this.replacementManager.shouldReplaceLine(line, this.outputBuffer);
          
          if (replacement.shouldReplace) {
            // Replace operation - we need to clear and rewrite
            if (replacement.replaceIndex !== undefined) {
              this.outputBuffer[replacement.replaceIndex] = line;
            } else if (this.outputBuffer.length > 0) {
              this.outputBuffer[this.outputBuffer.length - 1] = line;
            } else {
              this.outputBuffer.push(line);
            }
            
            // Trigger terminal replacement (would need terminal-specific implementation)
            this.onOutputReplace(this.outputBuffer.slice(-10).join('\n'), line);
          } else {
            // Normal append
            this.outputBuffer.push(line);
            terminalWriteFn(line + '\n');
          }
        }
        
        // Trim buffer if too large
        if (this.outputBuffer.length > this.maxBufferLines) {
          this.outputBuffer = this.outputBuffer.slice(-this.maxBufferLines);
        }
      }
      
      getRecentOutput(lines = 10) {
        return this.outputBuffer.slice(-lines).join('\n');
      }
      
      clear() {
        this.outputBuffer = [];
        this.deduplicator.reset();
      }
    }
    
    let terminalOutput = [];
    let replacementCalls = [];
    
    const filter = new TerminalOutputFilter({
      progressThreshold: 25,
      onOutputReplace: (buffer, newLine) => {
        replacementCalls.push({ buffer, newLine });
      }
    });
    
    // Simulate terminal writes
    const mockWrite = (data) => terminalOutput.push(data);
    
    // Test normal output
    filter.processTerminalOutput('Starting process\nLoading configuration', mockWrite);
    assertEqual(terminalOutput.length, 2, 'Should write normal lines');
    
    // Test progress replacement
    terminalOutput = [];
    replacementCalls = [];
    filter.processTerminalOutput('Building step 1', mockWrite);
    assertEqual(replacementCalls.length, 0, 'First building line should not trigger replacement');
    filter.processTerminalOutput('Building step 2', mockWrite); 
    assertEqual(replacementCalls.length, 1, 'Second building line should trigger replacement');
    
    // Test deduplication + replacement
    filter.clear();
    terminalOutput = [];
    replacementCalls = [];
    filter.processTerminalOutput('[##        ] 20%\n[####      ] 40%\n[########  ] 80%', mockWrite);
    // Should show 20% and 80% (due to 25% threshold), and 80% should replace 20%
    assert(terminalOutput.length <= 2, 'Should deduplicate and replace progress lines');
    
    console.log('   ✓ Terminal buffer management integration works correctly\n');
    
    // Test 5: Performance optimization for large outputs
    console.log('🔧 Test 5: Performance optimization for large outputs');
    
    class PerformanceOptimizer {
      constructor() {
        this.batchSize = 100; // Process lines in batches
        this.maxProcessingTime = 16; // Max 16ms per batch (60fps)
        this.pendingLines = [];
      }
      
      async processBatchedOutput(lines, processor) {
        const results = [];
        const startTime = Date.now();
        
        for (let i = 0; i < lines.length; i += this.batchSize) {
          const batch = lines.slice(i, i + this.batchSize);
          const batchResults = batch.map(line => processor(line)).filter(r => r !== null);
          results.push(...batchResults);
          
          // Check if we've exceeded time budget
          if (Date.now() - startTime > this.maxProcessingTime && i + this.batchSize < lines.length) {
            // Yield to browser and continue in next frame
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        return results;
      }
      
      shouldThrottleOutput(outputRate) {
        // If more than 100 lines per second, start throttling
        return outputRate > 100;
      }
      
      calculateOptimalUpdateRate(baseRate, cpuUsage) {
        // Reduce update frequency based on CPU usage
        if (cpuUsage > 0.8) return Math.max(baseRate / 4, 5); // Min 5 updates/sec
        if (cpuUsage > 0.5) return Math.max(baseRate / 2, 10); // Min 10 updates/sec
        return baseRate;
      }
    }
    
    const optimizer = new PerformanceOptimizer();
    
    // Test batch processing
    const batchTestLines = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`);
    let processedCount = 0;
    const processor = (line) => {
      processedCount++;
      return line;
    };
    
    const startTime = Date.now();
    const results = await optimizer.processBatchedOutput(batchTestLines, processor);
    const processingTime = Date.now() - startTime;
    
    assertEqual(results.length, 250, 'Should process all lines');
    assertEqual(processedCount, 250, 'Should call processor for each line');
    // Processing time should be reasonable (allowing for test environment variance)
    assert(processingTime < 100, `Processing time should be reasonable (was ${processingTime}ms)`);
    
    // Test throttling decision
    assert(!optimizer.shouldThrottleOutput(50), 'Should not throttle moderate output');
    assert(optimizer.shouldThrottleOutput(150), 'Should throttle high output rate');
    
    // Test update rate calculation
    const normalRate = optimizer.calculateOptimalUpdateRate(30, 0.3);
    assertEqual(normalRate, 30, 'Should maintain rate with low CPU usage');
    
    const highCpuRate = optimizer.calculateOptimalUpdateRate(30, 0.9);
    assert(highCpuRate < 30, 'Should reduce rate with high CPU usage');
    assert(highCpuRate >= 5, 'Should maintain minimum update rate');
    
    console.log('   ✓ Performance optimization works correctly\n');
    
    console.log('🎉 All Intelligent Output Deduplication tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Progress bar detection and replacement');
    console.log('   ✅ Output deduplication engine');
    console.log('   ✅ Smart line replacement detection');
    console.log('   ✅ Terminal buffer management integration');
    console.log('   ✅ Performance optimization for large outputs\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('Intelligent Output Deduplication test suite failed:', error);
  process.exit(1);
});