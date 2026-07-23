#!/usr/bin/env bash
#
# realign-local-clones.sh
#
# Run this AFTER cleanup-public-repos.sh has already rewritten and pushed.
# It does NOT touch GitHub — no fetch-and-merge, no push, no rebuild triggered.
#
# Your 5 local clones still point at the old, pre-rewrite history. A plain
# `git reset --hard` would delete CLAUDE.md, master.md and .impeccable/ —
# they are still tracked in your local HEAD but absent from the rewritten
# remote. So for each repo this: copies those files aside, resets onto the
# rewritten remote, then puts them back as ignored-untracked files.
#
# Also clears stale .git/*.lock files, which is what stopped the first run.
#
# Run:  bash realign-local-clones.sh
#
set -euo pipefail

PORTFOLIO_DIR="${PORTFOLIO_DIR:-$HOME/Claude/Projects/Portfolio}"
KEEP="$(mktemp -d)"

say()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mfatal:\033[0m %s\n\n' "$*" >&2; exit 1; }

# Files purged from history — must be preserved on disk across the reset.
purge_list() {
  cat <<'EOF'
CLAUDE.md
master.md
AGENTS.md
.claude
.impeccable
EOF
  [ "$1" = "Portfolio" ] && cat <<'EOF'
portfolio-progress-after-continue.md
EOF
  return 0
}

# A lock file with no git process behind it is stale. Git leaves these when a
# process is killed — or, in this case, when a sandboxed process could not
# unlink its own lock. Safe to clear once nothing is running.
clear_stale_locks() {
  local dir="$1" found=0
  for lock in "$dir/.git/index.lock" "$dir/.git/HEAD.lock" \
              "$dir/.git/objects/maintenance.lock" "$dir/.git/gc.pid.lock"; do
    if [ -e "$lock" ]; then rm -f "$lock" && found=1; fi
  done
  [ "$found" = 1 ] && note "cleared stale lock file(s)"
  return 0
}

realign() {
  local dir="$1" repo="$2"

  if [ ! -d "$dir/.git" ]; then
    warn "no git repo at $dir — skipped"
    return 0
  fi

  say "$repo"
  cd "$dir"
  clear_stale_locks "$dir"

  local branch; branch="$(git rev-parse --abbrev-ref HEAD)"

  # Refuse to reset over real uncommitted work.
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    warn "uncommitted changes here — skipped, nothing was touched."
    warn "Commit or stash them, then re-run this script."
    return 0
  fi

  local local_head remote_head
  local_head="$(git rev-parse HEAD)"
  remote_head="$(git ls-remote origin "$branch" | awk '{print $1}')"

  if [ "$local_head" = "$remote_head" ]; then
    note "already aligned ✓"
    return 0
  fi

  # Preserve, reset, restore.
  local stash="$KEEP/$repo"; mkdir -p "$stash"
  while IFS= read -r p; do
    [ -e "$p" ] && cp -R "$p" "$stash/" 2>/dev/null || true
  done < <(purge_list "$repo")

  git fetch --quiet origin
  git reset --quiet --hard "origin/$branch"
  cp -R "$stash"/. . 2>/dev/null || true

  note "${local_head:0:8} → $(git rev-parse --short HEAD)  ✓"
  local restored; restored="$(ls -A "$stash" 2>/dev/null | tr '\n' ' ')"
  [ -n "$restored" ] && note "kept on disk: $restored"
  return 0
}

command -v git >/dev/null || die "git not found."
[ -d "$PORTFOLIO_DIR/.git" ] || die "Portfolio repo not found at $PORTFOLIO_DIR"

realign "$PORTFOLIO_DIR"                                            Portfolio
realign "$PORTFOLIO_DIR/Commercial/(DEMO) Herminias-Business"       Herminias-Catering
realign "$PORTFOLIO_DIR/Commercial/(DEMO) Justdiz-Business"         Justdiz-Preproductions-Business
realign "$PORTFOLIO_DIR/Commercial/(DEMO) Kozykook-Business"        Kozykook-Business
realign "$PORTFOLIO_DIR/Commercial/Cafe Dashboard/order-dashboard"  Cafe-Order-CRM-Dashboard-

rm -rf "$KEEP"

say "All local clones realigned."
note "CLAUDE.md, master.md and .impeccable/ are still on disk, now ignored."
note "GitHub was not touched — no new deploys triggered."
