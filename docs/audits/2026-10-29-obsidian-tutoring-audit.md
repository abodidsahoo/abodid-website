# Obsidian tutoring: content, discovery and inquiry audit

Prepared 29 October 2026. Analysis only; no production content, settings, forms, crawler rules or data were changed.

## Assessment

The evidence supports a decline in recorded discovery of the tutoring page. The page also lost much of the practical, welcoming sales explanation that matched the needs expressed in earlier inquiries. These are credible contributors to the decline in inquiries, but the available data does not establish a single cause or a measured conversion-rate decline.

Keep the current visual identity. Restore useful buying information and the inclusive tutoring offer, repair discovery of the revenue pages, and verify the complete inquiry flow before considering another visual redesign or a price cut.

The phrase “after the pop-up tutorial” was interpreted provisionally as the pop-editorial tutoring redesign. The relevant history contains both a redesign and a change to the booking popup, so both were reviewed. Git dates establish source changes, not exact deployment dates.

## What was checked

- Git history of the main page, shared landing component, booking dialog, crawler rules and analytics implementation, June–October 2026.
- Live tutoring page on desktop and at a 390 × 844 mobile viewport; both inquiry entry points; rendered metadata and JSON-LD; form protection readiness.
- Live sitemap index, its published sitemap and robots.txt in a browser.
- GA4 property 497735650, 1 June–28 October 2026, filtered to `abodid.com` and `www.abodid.com`. Localhost and Vercel preview hostnames were excluded.
- Saved inquiry records, notification timestamps, and a read-only check of the email provider's available October message history. Names, emails, phone numbers and raw private messages are omitted from this report.
- The requested SEO/GEO skill, checked against official Google guidance; the repository's Modern Web Guidance accessibility guide and Supabase skill for the relevant read-only reviews.

## Traffic: fewer recorded visitors reached the offer

| Period | Main tutoring page views | Recorded users | Sessions containing the page | Google organic sessions landing on this page |
| --- | ---: | ---: | ---: | ---: |
| June | 13 | 7 | 11 | 2 |
| July | 18 | 18 | 18 | 1 |
| August | 43 | 23 | 35 | 12 |
| September | 19 | 11 | 14 | 5 |
| October, through 28th | 10 | 5 | 5 | 2 |

August to September: sessions containing the page fell 60%; Google organic landing sessions fell about 58%. October is a partial month and must not be compared as though it were a full month. These are GA4 records, not independently verified human counts. Production-domain filtering removes development traffic, but cannot remove every owner visit, repeated visitor or bot. GA4 uses its configured America/Los_Angeles reporting timezone.

The fall was not uniform across the website. Site-wide organic-search sessions were 99 in August and 134 in September, while Google organic landings on the tutoring page fell from 12 to 5. October site-wide organic-search sessions were 48 through the 28th. This makes a tutoring-specific relevance/discovery issue worth investigating, while October also has a broader acquisition and measurement context.

The older research course at `/workshops/obsidian` recorded 21 page sessions in August, including eight Instagram-referred landing sessions. No September or October page rows appeared for that exact course route in this report. Promotion of the course is another possible acquisition variable; this does not prove why the route stopped receiving recorded visits.

Search Console could not be queried: the configured Google Cloud project's Search Console API is disabled. No query-level impressions, clicks, position, CTR or indexing inspection were available. Consequently, this audit does **not** claim a proven ranking penalty, keyword loss, Google update impact or search-demand decline. A public search-result check is not a reliable substitute for those records.

## Inquiry records: totals are not qualified leads

| Month | All saved website inquiries | Obsidian-related saved records | Obsidian-related notifications marked sent |
| --- | ---: | ---: | ---: |
| July, records begin 13th | 9 | 1 | 1 |
| August | 12 | 3 | 3 |
| September | 19 | 6 | 6 |
| October, checked 29th | 2 | 1 | 1 |

