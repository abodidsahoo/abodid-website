import { supabase } from './supabaseClient';
import { featuredPhotography as mockPhotography, recentPosts as mockPosts } from '../utils/mockData';

// Mock Data for Awards (Internal Fallback)
const mockAwards = [
    {
        title: "Apple Scholarship",
        category: "Higher Education",
        value: "£28,000",
        date: "2022-08-15",
        url: "/awards/apple-scholarship",
        description: "Full scholarship covering tuition for MA at Royal College of Art, London."
    }
];

const mockEducation = [
    {
        institution: 'Royal College of Art',
        location: 'London',
        degree: 'M.A (Master of Arts)',
        course: 'Digital Direction',
        start_year: '2022',
        end_year: '2023',
        details: 'Translated my personal journey of love, grief, and healing into photographs, prints, writings, and performance films. Wrote a thesis, designed a photobook, and exhibited my work at the RCA Graduate Show 2023 in London.',
        specialization: 'Explored the emotional pain of romantic rejection and the loss of a loved one, drawing parallels between both experiences and tracing how both wounds mirror each other.',
        link_text: 'Link to a repository of all the research, photography works, films and writings.',
        link_url: '/photography'
    },
    {
        institution: 'National Institute of Design',
        location: 'Ahmedabad',
        degree: 'M.Des (Master of Design)',
        course: 'Film and Video Communication',
        start_year: '2021',
        end_year: '2022',
        details: 'Crafted short films and audio stories on anxiety, healing and mental health. Left NID after a year and moved to London for a fully funded masters at the Royal College of Art.',
        specialization: null,
        link_text: 'Watch my films on mental health focused on navigating rejection anxiety, healing and therapy.',
        link_url: '/films'
    },
    {
        institution: 'National Institute of Technology',
        location: 'Rourkela',
        degree: '(B.Tech + M.Tech) Bachelor of Technology + Master of Technology',
        course: 'Mechanical Engineering',
        start_year: '2012',
        end_year: '2017',
        details: 'Made a film so compelling, the Tech Mahindra CMO wanted me on their brand team when I was 21.',
        specialization: 'Specialised in Mechatronics and Automation during my masters and worked on aerial drone photography and photogrammetry. I was the president of the film-making club where I executed film-making workshops. Served as Festival Director for Roots, a student-led creative conference; led concept design, speaker outreach, and full event execution connecting students with industry professionals.',
        link_text: null,
        link_url: null
    }
];

// --- Helper to check if Supabase is configured ---
const isSupabaseConfigured = () => {
    return import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
};

// --- Research (Key Projects) ---
const mockResearchProjects = [
    {
        title: "LLM-based Chatbot",
        description: "Experimenting with OpenRouter API to build an internal chatbot trained on my research papers and creative work. Using selective free-tier models to create AI-driven tools for analyzing social data.",
        slug: "llm-chatbot",
        href: "/research/llm-chatbot",
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000",
        tags: ["OpenRouter API", "AI Tools", "In Progress"]
    },
    {
        title: "Polaroids Table",
        description: "An interactive photo arrangement experiment—handle photographs like physical objects, sequence them on a digital table, and feel how their order changes meaning. A stepping stone for designing photo books.",
        slug: "polaroids-table",
        href: "/research/polaroids-table",
        image: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?auto=format&fit=crop&q=80&w=1000",
        tags: ["Photography", "Interaction Design", "In Progress"]
    },
    {
        title: "The Second Brain",
        description: "My personal Obsidian vault, a digital garden of interconnected thoughts, notes, and research.",
        slug: "second-brain",
        href: "/research/second-brain",
        image: "https://images.unsplash.com/photo-1456324504439-367cee10123c?auto=format&fit=crop&q=80&w=1000",
        tags: ["Knowledge Graph", "Obsidian", "Second Brain"]
    },
    {
        title: "Invisible Punctums",
        description: "An AI-driven exploration of human memory, data, and the gaps in our digital archives.",
        slug: "invisible-punctum-explanation",
        href: "/research/invisible-punctum-explanation",
        image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000",
        tags: ["AI", "Memory", "Data Vis"]
    },
    {
        title: "Do ghosts feel jealous if you miss the living ones more than them?",
        description: "Blurring the lines between the living and the dead, this project was a way to decode my minute emotional gestures around the dissonance between absence and presence.",
        slug: "do-ghosts-feel-jealous",
        href: "/research/do-ghosts-feel-jealous",
        image: "https://images.unsplash.com/photo-1516575334481-f85287c2c81d?auto=format&fit=crop&q=80&w=1000",
        tags: ["Photography", "Writing", "Performance", "Film"]
    },
    {
        title: "Visual Experiments",
        description: "A playground for creative coding, motion design, AR/VR, and 3D web experiences.",
        slug: "visual-experiments",
        href: "/visual-experiments",
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=1000",
        tags: ["Creative Coding", "Three.js", "Visual Lab"]
    }
];

