#!/bin/zsh
set -u
APP=/Users/henryoh/Documents/afh-scout
NODE=/usr/local/bin/node
LOG="$APP/logs/daily-monitor.log"
LOCK="$APP/data/.monitor.lock"
mkdir -p "$APP/logs" "$APP/data"
exec >>"$LOG" 2>&1
printf '\n=== AFH Scout daily run %s ===\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "SKIP: another monitor run holds $LOCK"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
cd "$APP"
"$NODE" scout.js rate || echo "WARN: rate refresh failed; using saved rate"
"$NODE" scout.js monitor --limit 20
"$NODE" scout.js selftest
"$NODE" scout.js index
echo "DONE: $(date '+%Y-%m-%d %H:%M:%S %Z')"
