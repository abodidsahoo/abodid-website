#!/bin/zsh
set -euo pipefail
for tool in python3 yt-dlp ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. Install it first (for yt-dlp/ffmpeg: brew install yt-dlp ffmpeg)." >&2
    exit 1
  fi
done
ROOT="${0:A:h}"
APP="$HOME/Library/Application Support/Abodid Moodboard Video"
LOGDIR="$HOME/Library/Logs"
PLIST="$HOME/Library/LaunchAgents/com.abodid.moodboard-video.plist"
mkdir -p "$APP" "$LOGDIR" "$HOME/Library/LaunchAgents"
cp "$ROOT/bridge.py" "$APP/bridge.py"
chmod 700 "$APP/bridge.py"
PYTHON="$(command -v python3)"
cat > "$PLIST" <<PLIST_XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.abodid.moodboard-video</string>
<key>ProgramArguments</key><array><string>$PYTHON</string><string>$APP/bridge.py</string></array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$LOGDIR/abodid-moodboard-video.log</string>
<key>StandardErrorPath</key><string>$LOGDIR/abodid-moodboard-video-error.log</string>
</dict></plist>
PLIST_XML
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 1
KEYFILE="$APP/pairing-key"
if [[ -f "$KEYFILE" ]]; then
  echo "Mac bridge installed. Paste this key into the new extension's options:"
  cat "$KEYFILE"
else
  echo "Bridge installed; key has not been generated. Inspect $LOGDIR/abodid-moodboard-video-error.log" >&2
  exit 1
fi
printf '\nExtension directory: %s/../extension\n' "$ROOT"
