import { JSDOM } from 'jsdom';

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock environment setup
const dom = new JSDOM('<!DOCTYPE html><div id="test-container"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.fetch = global.fetch || (() => Promise.reject(new Error('fetch not available')));

// Mock Claude Code SDK
class MockClaudeCodeSDK {
  constructor(options = {}) {
    this.options = options;
    this.authenticated = options.authenticated !== false;
    this.queryCount = 0;
    this.lastQuery = null;
  }

  async *query(options) {
    this.queryCount++;
    this.lastQuery = options;

    if (!this.authenticated) {
      throw new Error('Not authenticated with Claude CLI. Please run: claude-code login');
    }

    // Simulate streaming response
    yield { type: 'result', result: 'Hello, ' };
    yield { type: 'result', result: 'this is a test response from Claude!' };
    yield { type: 'done' };
  }

  isAuthenticated() {
    return this.authenticated;
  }

  setAuthenticated(status) {
    this.authenticated = status;
  }
}

// Mock ClaudeCodeService that we will implement
class ClaudeCodeService {
  constructor(options = {}) {
    this.sdk = options.sdk || new MockClaudeCodeSDK(options);
    this.authenticated = false;
    this.lastError = null;
    this.requestQueue = [];
    this.processing = false;
  }

  async checkAuthentication() {
    try {
      this.authenticated = this.sdk.isAuthenticated();
      this.lastError = null;
      return this.authenticated;
    } catch (error) {
      this.lastError = error;
      this.authenticated = false;
      return false;
    }
  }

  async query(prompt, options = {}) {
    if (!this.authenticated) {
      await this.checkAuthentication();
      if (!this.authenticated) {
        throw new Error('Not authenticated with Claude CLI. Please run: claude-code login');
      }
    }

    const queryOptions = {
      prompt,
      allowedTools: options.allowedTools || ['Read', 'Grep', 'WriteFile'],
      permissionMode: options.permissionMode || 'default',
      maxTurns: options.maxTurns || 5,
      ...options
    };

    let fullResponse = '';
    
    try {
      for await (const message of this.sdk.query(queryOptions)) {
        if (message.type === 'result') {
          fullResponse += message.result;
        }
        // We could emit events here for real-time updates
      }
      
      return fullResponse;
    } catch (error) {
      this.lastError = error;
      throw error;
    }
  }

  async queueQuery(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ prompt, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const { prompt, options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await this.query(prompt, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  isAuthenticated() {
    return this.authenticated;
  }

  getLastError() {
    return this.lastError;
  }

  clearQueue() {
    this.requestQueue = [];
  }

  getQueueLength() {
    return this.requestQueue.length;
  }
}

// Test Suite
console.log('🧪 Testing Claude Code SDK Service Wrapper...\n');

try {
  // Test 1.1: ClaudeCodeService initialization and authentication
  console.log('📋 Test 1.1: ClaudeCodeService initialization and authentication');
  
  // Test 1.1.1: Service creation
  console.log('  Test 1.1.1: Create ClaudeCodeService instance');
  const service = new ClaudeCodeService({ authenticated: true });
  assert(service instanceof ClaudeCodeService, 'Service should be created');
  assert(service.sdk instanceof MockClaudeCodeSDK, 'Service should have SDK instance');
  console.log('    ✅ Service created successfully');
  
  // Test 1.1.2: Authentication check
  console.log('  Test 1.1.2: Check authentication status');
  const authResult = await service.checkAuthentication();
  assert(authResult === true, 'Authentication should be successful');
  assert(service.isAuthenticated() === true, 'Service should report as authenticated');
  console.log('    ✅ Authentication check works');
  
  // Test 1.1.3: Failed authentication
  console.log('  Test 1.1.3: Handle failed authentication');
  const unauthService = new ClaudeCodeService({ authenticated: false });
  const unauthResult = await unauthService.checkAuthentication();
  assert(unauthResult === false, 'Authentication should fail');
  assert(unauthService.isAuthenticated() === false, 'Service should report as not authenticated');
  console.log('    ✅ Failed authentication handled correctly');

  // Test 1.2: Query method integration
  console.log('\n📋 Test 1.2: Query method integration with SDK');
  
  // Test 1.2.1: Basic query execution
  console.log('  Test 1.2.1: Execute basic query');
  const response = await service.query('Hello Claude, how are you?');
  assert(typeof response === 'string', 'Response should be a string');
  assert(response.includes('Hello'), 'Response should contain expected content');
  assert(response.includes('test response'), 'Response should contain test content');
  assert(service.sdk.queryCount === 1, 'SDK should have received 1 query');
  console.log('    ✅ Basic query execution works');
  
  // Test 1.2.2: Query with options
  console.log('  Test 1.2.2: Execute query with options');
  const optionsResponse = await service.query('Test with options', {
    allowedTools: ['Read', 'Bash'],
    permissionMode: 'bypassPermissions',
    maxTurns: 3
  });
  assert(typeof optionsResponse === 'string', 'Response should be a string');
  assert(service.sdk.lastQuery.allowedTools.includes('Read'), 'Options should be passed to SDK');
  assert(service.sdk.lastQuery.allowedTools.includes('Bash'), 'Options should include Bash');
  assert(service.sdk.lastQuery.permissionMode === 'bypassPermissions', 'Permission mode should be set');
  assert(service.sdk.lastQuery.maxTurns === 3, 'Max turns should be set');
  console.log('    ✅ Query with options works');
  
  // Test 1.2.3: Query without authentication
  console.log('  Test 1.2.3: Query without authentication should fail');
  let errorThrown = false;
  try {
    await unauthService.query('This should fail');
  } catch (error) {
    errorThrown = true;
    assert(error.message.includes('Not authenticated'), 'Error should mention authentication');
  }
  assert(errorThrown === true, 'Unauthenticated query should throw error');
  console.log('    ✅ Unauthenticated query properly rejected');

  // Test 1.3: Message queuing system
  console.log('\n📋 Test 1.3: Message queuing to prevent concurrent requests');
  
  // Test 1.3.1: Queue multiple requests
  console.log('  Test 1.3.1: Queue multiple requests');
  
  // Create a slower mock SDK to test queuing
  const slowService = new ClaudeCodeService({
    sdk: {
      queryCount: 0,
      lastQuery: null,
      async *query(options) {
        this.queryCount++;
        this.lastQuery = options;
        // Simulate slow response
        await new Promise(resolve => setTimeout(resolve, 10));
        yield { type: 'result', result: 'Slow response' };
        yield { type: 'done' };
      },
      isAuthenticated: () => true
    }
  });
  await slowService.checkAuthentication();
  
  const promise1 = slowService.queueQuery('Request 1');
  const promise2 = slowService.queueQuery('Request 2');
  const promise3 = slowService.queueQuery('Request 3');
  
  // Check queue length before processing starts
  assert(slowService.getQueueLength() >= 2, 'Queue should have at least 2 requests');
  
  // Wait for all to complete
  const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
  
  assert(typeof result1 === 'string', 'First result should be string');
  assert(typeof result2 === 'string', 'Second result should be string');
  assert(typeof result3 === 'string', 'Third result should be string');
  assert(slowService.getQueueLength() === 0, 'Queue should be empty after processing');
  console.log('    ✅ Request queuing works correctly');
  
  // Test 1.3.2: Queue clearing
  console.log('  Test 1.3.2: Clear pending queue');
  slowService.queueQuery('Will be cleared 1');
  slowService.queueQuery('Will be cleared 2');
  // Wait a moment for queue to build up
  await new Promise(resolve => setTimeout(resolve, 1));
  assert(slowService.getQueueLength() >= 1, 'Queue should have at least 1 request');
  
  slowService.clearQueue();
  assert(slowService.getQueueLength() === 0, 'Queue should be empty after clearing');
  console.log('    ✅ Queue clearing works');

  // Test 1.4: Error handling
  console.log('\n📋 Test 1.4: Error handling and recovery');
  
  // Test 1.4.1: SDK error handling
  console.log('  Test 1.4.1: Handle SDK errors');
  const errorService = new ClaudeCodeService({
    sdk: {
      async *query() {
        throw new Error('SDK Error');
      },
      isAuthenticated: () => true
    }
  });
  await errorService.checkAuthentication();
  
  let sdkErrorThrown = false;
  try {
    await errorService.query('This will fail');
  } catch (error) {
    sdkErrorThrown = true;
    assert(error.message === 'SDK Error', 'Should propagate SDK error');
    assert(errorService.getLastError() === error, 'Should store last error');
  }
  assert(sdkErrorThrown === true, 'SDK error should be thrown');
  console.log('    ✅ SDK error handling works');

  // Test 1.5: Service configuration
  console.log('\n📋 Test 1.5: Service configuration options');
  
  // Test 1.5.1: Default options
  console.log('  Test 1.5.1: Default configuration options');
  const defaultService = new ClaudeCodeService({ authenticated: true });
  await defaultService.checkAuthentication();
  await defaultService.query('Test default options');
  
  const lastQuery = defaultService.sdk.lastQuery;
  assert(lastQuery.allowedTools.includes('Read'), 'Should include Read tool by default');
  assert(lastQuery.allowedTools.includes('Grep'), 'Should include Grep tool by default');
  assert(lastQuery.allowedTools.includes('WriteFile'), 'Should include WriteFile tool by default');
  assert(lastQuery.permissionMode === 'default', 'Should use default permission mode');
  assert(lastQuery.maxTurns === 5, 'Should use default max turns');
  console.log('    ✅ Default configuration works');
  
  // Test 1.5.2: Custom options override
  console.log('  Test 1.5.2: Custom options override defaults');
  await defaultService.query('Custom options test', {
    allowedTools: ['Bash', 'WebSearch'],
    permissionMode: 'acceptEdits',
    maxTurns: 10
  });
  
  const customQuery = defaultService.sdk.lastQuery;
  assert(customQuery.allowedTools.includes('Bash'), 'Should use custom tools');
  assert(customQuery.allowedTools.includes('WebSearch'), 'Should include WebSearch');
  assert(!customQuery.allowedTools.includes('Read'), 'Should not include default Read tool');
  assert(customQuery.permissionMode === 'acceptEdits', 'Should use custom permission mode');
  assert(customQuery.maxTurns === 10, 'Should use custom max turns');
  console.log('    ✅ Custom options override works');

  console.log('\n✅ All Claude Code SDK service wrapper tests passed!\n');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

// Export for use in actual implementation
export { ClaudeCodeService, MockClaudeCodeSDK };