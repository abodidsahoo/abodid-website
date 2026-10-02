# Send to Moodboard Chrome extension

This unpacked Manifest V3 extension adds **Send image under pointer to
Moodboard** to Chrome's right-click menu. It tracks the exact element under the
pointer, walks through gallery wrappers, and resolves the best available image
from `srcset`, `currentSrc`, `src`, data attributes, SVG images, video posters,
or CSS backgrounds. It then downloads the resolved image, uploads it to the
`assets` R2 bucket under `photos/originals/moodboard/`, and creates the matching
`moodboard_items` record.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder:
   `/Users/abodid/Documents/GitHub/personal-site/moodboard-extension`
4. In the settings tab that opens, save the same private token configured as
   `MOODBOARD_QUICK_ACTION_TOKEN` in Vercel.

The token is kept in Chrome extension-local storage and sent only to the
moodboard API on `https://abodid.com`.
