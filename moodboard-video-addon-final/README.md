# Video → GIF → Abodid Moodboard (separate extension)

This is a standalone **video-only** Chrome extension and Mac converter. **No original repository files are replaced or edited.** It adds a separate right-click item, **Send video under pointer to Moodboard**, on Pinterest. It keeps the entire short video, makes an animated GIF locally using FFmpeg, checks size and animation complexity, uploads the GIF to your *existing* Moodboard image `/prepare` and `/complete` API, and lets your existing Cloudflare media processor generate 800px and 1600px animated WebP variants.

## Progress dashboard (version 0.3.0)

Click the **blue video extension icon** in Chrome to open its compact **Transfers** panel. It updates about every 3 seconds while open and shows Download → Convert → Upload → Save, elapsed time, the currently attempted compression quality preset, the original Pinterest Pin link, recent successes and failures, and retriable errors. A numbered badge on the icon indicates pending video jobs. No GIF time-percentage or upload-percentage is fabricated: compression may require multiple complete attempts, and the browser's standard PUT upload does not expose a reliable byte-by-byte percentage. The current **stage and attempt** are real. Chrome notifications still announce when work starts and completes, and jobs continue with the popup closed. The Mac bridge updates its per-job progress; when the popup is open it reads those states directly, without waiting for the 30-second background poll.

**Upgrading from 0.2.0 without losing settings:** keep your existing `extension/` folder location. Replace only the **new video extension's** files with the `extension/` files from this ZIP, then press **Reload** on the video extension at `chrome://extensions`. Do not remove/re-add the video extension (that can reset its locally saved keys). Run `zsh ./install-mac.sh` from this ZIP's `mac-bridge/` folder to install the upgraded converter; the existing pairing key is preserved. Never touch the original image extension or website.

## Setup on your Mac

1. **Keep your existing image extension installed and unchanged.** This is a second extension.
2. In Terminal, make sure `yt-dlp`, `ffmpeg`, `ffprobe`, and `python3` are installed: `which yt-dlp ffmpeg ffprobe python3`. Your yt-dlp and FFmpeg were already installed according to your earlier Terminal output; you can use those versions initially.
3. Extract this ZIP, open Terminal inside the extracted `mac-bridge` folder, and run `zsh ./install-mac.sh`. This copies `bridge.py` into `~/Library/Application Support/Abodid Moodboard Video/`, creates a per-install pairing key, and installs a macOS LaunchAgent to keep the converter available in the background after login.
4. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the ZIP's **extension** folder.
5. Click the video extension icon → **Settings**. In the new extension's settings, enter **(a)** the Mac bridge pairing key printed by the installer, **(b)** the **same Moodboard API token** you already entered in your existing image extension. Click **Save settings**, then **Test Mac bridge**.
6. Open an individual Pinterest video Pin, **right-click the video → Send video under pointer to Moodboard**. A notification tells you conversion has started. Click the video extension icon to see the live Transfers panel. The extension continues tracking the job without keeping the Pinterest tab open.

**To stop the background Mac bridge:** `zsh ./uninstall-mac.sh`. This does not delete the existing image extension or existing Moodboard data.

## Why a Mac bridge instead of an all-Chrome extension?

Chrome extensions cannot run `yt-dlp` and FFmpeg executable binaries directly. The separate local bridge uses the tools already installed on your Mac, avoiding deployment of another paid/cloud service and avoiding any changes to your live website. **The Mac must be powered on and logged in for the conversion to finish.** This version is designed for your Mac, not general public Chrome Web Store distribution.

## Exact pipeline

```
Right-click Pinterest VIDEO
  -> identify canonical Pin under pointer
  -> local yt-dlp (full MP4/HLS extraction)
  -> local FFmpeg GIF conversion (never truncate)
  -> verify infinite-loop metadata, full duration, size < 19 MB, < 49 MP total frame area
  -> existing /api/integrations/moodboard/prepare API
  -> PUT GIF directly into Cloudflare R2: photos/originals/moodboard/
  -> existing /api/integrations/moodboard/complete API
  -> existing R2 queue -> animated 800/1600px WebP variants & colour palette
```

The extension never sends your Moodboard upload token to the Mac bridge; the Mac bridge only gets a dedicated local pairing key. Only Pinterest Pin URLs are accepted by the converter, and all local requests require that pairing key. The bridge runs on `127.0.0.1` only. Downloads and conversion take place in the user's local `~/Library/Application Support/Abodid Moodboard Video/jobs/` folder and are deleted after success or on failure.

