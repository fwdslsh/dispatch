# UI Test Suite - Quick Start Guide

## Overview

This repository includes a comprehensive Playwright-based UI test suite that validates all major user flows in Dispatch **excluding Claude sessions** to ensure reliable CI execution without external API dependencies.

## Quick Start

### Prerequisites

- Node.js >= 22
- npm packages installed: `npm install`

### Running Tests

```bash
# Install Playwright browsers (one-time setup)
npm run playwright:install

# Run the complete UI test suite
npm run test:ui

# Run with visible browser windows (development)
npm run test:ui:headed

# Interactive debugging mode
npm run test:ui:debug

# Open Playwright UI for test development
npm run test:ui:ui
```

### What Gets Tested

**✅ Comprehensive Coverage (110 tests across 5 browsers):**

- **Authentication Flow** - Login, logout, session persistence, error handling
- **Project Management** - Project creation, navigation, layout validation
- **Terminal Sessions** - Creation, management, multi-session handling, lifecycle
- **Console/Admin Page** - Accessibility, information display, navigation
- **Responsive Design** - Mobile (375px), tablet (768px), desktop layouts
- **Visual Regression** - Screenshot validation, layout consistency, styling
- **Error Handling** - Network errors, invalid URLs, graceful degradation

**🚫 Intentionally Excluded (for CI reliability):**

- Claude session functionality (requires external API)
- Claude-specific UI components
- Activity summaries requiring Claude API

## Test Results

Tests generate comprehensive visual documentation:

- **HTML Report**: `playwright-report/index.html`
- **Screenshots**: `test-results/*.png` files for visual validation
- **JSON Results**: `test-results/results.json` for CI integration

## Browser Coverage

- Desktop: Chrome, Firefox, Safari
- Mobile: Pixel 5 (Chrome), iPhone 12 (Safari)

## CI Integration

The test suite is designed for reliable CI execution:

```yaml
# GitHub Actions example
- name: Run UI Tests
  env:
    TERMINAL_KEY: 'testkey12345'
    PTY_MODE: 'shell'
  run: npm run test:ui
```

## Documentation

Full documentation available in [`docs/UI_TEST_SUITE.md`](docs/UI_TEST_SUITE.md)

## Files Added

- `e2e/comprehensive-ui.spec.js` - Main test suite (22 test scenarios)
- `playwright-ui.config.js` - Focused configuration excluding Claude tests
- `run-ui-tests.js` - Test runner with clear reporting
- `docs/UI_TEST_SUITE.md` - Complete documentation
- `scripts/install-browsers.sh` - CI-friendly browser installation
- `.github/workflows/ui-tests.yml.template` - GitHub Actions template

## Visual Examples

The test suite validates these key UI pages:

1. **Login Page** - Authentication flow and error handling
2. **Projects Page** - Main interface with session management
3. **Console Page** - Admin interface for monitoring

All tests include automatic screenshot generation for visual regression testing and documentation purposes.
