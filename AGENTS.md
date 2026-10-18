# Repository agent guidance

Whenever creating or changing the Chrome extension in `extension/`, create and maintain the root `CHROMEWEBSTORE.md`. Keep its store metadata, manifest permission and host-permission justifications, privacy disclosures, asset status, version history, and submission-readiness checklist aligned with the built Chrome manifest and actual runtime behavior. Use the project-installed `chrome-extensions` and `modern-web-guidance` skills for extension and client-side work.

## Image and moodboard tagging

Before tagging images, curating moodboard tags, changing the image-tag vocabulary, or implementing moodboard tagging automation, read [the canonical tagging guide](public/docs/TAGGING_LOGIC.md). Follow its current rules and curator-approved examples rather than relying on an older conversation summary or downloaded copy.

When the user supplies new tagging logic or corrections, update `public/docs/TAGGING_LOGIC.md` and keep its affected examples, model prompt, validation guidance, version, and changelog consistent. Distinguish general rules from image-specific feedback and optional research proposals. Preserve existing manual image tags unless the user requests their modification. Maintain this repository copy as the source of truth; earlier Downloads copies are historical snapshots. The same file is published at `/docs/TAGGING_LOGIC.md`.
