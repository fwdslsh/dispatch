# End-to-End Testing Documentation

## Overview

This document describes the comprehensive E2E test suite for the Dispatch application using Playwright. The test suite covers all major user flows, edge cases, and error conditions as specified in the `.agent-os` documentation.

## Test Coverage

### 🔐 Authentication Flow (`auth.spec.js`)

- **No auth required scenario**: Auto-redirect to projects
- **Authentication required**: Form display and validation
- **Valid authentication**: Successful login and redirect
- **Invalid authentication**: Error handling and display
- **Loading states**: UI feedback during authentication
- **Persistence**: localStorage token management
- **Network errors**: Graceful handling of connection issues

### 📁 Projects Management (`projects.spec.js`)

- **Projects page display**: Main elements and layout
- **Project creation**: Form handling and validation
- **Project name validation**: Edge cases and sanitization
- **Project navigation**: Links and routing
- **Project metadata**: Display of project information
- **Project deletion**: Confirmation and cleanup (if supported)
- **Empty state**: No projects messaging
- **Responsive design**: Mobile layout adaptation

### 💻 Terminal Sessions (`sessions.spec.js`)

- **Session page display**: Project session interface
- **Shell session creation**: Standard terminal sessions
- **Claude session creation**: AI-powered sessions (if available)
- **Session list display**: Active sessions management
- **Terminal I/O**: Input handling and output display
- **Session termination**: Cleanup and confirmation
- **Session attachment/detachment**: Connection management
- **Working directory selection**: Directory picker functionality
- **Mobile responsiveness**: Touch-optimized interface

### 📱 Mobile UX Features (`mobile.spec.js`)

- **Mobile layout optimization**: Responsive design verification
- **Virtual keyboard toolbar**: Custom terminal keys
- **Command palette**: Touch-friendly command selection
- **Touch gestures**: Swipe navigation and interactions
- **Header collapse**: Space optimization
- **Terminal sizing**: Viewport optimization
- **Keyboard interactions**: Virtual keyboard handling
- **Navigation patterns**: Mobile-specific navigation
- **Tablet viewport**: Landscape layout adaptation
- **Orientation changes**: Layout responsiveness
- **Touch accessibility**: Target size validation

### ⌨️ Command Palette and Keyboard Shortcuts (`command-palette.spec.js`)

- **Palette activation**: Keyboard shortcuts and click triggers
- **Command filtering**: Search and fuzzy matching
- **Keyboard navigation**: Arrow key navigation
- **Command execution**: Action triggering
- **Command categorization**: Grouped command display
- **Recent commands**: Command history
- **Global shortcuts**: Application-wide hotkeys
- **Terminal shortcuts**: Terminal-specific keys
- **Help system**: Shortcut documentation
- **Mobile palette**: Touch-optimized command interface
- **Fuzzy search**: Partial matching algorithms
- **Escape handling**: Palette dismissal

### 📂 Working Directory Functionality (`working-directory.spec.js`)

- **Directory picker**: Selection interface
- **Directory creation**: Session with specific working directory
- **Security validation**: Path traversal prevention
- **Directory listing**: Project structure display
- **Nested navigation**: Multi-level directory access
- **Metadata persistence**: Working directory in session data
- **Permission handling**: File system access validation
- **Claude integration**: AI sessions with working directories
- **Session display**: Working directory in session list
- **API integration**: Directory listing endpoints

### 🚨 Error Conditions and Edge Cases (`error-cases.spec.js`)

- **Network disconnection**: Offline mode and error handling
- **Server errors**: 5xx response handling
- **Invalid project IDs**: 404 and routing errors
- **Malformed data**: Input validation and sanitization
- **Storage issues**: localStorage limits and failures
- **Concurrent operations**: Race condition handling
- **Large output**: Terminal performance with heavy data
- **Security attacks**: Directory traversal and injection
- **Missing dependencies**: Claude CLI absence handling
- **Rapid navigation**: Fast user interactions
- **Browser refresh**: State recovery during operations
- **Small viewports**: Extreme mobile layouts
- **Resource limits**: Session and memory constraints

## Test Infrastructure

### Configuration

- **Playwright Config**: `playwright.config.js`
- **Test Directory**: `e2e/`
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Base URL**: `http://localhost:5173`
- **Dev Server**: Auto-started before tests

### Scripts

```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:headed    # Run with browser UI visible
npm run test:e2e:debug     # Debug mode with breakpoints
npm run test:e2e:ui        # Interactive test runner UI
npm run test:e2e:report    # View test results report
npm run playwright:install # Install browser dependencies
```

### Test Runner

- **Custom Runner**: `run-e2e-tests.js`
- **Parallel Execution**: Tests run in parallel for speed
- **Cross-Browser**: Automated testing across multiple browsers
- **Mobile Testing**: Touch-optimized interface validation
- **Artifact Collection**: Screenshots, videos, traces on failure

## Test Patterns

### Authentication Setup

```javascript
test.beforeEach(async ({ page }) => {
	await page.goto('/');
	const authInput = page.locator('input[type="password"]');
	if (await authInput.isVisible()) {
		await authInput.fill('test');
		await page.locator('button[type="submit"]').click();
	}
});
```

### Responsive Testing

```javascript
test('mobile layout', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 667 });
	// Test mobile-specific functionality
});
```

### Error Simulation

```javascript
test('network errors', async ({ page }) => {
	await page.route('**/socket.io/**', (route) => route.abort());
	// Test error handling
});
```

## Coverage Gaps and Limitations

### Known Gaps

1. **File Upload/Download**: No tests for file transfer functionality
2. **Multi-User Scenarios**: Single-user testing only
3. **Long-Running Sessions**: Limited testing of persistent sessions
4. **Performance Benchmarks**: No performance regression testing
5. **Accessibility**: Limited ARIA and screen reader testing

### Environment Dependencies

1. **Claude CLI**: Tests may fail if Claude is not installed
2. **Docker Environment**: Some features require containerized deployment
3. **Network Configuration**: Tests assume local development setup
4. **Browser Support**: Limited to Playwright-supported browsers

### Test Data Dependencies

1. **Project Creation**: Tests create temporary projects
2. **Session Cleanup**: Some sessions may persist between test runs
3. **localStorage**: Tests may leave authentication tokens
4. **Working Directories**: Test files may be created in project directories

## Maintenance Guidelines

### Adding New Tests

1. Follow existing test patterns and structure
2. Use descriptive test names and group related tests
3. Include proper error handling and cleanup
4. Test both happy path and edge cases
5. Ensure mobile compatibility

### Updating Tests

1. Update tests when UI changes occur
2. Maintain consistent selector patterns
3. Update documentation when adding new coverage
4. Verify tests across all supported browsers

### Debugging Failures

1. Use `npm run test:e2e:debug` for interactive debugging
2. Check `test-results/` for failure artifacts
3. Verify server is running on correct port
4. Check for timing issues with `waitForTimeout`

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**: Screenshot comparison
2. **Performance Testing**: Load time and interaction benchmarks
3. **Accessibility Testing**: WCAG compliance validation
4. **API Testing**: Direct Socket.IO endpoint testing
5. **Cross-Platform**: Testing on different operating systems

### Integration Opportunities

1. **CI/CD Pipeline**: Automated testing on pull requests
2. **Monitoring**: Integration with error tracking services
3. **Metrics**: Test execution time and flakiness tracking
4. **Notifications**: Test failure alerts and reporting