export async function getResearchProjects() {
    if (!isSupabaseConfigured()) {
        return mockResearchProjects;
    }

    const { data, error } = await supabase
        .from('research')
        .select('*')
        .eq('published', true) // Filter by published
        .eq('visible', true)    // Filter by visible
        .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
        console.warn("Using mock research data due to DB error or empty table:", error);
        return mockResearchProjects;
    }

    // Map database fields to frontend structure
    const dbProjects = data.map(p => ({
        ...p,
        // Generate href from slug - slug is the single source of truth
        href: `/research/${p.slug}`,
        // Ensure tags is an array
        tags: Array.isArray(p.tags) ? p.tags : (p.tags ? p.tags.split(',') : []),
        image: p.cover_image
    }));

    // Return ONLY database projects (no mock data to avoid duplicates)
    return dbProjects;
}

// --- Research (formerly Projects) ---

export async function getProjects() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
        .from('research')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching research:', error);
        return [];
    }

    // Map database fields to frontend structure
    return data.map(p => ({
        title: p.title,
        desc: p.description,
        tags: p.tags || [],
        // If it's the internal vault, use the specific route, otherwise use dynamic slug or external link
        href: p.slug === 'obsidian-vault' ? '/research/obsidian-vault' : `/research/${p.slug}`,
        link: p.link || p.repo_link, // Keep this for external links if displayed
        slug: p.slug,
        image: p.cover_image
    }));
}

export async function getProjectBySlug(slug) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('research')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error(`Error fetching research ${slug}:`, error);
        return null;
    }
    return data;
}

// --- Photography (Table: 'photography') --- 

export async function getFeaturedPhotography() {
    if (!isSupabaseConfigured()) return mockPhotography;

    const { data, error } = await supabase
        .from('photography')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Error fetching photography:', error);
        return mockPhotography;
    }

    return data.map(project => ({
        title: project.title,
        category: project.category, // Now returns array
        image: project.cover_image,
        images: (project.gallery_images || []).map(p => p.url), // Extract real gallery images
        href: `/photography/${project.slug}`
    }));
}

export async function getAllPhotography() {
    if (!isSupabaseConfigured()) return mockPhotography;

    const { data, error } = await supabase
        .from('photography')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all photography:', error);
        return [];
    }

    return data.map(project => ({
        title: project.title,
        category: project.category,
        image: project.cover_image,
        tags: project.tags || [],
        images: (project.gallery_images || []).map(p => p.url), // Expose all images
        href: `/photography/${project.slug}`
    }));
}


export async function getPhotographyBySlug(slug) {
    if (!isSupabaseConfigured()) return null;

    // 1. Fetch Project Metadata
    const { data: project, error: projectError } = await supabase
        .from('photography')
        .select('*')
        .eq('slug', slug)
        .single();

    if (projectError || !project) return null;

    // 2. Fetch Project Photos (Simplified: From JSON Column)
    // The 'gallery_images' column now holds the array of photo objects directly.
    let photos = project.gallery_images || [];

    return {
        ...project,
        images: photos.map(p => p.url) // Extract just the URLs for the frontend
    };
}

// --- Blog (Table: 'blog') ---

