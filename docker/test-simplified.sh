#!/bin/bash
# Test script for simplified Docker setup

set -e

echo "🔨 Building Docker image locally..."
docker build -f docker/Dockerfile -t dispatch:test .

echo ""
echo "📁 Creating test directories..."
mkdir -p test-config test-projects test-workspace

echo ""
echo "🚀 Starting container..."
docker run -d --name dispatch-test \
  -p 3031:3030 \
  -e TERMINAL_KEY=test123 \
  -v ./test-config:/config \
  -v ./test-projects:/projects \
  -v ./test-workspace:/workspace \
  dispatch:test

echo ""
echo "⏳ Waiting for server to start..."
sleep 5

echo ""
echo "🔍 Checking container logs..."
docker logs dispatch-test

echo ""
echo "✅ Test container is running on port 3031"
echo "   Access at: http://localhost:3031"
echo "   Password: test123"
echo ""
echo "To stop and clean up:"
echo "  docker stop dispatch-test"
echo "  docker rm dispatch-test"
echo "  rm -rf test-config test-projects test-workspace"