“Obsidian-related” means a match in the source, path, title or message; it includes vault-interest forms, not only requests for paid lessons. Later records contain short/ambiguous responses and generated booking-request messages. They must not be counted as six qualified September tutoring leads or used to calculate a page conversion rate. All were still marked unreviewed in the lead-quality field.

Two substantive August inquiries are especially informative:

- A PhD researcher wanted help moving thesis work and a large Zotero library into a system they could actually use, after becoming overwhelmed by conflicting tutorials and elaborate setups.
- A filmmaker with several creative projects wanted help getting started with a workable personal system. Their profession did not mean they wanted advanced enterprise-style architecture.

These are qualitative observations from a tiny sample, not a market segmentation study. They nevertheless support making “help me start” and “help me simplify” central to the offer.

No saved Obsidian-related inquiry had a recorded notification error. The provider's available October history showed the two 3 October inquiry notifications as delivered, and no later inquiry notifications. All website inquiry records stopped after 3 October. That makes testing the contact changes introduced on 5 October worthwhile; it does **not** prove those changes broke the form. Earlier periods of this provider history were not returned.

## Dated content and journey comparison

| Source version | Offer and page behaviour | Implication |
| --- | --- | --- |
| 6 June, `533c5a4` | “Obsidian Tutor for Students, Researchers & Writers”; welcomed students, researchers, writers, educators, artists and professionals. Four session types, five concrete outcomes, a course link and a visible Superprof option. | Broad fit, practical detail and more information to support a buying decision. This is the earliest tracked version of this page path examined. |
| 22 June, `d299534` | Kept those practical sections; added visible PayPal checkout, “Ask before booking” and “View full course.” | Visitors could distinguish immediate payment, questions and the longer course. |
| 31 August, `dfe5abd` | Introduced the shared redesigned landing page and “Stop watching Obsidian tutorials. Start using it.” Intro promised a simple system fitted to the learner. Start/Connect/Recall explanation, vault demonstration, specialist links, free discovery call and PayPal popup. | The redesign initially retained approachable positioning. The visual change and later audience rewrite are separate events. |
| 3 September, `b45d5d8` | Replaced PayPal in the popup with an email booking request. This version displayed success without checking the HTTP response. | A historical risk of false success; the response handling was corrected on 5 September. No evidence establishes how many submissions, if any, were lost. |
| 5 September, `ad6b78d` | Removed the Start/Connect/Recall section and connected-note explanation from the main page; retained audience links and the request form. Added name/error handling in the dialog. | Less explanation of the service and fewer practical reasons to inquire. |
| 12 September, `3f1899b` | Replaced the simple-system intro with “bespoke ... systems architecture” for startup founders, CEOs, directors and PhDs. Added founders first. Changed the emphasis to “Recall everything effortlessly.” | A broader list of high-status professions, but a narrower-feeling invitation. Beginner and ordinary note-organisation needs became less explicit. |
| 30 September, `8a1afc0` | Changed Google tracking implementation and introduced owner/internal-route exclusions. | Pre/post comparisons may include a measurement discontinuity. October's low figures cannot be assigned wholly to customer behaviour. |
| 3 October, `bae1f77` | Limited generated sitemap to section hubs and blocked crawling of vault detail URLs, while also blocking several training crawlers. | Main tutoring, four audience pages and research course were omitted from sitemap discovery. Vault policy is a separate intentional cost decision. This happened after September's initial decline. |
| 5 October, `113e4bb` | Added Turnstile-based form protection. | Full submission/delivery needs verification after this change; prior delivered inquiries do not validate it. |

## What the older page explained that the current page does not