export async function getRecentPosts() {
    if (!isSupabaseConfigured()) return mockPosts;

    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false })
        .limit(3);

    if (error) return mockPosts;

    return data.map(post => ({
        title: post.title,
        date: new Date(post.published_at).toLocaleDateString(),
        tags: post.tags || [],
        image: post.cover_image,
        category: post.category || [], // Add category support
        href: `/blog/${post.slug}`
    }));
}

export async function getAllPosts() {
    if (!isSupabaseConfigured()) return mockPosts.map(p => ({ ...p, pubDate: new Date(p.date), description: p.title }));

    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false });

    if (error) return mockPosts.map(p => ({ ...p, pubDate: new Date(p.date), description: p.title }));

    return data.map(post => ({
        title: post.title,
        date: new Date(post.published_at).toLocaleDateString(),
        pubDate: new Date(post.published_at),
        tags: post.tags || [],
        image: post.cover_image,
        category: post.category || [], // Add category support
        href: `/blog/${post.slug}`,
        description: post.excerpt || ''
    }));
}

export async function getPostBySlug(slug) {
    if (slug === 'how-apple-funded-my-dream-at-rca') return appleScholarshipPost;
    if (slug === 'scholarships-for-higher-studies') return scholarshipGuidePost;

    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error(`Error fetching blog post ${slug}:`, error);
        return null;
    }
    return data;
}

// Mock Content for specific static pages
const appleScholarshipPost = {
    title: 'How Apple Funded My Dream at RCA',
    slug: 'how-apple-funded-my-dream-at-rca',
    excerpt: 'In August 2022, a single email changed the trajectory of my life. Apple stepped in with a full scholarship that covered every penny of my £28,000 tuition.',
    content: `In August 2022, a single email changed the trajectory of my life. I had been accepted into the Royal College of Art in London but was struggling to figure out how I would pay for it. Then Apple stepped in, with a full scholarship. It covered every penny of my £28,000 tuition. The timing? Just a few weeks before term started. That close. It was wild!!!

I didn’t just study thanks to that scholarship, I lived. I walked into galleries, music gigs, therapy conversations, deep dives into auto-ethnography and emotional research.

I photographed everything. I asked questions about love, grief, relationships, and healing.
I made art. I found space.

That one year gave me freedom, not just from fees, but from fear.
If there’s one thing in my life I still have to pinch myself to believe, it’s this: **Apple paid for my master’s in the Royal College of Art, London.** Not just a stipend. Not a partial fee cut. The whole damn thing. Twenty-eight thousand pounds!! Deuymm!!!

When the email landed in my inbox, I remember sitting in stunned silence. Everything around me blurred. It was the first time in years I truly believed that anything could happen. Any f**king thing. I had written to them about my financial constraints, my social background, my dreams, my work. I explained. I didn’t have the answers. I just had urgency. And somehow, that was enough.

That scholarship didn’t just give me education. It gave me time. I went to every art exhibition I could find. Every music gig. I documented RCA obsessively. I explored London like someone finally allowed to breathe. I tried new technologies. I printed endlessly. I poured my energy into conversations about healing, therapy, identity, loneliness, and connection.

I researched mental health and human behaviour using myself as the subject. I used visual tools, experimental writing, soundscapes, and photos as methods of inquiry. That’s what the scholarship gave me, the freedom to go deep.

If I had paid that money in tuition, I would’ve never had this freedom. I'd have been budgeting every decision. Instead, I spent my loan on living. On learning. This year wasn’t perfect. But it was expansive.`,
    published_at: '2023-09-01', // Retroactive date
    published: true,
    category: ['Personal', 'Scholarships'],
    tags: ['Apple', 'RCA', 'Scholarship', 'London'],
    cover_image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=1000'
};

