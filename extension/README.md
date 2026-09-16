# Abodid Opportunity Capture Chrome Extension

A lightweight Manifest V3 Chrome Extension to capture jobs, open calls, residencies, grants, conferences, and fellowships into your private Opportunity Assistant with 1 click.

## Installation Instructions (Developer Mode)

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the address bar.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left.
5. Select the `extension/` folder inside this repository:
   `/Users/abodid/Documents/GitHub/personal-site/extension`
6. Pin the **Abodid Opportunity Capture** icon (yellow square with 'O') to your Chrome toolbar.

## Configuration

1. Click the extension icon on any webpage.
2. Click the ⚙️ gear icon in the top right of the popup.
3. Configure:
   - **Backend API URL**: `https://abodid.com` (or `http://localhost:4321` for local testing).
   - **Passphrase / Key**: Your `OPPORTUNITIES_PASSWORD` value.
4. Click **Save Config**.

## Usage

1. When viewing any opportunity online, click the extension icon.
2. Click **⚡ Save Opportunity**.
3. The extension extracts the page text and sends it to the server capture API.
4. The server checks for existing records (deduplication) and performs at most 1 AI extraction call.
5. The extension displays:
   - `Saved ✓`
   - `Category`
   - `Deadline`