| Buying question | Earlier answer | Current main page |
| --- | --- | --- |
| Can I begin with no experience? | “Start from zero”: install the app, create a vault and learn the interface. | No explicit beginner offer. |
| Can you fix the system I already have? | “Fix a messy vault”: audit notes, simplify folders, repair tags and reduce friction. | No clear vault-cleanup service description. |
| What will I leave with? | A usable vault, a note-making method, templates, a research dashboard and a way to return to old ideas. | Broad recall promise plus profession-specific links. |
| What sort of help can I buy? | One session, a short tutoring block or a four-session course. | An hourly rate, discovery request and specialist pages with different prices. |
| Why should I trust your teaching? | Superprof option was visible in the June version. | Vault graph demonstrates use, but there is no visible teaching testimonial or substantive teaching explanation on the landing page. |
| What happens when I book? | Checkout and questions had distinct paths. | Both main CTAs collect inquiries. Neither reserves a time or processes payment. |

The current main-content text measured about 203 visible words at the time of inspection, including headings, form labels and buttons. The problem is the missing answers above, not failing a word-count threshold. Google does not prescribe a preferred word count.

## Findings and recommended changes

### 1. Restore practical, inclusive positioning — high priority

Keep the existing visual style and, if desired, the current headline. Replace the status-heavy first paragraph with plain tutoring language. Explicitly welcome beginners, students and people whose current vault feels unmanageable. Specialist pages can still serve researchers, writers, filmmakers and founders.

Proposed opening:

> One-to-one Obsidian tutoring to help you start from scratch, simplify a messy vault, or build a better research and writing workflow. We work with your own notes and projects, at your pace, so you leave with a system you understand and can keep using.

Proposed supporting line:

> Learn the essentials. Connect your notes. Find the ideas you need.

Replace “Recall everything effortlessly” with a specific, credible benefit. Keep specialist terms such as Zotero where they answer a real need; reduce abstractions such as “systems architecture,” “high-leverage” and “zero cognitive overload.”

### 2. Add the missing buying information — high priority

Suggested order:

1. Clear tutoring offer, current rate and primary request CTA.
2. “Start from scratch,” “Fix a messy vault,” and “Research and writing” help options.
3. A concise explanation of a first session: discuss the problem, work together in the learner's vault, agree practical next steps. Publish only delivery promises you intend to fulfil.
4. A short, legible workflow example showing how a source or rough note becomes something useful; keep the graph as supporting evidence.
5. Teaching background and relevant, permissioned testimonials.
6. Transparent price, duration, booking process and what is included.
7. Specialist workflow links as optional next steps.
8. Practical questions and the inquiry form.

The existing approved testimonial located in the database describes **video editing tuition**. It may support a clearly labelled statement about teaching style, but must not be presented as an Obsidian result. No approved testimonial explicitly mentioning Obsidian was found in the query used here. Obtain real Obsidian feedback or demonstrate your process instead of inventing evidence.

Questions worth answering: Do I need prior experience? Can we work in my existing vault? Is this teaching or a done-for-you setup? Are sessions online? How long is a session? Can you help with Zotero? What happens after I send the form? What information do I need to share?

### 3. Make the request journey accurate and verify delivery — high priority

Confirmed in the live browser:

- The primary “Book a free 15-minute discovery call” link scrolls to name/email/message fields. It does not offer calendar slots.
- The secondary “Book 1:1 tutoring” button opens a name/email request dialog. It does not take payment or reserve a session.
- Both forms rendered their protection widgets and had verification tokens present during inspection. This only verifies browser readiness.
- The landing page disables the newsletter popup. The booking popup opens on demand. There is no evidence here of a current auto-opening newsletter popup covering this page.
- Mobile content fit the tested 390px viewport without horizontal overflow; the primary CTA was visible in the first screen. The discovery form began around 2,036px down the page, and the anchor took the visitor to it.

If keeping manual scheduling, use “Request a free 15-minute call” and explain: “Tell me what you need help with. I'll reply within [your actual response commitment] to arrange a time. No payment is required to inquire.” Rename the paid-session CTA to “Ask about a tutoring session” or explain that it is a booking request. Alternatively, introduce a genuine availability calendar as a separate considered change.