const scholarshipGuidePost = {
    title: "Everything You Need to Know About Scholarships for Higher Studies",
    slug: 'scholarships-for-higher-studies',
    excerpt: 'A comprehensive guide to scholarships for international students, including Aga Khan, Charles Wallace, and more.',
    content: `Securing funding for higher education in art and design can be daunting, but there are numerous opportunities available for international students. Here is a curated list of scholarships and funding bodies to help you pursue your dreams.

## Global & UK Specific Scholarships

### Aga Khan Foundation’s International Scholarship Programme (AKF ISP)
The Aga Khan Foundation provides a limited number of scholarships each year for postgraduate studies to outstanding students from select developing countries who have no other means of financing their studies.

### Charles Wallace India Trust Scholarships
For Indians to gain experience and deeper exposure to the arts and heritage conservation in the UK.

### Commonwealth Master’s Scholarships
Funded by the UK Foreign, Commonwealth & Development Office (FCDO), these scholarships enable talented and motivated individuals to gain the knowledge and skills required for sustainable development.

### Inlaks Scholarships
The Inlaks Shivdasani Foundation offers scholarships for young Indians to take up higher studies at top-rated American, European, and UK institutions.

## Other Notable Funds
- **Education Future International Scholarship**: For Indian students studying abroad.
- **JND TATA Endowment**: Loan scholarships for higher studies.
- **Lady Meherbai D Tata Education Trust**: For Indian women graduates.
- **KC Mahindra Trust Foundation**: Interest-free loan scholarships.
- **The Narotam Sekhsaria Foundation**: Interest-free scholarship loans.
- **National Overseas Scholarships**: Facilitated by the Ministry of Social Justice and Empowerment.

## Search Portals
These platforms are excellent resources for finding tailored opportunities:
- [MastersCompare](https://www.masterscompare.com)
- [FindAMasters](https://www.findamasters.com)
- [TopUniversities](https://www.topuniversities.com)
- [Postgrad Solutions](https://www.postgrad.com)
- [MastersPortal](https://www.mastersportal.com)
- [Chevening Scholarships](https://www.chevening.org)
- [Educations.com](https://www.educations.com)

## My Journey
I was fortunate enough to receive a full scholarship from Apple for my time at the RCA. It changed everything for me. You can read more about my personal experience here:

[**How Apple Funded My Dream at RCA**](/blog/how-apple-funded-my-dream-at-rca)

And check out my [Awards Page](/awards/apple-scholarship) for more details.`,
    published_at: new Date().toISOString(),
    published: true,
    category: ['Resources', 'Scholarships'],
    tags: ['Funding', 'Masters', 'Study Abroad'],
    cover_image: null // Fallback or placeholder
};


export async function getNextPost(currentSlug) {
    // We fetch all posts to determine the order
    // In a real optimized app, we would query Supabase for the specific next record
    // using 'published_at' < current_published_at order by published_at desc limit 1.
    // But reusing getAllPosts is simpler for now and keeps logic consistent with the list.
    const posts = await getAllPosts();
    const index = posts.findIndex(p => p.href.endsWith(`/${currentSlug}`));

    if (index !== -1 && index < posts.length - 1) {
        return posts[index + 1];
    }
    return null;
}

export async function getRelatedPost(currentSlug, category) {
    const allPosts = await getAllPosts();

    // Filter out current post
    const otherPosts = allPosts.filter(p => !p.href.endsWith(`/${currentSlug}`));

    if (otherPosts.length === 0) return null;

    // Try to find posts with matching category
    // category can be string or array
    const categoryMatches = otherPosts.filter(p => {
        if (!category || !p.category) return false;

        const currentCats = Array.isArray(category) ? category : [category];
        const postCats = Array.isArray(p.category) ? p.category : [p.category];

        return currentCats.some(c => postCats.includes(c));
    });

    // If we have matches, pick one randomly
    if (categoryMatches.length > 0) {
        return categoryMatches[Math.floor(Math.random() * categoryMatches.length)];
    }

    // Fallback: pick random from all others if no category match found
    // (Optional: could serve nothing, but "You may also like" usually wants *something*)
    return otherPosts[Math.floor(Math.random() * otherPosts.length)];
}

// --- Media Mentions (Table: 'media_mentions') ---

