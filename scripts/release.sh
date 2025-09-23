#! /usr/bin/env bash
# npm version 0.2.1 --no-git-tag-version
# git add package.json
# git commit -m "chore: bump version to 0.2.1"
# git tag v0.2.1
npm version "${1:-patch}"
git push origin main --tags