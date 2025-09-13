#!/bin/bash

# CI-friendly browser installation script
# This script handles Playwright browser installation with fallbacks for CI environments

echo "🎭 Installing Playwright browsers for CI..."

# Try to install browsers with retry logic
install_browsers() {
    local attempt=1
    local max_attempts=3
    
    while [ $attempt -le $max_attempts ]; do
        echo "Attempt $attempt/$max_attempts: Installing browsers..."
        
        if npx playwright install --with-deps; then
            echo "✅ Browsers installed successfully!"
            return 0
        else
            echo "❌ Installation failed (attempt $attempt/$max_attempts)"
            if [ $attempt -eq $max_attempts ]; then
                echo "🔄 Falling back to individual browser installation..."
                
                # Try installing just chromium as fallback
                if npx playwright install chromium; then
                    echo "✅ Chromium installed successfully!"
                    return 0
                else
                    echo "❌ Failed to install any browsers"
                    return 1
                fi
            fi
            attempt=$((attempt + 1))
            sleep 5
        fi
    done
}

# Check if browsers are already installed
if npx playwright --version > /dev/null 2>&1; then
    echo "📋 Checking existing browser installation..."
    
    # Try a quick browser check
    if npx playwright test --list --config=playwright-ui.config.js > /dev/null 2>&1; then
        echo "✅ Browsers already installed and working!"
        exit 0
    fi
fi

# Install browsers
if install_browsers; then
    echo "🎉 Browser installation complete!"
    
    # Verify installation
    echo "🔍 Verifying installation..."
    if npx playwright --version; then
        echo "✅ Playwright installation verified!"
    else
        echo "⚠️  Warning: Playwright verification failed, but installation may have succeeded"
    fi
else
    echo "❌ Browser installation failed!"
    echo ""
    echo "💡 Manual installation options:"
    echo "   • npm run playwright:install"
    echo "   • npx playwright install"
    echo "   • npx playwright install chromium (minimal install)"
    echo ""
    echo "🔧 System requirements:"
    echo "   • Node.js >= 22"
    echo "   • Sufficient disk space (~200MB per browser)"
    echo "   • Network access to download.playwright.dev"
    exit 1
fi