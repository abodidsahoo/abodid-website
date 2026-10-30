# Opportunity list icons

The list cards read `organisation_icon_url` from each opportunity's existing
`saved_opportunities.content` JSON. No additional table or schema migration is required.
The private serializer and public collection response both include this optional field.
Missing or failed images fall back to the existing category illustration.

Six samples were curated on 30 October 2026: three Newly Added entries (UCL,
Condé Nast, Google) and three Closing Soon entries (Matsu Biennial, Doing Sociology,
Royal College of Art). Original images were extracted from their listing pages or
the identified organizer's official site. Employer logos take precedence over
job-board branding. Matsu's site icon was checked against its full logo.
RCA's original 16px favicon was replaced with the official 180px touch icon when
the card layout was enlarged, to keep it sharp.

Images are stored as PNGs in the existing public `misc` bucket under
`opportunity-icons/<opportunity-id>/<content-hash>.png`. Their original URLs, hashes,
stored URLs, and linked record IDs are recorded in
[`opportunity-list-icon-sample.json`](./opportunity-list-icon-sample.json).
The original image URL is also retained as `content.organisation_icon_source_url`.

Only these six records have been populated. Other entries use their category icon;
this change does not add automatic image extraction or infer new category/theme tags.
