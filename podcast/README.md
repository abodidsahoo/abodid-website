# Podcast / Abodid

Standalone static site for `podcast.abodid.com`.

- `npm run dev` starts the local preview on port 4179.
- `npm run build` writes the deployable site to `dist/`.
- Shared prices, equipment summaries and navigation live in `src/assets/site-data.js`.

For Vercel, create a project from the existing GitHub repository and set the Root Directory to `podcast`, the Build Command to `npm run build`, and the Output Directory to `dist`.

The enquiry form prepares a human-readable email to `hello@abodid.com`; availability and payment remain human-confirmed for launch.
