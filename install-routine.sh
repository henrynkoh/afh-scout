#!/bin/zsh
set -e
APP=/Users/henryoh/Documents/afh-scout
LABEL=com.henryoh.afh-scout
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$APP/$LABEL.plist" "$TARGET"
plutil -lint "$TARGET"
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$TARGET"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
sleep 2
launchctl print "gui/$(id -u)/$LABEL" | grep -E 'path =|state =|runs =|last exit code' || true
echo "AFH Scout is scheduled every day at 7:00 AM. First run log: $APP/logs/daily-monitor.log"
