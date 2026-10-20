# Repository agent guidance

Whenever creating or changing the Chrome extension in `extension/`, create and maintain the root `CHROMEWEBSTORE.md`. Keep its store metadata, manifest permission and host-permission justifications, privacy disclosures, asset status, version history, and submission-readiness checklist aligned with the built Chrome manifest and actual runtime behavior. Use the project-installed `chrome-extensions` and `modern-web-guidance` skills for extension and client-side work.

## Image and moodboard tagging

Before tagging images, curating moodboard tags, changing the image-tag vocabulary, or implementing moodboard tagging automation, read and apply [Abodid's Master Tag Builder](public/docs/ABODID_MASTER_TAG_BUILDER.md). It is the single authoritative artistic tagging mechanism; do not rely on superseded Basic, Super Advanced, Artist Language, conversation-summary, or Downloads copies.

When the user supplies new tagging logic or corrections, update `public/docs/ABODID_MASTER_TAG_BUILDER.md` and keep its affected examples, model prompt, validation guidance, version, and changelog consistent. Distinguish general rules from image-specific feedback and optional research proposals. Preserve existing manual image tags unless the user requests their modification. The repository copy in `public/docs/` is the source of truth; Downloads copies are historical snapshots.