## Guarantees and boundaries

- **Your existing extension's code and live API code are untouched**. This add-on calls the same supported image upload API with `image/gif`, so no new database migrations are required for GIF-only saves.
- The complete source video is converted (audio is deliberately omitted; GIFs have no audio). The GIF is **infinite-looping (`-loop 0`)**, never intentionally trimmed. Conversion progressively drops evenly spaced frames (lower FPS), reduces resolution and colour palette density, with dithering, while retaining the entire timeline.
- The GIF must be at most 19,000,000 bytes and its animation <= 49 million frame pixels to stay below the existing 20 MiB upload and Cloudflare binding limits. If the entire clip cannot fit these limits, it **fails clearly** and nothing is uploaded. Not every video is guaranteed to fit.
- **No new `videos/` bucket or folder is created.** No permanent MP4 copy is stored; successful conversion deletes the original video locally. The GIF saved in R2 is the original upload, available for presentation use wherever your existing original files are downloadable.
- Works with publicly accessible Pinterest videos supported by the installed version of yt-dlp. Private/restricted Pins and changes to Pinterest's extraction APIs may fail. This does not bypass DRM or login restrictions.
- New video GIFs follow your *existing* Moodboard publication defaults and access policies. Before public redistribution of third-party media, ensure you have permission; source URLs are preserved.
- Does not modify the Moodboard gallery. Your existing gallery's animated WebP handling applies automatically. Video GIFs appear when the site's existing published-data refresh/build makes new records visible.
- **Filename and Pin source are preserved:** uses the video's real Pinterest metadata title (where provided) for the displayed Supabase title and a safe `Title - PinID.gif` filename in R2, rather than a generic random filename. `moodboard_items.source_url` receives the actual Pin hyperlink under the pointer (with tracking parameters removed), e.g. `https://in.pinterest.com/pin/474355773273105661/`. The Pin ID is also part of the GIF filename. A missing title falls back to `Pinterest video PinID`. Uploader and original creator are not assumed to be the same person, so unknown credits remain blank. Original CDN filenames are not always exposed by Pinterest; the best available metadata title is used.

## Troubleshooting

- **Bridge unavailable:** run `zsh ./install-mac.sh` and check `~/Library/Logs/abodid-moodboard-video-error.log`.
- **Pinterest extraction failure:** run `yt-dlp "https://www.pinterest.com/pin/474355773273105661/"` manually to see whether that Pin works with the installed extractor. An outdated yt-dlp can fail.
- **No video under the pointer:** open the individual Pin page, then right-click the actual video; on complex feed overlays the extension fails safely rather than choosing another card.
- **GIF too large:** full-length conversion couldn't meet the size/frame-area/quality presets. No partial or truncated GIF is uploaded.
- **R2 upload failure:** check that the existing Moodboard token is correct and the current image extension can still upload GIFs.
- **Install changed nothing visually:** the new menu appears *in addition to* your old image menu. Nothing in the original was patched.

## Tests

From the extracted package root:

```
python3 -m unittest discover -s tests -v
node --check extension/background.js
node --check extension/content.js
node --check extension/options.js
```

Automated tests cover Pin URL validation and real local FFmpeg video→GIF conversion. Pinterest network extraction, cloud upload and Chrome pointer selection still need a manual test on your Mac with live services; this package has not been deployed or tested against your authenticated R2 account.

## Updating from the earlier test ZIP

If you already installed a prior **video-only** version, extract this final ZIP to a **new folder** and run `zsh ./install-mac.sh` again from its `mac-bridge` folder. Then open `chrome://extensions`, remove **only the earlier video add-on** (not your image extension), and use **Load unpacked** on this ZIP’s new `extension` folder. Re-enter your existing Moodboard token and the pairing key shown by the installer. The installer retains the same local pairing key when upgrading. No `personal-site` repository files are touched.

**Source attribution:** The real Pinterest Pin hyperlink is passed to the existing `moodboard_items.source_url` column. The Pinterest metadata title is passed to `moodboard_items.title`; the cleaned title plus Pin ID determines the GIF filename. Since this add-on makes no database schema changes, it does not add a dedicated source-video-filename column.