export async function getMediaMentions() {
    if (!isSupabaseConfigured()) {
        // Mock data fallback
        return [
            {
                title: 'When Creative Minds Collide: XY’s "Show Me The Way" Music Video Is Visual Pleasure',
                publication: 'Homegrown',
                url: 'https://homegrown.co.in/homegrown-explore/when-creative-minds-collide-xys-show-me-the-way-music-video-is-visual-pleasure',
                date: '10/01/2021',
                categories: ['Press', 'Music Video'],
                image: 'https://homegrown.co.in/public/uploads/articles/featured_image/5ff5a6873b2d6.jpg'
            },
            {
                title: 'Four roommates shot a music video in their Mumbai flat and it received a premiere on Vh1',
                publication: 'Edex Live',
                url: 'https://www.edexlive.com/breaking/2021/Jan/05/four-roommates-shot-a-music-video-in-their-mumbai-flat-and-it-received-a-premiere-on-vh1-17053.html',
                date: '05/01/2021',
                categories: ['Press', 'Interview'],
                image: 'https://gumlet.assettype.com/newindianexpress%2Fimport%2F2021%2F1%2F5%2Foriginal%2F0906_XY_1_1.jpg'
            },
            {
                title: 'Watch Electronic Pop Duo XY’s Cinematic Video for Debut Single "Show Me The Way"',
                publication: 'Rolling Stone India',
                url: 'https://rollingstoneindia.com/watch-electronic-pop-duo-xys-cinematic-video-for-debut-single-show-me-the-way/',
                date: '07/01/2021',
                categories: ['Press', 'Featured'],
                image: 'https://rollingstoneindia.com/wp-content/uploads/2021/01/XY-Show-Me-The-Way-960x639.jpg'
            }
        ];
    }

    const { data, error } = await supabase
        .from('media_mentions')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });

    if (error) {
        console.error('Error fetching media mentions:', error);
        return [];
    }

    return data.map(item => ({
        title: item.title,
        publication: item.publication,
        url: item.url,
        date: new Date(item.published_at).toLocaleDateString(),
        categories: item.categories || [],
        image: item.image_url
    }));
    return data.map(item => ({
        title: item.title,
        publication: item.publication,
        url: item.url,
        date: new Date(item.published_at).toLocaleDateString(),
        categories: item.categories || [],
        image: item.image_url
    }));
}

// --- Awards (Table: 'awards') ---

export async function getAwards() {
    if (!isSupabaseConfigured()) return mockAwards;

    const { data, error } = await supabase
        .from('awards')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching awards:', error);
        return mockAwards;
    }

    return data.map(item => ({
        title: item.title,
        category: item.category,
        value: item.value,
        date: new Date(item.date).toLocaleDateString(),
        url: item.url,
        description: item.description
    }));
}

// --- Education (Table: 'education') ---

export async function getEducation() {
    if (!isSupabaseConfigured()) return mockEducation;

    const { data, error } = await supabase
        .from('education')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching education:', error);
        return mockEducation;
    }

    return data;
}

// --- Films (Table: 'films') ---

export async function getFilms() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
        .from('films')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('year', { ascending: false });

    if (error) return [];

    return data.map(film => ({
        title: film.title,
        description: film.description,
        year: film.year,
        image: film.thumbnail_url,
        videoUrl: film.video_url,
        roles: film.roles || [],
        categories: film.categories || []
    }));
}

// --- Timeline (Table: 'about_timeline_cards') ---

export async function getTimelineCards() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
        .from('about_timeline_cards')
        .select('*')
        .order('sort_index', { ascending: true }); // 0 = newest

    if (error) {
        console.error('Error fetching timeline cards:', error);
        return [];
    }

    return data;
}

// --- Documents (Bucket: 'documents') ---

export async function getCVs() {
    if (!isSupabaseConfigured()) {
        // Mock data
        return {
            artistCV: { name: 'Artist CV (Mock)', url: '#' },
            professionalCVs: [
                { name: 'Professional CV 2024 (Mock)', url: '#' },
                { name: 'Creative Tech CV (Mock)', url: '#' }
            ]
        };
    }

    const { data, error } = await supabase
        .storage
        .from('documents')
        .list('CV');

    if (error) {
        console.error('Error fetching CVs:', error);
        return { artistCV: null, professionalCVs: [] };
    }

    // Process files
    const fileList = data.map(file => {
        const { data: publicUrlData } = supabase
            .storage
            .from('documents')
            .getPublicUrl(`CV/${file.name}`);

        return {
            name: file.name,
            url: publicUrlData.publicUrl,
            params: file // keep original meta if needed
        };
    });

    // Categorize
    // Assuming "artist" in filename means Artist CV
    const artistCV = fileList.find(f => f.name.toLowerCase().includes('artist')) || null;
    const professionalCVs = fileList.filter(f => f !== artistCV);

    return { artistCV, professionalCVs };
}

