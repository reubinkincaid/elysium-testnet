#!/usr/bin/env bash
# Install the secret-scanning pre-commit hook.
#
#   ./scripts/install-hooks.sh
#
# .git/hooks is not version-controlled, so the hook lives in
# scripts/pre-commit-hook and is copied into place. Re-run after a fresh clone.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

HOOK_SRC="scripts/pre-commit-hook"
HOOK_DST=".git/hooks/pre-commit"

if [[ ! -f "$HOOK_SRC" ]]; then
  echo "error: $HOOK_SRC not found" >&2
  exit 1
fi

mkdir -p .git/hooks
cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "installed $HOOK_DST"

# gitleaks is the second layer. Layer 1 (exact match against .env values)
# works without it; layer 2 catches secrets the hook has never seen.
if command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks   $(gitleaks version 2>/dev/null | head -1)"
else
  echo "gitleaks   NOT INSTALLED — install with: brew install gitleaks"
  echo "           layer 1 still works; layer 2 (generic patterns) will not run"
fi

echo ""
echo "Test it:"
echo "  echo 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' > /tmp/x.ts"
echo "  git add /tmp/x.ts 2>/dev/null; cp /tmp/x.ts ./x.ts; git add x.ts; git commit -m t"
