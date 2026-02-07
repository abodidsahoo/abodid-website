-- Create the research_papers table
CREATE TABLE IF NOT EXISTS public.research_papers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    formatted_title TEXT,
    description TEXT,
    explanation TEXT,
    tags TEXT[],
    pdf_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    published BOOLEAN DEFAULT true
);

-- RLS Policies
ALTER TABLE public.research_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public research papers are viewable by everyone" 
ON public.research_papers FOR SELECT USING (true);

CREATE POLICY "Admin manage research papers" 
ON public.research_papers FOR ALL USING (auth.role() = 'authenticated');

-- Insert Data
INSERT INTO public.research_papers (title, formatted_title, description, explanation, tags, pdf_url, published)
VALUES
(
    'A Depth Psychology of Romantic Love as a Cultural Artifact',
    'A Depth Psychology of Romantic Love as a Cultural Artifact', -- using title as formatted_title default
    'The manuscript is a reproduction of a thesis/dissertation exploring romantic love as a cultural artifact through the lens of depth psychology. It includes standard information to users regarding the reproduction process.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Psychology','Romantic Love','Cultural Artifact'],
    'https://drive.google.com/open?id=1cQK9IHg5crCjJi2hvjLmmi0scdtTL82E',
    true
),
(
    'Heartful Autoethnography',
    'Heartful Autoethnography', -- using title as formatted_title default
    'Develops the concept of "Heartful Autoethnography," seeking to include researchers'' vulnerable selves, emotions, and bodies to produce evocative, detailed stories. The goal is to fuse social science with literature, encouraging compassion and empathy.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Qualitative Methods','Emotion'],
    'https://drive.google.com/open?id=1k4o82peuCgxjYBMkVZF7P-HoR1MLzOZ1',
    true
),
(
    'Can Emotions Be Transferred?',
    'Can Emotions Be Transferred?', -- using title as formatted_title default
    'Snippet is too brief to provide a two-line summary of the content, showing only a page number and an IEEE Xplore full-text link.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Emotion','Neuroscience','Research'],
    'https://drive.google.com/open?id=1KEeMq_pSWF2Ei9a-fmhpDmrvOrxx4Sg2',
    true
),
(
    'An Existential-Phenomenological Investigation of the Experience of Unrequited “Love-at-First-Sight”',
    'An Existential-Phenomenological Investigation of the Experience of Unrequited “Love-at-First-Sight”', -- using title as formatted_title default
    'A dissertation that presents an existential-phenomenological investigation into the experience of unrequited "love-at-first-sight." The study was submitted to the California Institute of Integral Studies in 2013.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Unrequited Love','Phenomenology','Psychology'],
    'https://drive.google.com/open?id=1PiYAUpn2FG-x1MLCUe0VTYMc6fe6eEtw',
    true
),
(
    'Silent Grief: Narratives of Bereaved Adult Siblings',
    'Silent Grief: Narratives of Bereaved Adult Siblings', -- using title as formatted_title default
    'A thesis titled "SILENT GRIEF: NARRATIVES OF BEREAVED ADULT SIBLINGS," submitted for a Doctor of Philosophy degree. The work focuses on the experiences of adult siblings coping with bereavement.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Grief','Psychology','Autoethnography'],
    'https://drive.google.com/open?id=1BbYp-qfjmkjYHQIVCVZe5wJr4gAIcSQU',
    true
),
(
    'High-Resolution Image Reconstruction with Latent Diffusion Models from Human Brain Activity',
    'High-Resolution Image Reconstruction with Latent Diffusion Models from Human Brain Activity', -- using title as formatted_title default
    'Proposes a new method based on a latent diffusion model (Stable Diffusion) to reconstruct realistic, high-semantic fidelity images from human brain activity obtained via fMRI. This work helps interpret the connection between computer vision models and the visual system.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Neuroscience','Image Reconstruction','fMRI'],
    'https://drive.google.com/open?id=1A8K4UCKKiSLT7ZvUFgM9xwVXy8tKw8jO',
    true
),
(
    'Event and Idea: A Writer''s Approach to the Videotape Documentary',
    'Event and Idea: A Writer''s Approach to the Videotape Documentary', -- using title as formatted_title default
    'A Master of Science thesis from MIT exploring a writer''s approach to the videotape documentary, titled "EVENT AND IDEA: A WRITER''S APPROACH TO THE VIDEOTAPE DOCUMENTARY."',
    NULL, -- explanation left empty as description covers it
    ARRAY['Documentary','Writing','Media'],
    'https://drive.google.com/open?id=1taPnXW9TdA9jcAODNJpyj5_lHKCwBOU3',
    true
),
(
    'How Stories Make Sense of Personal Experiences: Motives that Shape Autobiographical Narratives',
    'How Stories Make Sense of Personal Experiences: Motives that Shape Autobiographical Narratives', -- using title as formatted_title default
    'Examines how constructing stories is a mode for making sense of one''s experiences, noting that conversations often feature narrations of specific behaviors rather than abstract traits. The paper focuses on the motives that shape autobiographical narratives and meaning-making.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Psychology','Narrative','Autobiographical Memory'],
    'https://drive.google.com/open?id=1mJq0uV0rGg2l8-1X1R7mY9mN0uX0o0qG',
    true
),
(
    'Autoethnography as a Transformative Research Method',
    'Autoethnography as a Transformative Research Method', -- using title as formatted_title default
    'Argues that autoethnography is a qualitative, transformative research method due to its ability to change time, require vulnerability, foster empathy, and provide therapeutic benefits. Discusses these aspects using passages from an unpublished manuscript.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Qualitative Methods','Transformative Research'],
    'https://drive.google.com/open?id=1KvNVSHi9noJ6CRmCa4mY31Vg66WKeznq',
    true
),
(
    'Posthuman Figurations and Hauntological Graspings of Historical Consciousness/Thinking Through (Re)Photography',
    'Posthuman Figurations and Hauntological Graspings of Historical Consciousness/Thinking Through (Re)Photography', -- using title as formatted_title default
    'Explores how temporally disjointed aesthetics, such as (re)photographs, impact secondary students'' constructions of historical knowledge and thinking. Uses posthuman concepts (assemblage, rhizome, hauntology) and visual methodologies like photo-elicitation.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Posthumanism','Hauntology','Photography'],
    'https://drive.google.com/open?id=1RAS6418NPOFMh4Uzp_O9aQ4UAs0s_rC0',
    true
),
(
    'The Queering of Photography: A Generative Encounter',
    'The Queering of Photography: A Generative Encounter', -- using title as formatted_title default
    'A PhD thesis that considers what a "queering of photography" entails, proposing a new concept of the photographic image that addresses its materiality and generative principle. It aims to overturn the binary-rooted logic (e.g., truth/falsehood, copy/original) that underpins dominant photography discourse.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Photography','Queer Theory','Art'],
    'https://drive.google.com/open?id=1FWaCRRX-ejTXdyOgz5unGqoJks5XuJqz',
    true
),
(
    'Exposed Wounds: The Photographic Autopathographies of Hannah Wilke and Jo Spence',
    'Exposed Wounds: The Photographic Autopathographies of Hannah Wilke and Jo Spence', -- using title as formatted_title default
    'Focuses on the photographic autopathographies produced by artists Hannah Wilke and Jo Spence, examining their use of self-representation to document and explore illness and the body.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Photography','Art','Illness Narrative'],
    'https://drive.google.com/open?id=16UfdoZy7DZd2VwCyKQ_JlS5mGFHDj2mA',
    true
),
(
    'Out of the Blue and Into It: Autoethnography, Emotions and Complicated Grief',
    'Out of the Blue and Into It: Autoethnography, Emotions and Complicated Grief', -- using title as formatted_title default
    'Illustrates how autoethnography can research complex emotional experiences but is subject to cultural feeling/display rules that interfere with emotional engagement. Critically revisits myths about autoethnography (narcissistic, therapeutic, authentic) and suggests it is complicated and non-linear.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Grief','Emotion'],
    'https://drive.google.com/open?id=1dA1qao_0NSjXbg0aqV_ndnGS478lQGXA',
    true
),
(
    'Dream, Death, and the Self (Contents)',
    'Dream, Death, and the Self (Contents)', -- using title as formatted_title default
    'A table of contents for a work on "Dream Death and the Self," detailing chapters on philosophical puzzles, the meaning of the dream hypothesis, and its relation to identity and the first person.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Philosophy','Identity','Dream Analysis'],
    'https://drive.google.com/open?id=1i6m3W1e0Q0u2p9z7y4d2nN5w9z8f8j0k',
    true
),
(
    'Relationships Among Goals and Flirting: A Recall Study',
    'Relationships Among Goals and Flirting: A Recall Study', -- using title as formatted_title default
    'Investigates the relationships between goals and specific flirting behaviors in a college population using Dillard''s Goals-Plans-Action (GPA) model of interpersonal influence. Results confirm that goals, planning, and importance relate to flirting behaviors, with sex differences observed in behaviors and motivations.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Flirting','Relationships','Psychology'],
    'https://drive.google.com/open?id=1Y1HTntbB7O3zu6f4_uEX_3TxgD5P8UKR',
    true
),
(
    '‘Undoubtedly Love Letters’? Olive Schreiner’s Letters to Karl Pearson',
    '‘Undoubtedly Love Letters’? Olive Schreiner’s Letters to Karl Pearson', -- using title as formatted_title default
    'Offers a re-reading of Olive Schreiner’s letters to Karl Pearson, arguing that the dominant interpretation of them as "unrequited love letters" needs rethinking. It suggests a more complex interpretation when considering the intertwining of their public and private aspects.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Love Letters','History','Re-Reading'],
    'https://drive.google.com/open?id=17p0G5b8zH5jW4O9c9g6P7Q5i7d5O9g7a',
    true
),
(
    'Exploring the Reciprocity of Attraction Effect: Is the Truism True?',
    'Exploring the Reciprocity of Attraction Effect: Is the Truism True?', -- using title as formatted_title default
    'A dissertation that examines the "Reciprocity of Attraction Effect," aiming to test whether the truism that people are attracted to those who like them is true.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Attraction','Relationships','Psychology'],
    'https://drive.google.com/open?id=1Z6CyyjgQJ6S0DDlBce7IDqYxKNT7dkV7',
    true
),
(
    'Let''s Just Be Friends: Relationship Negotiation and the Communication of Social Rejection in Unrequited Love',
    'Let''s Just Be Friends: Relationship Negotiation and the Communication of Social Rejection in Unrequited Love', -- using title as formatted_title default
    'Snippet is too brief to provide a two-line summary, containing only reproduction permission notices.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Unrequited Love','Relationships','Communication'],
    'https://drive.google.com/open?id=1ej3l2BlNZ2uCtY-NESxO5y_A5ESbNBWd',
    true
),
(
    'Evocative Autoethnography: Writing Lives and Telling Stories (Book Review)',
    'Evocative Autoethnography: Writing Lives and Telling Stories (Book Review)', -- using title as formatted_title default
    'A book review of *Evocative Autoethnography: Writing Lives and Telling Stories* by Art Bochner and Carolyn Ellis. It praises the text for introducing the methodology as a "way of life" and as a terrific guide.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Book Review','Qualitative Methods'],
    'https://drive.google.com/open?id=1jUS0TFCHBTnF1zL2iUpXEvOSK2J_fpc8',
    true
),
(
    'Evocative Autoethnography: Writing Lives and Telling Stories (Preface)',
    'Evocative Autoethnography: Writing Lives and Telling Stories (Preface)', -- using title as formatted_title default
    'A comprehensive text that introduces evocative autoethnography as a methodology and a way of life in the human sciences. It describes the history, development, and purposes of evocative storytelling and is structured as a fictional workshop.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Qualitative Methods','Storytelling'],
    'https://www.google.com/url?source=gmail&sa=E&q=https://www.google.com/url%3Fsource%3Dgmail%26sa%3DE%26q%3Dhttps://drive.com/open%253Fid%253D1WrmkHub9_0nfX1i3kFM_hTwbPb0UV8yF',
    true
),
(
    'Photography and Memory: The Representation of the Unrepresentable in Gustavo Germano’s Absences',
    'Photography and Memory: The Representation of the Unrepresentable in Gustavo Germano’s Absences', -- using title as formatted_title default
    'Explores the relationship between photography and memory, specifically focusing on "The Representation of the Unrepresentable in Gustavo Germano’s Absences."',
    NULL, -- explanation left empty as description covers it
    ARRAY['Photography','Memory','Art'],
    'https://drive.google.com/open?id=1mnojbXDnsfrmnKBCBCBCqpQZRxbZbhLn',
    true
),
(
    'Autoethnography as a Research Method: Advantages, Limitations and Criticisms',
    'Autoethnography as a Research Method: Advantages, Limitations and Criticisms', -- using title as formatted_title default
    'Reviews the literature on autoethnography, describing it as a research method that uses evocative narratives. It explores the advantages, limitations, and criticisms this research method has endured since its emergence.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Research Methods','Criticism'],
    'https://drive.google.com/open?id=1WuLeVxFeG5Vho8iXBUxVKf9b9eJLA_M-',
    true
),
(
    'Attachment Style and Willingness to Compromise When Choosing a Mate',
    'Attachment Style and Willingness to Compromise When Choosing a Mate', -- using title as formatted_title default
    'Eminines the association between attachment styles and the willingness to compromise when choosing a mate among single male students. Results showed that anxious-ambivalent participants exhibited less willingness to compromise than secure and avoidant individuals.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Attachment Theory','Mate Selection','Psychology'],
    'https://drive.google.com/open?id=1KxhZf1O4WVrQbR5Gv6L4V2smR9qLnBvd',
    true
),
(
    'Autoethnographic Reflections on Dance-Based Contemporary Art Practice-as-Research',
    'Autoethnographic Reflections on Dance-Based Contemporary Art Practice-as-Research', -- using title as formatted_title default
    'A Master of Arts dissertation titled "Autoethnographic Reflections on Dance-Based Contemporary Art Practice-as-Research." The keywords highlight its focus on dance, movement, embodiment, tango, and autoethnography.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Dance','Art Practice'],
    'https://drive.google.com/open?id=1FSVlFoyeZS1r9WL_XnALzZn8_u5hqUvE',
    true
),
(
    'Handbook of Research on the Relationship Between Autobiographical Memory and Photography',
    'Handbook of Research on the Relationship Between Autobiographical Memory and Photography', -- using title as formatted_title default
    'Title page for a volume in the Advances in Media, Entertainment, and the Arts Book Series. Focuses on the relationship between autobiographical memory and photography.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autobiographical Memory','Photography','Research'],
    'https://drive.google.com/open?id=1ic5KYvDHCvHezDe8L7-fF7vhFF4xuCc1',
    true
),
(
    'EEG-Based Emotion Recognition Using Quadratic Time-Frequency Distribution',
    'EEG-Based Emotion Recognition Using Quadratic Time-Frequency Distribution', -- using title as formatted_title default
    'Presents an EEG-based emotion recognition approach using a novel time-frequency feature extraction technique: a quadratic time-frequency distribution (QTFD). The method aims to construct a high-resolution time-frequency representation of EEG signals for accurate emotion recognition.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Emotion Recognition','EEG','Signal Processing'],
    'https://drive.google.com/open?id=1q8qLGvFSIeiv3V3tfq0rtmcwdNvD_5hS',
    true
),
(
    '‘What meaning does somebody''s death have, what meaning does somebody''s life have?’ Psychotherapists’ Stories of Their Work with Suicidal Clients',
    '‘What meaning does somebody''s death have, what meaning does somebody''s life have?’ Psychotherapists’ Stories of Their Work with Suicidal Clients', -- using title as formatted_title default
    'Examines psychotherapists'' stories of their work with suicidal clients, focusing on the meaning of life and death in this therapeutic context.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Psychotherapy','Suicidal Clients','Grief'],
    'https://drive.google.com/open?id=1z0EpHVpRiRSyn1wOVrua9YdwZh3K9fuz',
    true
),
(
    'Once More with Feeling: A Reinvention of ‘Hysteria’ Using Photography, Performance, and Autofiction',
    'Once More with Feeling: A Reinvention of ‘Hysteria’ Using Photography, Performance, and Autofiction', -- using title as formatted_title default
    'A PhD research project subtitled "A reinvention of ‘hysteria’ using photography, performance, and autofiction."',
    NULL, -- explanation left empty as description covers it
    ARRAY['Photography','Performance','Autofiction'],
    'https://drive.google.com/open?id=1_9hTol06vIsv17Cb19AZ2CU9C2g8VP4s',
    true
),
(
    'Love and Irrationality: It’s Got to Be Rational to Love You Because It Makes Me So Happy',
    'Love and Irrationality: It’s Got to Be Rational to Love You Because It Makes Me So Happy', -- using title as formatted_title default
    'Discusses love and irrationality, arguing it is rational to pursue happiness and delight from love, even if it may lead to future unhappiness. Notes that love''s peculiarities, such as the difficulty in calculating its actuarial value, led Max Weber to classify it as charismatic rather than rational.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Romantic Love','Rationality','Sociology'],
    'https://drive.google.com/open?id=1KTqtn46MDPG78HDApdUu0IQxeH2banGX',
    true
),
(
    'Preface: Ghosts, Haunting, and Hauntology',
    'Preface: Ghosts, Haunting, and Hauntology', -- using title as formatted_title default
    'An editorial that discusses locating the human subject''s experience not just within the body but as dispersed across social and symbolic networks of power, and often confined to a "temporal now." The piece introduces the concepts of ghosts, haunting, and "Hauntology" to address these limitations.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Hauntology','Philosophy','Historical Consciousness'],
    'https://drive.google.com/open?id=1rAexiNEK769ad-X7Cq2Y_bxj2eKKlZSY',
    true
),
(
    'Moving On Gracefully: Navigating a New Relationship After Romantic Rejection',
    'Moving On Gracefully: Navigating a New Relationship After Romantic Rejection', -- using title as formatted_title default
    'Examines individuals'' behavior toward a new dating partner following romantic rejection. Results showed that individuals expressed significant prosocial behavior after rejection, particularly toward a new partner with a high possibility of acceptance.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Romantic Rejection','Prosocial Behavior','Relationships'],
    'https://drive.google.com/open?id=1r31UyCLX6mdIKaC3X0Gj_iTXSwSJbzQz',
    true
),
(
    'Unrequited Love: On Heartbreak, Anger, Guilt, Scriptlessness, and Humiliation',
    'Unrequited Love: On Heartbreak, Anger, Guilt, Scriptlessness, and Humiliation', -- using title as formatted_title default
    'Explores unreciprocated romantic attraction by comparing narrative accounts, concluding that unrequited love is a bilaterally distressing experience marked by mutual incomprehension. Would-be lovers reported more positive and intensely negative emotions than rejectors and felt they were led on.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Unrequited Love','Emotion','Social Psychology'],
    'https://drive.google.com/open?id=196XZgsrnl7MkCVNw0JHXKQD9wiuGyoNW',
    true
),
(
    'What Gets in the Way of Working with Clients Who Have Been Sexually Abused? Heuristic Inquiry',
    'What Gets in the Way of Working with Clients Who Have Been Sexually Abused? Heuristic Inquiry', -- using title as formatted_title default
    'Presents the findings of a heuristic investigation into factors that may hinder the process of working with clients who have been sexually abused in a therapeutic setting.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Psychotherapy','Sexual Abuse','Heuristic Inquiry'],
    'https://drive.google.com/open?id=12GVmCR7PrX7NDzl7gQ-tdqQa8JcXyWJU',
    true
),
(
    'The Experiences of Person-Centred Counsellors Working with Suicidal Clients Online Through the Medium of Text',
    'The Experiences of Person-Centred Counsellors Working with Suicidal Clients Online Through the Medium of Text', -- using title as formatted_title default
    'A study to provide an understanding of the experiences of UK-based person-centred counsellors working with suicidal clients online through text.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Counselling','Suicidal Clients','Online Therapy'],
    'https://drive.google.com/open?id=1wAzewUjDW6cxYDt9BFt9-3RMz77wmK_i',
    true
),
(
    'Recognition of Human Emotions Using EEG Signals: A Review',
    'Recognition of Human Emotions Using EEG Signals: A Review', -- using title as formatted_title default
    'A review article on the assessment and classification of human emotions through the analysis of physiological signals, focusing on electroencephalography (EEG) signals. It highlights emotion classification as a key means of detecting emotion for e-health care and human-machine interfaces.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Emotion Recognition','EEG','Review'],
    'https://drive.google.com/open?id=1a-2Im29_KBJPMMhrCOPJwUtG6f6kef_q',
    true
),
(
    'Photography as Anti-Memory',
    'Photography as Anti-Memory', -- using title as formatted_title default
    'Discusses "PHOTOGRAPHY AS ANTI-MEMORY," exploring concepts like Romanticism, the invisible, alterity, the void, and the symbolic mirror in relation to memory and photography.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Photography','Memory','Philosophy'],
    'https://drive.google.com/open?id=1ElFY5kFJlPRsJpRYSxrloXuIWGD7ilDa',
    true
),
(
    'What Does “Retrospective Consent” Really Mean?',
    'What Does “Retrospective Consent” Really Mean?', -- using title as formatted_title default
    'Examines the impact of a non-traditional "retrospective" consent process compared to the usual prospective consent process on recruitment rates and outcomes in a clinical trial (HIPSTER).',
    NULL, -- explanation left empty as description covers it
    ARRAY['Ethics','Clinical Trials','Consent'],
    'https://drive.google.com/open?id=1Qf7LQbXNHLJ5SjwxlerYZSo6FdJZkH8-',
    true
),
(
    'Using Imagined Interactions to Predict Covert Narcissism',
    'Using Imagined Interactions to Predict Covert Narcissism', -- using title as formatted_title default
    'Investigates "Using Imagined Interactions to Predict Covert Narcissism," exploring the link between one''s internal dialogue and covert narcissistic traits.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Imagined Interactions','Narcissism','Psychology'],
    'https://drive.google.com/open?id=1v-6BwqdcoJZhzdMqFC6msyn50G8B1Uw>_',
    true
),
(
    'Why Autoethnography?',
    'Why Autoethnography?', -- using title as formatted_title default
    'Addresses the need to make human sciences more human by writing in more poignant, touching, and heartfelt ways. It argues that autoethnography, which is concerned with evocation over information, helps researchers address what it feels like to be alive in a chaotic world.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Human Sciences','Methodology'],
    'https://drive.google.com/open?id=1FHVbJwhddYvZpX75Cio18vAU7DCnwf7I',
    true
),
(
    'When Courtship Persistence Becomes Intrusive Pursuit: Comparing Rejecter and Pursuer Perspectives of Unrequited Attraction',
    'When Courtship Persistence Becomes Intrusive Pursuit: Comparing Rejecter and Pursuer Perspectives of Unrequited Attraction', -- using title as formatted_title default
    'Compares rejecter (target) and pursuer (actor) perspectives of unrequited attraction, finding targets reported being on the receiving end of more unwanted courtship tactics. Actors tended to overreport reciprocity signals and underreport rejections, a difference with implications for understanding stalking.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Unrequited Love','Courtship','Stalking'],
    'https://drive.google.com/open?id=1BPK7ceoPy8aAT0gQzbdyYLKDOnwi8KoW',
    true
),
(
    'Unrequited Love Hurts: The Medicalization of Broken Hearts Is Therapy, Not Enhancement',
    'Unrequited Love Hurts: The Medicalization of Broken Hearts Is Therapy, Not Enhancement', -- using title as formatted_title default
    'Responds to a proposal for using "love drugs" to enhance romantic relationships, arguing that the medicalization of broken hearts is therapy, not enhancement. Notes that psychotherapy and counseling already analyze and medicalize romantic love without objection.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Unrequited Love','Neuroethics','Psychotherapy'],
    'https://drive.google.com/open?id=13NsKv38lZkcZIdK79zyrg2nBYLpuiX5P',
    true
),
(
    'Unrequited Neurochemical Enhancement of Love',
    'Unrequited Neurochemical Enhancement of Love', -- using title as formatted_title default
    'Raises concerns with the analysis of love enhancement through neurochemical modulation as a key issue in contemporary neuroethics. It suggests strengthening the argument against medicalization concerns and developing stronger analysis of social/political concerns, emphasizing the relevance of philosophy and the humanities.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Neuroethics','Love','Philosophy'],
    'https://drive.google.com/open?id=1I6OCgl_AJN9R68VuMec8EQfJH1jypJCa',
    true
),
(
    'What Does Vulnerability Mean',
    'What Does Vulnerability Mean', -- using title as formatted_title default
    'Snippet is too brief to provide a two-line summary, containing only reproduction permission notices.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Vulnerability','Emotion','Psychology'],
    'https://drive.google.com/open?id=1vAEprP4HM_Z7puPp4PMrjt4P5aQhdkRB',
    true
),
(
    'Unrequited Love: The Role of Prior Commitment, Motivation to Remain Friends, and Friendship Maintenance',
    'Unrequited Love: The Role of Prior Commitment, Motivation to Remain Friends, and Friendship Maintenance', -- using title as formatted_title default
    'This study tested a moderated mediation model that commitment prior to an unrequited love episode will be related to higher levels of friendship maintenance behaviors after the episode. This relationship is mediated by the individual''s motivations to remain friends with the rejecter.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Unrequited Love','Friendship','Commitment'],
    'https://drive.google.com/open?id=1_TuCdAjSXLAgBpjBk8AAIzCb-uQ0agQQ',
    true
),
(
    'The Risks and Rewards of Sexual Debut',
    'The Risks and Rewards of Sexual Debut', -- using title as formatted_title default
    'Measures the longitudinal impact of sexual debut on adolescents, hypothesizing that healthy sexual experiences can be developmentally appropriate and rewarding. Findings show sexual debut was related to increases in romantic appeal and sexual satisfaction, and a decline in internalizing symptoms.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Sexual Debut','Adolescence','Psychology'],
    'https://drive.google.com/open?id=15SKNNBydRBAoJF0ksnijz9fZR8IftCWD',
    true
),
(
    'Spectral—Fragile—(Un)homely: The Haunting Presence of Francesca Woodman in the House and Space2 Series',
    'Spectral—Fragile—(Un)homely: The Haunting Presence of Francesca Woodman in the House and Space2 Series', -- using title as formatted_title default
    'Examines the photographic series *House and Space2* by Francesca Woodman, focusing on her spectral, semi-absent presence in unhomely locations. It uses Bracha L. Ettinger''s matrixial theory to challenge the non-affirmative understanding of her self-portraits as works of disappearing subjectivity.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Haunting','Photography','Art'],
    'https://drive.google.com/open?id=1jL9VcvzgY3JEfs7qp_hhyGmprtPsIv7c',
    true
),
(
    'What Is Hauntology?',
    'What Is Hauntology?', -- using title as formatted_title default
    'Defines and discusses the concept of "Hauntology," noting its resurgence prompted by musical artists whose work sounded "ghostly." It identifies hauntology''s key feature as its confrontation with a cultural impasse.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Hauntology','Philosophy','Cultural Theory'],
    'https://drive.google.com/open?id=1WLc4iFh0ACbDhS_5CBdFr6wlZyyhlIg',
    true
),
(
    'The Poetry Pharmacy Condition: Obsessive Love',
    'The Poetry Pharmacy Condition: Obsessive Love', -- using title as formatted_title default
    'A piece on "Obsessive Love" from The Poetry Pharmacy, stating that although love can cause anguish, "’Tis better to have loved and lost / Than never to have loved at all." It argues that relationships are how humans evolve and that the regret of chances untaken is worse than the agony of heartbreak.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Obsessive Love','Unrequited Love','Poetry'],
    'https://drive.google.com/open?id=15wlc4iFh0ACbDhS_5CBdFr6wlZyyhlIg',
    true
),
(
    'Prelude to a Kiss',
    'Prelude to a Kiss', -- using title as formatted_title default
    'A chapter titled "Prelude to a Kiss" from the *Handbook Of Relationship Initiation*. The snippet provides no further content, only publication information.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Relationship Initiation','Psychology','Handbook Chapter'],
    'https://drive.google.com/open?id=15dIdRfidVBgmCDg85lRjOg7Sy52h3nVo',
    true
),
(
    'Shower Thoughts – of Loss and Queer Love',
    'Shower Thoughts – of Loss and Queer Love', -- using title as formatted_title default
    'A reflective piece of writing, likely autoethnographic, that details a person''s experience of sadness, loss, and "queer love" while struggling with a disrupted sleeping schedule during the pandemic. The author reflects on the disconnect between their vibrant self and their depressive state.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Autoethnography','Loss','Queer Love'],
    'https://drive.google.com/open?id=1xdOedMbHDBQxV8hREjNFQB_qOT7066rD',
    true
),
(
    'Perhaps It Was Too Soon: College Students’ Reflections on the Timing of Their Sexual Debut',
    'Perhaps It Was Too Soon: College Students’ Reflections on the Timing of Their Sexual Debut', -- using title as formatted_title default
    'Examines college students'' reflections on the timing of their sexual debut, shifting research focus from just chronological age to the degree to which the event is viewed as "on-time."',
    NULL, -- explanation left empty as description covers it
    ARRAY['Sexual Debut','College Students','Timing'],
    'https://drive.google.com/open?id=1o4E-76E1hXoPRxvw83xRKlf2prgcPVIW',
    true
),
(
    'The Self Portrait, a Powerful Tool for Self-Therapy',
    'The Self Portrait, a Powerful Tool for Self-Therapy', -- using title as formatted_title default
    'Argues that in the digital era, self-portraiture is a powerful tool for self-therapy, enabling anyone to produce a work of art instinctively. It suggests that facing the camera lens immediately engages the essential process of defining the self.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Self-Portrait','Self-Therapy','Photography'],
    'https://drive.google.com/open?id=1ZOcazqjb2yh8E7g7nP82uX5k_wH_ZgDF',
    true
),
(
    'Performative Writing as Training in the Performing Arts',
    'Performative Writing as Training in the Performing Arts', -- using title as formatted_title default
    'Advocates for the body-centered, creative practice of performative writing as a useful method for training in the performing arts. This method serves as an "extended stage" for students to revisit and reassess their work on the page as fully as on stage.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Performative Writing','Performing Arts','Training'],
    'https://drive.google.com/open?id=1ub5gv6xvLXAh5RZIg_d5Tf2Pe1SVjByv',
    true
),
(
    'Love''s Effect on Creativity',
    'Love''s Effect on Creativity', -- using title as formatted_title default
    'Snippet is too brief to provide a two-line summary, containing only reproduction permission notices.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Love','Creativity','Psychology'],
    'https://drive.google.com/open?id=1iOvJjjxQBu7sgvrtNxWz1vzgD2_NdaPy',
    true
),
(
    'Performative Writing as a Method of Inquiry With the Material World: The Art of the Imperative',
    'Performative Writing as a Method of Inquiry With the Material World: The Art of the Imperative', -- using title as formatted_title default
    'Highlights the "imperative" as a strategy to enhance writing practices, understanding writing as a performative material practice based on posthuman theories. Employs a critical collaborative autoethnographic methodology to explore writing as a method of inquiry.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Performative Writing','Posthumanism','Qualitative Methods'],
    'https://drive.google.com/open?id=1vltDCpmuOxra75U9qoYiy4Plp9fCn3mY',
    true
),
(
    'EEG-Based Emotion Recognition: Review of Commercial EEG Devices and Machine Learning Techniques',
    'EEG-Based Emotion Recognition: Review of Commercial EEG Devices and Machine Learning Techniques', -- using title as formatted_title default
    'A review of commercial EEG devices and machine learning techniques for EEG-based emotion recognition. It aims to evaluate popular consumer-grade EEG devices'' status and provide insights for future investigations.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Emotion Recognition','EEG','Machine Learning'],
    'https://drive.google.com/open?id=1KdWpgYrZEmpzbvyDPNnP1E0Fb27kivVO',
    true
),
(
    'The Roles of Romantic Beliefs and Imagined Interaction in Unrequited Love',
    'The Roles of Romantic Beliefs and Imagined Interaction in Unrequited Love', -- using title as formatted_title default
    'Examined the roles of romantic beliefs and imagined interactions in unrequited love among Chinese college students. Found that more idealized romantic beliefs and having imagined interactions were associated with stronger unrequited love, with the frequency of imagined interactions mediating the relationship.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Unrequited Love','Romantic Beliefs','Imagined Interaction'],
    'https://drive.google.com/open?id=1yBEcdkZHZSNeQ4JnGYbaQjnNYwphpI8y',
    true
),
(
    'Love, Sex, and Psychotherapy in a Post-Romantic Era',
    'Love, Sex, and Psychotherapy in a Post-Romantic Era', -- using title as formatted_title default
    'An editorial discussing love, sex, and psychotherapy in a "post-romantic era" where there are greater sexual freedoms but a longing to "marry sex and intimacy."',
    NULL, -- explanation left empty as description covers it
    ARRAY['Psychotherapy','Love','Post-Romanticism'],
    'https://drive.google.com/open?id=12lWNIMrAGVompqy_7JCbm-kU3c3b2Bgv',
    true
),
(
    'Conceptualizing the Friendzone Phenomenon',
    'Conceptualizing the Friendzone Phenomenon', -- using title as formatted_title default
    'Explores the "friendzone" phenomenon through the perspectives of initiators (those who communicate attraction) and respondents (those who react). It conceptualizes the friendzone, highlights obstacles in non-normative relationship scripts, and identifies risks with relationship change.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Friendzone','Relationships','Communication'],
    'https://drive.google.com/open?id=1VOtRqB_DaXs5R5Gv6L4V2smR9qLnBvd',
    true
),
(
    'Love, Loss—And Love',
    'Love, Loss—And Love', -- using title as formatted_title default
    'An article on families who have suffered the death of a child and their efforts to try to have children again. Reports that some experts believe the best way for parents to get over a death is to have another child, even with the risk of genetic disorders.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Grief','Child Loss','Family'],
    'https://drive.google.com/open?id=1oog4qszB0Q6fr5VZTN3Usx34CtAqmJKP',
    true
),
(
    'Pair-Bonding, Romantic Love, and Evolution: The Curious Case of Homo sapiens',
    'Pair-Bonding, Romantic Love, and Evolution: The Curious Case of Homo sapiens', -- using title as formatted_title default
    'The article evaluates the thesis that romantic love is an evolved ''commitment device'' for motivating human pair-bonding, which in turn facilitated the idiosyncratic life history of hominins. It integrates evidence from various scientific disciplines, including the universality of romantic love, its neurobiological signatures, and challenges like infidelity.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Romantic Love','Evolution','Pair-Bonding'],
    'https://drive.google.com/open?id=1TSefEYwOMgAalpdrYTq2hH1fS33efUCP',
    true
),
(
    'Imagined Interaction as an Element of Social Cognition',
    'Imagined Interaction as an Element of Social Cognition', -- using title as formatted_title default
    'Introduces the notion of "imagined interaction" as part of the social cognition process. Imagined interactions serve functions like rehearsal for anticipated encounters, are dominated by the self, and are equally pleasant and unpleasant.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Social Cognition','Imagined Interaction','Communication'],
    'https://drive.google.com/open?id=1hXAjhxXTMe02hpar57fCgWdCKoeNRlVo',
    true
),
(
    'Effective Psychotherapy and Trotsky: Should Theory, Practice or Research, Come First?',
    'Effective Psychotherapy and Trotsky: Should Theory, Practice or Research, Come First?', -- using title as formatted_title default
    'An editorial debating the role of research as the cornerstone of psychotherapeutic theory, practice, and training. It questions what is meant by ''research'' in this context, contrasting evidence-based practice (EBP) with the view that psychotherapy itself is the research.',
    NULL, -- explanation left empty as description covers it
    ARRAY['Psychotherapy','Research','Theory'],
    'https://drive.google.com/open?id=1eDWO5xdZogGD_lEJrvtQviOibVJhFrwg',
    true
);