// --- Research Papers (Table: 'research_papers') ---

export async function getResearchPapers() {
    if (!isSupabaseConfigured()) {
        // Mock Data
        return [
            {
                title: 'Deep Learning in Medical Imaging',
                formatted_title: 'Deep Learning in <em>Medical Imaging</em>',
                description: 'A comprehensive study on the application of CNNs in detecting early-stage tumors.',
                explanation: 'This paper explores the use of Convolutional Neural Networks (CNNs) to analyze MRI scans for early detection of tumors. The study demonstrates a significant improvement in accuracy compared to traditional methods.',
                tags: ['AI', 'Healthcare', 'Computer Vision'],
                pdf_url: '#',
                published_at: new Date().toISOString()
            },
            {
                title: 'Sustainable Urban Planning',
                formatted_title: 'Sustainable <strong>Urban Planning</strong> for 2030',
                description: 'Strategies for reducing carbon footprints in metropolitan areas.',
                explanation: 'An in-depth analysis of urban planning strategies that focus on sustainability. The paper discusses renewable energy integration, green spaces, and efficient public transportation systems.',
                tags: ['Urban Planning', 'Sustainability', 'Environment'],
                pdf_url: '#',
                published_at: new Date().toISOString()
            },
            {
                title: 'Quantum Computing Algorithms',
                formatted_title: 'Quantum Computing <span>Algorithms</span>',
                description: 'Exploring the potential of quantum supremacy in cryptography.',
                explanation: 'A technical breakdown of quantum algorithms and their impact on modern cryptographic security. The paper proposes new encryption standards resistant to quantum attacks.',
                tags: ['Quantum Computing', 'Cryptography', 'Physics', 'AI'], // Overlap for testing
                pdf_url: '#',
                published_at: new Date().toISOString()
            },
            {
                title: 'Another AI Paper',
                formatted_title: 'Another <em>AI</em> Paper',
                description: 'Testing the filter logic.',
                explanation: 'Just a mock paper to test multiple tags.',
                tags: ['AI', 'Testing'],
                pdf_url: '#',
                published_at: new Date().toISOString()
            }
        ];
    }

    const { data, error } = await supabase
        .from('research_papers')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });

    if (error) {
        console.error('Error fetching research papers:', error);
        return [];
    }

    return data;
}

// --- Page Metadata (Table: 'page_metadata') ---

export async function getPageMetadata(pagePath) {
    if (!isSupabaseConfigured()) return null;

    try {
        const { data, error } = await supabase
            .from('page_metadata')
            .select('*')
            .eq('page_path', pagePath)
            .eq('is_active', true)
            .single();

        if (error) {
            // Not finding metadata is not necessarily an error - page might not have custom metadata
            if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Error fetching page metadata:', error);
            }
            return null;
        }

        return data;
    } catch (e) {
        console.error('Failed to fetch page metadata:', e);
        return null;
    }
}

export async function getAllPageMetadata() {
    if (!isSupabaseConfigured()) return [];

    try {
        const { data, error } = await supabase
            .from('page_metadata')
            .select('*')
            .eq('is_active', true)
            .order('page_path', { ascending: true });

        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Failed to fetch all page metadata:', e);
        return [];
    }
}

export async function updatePageMetadata(id, updates) {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

    try {
        const { data, error } = await supabase
            .from('page_metadata')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        console.error('Failed to update page metadata:', e);
        return { success: false, error: e.message };
    }
}

export async function createPageMetadata(metadata) {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

    try {
        const { data, error } = await supabase
            .from('page_metadata')
            .insert([metadata])
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (e) {
        console.error('Failed to create page metadata:', e);
        return { success: false, error: e.message };
    }
}

export async function deletePageMetadata(id) {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

    try {
        const { error } = await supabase
            .from('page_metadata')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Failed to delete page metadata:', e);
        return { success: false, error: e.message };
    }
}

