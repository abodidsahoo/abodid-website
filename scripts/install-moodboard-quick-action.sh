#!/bin/zsh

set -euo pipefail

readonly script_dir="${0:A:h}"
readonly project_dir="${script_dir:h}"
readonly source_workflow="${project_dir}/macos/Send to Moodboard.workflow"
readonly services_dir="${HOME}/Library/Services"
readonly installed_workflow="${services_dir}/Send to Moodboard.workflow"
readonly keychain_account="${USER}"
readonly endpoint_service="com.abodid.moodboard.endpoint"
readonly token_service="com.abodid.moodboard.token"

endpoint="${MOODBOARD_QUICK_ACTION_ENDPOINT:-https://abodid.com/api/integrations/moodboard}"
endpoint="${endpoint%/}"
token="${MOODBOARD_QUICK_ACTION_TOKEN:-}"

if [[ -z "${token}" ]]; then
    if [[ ! -t 0 ]]; then
        print -u2 "Set MOODBOARD_QUICK_ACTION_TOKEN or run this installer in a terminal."
        exit 1
    fi
    read -r -s "token?Paste the MOODBOARD_QUICK_ACTION_TOKEN configured in Vercel: "
    print
fi

if (( ${#token} < 32 )); then
    print -u2 "The token must be at least 32 characters."
    exit 1
fi

if [[ "${endpoint}" != https://* && "${endpoint}" != http://localhost:* ]]; then
    print -u2 "The endpoint must use HTTPS (or localhost for development)."
    exit 1
fi

if [[ ! -f "${source_workflow}/Contents/document.wflow" || ! -f "${source_workflow}/Contents/Info.plist" ]]; then
    print -u2 "The Send to Moodboard workflow is missing."
    exit 1
fi

/usr/bin/security add-generic-password -U \
    -a "${keychain_account}" \
    -s "${endpoint_service}" \
    -w "${endpoint}" >/dev/null
/usr/bin/security add-generic-password -U \
    -a "${keychain_account}" \
    -s "${token_service}" \
    -w "${token}" >/dev/null

/bin/mkdir -p "${services_dir}"
/usr/bin/ditto "${source_workflow}" "${installed_workflow}"

print "Installed: ${installed_workflow}"
print "In Finder, right-click an image and choose Quick Actions > Send to Moodboard."
print "If it is hidden, enable it in System Settings > Privacy & Security > Extensions > Finder > Quick Actions."
