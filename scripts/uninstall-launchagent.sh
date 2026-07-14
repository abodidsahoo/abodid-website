#!/usr/bin/env bash

set -Eeuo pipefail

LABEL="com.personalsite.devserver"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
SERVICE_TARGET="gui/$(id -u)/${LABEL}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf '✗ Site Workspace auto-start is supported on macOS only.\n' >&2
  exit 1
fi

if launchctl print "${SERVICE_TARGET}" >/dev/null 2>&1; then
  launchctl bootout "${SERVICE_TARGET}" >/dev/null 2>&1 \
    || launchctl unload "${PLIST_PATH}" >/dev/null 2>&1 \
    || true
fi

rm -f "${PLIST_PATH}"
rm -f /tmp/personalsite-dev.log /tmp/personalsite-dev-error.log

printf '✓ Site Workspace auto-start removed.\n'