Add a visible email fallback alongside the form. Currently `showEmailLink={false}` hides that direct option on these landing pages. Keep the message short and easy to answer, possibly optional if the intended intake allows it.

The forms currently depend on JavaScript and have no native action/method fallback. A server-handled fallback would improve resilience. Keep anti-spam protection, but verify it with a controlled real submission and receipt check on desktop/mobile; do not remove protection merely because inquiry volume is down. This audit did not send a live inquiry, make a payment or book a call.

### 4. Put the revenue pages back into sitemap discovery — high priority

The live index points to a 19-URL sitemap of hubs. It includes `/workshops` and `/obsidian-vault`, but omits `/obsidian-tutoring`, all four `/obsidian-for-*` pages and `/workshops/obsidian`. Repository history dates this restriction to 3 October.

Add these selected commercial pages to the allowed sitemap set while retaining the deliberate limits on large vault/detail collections. Sitemap omission is not `noindex`, and existing internal links can still lead crawlers to a page. It is a concrete discoverability improvement, not proof of the cause of September's decline.

The live tutoring page has a correct self-canonical URL, descriptive title and meta description, and Person, BreadcrumbList and Service JSON-LD. No robots meta restriction was present. The live robots file does not disallow the tutoring route for general search crawlers. Rebuilding metadata infrastructure is unnecessary; improve its content and validate consistency.

### 5. Check edge challenges using real crawler evidence — high priority investigation

Direct `curl` and Python requests received HTTP 429 responses from Vercel with `x-vercel-mitigated: challenge`, while normal browser access succeeded. This establishes a difference between clients, not that verified Googlebot is blocked.

Check Search Console URL Inspection/live fetch and Vercel firewall/crawler logs for these exact revenue URLs. Confirm verified Google/Bing crawlers and intended search-retrieval clients can access the pages. Adjust only a rule shown to block intended traffic. Keep the deliberate training-crawler restrictions and cost controls unless a separate decision changes them. Do not allow everything or impersonate Googlebot as a supposed validation.

### 6. Explain the offers and prices consistently — medium priority

Current pages show £60/hour promotional general tutoring, £150/hour on several specialist pages, researcher pricing of £150 per specialist session or six sessions for £450, and the older eight-hour research workshop at ₹15,000. The workshops listing describes tutoring price as “Custom.”

Different products can have different prices. Explain what makes them different: individual/group format, session duration, support, preparation, deliverables, currency and eligibility. Link the detailed course and general tutoring to one another where useful. State clearly that discovery is free and paid teaching is separate.

The £60 promotional rate was already present in the 31 August redesigned page. There is no basis here to identify a later increase in that main-page rate as the cause of September's decline. Do not start with an unexplained discount or price cut.

### 7. Use SEO/GEO to support the real offer — medium priority

Suggested title: **Obsidian Tutoring: 1-to-1 Help for Beginners & Researchers | Abodid Sahoo**.

Suggested description: **Learn Obsidian one-to-one with Abodid Sahoo. Start from scratch, simplify your vault, or improve research and writing workflows. Request a free 15-minute call.**

Use natural terms for the actual services: Obsidian tutor, one-to-one Obsidian help, beginner setup, vault organisation and research workflows. These are candidate topics, not verified search-volume findings. Search Console should determine which terms deserve emphasis.

Keep one broad main tutoring page and give each specialist page a distinct, truthful workflow example and offer. Do not create further near-duplicate audience pages simply to cover titles. The four specialist pages had very little recorded traffic in September/October, so they should not take priority over the main offer.

Align visible copy, metadata, workshops cards and `llms.txt` after the positioning is settled. Keep structured data accurate; add offer details only when they match a real, stable visible offer. Google does not require special AI schema or `llms.txt` for AI Overviews/AI Mode inclusion. AI citations and rankings cannot be promised.

### 8. Improve media delivery and measurement — medium priority

