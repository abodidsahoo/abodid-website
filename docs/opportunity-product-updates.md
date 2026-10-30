# Opportunity Tracker product-update preferences

Google sign-in on the welcome page and the public collection's save-to-radar
dialog includes an optional checkbox, unchecked by default. It covers occasional
product updates and new feature announcements from Abodid & Co.

An unchecked sign-in neither subscribes someone nor unsubscribes an existing
subscriber. Users can turn updates on or off separately in **Profile → Email
preferences**; this setting saves immediately and does not require saving their
display name or personal URL.

## Consent and authentication

- The affirmative choice stays in session storage for at most 30 minutes and is
  bound to one OAuth attempt using a random nonce. A callback URL alone cannot
  opt someone in, and a failed sign-in clears its pending choice.
- The callback saves consent only after the existing Google login succeeds.
  Failed optional preference requests leave login usable and show a retry notice.
- `/api/opportunities/product-updates` requires a server-verified bearer token.
  It derives the user and verified email from that token, never the request body.
- Consent version `2026-10-30-v1`, the displayed text, source, verified email,
  opt-in time, and later opt-out time are stored in the existing private
  `opportunity_memberships` table. Its service-only access and forced RLS are
  retained. Migration: `20261029214029_opportunity_product_updates_consent.sql`.

## Product-announcement audience

This preference does not enroll people in the general weekly newsletter, create
entries in `subscribers`, or send any email automatically. When sending product
announcements, select the current opted-in audience immediately before sending:

```sql
select m.user_id, m.product_updates_email as email
from public.opportunity_memberships m
join auth.users u on u.id = m.user_id
where m.product_updates_opt_in = true
  and u.email_confirmed_at is not null
  and coalesce(u.is_anonymous, false) = false
  and lower(u.email) = lower(m.product_updates_email);
```

Checking that the current verified address matches the consent address prevents
transferring permission to a changed account email. Announcement emails should
link to the tracker profile so recipients can turn updates off. Do not use the
general newsletter unsubscribe endpoint for this separate preference.
