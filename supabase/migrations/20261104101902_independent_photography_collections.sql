-- Independent private collections. Existing lecture rows and schema are preserved.
begin;

insert into public.feedback_forms (slug,institution_slug,institution_name,event_slug,event_title,event_date,questions,content,responses_public) values ('photography-album-thoughts','abodid-com','Abodid Sahoo','photography-album','Photography album',null,$json$[{"id": "album_thoughts", "label": "Your thoughts on the album", "shortLabel": "Album thoughts", "type": "textarea", "placeholder": "Please feel free to share.", "required": true}]$json$::jsonb,$json${"kicker": "Photography album", "heading": "Thoughts on my photography album?", "note": "Please feel free to share. Your thoughts are private, just for me.", "thanks": "", "resourceNote": "", "formNote": "Name and email are optional.", "successNote": "Thank you! Your thoughts have been shared privately with me.", "resources": []}$json$::jsonb,false) on conflict (slug) do nothing;

insert into public.feedback_forms (slug,institution_slug,institution_name,event_slug,event_title,event_date,questions,content,responses_public) values ('nift-photography-workshop-photo-walk-2026-11','nift-bhubaneswar','NIFT Bhubaneswar','photography-workshop-photo-walk-2026-11','Photography workshop + photo walk interest',null,$json$[{"id": "interested", "label": "Workshop and photo walk interest", "shortLabel": "Interested", "type": "choice", "required": true, "options": ["Yes, I am interested.", "Not right now."]}]$json$::jsonb,$json${"kicker": "NIFT Bhubaneswar", "heading": "Photography workshop + photo walk", "note": "Interest for 9–15 November 2026.", "thanks": "", "resourceNote": "", "formNote": "", "successNote": "Your interest has been saved.", "resources": []}$json$::jsonb,false) on conflict (slug) do nothing;

notify pgrst, 'reload schema';

commit;
