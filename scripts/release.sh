#!/usr/bin/env bash
set -e

VERSION_ARG="${1:-patch}"

# Check if argument looks like a version string (contains digits and dots/dashes)
# e.g., v0.4.0-rc1, 1.0.0-rc-abc123, 0.3.0-rc-4
if [[ "$VERSION_ARG" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  # Custom version string provided
  # Remove leading 'v' if present
  VERSION="${VERSION_ARG#v}"

  echo "📦 Creating custom release: $VERSION"

  # Update package.json without creating git tag
  npm version "$VERSION" --no-git-tag-version

  # Commit the version change
  git add package.json package-lock.json
  git commit -m "chore: bump version to $VERSION"

  # Create tag with 'v' prefix
  git tag "v$VERSION"

  echo "✅ Created tag: v$VERSION"
else
  # Standard semver bump (patch, minor, major)
  echo "📦 Creating $VERSION_ARG release"
  npm version "$VERSION_ARG"
  echo "✅ Version bumped"
fi

# Push to origin with tags
git push origin main --tags
echo "🚀 Pushed to origin with tags"