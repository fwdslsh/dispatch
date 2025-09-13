// Example: How to add new UI tests to the comprehensive test suite

/**
 * Best Practices for Adding Tests:
 * 
 * 1. **Authentication**: Always use the standard beforeEach pattern
 * 2. **Wait for Load**: Use waitForLoadState('networkidle') for stability
 * 3. **Conditional Testing**: Check if elements exist before interacting
 * 4. **Screenshots**: Take screenshots for visual validation
 * 5. **Error Handling**: Test both success and failure scenarios
 * 6. **Mobile Testing**: Include mobile viewport tests
 * 7. **Timeouts**: Use reasonable timeouts for dynamic content
 * 8. **Assertions**: Use clear, specific assertions
 * 9. **Cleanup**: Don't rely on global state between tests
 * 10. **Documentation**: Comment complex test logic
 */

// See e2e/comprehensive-ui.spec.js for complete examples