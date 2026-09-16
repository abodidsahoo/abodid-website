# Chrome Web Store Listing: Abodid Opportunity Capture

## Metadata
- **Extension Name**: Abodid Opportunity Capture
- **Version**: 1.0.0
- **Category**: Productivity
- **Primary Language**: English
- **Last Updated**: 2026-09-16

## Description
Single-click capture of jobs, open calls, residencies, grants, conferences, and fellowships directly into your personal Abodid Opportunity Assistant.

### Key Features
- One-click capture of opportunity web pages
- Safe client-side page text extraction for restricted/authenticated pages
- Automatic deduplication against your private database
- Displays extracted category and deadline immediately upon saving

## Permissions Justification
- `activeTab`: Required to inspect the current opportunity page URL, title, and structure upon user click.
- `tabs`: Required to access the active tab URL and title when opening the capture popup.
- `storage`: Required to securely store your private backend API URL and authentication key locally in your browser.
- `scripting`: Required to extract visible text from the active opportunity page to send to your private capture endpoint.

## Host Permissions
- `https://abodid.com/*`: Required to communicate with your private opportunity capture API.
- `http://localhost:4321/*`: Required for local development and testing.

## Privacy & Data Use
- **Single Purpose**: Captures opportunity web pages and transmits them directly to your personal API.
- **No Third-Party Tracking**: No analytics, telemetry, or third-party ads are embedded in this extension.
- **Data Collection**: Collects URL, title, and page text only when you explicitly press "Save Opportunity".
