#!/usr/bin/env bash
# Cut a versioned release: bump package.json, tag vX.Y.Z, build, deploy hosting, push.
# Usage: scripts/release.sh [patch|minor|major]   (default: patch)
set -euo pipefail

BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "Usage: $0 [patch|minor|major]" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "Releases are cut from main (currently on '$BRANCH')." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Commit or stash your changes before releasing." >&2
  git status --short >&2
  exit 1
fi

git fetch origin main --tags --quiet
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Local main differs from origin/main. Pull or push first so the tag matches what is on GitHub." >&2
  exit 1
fi

echo "==> Linting"
npm run lint

echo "==> Bumping version ($BUMP)"
# npm version updates package.json + lockfile, commits, and creates an annotated tag "vX.Y.Z".
VERSION="$(npm version "$BUMP" -m "Release v%s")"
echo "    Tagged $VERSION"

echo "==> Building $VERSION"
npm run build

echo "==> Deploying $VERSION to Firebase Hosting"
npx firebase deploy --only hosting -m "$VERSION ($(git rev-parse --short HEAD))"

echo "==> Pushing commit and tag"
git push origin main
git push origin "$VERSION"

echo
echo "Released $VERSION. Roll back later with: npm run rollback -- $VERSION"
