#!/bin/zsh
set -euo pipefail
PLIST="$HOME/Library/LaunchAgents/com.abodid.moodboard-video.plist"
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
echo "The Mac bridge has been stopped and its LaunchAgent removed. Your existing image extension, website, and R2 objects were not changed."
echo "Optional: delete ~/Library/Application Support/Abodid Moodboard Video to remove bridge files and its local key."