The hero MP4 is about 6.9MB and is preloaded with `preload="auto"`; five fallback frames are also loaded. The main page also loads the PayPal SDK although the present dialog no longer contains a PayPal checkout. Remove that unnecessary load if the request-only journey remains, and serve a lighter media preview with an appropriate poster/loading strategy. No field Core Web Vitals or controlled performance trace were obtained, so this is a resource finding rather than a measured LCP/INP failure.

Track the stages separately: tutoring page view, discovery CTA click, session-request dialog open, form start, submission error, server-accepted inquiry, qualified lead and booked/paid session. Keep actual acceptance distinct from clicking submit. The GA4 report contained form-start events but no observed `generate_lead` or successful-form-submit events for the checked routes/period.

The private tracker has substantial coverage gaps; its data should not be used as a clean before/after denominator. Observed monthly storage was 2,800 sessions in August, 1,702 in September and six in October at query time, with changed collection/qualification logic and current repair work evident in the workspace. GA4 and private tracker definitions also differ. No dashboard absence is proof of no visitors.

## How to evaluate the changes

First verify the form and crawler path. Then publish the main-page copy and selected sitemap improvements as a recorded release. With only 5–35 monthly recorded page sessions, a conventional A/B test would be slow and unreliable; prefer one coherent revision and track it over time.

Compare equal-length periods and annotate releases, promotion and measurement changes. Review qualified inquiries alongside Google organic landings, Search Console impressions/CTR/positions and accepted-form events. If impressions fall, investigate indexing/relevance/demand; if impressions hold but clicks fall, examine results presentation; if visitors arrive but do not start a form, examine offer clarity; if starts occur but accepted inquiries do not, inspect the form and protection logs. Avoid conclusions from one additional inquiry.

Recommended implementation sequence:

1. Verify post-5-October submission and delivery; inspect intended crawler access.
2. Restore beginner/vault-cleanup/session-outcome copy and truthful request labels; show email fallback.
3. Re-add the six selected Obsidian commercial URLs to the sitemap and strengthen relevant internal links.
4. Add specific teaching evidence and clarify prices/products.
5. Fix funnel measurement, then refine media delivery and specialist pages.

## Sources and evidence locations

Repository evidence:

- `src/pages/obsidian-tutoring.astro`: current offer, audiences and pricing.
- `src/components/obsidian/ObsidianLandingPage.astro`: shared CTAs, newsletter setting, media preload and inquiry-form configuration.
- `src/components/obsidian/ObsidianPaymentDialog.astro`: request-only dialog and response handling.
- `src/components/InlineInquiryForm.astro`, `src/components/ContactProtection.astro`, `src/pages/api/contact.ts`: submission and notification path.
- `src/lib/searchVisibility.ts`, `astro.config.mjs`, `public/robots.txt`: discovery policy.
- `src/components/GoogleAnalytics.astro`, `src/lib/analytics/google-tag-policy.js`: tracking changes and exclusions.
- Commit identifiers in the timeline; live checks and read-only analytics/provider/database queries performed on 29 October.

Public references:

- [Current tutoring page](https://abodid.com/obsidian-tutoring).
- [Published sitemap](https://abodid.com/sitemap-0.xml) and [crawler rules](https://abodid.com/robots.txt).
- [Google: helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): completeness, demonstrable experience, useful headings and no preferred word count.
- [Google: sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview): sitemap discovery benefits and limits.
- [Google: robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro): crawl controls differ from indexing controls.
- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): normal SEO applies; special AI files/markup are unnecessary; inclusion is not guaranteed.
- [PKM Insights coaching page](https://www.pkminsights.com/obsidian-coaching-plans): one comparator explicitly explains training modules, support, outcomes and testimonials. This is an observed presentation pattern, not evidence that its design or prices outperform yours.

Modern Web Guidance was used to review naming, labels, native-dialog behaviour, input assistance and error communication. No frontend code was changed in this audit.
