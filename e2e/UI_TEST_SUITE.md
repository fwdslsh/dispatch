# Dispatch UI Test Suite Documentation

## Overview

The Dispatch UI Test Suite is a comprehensive Playwright-based end-to-end testing framework that validates all major UI flows and user experiences in the Dispatch application. The test suite is specifically designed to **exclude Claude session functionality** to ensure reliable CI execution without external API dependencies.

## Architecture

### Test Organization

The test suite is organized into focused test categories:

- **Authentication Flow** - Login, logout, session persistence
- **Project Management** - Project creation, navigation, lifecycle
- **Terminal Session Management** - Terminal creation, multi-session handling, lifecycle
- **Console/Admin Page Validation** - Admin interface functionality and display
- **Responsive and Mobile Layout** - Cross-device compatibility and responsive design
- **Visual Regression and Layout Validation** - UI consistency and visual quality
- **Error Handling and Edge Cases** - Graceful error handling and edge case coverage

### Key Files

- `e2e/comprehensive-ui.spec.js` - Main comprehensive test suite
- `playwright-ui.config.js` - Focused test configuration excluding Claude tests
- `run-ui-tests.js` - Test runner script with clear reporting
- `package.json` - Updated with new test scripts

## Running Tests

### Local Development

```bash
# Run all UI tests
npm run test:ui

# Run with visible browser windows
npm run test:ui:headed

# Run with interactive debugging
npm run test:ui:debug

# Open Playwright UI for test development
npm run test:ui:ui
```

### CI Environment

```bash
# Standard CI execution
npm run test:ui

# View test report
npx playwright show-report
```

### Prerequisites

1. **Node.js >= 22** (see package.json engines requirement)
2. **Playwright browsers installed**: `npm run playwright:install`
3. **Dependencies installed**: `npm install`

## Test Configuration

### Browser Coverage

The test suite runs across multiple browsers and devices:

- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Pixel 5 (Chrome), iPhone 12 (Safari)
- **Tablets**: iPad viewport testing

### Environment Variables

- `TERMINAL_KEY=testkey12345` - Authentication key for tests
- `PTY_MODE=shell` - Forces shell mode (not Claude)
- `NODE_ENV=test` - Test environment flag

### Excluded Functionality

The following features are intentionally excluded to avoid external API dependencies:

- ❌ Claude session creation and management
- ❌ Claude-specific UI components
- ❌ Activity summaries requiring Claude API
- ❌ Any functionality requiring `@anthropic-ai/claude-code` API calls

## Test Scenarios

### Authentication Flow Tests

- ✅ Complete login/logout cycle
- ✅ Invalid authentication handling
- ✅ Session persistence across browser refresh
- ✅ Loading states during authentication

### Project Management Tests

- ✅ Projects page layout validation
- ✅ Project creation workflow
- ✅ Navigation between projects
- ✅ Project listing and display

### Terminal Session Tests

- ✅ Terminal session creation
- ✅ Multiple session management
- ✅ Session lifecycle (create, use, close)
- ✅ Session display in sidebar
- ✅ Session switching functionality

### Console/Admin Page Tests

- ✅ Console page accessibility and layout
- ✅ Admin information display
- ✅ Navigation to/from console
- ✅ Page structure validation

### Responsive Design Tests

- ✅ Mobile viewport (375x667)
- ✅ Tablet viewport (768x1024)
- ✅ Various desktop resolutions
- ✅ Layout adaptation across screen sizes
- ✅ Interactive element accessibility on touch devices

### Visual Regression Tests

- ✅ Consistent layout structure
- ✅ Button and interactive element styling
- ✅ Form element validation
- ✅ Color contrast and accessibility
- ✅ Screenshot comparison for key pages

### Error Handling Tests

- ✅ Network error resilience
- ✅ Invalid URL handling
- ✅ Session state persistence
- ✅ Graceful degradation

## Visual Documentation

