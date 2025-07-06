#!/bin/bash
set -e

# Arguments
version=$1

# Add the version text on 9th line
echo "Updating changelog"
updateText="## $version\n\nInitial release of the new version $version.\n"
sed -i "9i$updateText" CHANGELOG.md
echo "Changelog updated: $updateText"

echo "Updating version in package.json"
npm version "$version" --no-git-tag-version

echo "Done"
