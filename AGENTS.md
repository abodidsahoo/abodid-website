# Repository agent guidance

Whenever creating or changing the Chrome extension in `extension/`, create and maintain the root `CHROMEWEBSTORE.md`. Keep its store metadata, manifest permission and host-permission justifications, privacy disclosures, asset status, version history, and submission-readiness checklist aligned with the built Chrome manifest and actual runtime behavior. Use the project-installed `chrome-extensions` and `modern-web-guidance` skills for extension and client-side work.

## Image and moodboard tagging

Before tagging images, curating moodboard tags, changing the image-tag vocabulary, or implementing moodboard tagging automation, read and apply [Abodid's Master Tag Builder](public/docs/ABODID_MASTER_TAG_BUILDER.md). It is the single authoritative artistic tagging mechanism; do not rely on superseded Basic, Super Advanced, Artist Language, conversation-summary, or Downloads copies.

When the user supplies new tagging logic or corrections, update `public/docs/ABODID_MASTER_TAG_BUILDER.md` and keep its affected examples, model prompt, validation guidance, version, and changelog consistent. Distinguish general rules from image-specific feedback and optional research proposals. Preserve existing manual image tags unless the user requests their modification. The repository copy in `public/docs/` is the source of truth; Downloads copies are historical snapshots.


## Shared UI colours

Use the role variables in `src/lib/designTokens.js` and derived states in `src/styles/ui-colors.css` for ordinary site UI. Shared buttons, forms, navigation, hover/pressed states and overlays must follow these roles. Keep new literal palette values at the central defaults. The Creative Companies Database, separately art-directed lab experiments, archived editions and Podcast Studio can own independent palettes. Treat image-derived palettes, user-selected artwork/board colours and official third-party marks as content or intentional exceptions. See `DESIGN_SYSTEM.md` for the publishing and compatibility contract.
