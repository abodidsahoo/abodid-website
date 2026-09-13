begin;

-- Research now follows the Blog authoring model: ordered JSON blocks are the
-- source of truth, while content remains a derived Markdown compatibility field.
alter table public.research
  add column if not exists blocks jsonb not null default '[]'::jsonb,
  add column if not exists role text not null default 'Research project',
  add column if not exists accent text not null default 'lime';

update public.research as research_project
set blocks =
  case
    when nullif(btrim(research_project.content), '') is null then '[]'::jsonb
    else jsonb_build_array(
      jsonb_build_object(
        'id', research_project.slug || '-legacy-story',
        'blockType', 'body_text',
        'content', jsonb_build_object('text', research_project.content),
        'settings', jsonb_build_object('width', 'standard', 'spacing', 'default')
      )
    )
  end
  ||
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', research_project.slug || '-legacy-image-' || gallery_item.ordinality,
          'blockType', 'single_image',
          'content', jsonb_build_object(
            'media', jsonb_build_object(
              'sourceType', 'external',
              'url', gallery_item.image ->> 'url',
              'alt', coalesce(gallery_item.image ->> 'alt', gallery_item.image ->> 'caption', ''),
              'caption', coalesce(gallery_item.image ->> 'caption', '')
            )
          ),
          'settings', jsonb_build_object('width', 'wide', 'spacing', 'default')
        )
        order by gallery_item.ordinality
      )
      from jsonb_array_elements(research_project.gallery_images) with ordinality as gallery_item(image, ordinality)
      where nullif(gallery_item.image ->> 'url', '') is not null
    ),
    '[]'::jsonb
  )
where jsonb_typeof(research_project.blocks) = 'array'
  and jsonb_array_length(research_project.blocks) = 0;

-- This project was already intentionally excluded in application code. Persist
-- that editorial choice in Supabase so visibility is data-controlled.
update public.research
set visible = false
where slug = 'llm-chatbot';

-- Keep the established projects, placing the richer case studies first.
update public.research
set sort_order = coalesce(sort_order, 0) + 100
where slug not in (
  'cloud-memories-algorithmic-recall',
  'do-ghosts-feel-jealous',
  'rejection-reactivates-unresolved-grief',
  'cambridge-cultural-heritage-data-school',
  'cries-of-an-unmarried-widow',
  'photogrammetry-physical-evidence'
)
and coalesce(sort_order, 0) < 100;

