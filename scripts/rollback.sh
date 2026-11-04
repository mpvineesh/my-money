#!/usr/bin/env bash
# Redeploy a previously released tag to Firebase Hosting without touching your working tree.
# Usage: scripts/rollback.sh v1.2.3
#        scripts/rollback.sh --list      (show available release tags)
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${1:-}" = "--list" ] || [ -z "${1:-}" ]; then
  echo "Release tags (newest first):"
  git tag --list 'v*' --sort=-v:refname | head -20
  [ -z "${1:-}" ] && { echo; echo "Usage: $0 <tag>"; exit 1; }
  exit 0
fi

TAG="$1"
git fetch origin --tags --quiet || true
if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Tag '$TAG' not found. Run '$0 --list' to see releases." >&2
  exit 1
fi

WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/my-money-rollback.XXXXXX")"
cleanup() {
  git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || rm -rf "$WORKTREE"
}
trap cleanup EXIT

echo "==> Checking out $TAG into a temporary worktree"
git worktree add --detach "$WORKTREE" "$TAG" >/dev/null

echo "==> Installing dependencies for $TAG"
(cd "$WORKTREE" && npm ci --silent)

echo "==> Building $TAG"
(cd "$WORKTREE" && npm run build)

echo "==> Deploying $TAG to Firebase Hosting"
(cd "$WORKTREE" && npx firebase deploy --only hosting -m "Rollback to $TAG ($(git rev-parse --short "$TAG"))")

echo
echo "Hosting now serves $TAG. Your working tree on $(git rev-parse --abbrev-ref HEAD) was not changed."
echo "To move forward again, run 'npm run release' from main (it will cut a new version)."
