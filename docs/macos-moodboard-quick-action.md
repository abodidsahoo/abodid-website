# macOS “Send to Moodboard” Quick Action

This integration adds selected Finder images to the website mood board. Every
original is uploaded to the `assets` Cloudflare R2 bucket under this fixed key
prefix:

```text
photos/originals/moodboard/
```

The endpoint also inserts the corresponding `moodboard_items` row, so the image
appears in the admin mood-board manager immediately. The Finder action supports
JPEG, PNG, WebP, GIF, and AVIF images up to 20 MB. Multiple selected images are
uploaded one at a time.

R2 object-create notifications then build permanent 800px and 1600px WebP
variants. The public grid requests 800px, the opened viewer requests 1600px,
and animated GIFs stay animated in both compressed variants. The moodboard page
is database-driven, so adding an image does not require a Vercel deployment.

## 1. Configure the server secret

Generate a random token with at least 32 characters:

```sh
openssl rand -hex 32
```

Add the result to the Vercel project as `MOODBOARD_QUICK_ACTION_TOKEN` for the
Production environment, then deploy the site. The endpoint is:

```text
https://abodid.com/api/integrations/moodboard
```

The token is server-only. Never give it a `PUBLIC_` prefix or commit its value.

## 2. Install the Finder Quick Action

From the project directory, run:

```sh
npm run install:moodboard-quick-action
```

Paste the same token when prompted. The installer stores the endpoint and token
in macOS Keychain and installs the workflow at:

```text
~/Library/Services/Send to Moodboard.workflow
```

Then select one or more images in Finder and choose **Quick Actions → Send to
Moodboard**. A macOS notification reports whether the upload succeeded.

If the action is not visible, enable it under **System Settings → Privacy &
Security → Extensions → Finder → Quick Actions**.

To point the action at a different deployment, set
`MOODBOARD_QUICK_ACTION_ENDPOINT` while running the installer.
