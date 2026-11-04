-- Pending local change: apply with the NIFT lecture release, before deploying its handler.
begin;

-- The existing form trigger increments form_version only when questions change.
update public.feedback_forms
set questions = $questions$[{"id": "feedback", "label": "Your feedback", "shortLabel": "Feedback", "type": "textarea", "placeholder": "What did you think of the lecture and how it was conducted?", "required": true}]$questions$::jsonb,
    content = content || $content${"resourceNote": "After your feedback, download the complete slide decks as high-resolution PDFs, and revisit the demo.", "successNote": "Thanks for sharing your feedback!", "resourceInstructions": "Open a session PDF in Google Drive, then use Download to save the high-resolution file.", "resourceNotice": {"title": "For NIFT workshop participants", "text": "These two PDFs are for participants within the NIFT community. Please keep them within that group. Do not share them publicly or upload them to any platform."}, "resources": [{"label": "Session 01 — The Retail Window", "url": "https://drive.google.com/file/d/1am-OG6yy9n8bf8vGucJ8BHVxWuSMPxHt/view?usp=sharing", "description": "PDF · 40 pages · 230 MB"}, {"label": "Session 02 — Tanishq, Bhubaneswar", "url": "https://drive.google.com/file/d/1d8fC90updrTx0kMZ4ydlgG9yyH5C5-w5/view?usp=sharing", "description": "PDF · 15 pages · 101 MB"}, {"label": "Tessellation demo", "url": "https://tiled.art/en/art/TurtleIsland/", "description": "View the interactive demo"}], "heading": "Thanks for joining the lecture!", "note": "Share your feedback to receive the download links.", "formNote": "Please share your feedback in a few lines.", "resourceEmailEnabled": true}$content$::jsonb
where slug = 'nift-bhubaneswar-space-materiality-2026-11-03';

-- Resource mail storage is applied separately in resource_email_delivery_storage.

-- The legacy DU backup is no longer read by a browser or admin component.
-- Match the shared system's service-only access, preserving its rows and mirror trigger.
alter table public.du_workshop_feedback enable row level security;
revoke all on public.du_workshop_feedback from public, anon, authenticated;
grant all on public.du_workshop_feedback to service_role;
drop policy if exists "Authenticated users can read DU workshop feedback" on public.du_workshop_feedback;
drop policy if exists "Authenticated users can update DU workshop feedback" on public.du_workshop_feedback;
alter function public.set_du_workshop_feedback_updated_at() set search_path = '';

notify pgrst, 'reload schema';
commit;