with research_seed as (
  select project, ordinality
  from jsonb_array_elements(
    $research_projects$[{"slug":"cloud-memories-algorithmic-recall","title":"Cloud Memories and Algorithmic Recall","description":"How photographic excess, cloud platforms and AI sorting reshape memory, care, ownership and consent.","role":"Researcher / Visual Autoethnographer","accent":"lime","tags":["Personal archives","Platform surveillance","AI ethics"],"cover_image":"https://assets.abodid.com/documents/thumbnails/research-1769636977430-msh94w5fk.jpg","gallery_images":[{"id":"cloud-memories-algorithmic-recall-gallery-1","url":"https://assets.abodid.com/documents/thumbnails/research-1769636977430-msh94w5fk.jpg","alt":"Visual study of digital archives and algorithmic recall from the Punctum research series","caption":"Visual study of photographic excess, digital archives and algorithmic recall.","objectPosition":"50% 50%","sort_order":0},{"id":"cloud-memories-algorithmic-recall-gallery-2","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-icloud-image-cluster-05153ef77c.webp","alt":"A dense cluster of photographs from Abodid's iCloud archive","caption":"A visual study of photographic excess and algorithmic recall.","objectPosition":"50% 50%","sort_order":1},{"id":"cloud-memories-algorithmic-recall-gallery-3","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-icloud-images-01-bd5533f069.webp","alt":"Archival prints from the iCloud archive","caption":"Archival evidence from over 80,000 materialised iCloud photographs.","objectPosition":"50% 50%","sort_order":2}],"content":"What happens when we make more photographs than we can live with - when most frames feel futile, yet a few matter intensely?\n\n## From storage to stewardship\n\nThis study examines how photographic excess, cloud platforms and AI sorting shape memory, care and ownership. Working from a long-running personal archive of more than 180,000 images, I analyse selected photographs across time and place and co-view phone and iCloud archives with others to understand what people keep, delete, hide or share. Images, metadata and platform resurfacing events - such as Memories, face clustering and search prompts - become material for understanding how platforms participate in remembering. The recurring patterns include overwhelm from volume, a small number of anchor images that carry disproportionate meaning, algorithmic resurfacing that edits what feels salient, and uncertainty around consent once photographs circulate through backups, shared albums and AI-indexed faces.\n\n## Outcome\n\n> **Accepted poster · Science, Technology & Digital Studies**\n\nAccepted as a poster in the Science, Technology & Digital Studies stream at the British Sociological Association Annual Conference 2026. A related 2025 installation, “I thought I will forget you that night”, materialised more than 80,000 iCloud images as a one-metre-square archive.\n\n![Visual study of digital archives and algorithmic recall from the Punctum research series](https://assets.abodid.com/documents/thumbnails/research-1769636977430-msh94w5fk.jpg)\n\n![A dense cluster of photographs from Abodid's iCloud archive](https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-icloud-image-cluster-05153ef77c.webp)\n\n![Archival prints from the iCloud archive](https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-icloud-images-01-bd5533f069.webp)\n\n[Related work: I thought I will forget you that night](/work)","blocks":[{"id":"cloud-memories-algorithmic-recall-01","blockType":"body_text","content":{"text":"What happens when we make more photographs than we can live with - when most frames feel futile, yet a few matter intensely?"},"settings":{"width":"wide","spacing":"spacious"}},{"id":"cloud-memories-algorithmic-recall-02","blockType":"heading","content":{"text":"From storage to stewardship","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cloud-memories-algorithmic-recall-03","blockType":"body_text","content":{"text":"This study examines how photographic excess, cloud platforms and AI sorting shape memory, care and ownership. Working from a long-running personal archive of more than 180,000 images, I analyse selected photographs across time and place and co-view phone and iCloud archives with others to understand what people keep, delete, hide or share. Images, metadata and platform resurfacing events - such as Memories, face clustering and search prompts - become material for understanding how platforms participate in remembering. The recurring patterns include overwhelm from volume, a small number of anchor images that carry disproportionate meaning, algorithmic resurfacing that edits what feels salient, and uncertainty around consent once photographs circulate through backups, shared albums and AI-indexed faces."},"settings":{"width":"standard","spacing":"default"}},{"id":"cloud-memories-algorithmic-recall-04","blockType":"heading","content":{"text":"Outcome","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cloud-memories-algorithmic-recall-05","blockType":"highlight","content":{"text":"**Accepted poster · Science, Technology & Digital Studies**\n\nAccepted as a poster in the Science, Technology & Digital Studies stream at the British Sociological Association Annual Conference 2026. A related 2025 installation, “I thought I will forget you that night”, materialised more than 80,000 iCloud images as a one-metre-square archive."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"cloud-memories-algorithmic-recall-06","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/documents/thumbnails/research-1769636977430-msh94w5fk.jpg","alt":"Visual study of digital archives and algorithmic recall from the Punctum research series","caption":"Visual study of photographic excess, digital archives and algorithmic recall.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cloud-memories-algorithmic-recall-07","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-icloud-image-cluster-05153ef77c.webp","alt":"A dense cluster of photographs from Abodid's iCloud archive","caption":"A visual study of photographic excess and algorithmic recall.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cloud-memories-algorithmic-recall-08","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-icloud-images-01-bd5533f069.webp","alt":"Archival prints from the iCloud archive","caption":"Archival evidence from over 80,000 materialised iCloud photographs.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cloud-memories-algorithmic-recall-09","blockType":"body_text","content":{"text":"[Related work: I thought I will forget you that night](/work)"},"settings":{"width":"standard","spacing":"default"}}],"featured":true,"published":true,"visible":true,"sort_order":0},{"slug":"do-ghosts-feel-jealous","title":"Do ghosts feel jealous if you miss the living ones more than them?","description":"An ongoing autoethnographic body of work on unrequited love, sibling loss, absence and the ways photographs carry unresolved grief.","role":"Artist-researcher / Photographer / Writer","accent":"pink","tags":["Autoethnography","Grief","Phototherapy"],"cover_image":"/images/research-portfolio/ghosts-cover.jpg","gallery_images":[{"id":"do-ghosts-feel-jealous-gallery-1","url":"/images/research-portfolio/ghosts-cover.jpg","alt":"Project cover showing a family photograph and the title Do ghosts feel jealous","caption":"Project cover from the ongoing RCA research corpus.","objectPosition":"50% 50%","sort_order":0},{"id":"do-ghosts-feel-jealous-gallery-2","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-performance-01-85bda7535b.webp","alt":"Performance image from the ongoing grief research project","caption":"Performance became a way to give absence a physical form.","objectPosition":"50% 50%","sort_order":1},{"id":"do-ghosts-feel-jealous-gallery-3","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-wall-writing-01-216dec68db.webp","alt":"Handwritten research material installed on a wall","caption":"Handwritten image-text and spatial studies from the research process.","objectPosition":"50% 50%","sort_order":2}],"content":"A long-form inquiry into the dissonance between absence and presence: how love, loss and heartbreak remain inside photographs, bodies, rituals and everyday gestures.\n\n## Memory as research material\n\nThe project grew from my experiences of losing my younger brother and later living through unrequited love. Using photographs from personal archives, prints, audio stories, video, performance, handwritten texts and conversations, I began treating memory not only as subject matter but as research material. The work asks whether we ever move on from loss, or whether earlier grief quietly reorganises the way we experience later relationships.\n\n## Process\n\n- Archive-led image making with family photographs, screenshots, voice notes and personal visual material.\n- Phototherapy and writing on images to make imagined conversations and unfinished goodbyes visible.\n- Participatory responses, music and other associations as secondary research material.\n- Performance and installation through large prints, projection, CRT video, audio and tactile elements.\n- Consent, trigger warnings and careful handling of private conversations as part of the method.\n\n## Status\n\n> The project was conceived toward an exhibition and film, and continues to evolve into sociological research. Its later academic framing became “Rejection Re-Activates Unresolved Grief”, presented at BSA 2026.\n\n![Project cover showing a family photograph and the title Do ghosts feel jealous](/images/research-portfolio/ghosts-cover.jpg)\n\n![Performance image from the ongoing grief research project](https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-performance-01-85bda7535b.webp)\n\n![Handwritten research material installed on a wall](https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-wall-writing-01-216dec68db.webp)\n\n[Academic finding: Rejection Re-Activates Unresolved Grief](/research/rejection-reactivates-unresolved-grief)","blocks":[{"id":"do-ghosts-feel-jealous-01","blockType":"body_text","content":{"text":"A long-form inquiry into the dissonance between absence and presence: how love, loss and heartbreak remain inside photographs, bodies, rituals and everyday gestures."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"do-ghosts-feel-jealous-02","blockType":"heading","content":{"text":"Memory as research material","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"do-ghosts-feel-jealous-03","blockType":"body_text","content":{"text":"The project grew from my experiences of losing my younger brother and later living through unrequited love. Using photographs from personal archives, prints, audio stories, video, performance, handwritten texts and conversations, I began treating memory not only as subject matter but as research material. The work asks whether we ever move on from loss, or whether earlier grief quietly reorganises the way we experience later relationships."},"settings":{"width":"standard","spacing":"default"}},{"id":"do-ghosts-feel-jealous-04","blockType":"heading","content":{"text":"Process","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"do-ghosts-feel-jealous-05","blockType":"body_text","content":{"text":"- Archive-led image making with family photographs, screenshots, voice notes and personal visual material.\n- Phototherapy and writing on images to make imagined conversations and unfinished goodbyes visible.\n- Participatory responses, music and other associations as secondary research material.\n- Performance and installation through large prints, projection, CRT video, audio and tactile elements.\n- Consent, trigger warnings and careful handling of private conversations as part of the method."},"settings":{"width":"standard","spacing":"default"}},{"id":"do-ghosts-feel-jealous-06","blockType":"heading","content":{"text":"Status","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"do-ghosts-feel-jealous-07","blockType":"highlight","content":{"text":"The project was conceived toward an exhibition and film, and continues to evolve into sociological research. Its later academic framing became “Rejection Re-Activates Unresolved Grief”, presented at BSA 2026."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"do-ghosts-feel-jealous-08","blockType":"single_image","content":{"media":{"sourceType":"uploaded","url":"/images/research-portfolio/ghosts-cover.jpg","alt":"Project cover showing a family photograph and the title Do ghosts feel jealous","caption":"Project cover from the ongoing RCA research corpus.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"do-ghosts-feel-jealous-09","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-performance-01-85bda7535b.webp","alt":"Performance image from the ongoing grief research project","caption":"Performance became a way to give absence a physical form.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"do-ghosts-feel-jealous-10","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-wall-writing-01-216dec68db.webp","alt":"Handwritten research material installed on a wall","caption":"Handwritten image-text and spatial studies from the research process.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"do-ghosts-feel-jealous-11","blockType":"body_text","content":{"text":"[Academic finding: Rejection Re-Activates Unresolved Grief](/research/rejection-reactivates-unresolved-grief)"},"settings":{"width":"standard","spacing":"default"}}],"featured":true,"published":true,"visible":true,"sort_order":1},{"slug":"rejection-reactivates-unresolved-grief","title":"Rejection Re-Activates Unresolved Grief","description":"A sociological framing of how romantic rejection can reactivate earlier grief when mourning remains unfinished.","role":"Researcher / Autoethnographer","accent":"purple","tags":["Unresolved grief","Romantic rejection","Family"],"cover_image":"/images/research-portfolio/rejection-responses.jpg","gallery_images":[{"id":"rejection-reactivates-unresolved-grief-gallery-1","url":"/images/research-portfolio/rejection-responses.jpg","alt":"Participatory written responses displayed beside an outdoor installation","caption":"Participatory responses from the broader “Do ghosts...” research corpus.","objectPosition":"50% 50%","sort_order":0},{"id":"rejection-reactivates-unresolved-grief-gallery-2","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-wall-writing-02-494e1e4295.webp","alt":"Handwritten research material installed on a gallery wall","caption":"Handwritten image-text and spatial studies documenting dialogue and grief.","objectPosition":"50% 50%","sort_order":1},{"id":"rejection-reactivates-unresolved-grief-gallery-3","url":"/images/research-portfolio/bsa-invitation.jpg","alt":"British Sociological Association invitation letter accepting two projects","caption":"Documentary proof of acceptance to the BSA Annual Conference 2026.","objectPosition":"50% 50%","sort_order":2}],"content":"This research begins with a specific question: what happens when a romantic refusal reopens an older grief that was never fully worked through?\n\n## An archive-led autoethnography\n\nOriginating in a case where romantic rejection reopened the pain of a sibling's death, the project treats unrequited love and unresolved bereavement as entangled rather than separate experiences. I write on archival family photographs as if in conversation with my younger brother, whose funeral I could not attend, and use those handwritten image-texts alongside extensive conversations about love and loss as ethnographic material. The analysis looks for recurring patterns around recalling, interrupted mourning and feelings of abandonment where ritual was absent. Intimate image-making and held dialogue can make coexisting losses legible without flattening their differences, while consent, anonymisation and the right to withdraw remain central to the method.\n\n## Outcome\n\n> **Accepted roundtable · Families & Relationships**\n\nAccepted as a roundtable presentation in the Families & Relationships stream at the British Sociological Association Annual Conference 2026. This paper is the academic research output of a larger ongoing artistic inquiry.\n\n![Participatory written responses displayed beside an outdoor installation](/images/research-portfolio/rejection-responses.jpg)\n\n![Handwritten research material installed on a gallery wall](https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-wall-writing-02-494e1e4295.webp)\n\n![British Sociological Association invitation letter accepting two projects](/images/research-portfolio/bsa-invitation.jpg)\n\n[Part of the ongoing Do ghosts... research corpus](/research/do-ghosts-feel-jealous)","blocks":[{"id":"rejection-reactivates-unresolved-grief-01","blockType":"body_text","content":{"text":"This research begins with a specific question: what happens when a romantic refusal reopens an older grief that was never fully worked through?"},"settings":{"width":"wide","spacing":"spacious"}},{"id":"rejection-reactivates-unresolved-grief-02","blockType":"heading","content":{"text":"An archive-led autoethnography","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"rejection-reactivates-unresolved-grief-03","blockType":"body_text","content":{"text":"Originating in a case where romantic rejection reopened the pain of a sibling's death, the project treats unrequited love and unresolved bereavement as entangled rather than separate experiences. I write on archival family photographs as if in conversation with my younger brother, whose funeral I could not attend, and use those handwritten image-texts alongside extensive conversations about love and loss as ethnographic material. The analysis looks for recurring patterns around recalling, interrupted mourning and feelings of abandonment where ritual was absent. Intimate image-making and held dialogue can make coexisting losses legible without flattening their differences, while consent, anonymisation and the right to withdraw remain central to the method."},"settings":{"width":"standard","spacing":"default"}},{"id":"rejection-reactivates-unresolved-grief-04","blockType":"heading","content":{"text":"Outcome","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"rejection-reactivates-unresolved-grief-05","blockType":"highlight","content":{"text":"**Accepted roundtable · Families & Relationships**\n\nAccepted as a roundtable presentation in the Families & Relationships stream at the British Sociological Association Annual Conference 2026. This paper is the academic research output of a larger ongoing artistic inquiry."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"rejection-reactivates-unresolved-grief-06","blockType":"single_image","content":{"media":{"sourceType":"uploaded","url":"/images/research-portfolio/rejection-responses.jpg","alt":"Participatory written responses displayed beside an outdoor installation","caption":"Participatory responses from the broader “Do ghosts...” research corpus.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"rejection-reactivates-unresolved-grief-07","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-rca-project-wall-writing-02-494e1e4295.webp","alt":"Handwritten research material installed on a gallery wall","caption":"Handwritten image-text and spatial studies documenting dialogue and grief.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"rejection-reactivates-unresolved-grief-08","blockType":"single_image","content":{"media":{"sourceType":"uploaded","url":"/images/research-portfolio/bsa-invitation.jpg","alt":"British Sociological Association invitation letter accepting two projects","caption":"Documentary proof of acceptance to the BSA Annual Conference 2026.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"rejection-reactivates-unresolved-grief-09","blockType":"body_text","content":{"text":"[Part of the ongoing Do ghosts... research corpus](/research/do-ghosts-feel-jealous)"},"settings":{"width":"standard","spacing":"default"}}],"featured":true,"published":true,"visible":true,"sort_order":2},{"slug":"cambridge-cultural-heritage-data-school","title":"Cultural Heritage Data School, Cambridge","description":"A methods-led research experience across cultural heritage data, co-design, photogrammetry, critical visualisation and participatory preservation.","role":"Bursary participant / Researcher","accent":"cyan","tags":["Cultural heritage","Co-design","Data ethics"],"cover_image":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-359c529ec7.webp","gallery_images":[{"id":"cambridge-cultural-heritage-data-school-gallery-1","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-359c529ec7.webp","alt":"Participants collaborating at the Cultural Heritage Data School","caption":"A participatory co-design activity at Cambridge Digital Humanities.","objectPosition":"50% 50%","sort_order":0},{"id":"cambridge-cultural-heritage-data-school-gallery-2","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-06-530ae313ad.webp","alt":"A classroom session at the Cultural Heritage Data School","caption":"Methods moved between paper, code, images and group discussion.","objectPosition":"50% 50%","sort_order":1},{"id":"cambridge-cultural-heritage-data-school-gallery-3","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-photo-5daaec7b0a.webp","alt":"Cultural Heritage Data School cohort group photograph","caption":"The 2026 international cohort at Cambridge.","objectPosition":"50% 50%","sort_order":2}],"content":"A week of methods for asking what cultural data becomes when it is handled through code, images, movement, participation and design.\n\n## Methods carried forward\n\nAt the Cultural Heritage Data School run by Cambridge Digital Humanities, I worked across practical and critical approaches to cultural heritage data. Sessions moved between paper and Python, world-building, photogrammetry, hybrid walking methods, critical data visualisation and cultural probes. The experience was less about adopting technology for its own sake and more about asking what forms of knowledge are produced - and who is represented or flattened - when heritage is translated into data.\n\n## Process\n\n- Photogrammetry with Polycam, reconnecting to earlier engineering experiments with Agisoft PhotoScan.\n- Co-design and walking as research methods rather than only facilitation techniques.\n- Critical data visualisation, including the ethics of scale, units and framing.\n- Cultural probes and participatory methods for situated qualitative responses.\n\n## Year\n\n> Full bursary / funded participation in the 2026 Cultural Heritage Data School; our group developed and presented a participatory cultural-preservation activity to an international cohort of more than 50 fellows from over 15 countries.\n\n![Participants collaborating at the Cultural Heritage Data School](https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-359c529ec7.webp)\n\n![A classroom session at the Cultural Heritage Data School](https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-06-530ae313ad.webp)\n\n![Cultural Heritage Data School cohort group photograph](https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-photo-5daaec7b0a.webp)\n\n[Read the complete UK 2026 memoir](/uk2026)","blocks":[{"id":"cambridge-cultural-heritage-data-school-01","blockType":"body_text","content":{"text":"A week of methods for asking what cultural data becomes when it is handled through code, images, movement, participation and design."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"cambridge-cultural-heritage-data-school-02","blockType":"heading","content":{"text":"Methods carried forward","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-03","blockType":"body_text","content":{"text":"At the Cultural Heritage Data School run by Cambridge Digital Humanities, I worked across practical and critical approaches to cultural heritage data. Sessions moved between paper and Python, world-building, photogrammetry, hybrid walking methods, critical data visualisation and cultural probes. The experience was less about adopting technology for its own sake and more about asking what forms of knowledge are produced - and who is represented or flattened - when heritage is translated into data."},"settings":{"width":"standard","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-04","blockType":"heading","content":{"text":"Process","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-05","blockType":"body_text","content":{"text":"- Photogrammetry with Polycam, reconnecting to earlier engineering experiments with Agisoft PhotoScan.\n- Co-design and walking as research methods rather than only facilitation techniques.\n- Critical data visualisation, including the ethics of scale, units and framing.\n- Cultural probes and participatory methods for situated qualitative responses."},"settings":{"width":"standard","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-06","blockType":"heading","content":{"text":"Year","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-07","blockType":"highlight","content":{"text":"Full bursary / funded participation in the 2026 Cultural Heritage Data School; our group developed and presented a participatory cultural-preservation activity to an international cohort of more than 50 fellows from over 15 countries."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"cambridge-cultural-heritage-data-school-08","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-359c529ec7.webp","alt":"Participants collaborating at the Cultural Heritage Data School","caption":"A participatory co-design activity at Cambridge Digital Humanities.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-09","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-06-530ae313ad.webp","alt":"A classroom session at the Cultural Heritage Data School","caption":"Methods moved between paper, code, images and group discussion.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-10","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/my-life/1600/abodid-cambridge-university-cultural-heritage-data-school-group-photo-5daaec7b0a.webp","alt":"Cultural Heritage Data School cohort group photograph","caption":"The 2026 international cohort at Cambridge.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cambridge-cultural-heritage-data-school-11","blockType":"body_text","content":{"text":"[Read the complete UK 2026 memoir](/uk2026)"},"settings":{"width":"standard","spacing":"default"}}],"featured":true,"published":true,"visible":true,"sort_order":3},{"slug":"cries-of-an-unmarried-widow","title":"Cries of an Unmarried Widow","description":"A conceptual photography and writing project about grief without the social legitimacy of marriage, and the tension between desire, memory and cultural expectations.","role":"Artist-researcher / Photographer / Writer","accent":"orange","tags":["Widowhood","Desire","Unrecognised grief"],"cover_image":"/images/research-portfolio/cries-cover.jpg","gallery_images":[{"id":"cries-of-an-unmarried-widow-gallery-1","url":"/images/research-portfolio/cries-cover.jpg","alt":"Cries of an Unmarried Widow book beside flowers and a cup","caption":"The project book and primary research cover.","objectPosition":"50% 50%","sort_order":0},{"id":"cries-of-an-unmarried-widow-gallery-2","url":"https://assets.abodid.com/photos/variants/cries-of-an-unmarried-widow/1600/_N5A1669-dd03e060a3.webp","alt":"Conceptual photograph from Cries of an Unmarried Widow","caption":"Desire, guilt and memory coexist inside the photographic series.","objectPosition":"50% 50%","sort_order":1},{"id":"cries-of-an-unmarried-widow-gallery-3","url":"https://assets.abodid.com/photos/variants/cries-of-an-unmarried-widow/1600/_N5A1635-543d6bc52d.webp","alt":"Photographic study of intimacy and touch","caption":"Tactile performance and intimate image-making as research method.","objectPosition":"50% 50%","sort_order":2}],"content":"What happens when a woman loses a partner without the social legitimacy of marriage - when her grief remains unrecognised, but her desire is still judged?\n\n## Grief outside recognised structures\n\nThis conceptual photography and writing project is grounded in the experience of loving after loss, where the presence of a past lover continues to intrude upon moments of intimacy. Pleasure and guilt are not opposites here but coexisting states. At its core, the work reflects on the cultural construction of grief in South Asian contexts, where womanhood is often defined through relational identities such as marriage and widowhood. A married widow is socially named and visibly positioned through the loss of a husband; an unmarried woman who loses a partner may have no equivalent public identity for her grief. The work stays with that contradiction: memory can remain bodily and intimate even when society offers no language, ritual or status through which to hold it.\n\n## Year\n\n> A conceptual photographic body of work accompanied by long-form writing, presented here as a text-image research project rather than a conventional photography gallery.\n\n![Cries of an Unmarried Widow book beside flowers and a cup](/images/research-portfolio/cries-cover.jpg)\n\n![Conceptual photograph from Cries of an Unmarried Widow](https://assets.abodid.com/photos/variants/cries-of-an-unmarried-widow/1600/_N5A1669-dd03e060a3.webp)\n\n![Photographic study of intimacy and touch](https://assets.abodid.com/photos/variants/cries-of-an-unmarried-widow/1600/_N5A1635-543d6bc52d.webp)\n\n[View the complete photographic series](/photography/cries-of-an-unmarried-widow)\n\n## Cries of an Unmarried Widow\n\n**Work in Progress**\n\nAn intimate reading excerpt from my upcoming memoir tracing love, rejection, grief, and healing.\n\n[Read the Prelude](/blog/cries-of-an-unmarried-widow-book-excerpt)","blocks":[{"id":"cries-of-an-unmarried-widow-01","blockType":"body_text","content":{"text":"What happens when a woman loses a partner without the social legitimacy of marriage - when her grief remains unrecognised, but her desire is still judged?"},"settings":{"width":"wide","spacing":"spacious"}},{"id":"cries-of-an-unmarried-widow-02","blockType":"heading","content":{"text":"Grief outside recognised structures","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-03","blockType":"body_text","content":{"text":"This conceptual photography and writing project is grounded in the experience of loving after loss, where the presence of a past lover continues to intrude upon moments of intimacy. Pleasure and guilt are not opposites here but coexisting states. At its core, the work reflects on the cultural construction of grief in South Asian contexts, where womanhood is often defined through relational identities such as marriage and widowhood. A married widow is socially named and visibly positioned through the loss of a husband; an unmarried woman who loses a partner may have no equivalent public identity for her grief. The work stays with that contradiction: memory can remain bodily and intimate even when society offers no language, ritual or status through which to hold it."},"settings":{"width":"standard","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-04","blockType":"heading","content":{"text":"Year","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-05","blockType":"highlight","content":{"text":"A conceptual photographic body of work accompanied by long-form writing, presented here as a text-image research project rather than a conventional photography gallery."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"cries-of-an-unmarried-widow-06","blockType":"single_image","content":{"media":{"sourceType":"uploaded","url":"/images/research-portfolio/cries-cover.jpg","alt":"Cries of an Unmarried Widow book beside flowers and a cup","caption":"The project book and primary research cover.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-07","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/cries-of-an-unmarried-widow/1600/_N5A1669-dd03e060a3.webp","alt":"Conceptual photograph from Cries of an Unmarried Widow","caption":"Desire, guilt and memory coexist inside the photographic series.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-08","blockType":"single_image","content":{"media":{"sourceType":"external","url":"https://assets.abodid.com/photos/variants/cries-of-an-unmarried-widow/1600/_N5A1635-543d6bc52d.webp","alt":"Photographic study of intimacy and touch","caption":"Tactile performance and intimate image-making as research method.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-09","blockType":"body_text","content":{"text":"[View the complete photographic series](/photography/cries-of-an-unmarried-widow)"},"settings":{"width":"standard","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-10","blockType":"heading","content":{"text":"Cries of an Unmarried Widow","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"cries-of-an-unmarried-widow-11","blockType":"body_text","content":{"text":"**Work in Progress**\n\nAn intimate reading excerpt from my upcoming memoir tracing love, rejection, grief, and healing.\n\n[Read the Prelude](/blog/cries-of-an-unmarried-widow-book-excerpt)"},"settings":{"width":"standard","spacing":"default"}}],"featured":true,"published":true,"visible":true,"sort_order":4},{"slug":"photogrammetry-physical-evidence","title":"Using Photogrammetry to Reconstruct Landscapes","description":"An early technical study using drone imagery and photogrammetric workflows to reconstruct physical spaces and produce orthophotos.","role":"Researcher / Technical experimenter","accent":"yellow","tags":["Photogrammetry","3D reconstruction","Aerial imaging"],"cover_image":"/images/research-portfolio/photogrammetry-poster.jpg","gallery_images":[{"id":"photogrammetry-physical-evidence-gallery-1","url":"/images/research-portfolio/photogrammetry-poster.jpg","alt":"Photogrammetry research poster showing drone acquisition and orthophoto workflow","caption":"Original workflow poster: image acquisition to orthophoto production.","objectPosition":"50% 50%","sort_order":0}],"content":"An early experiment in reconstructing physical spaces from captured image and video data.\n\n## A technical origin point\n\nThe study used aerial image acquisition and photogrammetric processing to turn overlapping visual data into measurable spatial outputs. The original workflow mapped image acquisition through preprocessing, image orientation, feature extraction and matching, DSM extraction, multi-image matching, filtering and solid true orthophoto production. A DJI Phantom 4 formed part of the acquisition setup. Years later, the method resurfaced at the Cambridge Cultural Heritage Data School: an earlier Agisoft PhotoScan workflow gave way to Polycam on an iPhone, connecting the technical language of engineering with later cultural-heritage and visual-research practice.\n\n## Context\n\n> A technical research poster and workflow study, presented as an origin point for the spatial and computational strand of the research practice.\n\n![Photogrammetry research poster showing drone acquisition and orthophoto workflow](/images/research-portfolio/photogrammetry-poster.jpg)\n\n[Then / now: Cultural Heritage Data School, Cambridge](/research/cambridge-cultural-heritage-data-school)","blocks":[{"id":"photogrammetry-physical-evidence-01","blockType":"body_text","content":{"text":"An early experiment in reconstructing physical spaces from captured image and video data."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"photogrammetry-physical-evidence-02","blockType":"heading","content":{"text":"A technical origin point","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"photogrammetry-physical-evidence-03","blockType":"body_text","content":{"text":"The study used aerial image acquisition and photogrammetric processing to turn overlapping visual data into measurable spatial outputs. The original workflow mapped image acquisition through preprocessing, image orientation, feature extraction and matching, DSM extraction, multi-image matching, filtering and solid true orthophoto production. A DJI Phantom 4 formed part of the acquisition setup. Years later, the method resurfaced at the Cambridge Cultural Heritage Data School: an earlier Agisoft PhotoScan workflow gave way to Polycam on an iPhone, connecting the technical language of engineering with later cultural-heritage and visual-research practice."},"settings":{"width":"standard","spacing":"default"}},{"id":"photogrammetry-physical-evidence-04","blockType":"heading","content":{"text":"Context","level":2},"settings":{"width":"standard","spacing":"default"}},{"id":"photogrammetry-physical-evidence-05","blockType":"highlight","content":{"text":"A technical research poster and workflow study, presented as an origin point for the spatial and computational strand of the research practice."},"settings":{"width":"wide","spacing":"spacious"}},{"id":"photogrammetry-physical-evidence-06","blockType":"single_image","content":{"media":{"sourceType":"uploaded","url":"/images/research-portfolio/photogrammetry-poster.jpg","alt":"Photogrammetry research poster showing drone acquisition and orthophoto workflow","caption":"Original workflow poster: image acquisition to orthophoto production.","objectPosition":"50% 50%"}},"settings":{"width":"wide","spacing":"default"}},{"id":"photogrammetry-physical-evidence-07","blockType":"body_text","content":{"text":"[Then / now: Cultural Heritage Data School, Cambridge](/research/cambridge-cultural-heritage-data-school)"},"settings":{"width":"standard","spacing":"default"}}],"featured":true,"published":true,"visible":true,"sort_order":5}]$research_projects$::jsonb
  ) with ordinality as seeded(project, ordinality)
)
insert into public.research (
  title,
  description,
  slug,
  tags,
  featured,
  sort_order,
  published,
  cover_image,
  visible,
  content,
  blocks,
  gallery_images,
  experiment_url,
  role,
  accent,
  updated_at
)
select
  project ->> 'title',
  project ->> 'description',
  project ->> 'slug',
  array(select jsonb_array_elements_text(project -> 'tags')),
  coalesce((project ->> 'featured')::boolean, true),
  (project ->> 'sort_order')::integer,
  coalesce((project ->> 'published')::boolean, true),
  project ->> 'cover_image',
  coalesce((project ->> 'visible')::boolean, true),
  coalesce(project ->> 'content', ''),
  coalesce(project -> 'blocks', '[]'::jsonb),
  coalesce(project -> 'gallery_images', '[]'::jsonb),
  null,
  coalesce(project ->> 'role', 'Research project'),
  coalesce(project ->> 'accent', 'lime'),
  now()
from research_seed
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  tags = excluded.tags,
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  published = excluded.published,
  cover_image = excluded.cover_image,
  visible = excluded.visible,
  content = excluded.content,
  blocks = excluded.blocks,
  gallery_images = excluded.gallery_images,
  role = excluded.role,
  accent = excluded.accent,
  updated_at = now();

-- Catalogue-only Lab presentation values live with the project blocks. The
-- visible heading and prompt are normal editable blocks, not component strings.
with lab_config(slug, surface, variant) as (
  values
    ('punctum', 'pink', 'media'),
    ('image-flick', 'yellow', 'media'),
    ('glyph-loom', 'lime', 'media'),
    ('sequence-room', 'cream', 'media'),
    ('second-brain', 'blue', 'vault-tags')
)
update public.portfolio_projects as project
set
  content = jsonb_set(
    project.content,
    '{blocks}',
    (
      select coalesce(
        jsonb_agg(
          case
            when block.ordinality = 1 then jsonb_set(
              block.value,
              '{settings}',
              coalesce(block.value -> 'settings', '{}'::jsonb)
                || jsonb_build_object(
                  'catalogueSurface', config.surface,
                  'catalogueVariant', config.variant
                ),
              true
            )
            else block.value
          end
          order by block.ordinality
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(coalesce(project.content -> 'blocks', '[]'::jsonb))
        with ordinality as block(value, ordinality)
    ),
    true
  ),
  published_content = jsonb_set(
    project.published_content,
    '{blocks}',
    (
      select coalesce(
        jsonb_agg(
          case
            when block.ordinality = 1 then jsonb_set(
              block.value,
              '{settings}',
              coalesce(block.value -> 'settings', '{}'::jsonb)
                || jsonb_build_object(
                  'catalogueSurface', config.surface,
                  'catalogueVariant', config.variant
                ),
              true
            )
            else block.value
          end
          order by block.ordinality
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(coalesce(project.published_content -> 'blocks', '[]'::jsonb))
        with ordinality as block(value, ordinality)
    ),
    true
  ),
  updated_at = now()
from lab_config as config
where project.slug = config.slug
  and project.published_content is not null;

with preview_blocks as (
  select jsonb_build_array(
    jsonb_build_object(
      'id', 'second-brain-catalogue-heading',
      'blockType', 'heading',
      'content', jsonb_build_object('text', 'A glimpse into my second brain.', 'level', 2),
      'settings', jsonb_build_object(
        'width', 'wide',
        'spacing', 'default',
        'catalogueRole', 'previewHeading'
      ),
      'visible', true,
      'position', -2
    ),
    jsonb_build_object(
      'id', 'second-brain-catalogue-prompt',
      'blockType', 'highlight',
      'content', jsonb_build_object('text', 'Move cursor to surface vault tags ↗'),
      'settings', jsonb_build_object(
        'width', 'wide',
        'spacing', 'compact',
        'catalogueRole', 'previewCta'
      ),
      'visible', true,
      'position', -1
    )
  ) as blocks
)
update public.portfolio_projects as project
set
  content = jsonb_set(
    project.content,
    '{blocks}',
    preview.blocks
      || (
        select coalesce(jsonb_agg(block.value order by block.ordinality), '[]'::jsonb)
        from jsonb_array_elements(coalesce(project.content -> 'blocks', '[]'::jsonb))
          with ordinality as block(value, ordinality)
        where block.value ->> 'id' not in (
          'second-brain-catalogue-heading',
          'second-brain-catalogue-prompt'
        )
      ),
    true
  ),
  published_content = jsonb_set(
    project.published_content,
    '{blocks}',
    preview.blocks
      || (
        select coalesce(jsonb_agg(block.value order by block.ordinality), '[]'::jsonb)
        from jsonb_array_elements(coalesce(project.published_content -> 'blocks', '[]'::jsonb))
          with ordinality as block(value, ordinality)
        where block.value ->> 'id' not in (
          'second-brain-catalogue-heading',
          'second-brain-catalogue-prompt'
        )
      ),
    true
  ),
  updated_at = now()
from preview_blocks as preview
where project.slug = 'second-brain'
  and project.published_content is not null;

notify pgrst, 'reload schema';

commit;