The test suite automatically generates visual documentation:

- `test-results/projects-page-layout.png` - Main projects page layout
- `test-results/terminal-session-created.png` - Terminal session interface
- `test-results/sessions-sidebar.png` - Session management sidebar
- `test-results/multiple-sessions.png` - Multi-session view
- `test-results/console-page.png` - Admin console interface
- `test-results/mobile-layout.png` - Mobile responsive layout
- `test-results/tablet-layout.png` - Tablet responsive layout
- `test-results/layout-*.png` - Various viewport layouts
- `test-results/visual-baseline.png` - Visual regression baseline

## CI Integration

### Reliable Execution

The test suite is designed for reliable CI execution:

- **No external API dependencies** - All Claude functionality excluded
- **Deterministic behavior** - Tests use mocked data where needed
- **Fast execution** - Focused on essential UI flows
- **Clear reporting** - Detailed success/failure information

### Test Results

- **HTML Report**: `test-results/html-report/index.html`
- **JSON Results**: `test-results/results.json`
- **Screenshots**: `test-results/*.png` files
- **Videos**: Captured on test failure

### Environment Setup

For CI environments, ensure:

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run playwright:install

# Set required environment variables
export TERMINAL_KEY=testkey12345
export PTY_MODE=shell
export NODE_ENV=test

# Run tests
npm run test:ui
```

## Development and Extension

### Adding New Tests

1. **Core functionality tests** - Add to `e2e/comprehensive-ui.spec.js`
2. **Specialized tests** - Create new `*.spec.js` files
3. **Update configuration** - Add new test files to `playwright-ui.config.js`

### Test Development Best Practices

- **Use data-testid attributes** for reliable element selection
- **Wait for load states** before interacting with elements
- **Take screenshots** for visual validation
- **Mock external dependencies** to ensure test reliability
- **Test across viewports** for responsive validation

### Debugging Failed Tests

```bash
# Interactive debugging
npm run test:ui:debug

# View test report
npx playwright show-report

# Run specific test file
npx playwright test e2e/comprehensive-ui.spec.js --config=playwright-ui.config.js

# Run with headed browser
npm run test:ui:headed
```

## Maintenance

### Regular Maintenance Tasks

1. **Update visual baselines** when UI changes are intentional
2. **Review test timeouts** if application performance changes
3. **Update viewport sizes** to match target device specifications
4. **Refresh test data** to maintain test relevance

### Monitoring Test Health

- Monitor test execution time for performance regressions
- Review screenshot diffs for unintended visual changes
- Check test flakiness in CI environment
- Update test selectors when UI elements change

## Troubleshooting

### Common Issues

**Tests fail due to authentication**

- Verify `TERMINAL_KEY` environment variable is set
- Check that auth flow matches application behavior

**Screenshots don't match**

- Update visual baselines if changes are intentional
- Check for font rendering differences across environments

**Timeouts in CI**

- Increase timeout values in configuration
- Check for network latency issues
- Verify dev server startup time

**Missing elements**

- Update selectors when UI structure changes
- Add proper wait conditions for dynamic content
- Check element visibility requirements

### Getting Help

For test suite issues:

1. Check the HTML test report for detailed failure information
2. Review screenshots in `test-results/` directory
3. Run tests with `--debug` flag for interactive debugging
4. Verify the dev server runs correctly with `npm run dev`

## Benefits

This test suite provides:

- **Comprehensive UI Coverage** - All major user flows validated
- **CI Reliability** - No external API dependencies
- **Visual Quality Assurance** - Screenshot-based regression testing
- **Cross-browser Compatibility** - Multi-browser and device testing
- **Maintainable Test Code** - Clear structure and documentation
- **Fast Feedback** - Focused tests for quick development cycles

The test suite ensures that Dispatch's core functionality remains stable and user-friendly across all supported platforms and browsers, while avoiding the complexity and unreliability of testing features that require external API access.
