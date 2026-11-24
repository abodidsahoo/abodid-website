# Website subscriptions and search discovery

RSS is an independent subscription layer. The existing `https://abodid.com/rss.xml` URL now serves **All Updates**. Existing blog items retain the exact URL-based GUIDs produced by the previous Astro RSS generator, including their terminal slash; their links use the slash-free canonical page URL. Blog-only subscribers can use `/feeds/blog.xml`.

## Audited collections

| Collection | Feed | Existing publishing source and eligibility |
| --- | --- | --- |
| All Updates | `/rss.xml` | Deduplicated union of every eligible collection below |
| Writing and essays | `/feeds/blog.xml` | `blog`, `published = true`; scheduled publications are withheld until their date |
| Obsidian and workflows | `/feeds/obsidian.xml` | Existing blog/public-note titles and stored classifications that identify Obsidian, PKM, knowledge systems or workflows |
| Public digital garden | `/feeds/notes.xml` | `obsidian_notes`, public main-note folders, completed source index; frontmatter and sensitive-content checks also apply |
| Research and papers | `/feeds/research.xml` | Visible, published `research`; published `research_papers`; existing public local research case studies and explanation pages |
| Lab | `/feeds/lab.xml` | The same visible Lab catalogue and required local experiments used by the Lab hub |
| Opportunities | `/feeds/opportunities.xml` | Abodid's collection only while his profile is public; reviewing items with public source links; expired deadlines/events and manually expired outcomes excluded; open roles from `careerRoles` |
| Curated resources | `/feeds/resources.xml` | Approved `hub_resources`, published XR showcase records, the existing creative companies directory, FTII film catalogue and curated screening list |
| Visual references | `/feeds/moodboard.xml` | Published `moodboard_items`; existing titles, artist attribution and tags are read unchanged |
| Morning Digest | `/feeds/reading.xml` | `reading_digest_public_items`, the existing projection of verified, published readings from sent digests; future delivery dates excluded |
| Press | `/feeds/press.xml` | Published `media_mentions`, linked to their original sources with publication attribution |
| Shared notebook | `/feeds/community.xml` | Existing public notepad and quotes boards; contributors are identified as community contributors rather than attributed to Abodid |
| Work and photography | `/feeds/work.xml` | Public portfolio index, published photography series and films, and the same local case-study fallbacks supported by the work route |
| System manual | `/feeds/manual.xml` | The existing public manual Markdown sources; drafts, private and explicitly unpublished documents excluded |

The audit also covered the service/workshop pages, biography, CV, education, awards, interactive tools and artist-atlas data, feedback and response pages, guestbook, payment/account/admin surfaces, archives, and newsletter. Service/profile pages are permanent destinations rather than dated publications. Lab launches cover interactive tools; their working data and participant actions are not separate publications. Guestbook and feedback interactions, account data, forms/results, admin records, draft/preview pages and private research workspaces are excluded from feeds. The email newsletter has no public issue archive to syndicate; its existing email workflow remains the subscription source for those issues. Archived designs are not new publications.

## Implementation and automatic updates

`src/lib/subscriptions/catalog.js` defines the public feed catalogue once for routes, autodiscovery, the modal and `/subscribe`. Database adapters in `sources.ts` use the existing schemas and publication boundaries. No schema changes, credentials, deployment hooks, extra publishing action or production dependency were added.

Feeds are rendered on request. Database changes therefore appear without a website rebuild. Local Markdown, case-study, film-list and company-directory changes follow the existing website deployment pipeline. Local sources are bundled by Vite; RSS requests do not read a checkout at runtime. Database reads are paginated beyond PostgREST's default row limit and select summary fields where available.

Published RSS responses and live content sitemaps use `Cache-Control: no-store` so privacy changes are not prolonged by a stale public snapshot. Service-role reads are server-only and explicitly limited to eligible public rows and named public fields. They are needed for the existing public projections/RLS arrangement; keys and private opportunity notes, meeting links, account fields and moderation fields never become feed items. If a required source is unavailable, the endpoint returns a retryable HTTP 503 instead of a successful partial feed that silently drops a collection.

Item publication dates come from original publication metadata or stable creation timestamps. Note modification dates are separate `atom:updated` values; editing a note does not move its publication date or GUID. Portfolio publication dates use the earliest immutable publication backup, with the latest backup date as modification time. Where the source has no honest original date, `pubDate` is omitted and the entry sorts after dated items; a build date is never substituted. Images use Media RSS thumbnails, with no invented enclosure lengths. Authors use Dublin Core so names do not need fabricated email addresses.

Own-site URL aliases lose query/trailing-slash variants. The moodboard's existing `?photo=<id>` deep links are deliberately retained as reader destinations, with stable per-image GUIDs; these query variants never enter the sitemap. Shared board items use stable fragments and GUIDs, with only their parent board indexed. External URLs retain meaningful parameters such as YouTube video IDs; tracking parameters are removed.

Frontmatter privacy/draft flags, active published `page_metadata` noindex overrides, project `search_visible` flags, source publication flags and future/expiry dates are enforced. Unpublished blog/photography/resource detail routes now return 404. Vault detail pages use a fresh public-index check and do not fall back to raw GitHub files when a note has been withdrawn. Notes include explicit canonical URLs and original publication/modification structured-data dates.

