#!/usr/bin/env bash

set -Eeuo pipefail

LABEL="com.personalsite.devserver"
PORT="4321"
SERVER_URL="http://localhost:${PORT}"
PLIST_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${PLIST_DIR}/${LABEL}.plist"
STDOUT_LOG="/tmp/personalsite-dev.log"
STDERR_LOG="/tmp/personalsite-dev-error.log"
USER_DOMAIN="gui/$(id -u)"
SERVICE_TARGET="${USER_DOMAIN}/${LABEL}"

fail() {
  printf '✗ %s\n' "$*" >&2
  exit 1
}

xml_escape() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&apos;/g"
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "Site Workspace auto-start is supported on macOS only."
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
NVM_SCRIPT="${NVM_DIR}/nvm.sh"

[[ -s "${NVM_SCRIPT}" ]] || fail "nvm was not found at ${NVM_SCRIPT}. Install it from https://github.com/nvm-sh/nvm#installing-and-updating, then install Node 20."

# nvm uses optional shell variables internally, so nounset is disabled only while loading it.
set +u
# shellcheck source=/dev/null
source "${NVM_SCRIPT}"
NODE_PATH="$(nvm which 20 2>/dev/null || true)"
set -u
[[ -n "${NODE_PATH}" && -x "${NODE_PATH}" ]] || fail "Node 20 is not installed in nvm. Run: nvm install 20"

NODE_MAJOR="$("${NODE_PATH}" -p 'process.versions.node.split(".")[0]')"
[[ "${NODE_MAJOR}" == "20" ]] || fail "Expected Node 20, but ${NODE_PATH} reports a different version."

ASTRO_BIN="${PROJECT_ROOT}/node_modules/.bin/astro"
[[ -f "${ASTRO_BIN}" ]] || fail "Astro is missing. Run npm install in ${PROJECT_ROOT} first."

printf '✓ Node 20 found at %s\n' "${NODE_PATH}"
printf '✓ Astro found at %s\n' "${ASTRO_BIN}"
printf '✓ Project found at %s\n' "${PROJECT_ROOT}"

# Replace an older copy cleanly before checking whether another process owns the port.
if launchctl print "${SERVICE_TARGET}" >/dev/null 2>&1; then
  launchctl bootout "${SERVICE_TARGET}" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    curl --silent --fail --max-time 1 "${SERVER_URL}" >/dev/null 2>&1 || break
    sleep 0.25
  done
fi

if curl --silent --fail --max-time 1 "${SERVER_URL}" >/dev/null 2>&1; then
  fail "Port ${PORT} is already in use. Stop the existing dev server and run this command again."
fi

mkdir -p "${PLIST_DIR}"

NODE_XML="$(xml_escape "${NODE_PATH}")"
ASTRO_XML="$(xml_escape "${ASTRO_BIN}")"
PROJECT_XML="$(xml_escape "${PROJECT_ROOT}")"
HOME_XML="$(xml_escape "${HOME}")"
NODE_BIN_DIR="$(dirname -- "${NODE_PATH}")"
PATH_XML="$(xml_escape "${NODE_BIN_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin")"

cat > "${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_XML}</string>
    <string>${ASTRO_XML}</string>
    <string>dev</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${PROJECT_XML}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME_XML}</string>
    <key>PATH</key>
    <string>${PATH_XML}</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${STDOUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${STDERR_LOG}</string>

  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
PLIST

plutil -lint "${PLIST_PATH}" >/dev/null || fail "The generated LaunchAgent file is invalid."

if ! launchctl bootstrap "${USER_DOMAIN}" "${PLIST_PATH}" >/dev/null 2>&1; then
  launchctl load "${PLIST_PATH}" >/dev/null 2>&1 || fail "macOS could not load the LaunchAgent."
fi

launchctl print "${SERVICE_TARGET}" >/dev/null 2>&1 || fail "The LaunchAgent was created but is not running."
printf '✓ LaunchAgent installed\n'

server_ready=false
for _ in {1..30}; do
  if curl --silent --fail --max-time 1 "${SERVER_URL}" >/dev/null 2>&1; then
    server_ready=true
    break
  fi
  sleep 1
done

if [[ "${server_ready}" != "true" ]]; then
  printf '✗ Server did not respond within 30 seconds.\n' >&2
  if [[ -s "${STDERR_LOG}" ]]; then
    printf 'Last server errors:\n' >&2
    tail -n 20 "${STDERR_LOG}" >&2
  fi
  exit 1
fi

printf '✓ Server started - %s is responding\n' "${SERVER_URL}"
printf 'Open %s/admin/dashboard in Chrome to install Site Workspace.\n' "${SERVER_URL}"
