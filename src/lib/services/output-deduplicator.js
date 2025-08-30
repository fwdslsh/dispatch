// Output deduplication service for intelligent terminal output handling
// Handles progress bars, duplicate lines, and smart replacements

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

export class TerminalOutputFilter {
  constructor(options = {}) {
    this.deduplicator = new OutputDeduplicator(options);
    this.replacementManager = new LineReplacementManager();
    this.optimizer = new PerformanceOptimizer();
    this.outputBuffer = [];
    this.maxBufferLines = options.maxBufferLines || 1000;
    this.onOutputReplace = options.onOutputReplace || (() => {});
    
    // Performance tracking
    this.lastUpdateTime = Date.now();
    this.outputRate = 0;
    this.updateCount = 0;
  }
  
  async processTerminalOutput(newOutput, terminalWriteFn) {
    // Track performance
    this.updateCount++;
    const now = Date.now();
    if (now - this.lastUpdateTime > 1000) {
      this.outputRate = this.updateCount;
      this.updateCount = 0;
      this.lastUpdateTime = now;
    }
    
    // First pass: deduplication
    const deduplicatedOutput = this.deduplicator.processOutput(newOutput);
    if (!deduplicatedOutput) return; // Nothing to output
    
    const newLines = deduplicatedOutput.split(/\r?\n/).filter(line => line.length > 0);
    
    // Handle high output rates with batching
    if (this.optimizer.shouldThrottleOutput(this.outputRate) && newLines.length > this.optimizer.batchSize) {
      await this.processBatchedLines(newLines, terminalWriteFn);
    } else {
      this.processLines(newLines, terminalWriteFn);
    }
    
    // Trim buffer if too large
    if (this.outputBuffer.length > this.maxBufferLines) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxBufferLines);
    }
  }
  
  processLines(lines, terminalWriteFn) {
    for (const line of lines) {
      this.processLine(line, terminalWriteFn);
    }
  }
  
  async processBatchedLines(lines, terminalWriteFn) {
    await this.optimizer.processBatchedOutput(lines, (line) => {
      this.processLine(line, terminalWriteFn);
      return line;
    });
  }
  
  processLine(line, terminalWriteFn) {
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
      
      // Trigger terminal replacement callback
      this.onOutputReplace(this.outputBuffer.slice(-10).join('\n'), line);
    } else {
      // Normal append
      this.outputBuffer.push(line);
      terminalWriteFn(line + '\n');
    }
  }
  
  getRecentOutput(lines = 10) {
    return this.outputBuffer.slice(-lines).join('\n');
  }
  
  clear() {
    this.outputBuffer = [];
    this.deduplicator.reset();
    this.outputRate = 0;
    this.updateCount = 0;
    this.lastUpdateTime = Date.now();
  }
  
  // Configuration methods for dynamic adjustment
  setProgressThreshold(threshold) {
    this.deduplicator.progressThreshold = threshold;
  }
  
  setMaxBufferLines(maxLines) {
    this.maxBufferLines = maxLines;
    if (this.outputBuffer.length > maxLines) {
      this.outputBuffer = this.outputBuffer.slice(-maxLines);
    }
  }
  
  // Statistics for monitoring
  getStats() {
    return {
      bufferLines: this.outputBuffer.length,
      outputRate: this.outputRate,
      lastProgressValue: this.deduplicator.lastProgressValue,
      historyLines: this.deduplicator.lastLines.length
    };
  }
}