## Subscription experience

The footer keeps a real `/rss.xml` link, enhanced into a native dialog when supported. JavaScript-disabled browsers and modified clicks can still open RSS directly. `/subscribe` provides a permanent HTML subscription directory. The interface uses the site's typography, role colours, button states and corner settings, with no React hydration or third-party reader scripts.

The dialog has a named heading, native focus containment and Escape dismissal, a visible Close button, backdrop dismissal with a pointer-position fallback, and scroll containment. Feed URLs remain selectable even when clipboard permission is denied. Copy results are announced in a live region inside the active dialog. Direct feeds disable speculative prefetching. All Updates appears first; every category has copy, raw XML, Feedly and Inoreader options.

## Sitemap and SEO

`/sitemap-index.xml` remains the Search Console submission URL. It links to the generated permanent-page sitemap and the existing `/content-sitemap.xml`, `/vault-sitemap.xml` and `/work-sitemap.xml` URLs. The three content sitemaps now use live eligible records rather than hub-only placeholders.

The generated sitemap reuses the shared site directory and checks the final rendered HTML's canonical URL, robots metadata and redirects. Live detail sitemaps apply the same eligibility rules as feeds, deduplicate canonical URLs, omit external sources, fragments and image query variants, and use real modification dates where available. Private/internal routes remain excluded. The blanket robots.txt block on public Obsidian notes was removed; RSS endpoints are outside blocked API paths. The duplicate Glyph Loom instrument points to its Lab canonical; the two curation pages use the primary non-www host.

## Verification

Run with the project's Node 24 runtime:

```sh
node --test tests/subscriptions/entries.test.mjs tests/seo/*.test.mjs
npx vitest run tests/subscriptions/sources.test.ts
npx playwright test --config tests/subscriptions/playwright.config.ts
npm run build
python3 tests/subscriptions/validate_live.py --base http://127.0.0.1:4325 --static-root dist/client
```

Start the development server on port 4325 for the browser/live checks, or set `RSS_TEST_URL` for the browser suite and `--base` for the validator. The Python validator uses only the standard library, discovers the advertised feeds from HTML, parses every RSS/sitemap XML document, checks MIME types, self links, authors, dates/order, canonical URLs, duplicate IDs and duplicate sitemap entries. It can also target the production hostname after deployment.

Regression coverage includes future/draft/private/expired records; newly published items; note edits and withdrawals; private opportunity fields and profile changes; noindex overrides; pagination past 1,000 rows; legacy GUIDs; meaningful external query parameters; and image deep links. Browser coverage includes desktop, tablet, 390px and 320px layouts, native focus handling, Escape/Close/backdrop behavior, clipboard success/denial, Astro navigation and a real JavaScript-disabled XML request.

Local verification on 24 November 2026 passed production builds and live XML validation for all 14 feeds. The observed All Updates feed contained 3,075 entries, including 1,778 published visual references. The sitemap tree contained 644 distinct canonical URLs. Counts change with the live publishing sources. Representative note, resource, research, manual and portfolio pages returned indexable HTTP 200 responses. The repository-wide Astro check still reports existing errors outside the new subscription files; that broader typecheck is not clean. Real reader-account subscriptions, Search Console submission and production Core Web Vitals require deployment/live measurement and were not claimed as completed locally.

## Feedly discovery: production hosting prerequisite

On 24 November 2026, automated requests to `/feeds/lab.xml`, `/rss.xml`, `/subscribe` and `/robots.txt` on the live hostname returned HTTP 429, `x-vercel-mitigated: challenge`, and an HTML **Vercel Security Checkpoint**. RSS readers cannot complete browser challenges. This is independent of XML validity. The new RSS implementation also remains local until deployment.

Inspect the active Vercel firewall configuration before applying a narrow exception for GET/HEAD requests to public RSS, sitemap and robots URLs on the primary hostname. Place the exception before the challenge rule. Do not disable protection across the website. The prepared rule covers only the advertised feeds and search discovery endpoints; it excludes admin/API/private paths and write methods. Vercel challenge/bypass configuration is a hosting setting and cannot be fixed by changing an RSS response header or `robots.txt`.

Generate the reviewable API payload with `node scripts/prepare-rss-firewall-rule.mjs`. This only prints configuration; it does not modify Vercel. Read the active configuration and rule order before insertion, confirm the specific mitigation is covered, deploy the RSS routes, then run `python3 tests/subscriptions/validate_live.py --base https://abodid.com`. Production validation always fetches remote sitemaps, even when local build artifacts exist. The checker reports security challenges explicitly.

The Vercel connection was restored and the live firewall was updated to version 5 on 24 November 2026. The existing trusted-integrations bypass now also contains the two GET/HEAD discovery condition groups, preserving its original API condition and the other firewall rules. This stays within the plan’s three-rule limit. The managed bot challenge and AI-bot rules remain active. Unauthenticated checks then returned HTTP 200 for `/rss.xml` and `/robots.txt`; `/feeds/lab.xml` returned HTTP 404 until deployment of the new routes. An isolated RSS release based on the current production commit is being verified before publication. See [Vercel's bot management guidance](https://vercel.com/docs/bot-management) and [custom rule documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules).
