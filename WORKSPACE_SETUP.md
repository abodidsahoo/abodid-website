# Site Workspace - Setup Guide

## Prerequisites

- A Mac running macOS
- Node.js 20 installed through `nvm`
- Google Chrome (not Safari or Firefox)
- The project `.env` file with all keys filled in
- Project packages installed with `npm install`

## First-Time Setup (run once)

### 1. Install the auto-start service

From the project folder, run:

```bash
npm run workspace:install
```

This installs a macOS background service that starts the local site automatically every time you log in. A successful setup ends with messages like:

```text
✓ Node 20 found at /Users/...
✓ LaunchAgent installed
✓ Server started - http://localhost:4321 is responding
```

### 2. Install the admin panel as an app

1. Open Google Chrome.
2. Go to [http://localhost:4321/admin/dashboard](http://localhost:4321/admin/dashboard).
3. Sign in to the admin panel if asked.
4. Select the install icon in the address bar. If it is not shown, open the Chrome menu (three dots), choose **Cast, save, and share**, then choose **Install page as app**.
5. Name it **Site Workspace** and select **Install**.
6. Site Workspace now appears in the Dock and Applications folder.

### 3. Optional: open the app at login

Right-click the Site Workspace icon in the Dock, then choose **Options > Open at Login**.

The background service already starts the site. This option also opens the app window automatically.

## Daily Use

The local site starts automatically after you log in to your Mac. Open Site Workspace from the Dock to manage the site. Admin changes continue to save to Supabase in real time, and source-code changes appear automatically.

You only authenticate in Site Workspace once on this Mac. Chrome stores the Supabase session and the app refreshes it silently on later launches. You will be asked to authenticate again only if you deliberately sign out, clear Chrome's site data, change the account password, or the session is revoked in Supabase.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd + Enter | Toggle full screen |
| Cmd + R | Reload the current page |
| Cmd + Option + I | Open Chrome developer tools |
| Cmd + [ | Navigate back |
| Cmd + ] | Navigate forward |

## Useful Commands

```bash
npm run workspace:status     # Check whether the background service is running
npm run workspace:logs       # Watch the server logs
npm run workspace:restart    # Restart the local site
```

Press `Control + C` to stop watching the logs. This does not stop the site.

## Troubleshooting

### Server not responding

Run:

```bash
npm run workspace:status
npm run workspace:restart
npm run workspace:logs
```

If the log says port 4321 is already in use, close any terminal window running `npm run dev`, then run `npm run workspace:restart`.

### App window is blank

Press `Cmd + R` inside Site Workspace. If it is still blank, run `npm run workspace:logs` in a terminal and check the latest message.

### Node 20 or nvm was not found

If `command -v nvm` prints nothing, install nvm using its [official installation guide](https://github.com/nvm-sh/nvm#installing-and-updating), then close and reopen Terminal.

Install Node 20 through nvm, then try setup again:

```bash
nvm install 20
nvm use 20
npm install
npm run workspace:install
```

### Reset everything

```bash
npm run workspace:uninstall
npm run workspace:install
```

The uninstall command removes only the local auto-start service and its logs. It does not delete the project or any Supabase data.
