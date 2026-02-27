import { supabase } from '../supabaseClient';
import { isSupabaseConfigured } from './utils';
import type { Project, PhotographyProject, BlogPost, Film, ResearchPaper, WorkExperience, ServiceItem } from './types';
import { featuredPhotography as mockPhotography, recentPosts as mockPosts } from '../../utils/mockData';

// Mock Data for Research (from api.js)
const mockResearchProjects: Project[] = [
    {
        title: "LLM-based Chatbot",
        description: "Experimenting with OpenRouter API to build an internal chatbot trained on my research papers and creative work. Using selective free-tier models to create AI-driven tools for analyzing social data.",
        slug: "llm-chatbot",
        href: "/research/llm-chatbot",
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000",
        tags: ["OpenRouter API", "AI Tools", "In Progress"],
        published: true,
    },
    {
        title: "Polaroid Hub",
        description: "An interactive photo arrangement experiment—handle photographs like physical objects, sequence them on a digital table, and feel how their order changes meaning. A stepping stone for designing photo books.",
        slug: "polaroid-hub",
        href: "/research/polaroid-hub",
        image: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?auto=format&fit=crop&q=80&w=1000",
        tags: ["Photography", "Interaction Design", "In Progress"],
        published: true,
    },
    {
        title: "The Second Brain",
        description: "My personal Obsidian vault, a digital garden of interconnected thoughts, notes, and research.",
        slug: "second-brain",
        href: "/research/second-brain",
        image: "https://images.unsplash.com/photo-1456324504439-367cee10123c?auto=format&fit=crop&q=80&w=1000",
        tags: ["Knowledge Graph", "Obsidian", "Second Brain"],
        published: true,
    },
    {
        title: "Invisible Punctums",
        description: "An AI-driven exploration of human memory, data, and the gaps in our digital archives.",
        slug: "invisible-punctum",
        href: "/research/invisible-punctum",
        image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000",
        tags: ["AI", "Memory", "Data Vis"],
        published: true,
    },
    {
        title: "Do ghosts feel jealous if you miss the living ones more than them?",
        description: "Blurring the lines between the living and the dead, this project was a way to decode my minute emotional gestures around the dissonance between absence and presence.",
        slug: "do-ghosts-feel-jealous",
        href: "/research/do-ghosts-feel-jealous",
        image: "https://images.unsplash.com/photo-1516575334481-f85287c2c81d?auto=format&fit=crop&q=80&w=1000",
        tags: ["Photography", "Writing", "Performance", "Film"],
        published: true,
    }
];

// --- Research ---
export async function getResearchProjects(): Promise<Project[]> {
    if (!isSupabaseConfigured() || !supabase) {
        return mockResearchProjects;
    }

    const { data, error } = await supabase
        .from('research')
        .select('*')
        .eq('published', true)
        .eq('visible', true)
        .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
        console.warn("Using mock research data due to DB error or empty table:", error);
        return mockResearchProjects;
    }

    return data.map((p: any) => {
        const normalizedSlug =
            p.slug === 'invisible-punctum-explanation'
                ? 'invisible-punctum'
                : p.slug;
        return {
            ...p,
            slug: normalizedSlug,
            href: `/research/${normalizedSlug}`,
            tags: Array.isArray(p.tags) ? p.tags : (p.tags ? p.tags.split(',') : []),
            image: p.cover_image
        };
    });
}

export async function getProjects(): Promise<Project[]> {
    if (!isSupabaseConfigured() || !supabase) return [];

    const { data, error } = await supabase
        .from('research')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching research:', error);
        return [];
    }

    return data.map((p: any) => {
        const normalizedSlug =
            p.slug === 'invisible-punctum-explanation'
                ? 'invisible-punctum'
                : p.slug;
        return {
            title: p.title,
            description: p.description,
            tags: p.tags || [],
            href:
                normalizedSlug === 'obsidian-vault'
                    ? '/research/obsidian-vault'
                    : `/research/${normalizedSlug}`,
            link: p.link || p.repo_link,
            slug: normalizedSlug,
            image: p.cover_image,
            published: p.published
        } as Project;
    });
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

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

// --- Photography ---
// Important: mockPhotography from utils might allow implicit "any", we cast it for safety
export async function getFeaturedPhotography(): Promise<PhotographyProject[]> {
    if (!isSupabaseConfigured() || !supabase) return mockPhotography as unknown as PhotographyProject[];

    const { data, error } = await supabase
        .from('photography')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching photography:', error);
        return mockPhotography as unknown as PhotographyProject[];
    }

    return data.map((project: any) => ({
        title: project.title,
        category: project.category,
        image: project.cover_image,
        href: `/photography/${project.slug}`,
        slug: project.slug,
        published: project.published
    } as PhotographyProject));
}

export async function getAllPhotography(): Promise<PhotographyProject[]> {
    if (!isSupabaseConfigured() || !supabase) return mockPhotography as unknown as PhotographyProject[];

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

    return data.map((project: any) => ({
        title: project.title,
        category: project.category,
        image: project.cover_image,
        tags: project.tags || [],
        images: (project.gallery_images || []).map((p: any) => p.url),
        href: `/photography/${project.slug}`,
        slug: project.slug,
        published: project.published
    } as PhotographyProject));
}

export async function getPhotographyBySlug(slug: string): Promise<PhotographyProject | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    const { data: project, error: projectError } = await supabase
        .from('photography')
        .select('*')
        .eq('slug', slug)
        .single();

    if (projectError || !project) return null;

    let photos = project.gallery_images || [];

    return {
        ...project,
        image: project.cover_image,
        images: photos.map((p: any) => p.url)
    } as PhotographyProject;
}

// --- Blog ---
export async function getRecentPosts(): Promise<BlogPost[]> {
    if (!isSupabaseConfigured() || !supabase) return mockPosts as unknown as BlogPost[];

    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false })
        .limit(3);

    if (error) return mockPosts as unknown as BlogPost[];

    return data.map((post: any) => ({
        title: post.title,
        date: new Date(post.published_at).toLocaleDateString(),
        tags: post.tags || [],
        image: post.cover_image,
        category: post.category || [],
        href: `/blog/${post.slug}`,
        slug: post.slug,
        published: post.published,
        description: post.excerpt || '',
        published_at: post.published_at
    } as BlogPost));
}

export async function getAllPosts(): Promise<BlogPost[]> {
    // Basic mapping for mockPosts
    const mappedMock = mockPosts.map((p: any) => ({
        ...p,
        pubDate: new Date(p.date),
        description: p.title,
        published_at: new Date(p.date).toISOString()
    }));

    if (!isSupabaseConfigured() || !supabase) return mappedMock as unknown as BlogPost[];

    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false });

    if (error) return mappedMock as unknown as BlogPost[];

    return data.map((post: any) => ({
        title: post.title,
        date: new Date(post.published_at).toLocaleDateString(),
        pubDate: new Date(post.published_at),
        tags: post.tags || [],
        image: post.cover_image,
        category: post.category || [],
        href: `/blog/${post.slug}`,
        description: post.excerpt || '',
        slug: post.slug,
        published: post.published,
        published_at: post.published_at
    } as BlogPost));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

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

export async function getNextPost(currentSlug: string): Promise<BlogPost | null> {
    const posts = await getAllPosts();
    const index = posts.findIndex(p => p.href.endsWith(`/${currentSlug}`));

    if (index !== -1 && index < posts.length - 1) {
        return posts[index + 1];
    }
    return null;
}

export async function getRelatedPost(currentSlug: string, category: string | string[]): Promise<BlogPost | null> {
    const allPosts = await getAllPosts();
    const otherPosts = allPosts.filter(p => !p.href.endsWith(`/${currentSlug}`));

    if (otherPosts.length === 0) return null;

    const categoryMatches = otherPosts.filter(p => {
        if (!category || !p.category) return false;
        const currentCats = Array.isArray(category) ? category : [category];
        const postCats = Array.isArray(p.category) ? p.category : [p.category];
        return currentCats.some(c => postCats.includes(c));
    });

    if (categoryMatches.length > 0) {
        return categoryMatches[Math.floor(Math.random() * categoryMatches.length)];
    }

    return otherPosts[Math.floor(Math.random() * otherPosts.length)];
}

// --- Films ---
export async function getFilms(): Promise<Film[]> {
    if (!isSupabaseConfigured() || !supabase) return [];

    const { data, error } = await supabase
        .from('films')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('year', { ascending: false });

    if (error) return [];

    return data.map((film: any) => ({
        title: film.title,
        description: film.description,
        year: film.year,
        image: film.thumbnail_url,
        videoUrl: film.video_url,
        roles: film.roles || [],
        categories: film.categories || [],
        published: film.published
    } as Film));
}

// --- Research Papers ---
export async function getResearchPapers(): Promise<ResearchPaper[]> { // Using any for rough typing for now unless we add ResearchPaper type
    if (!isSupabaseConfigured() || !supabase) {
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
                tags: ['Quantum Computing', 'Cryptography', 'Physics', 'AI'],
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
        ] as any;
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

// --- Work Experience ---
export async function getWorkExperience(): Promise<WorkExperience[]> {
    if (!isSupabaseConfigured() || !supabase) {
        // Mock Data
        return [
            {
                role: 'Exhibition Experience Designer',
                company: 'Royal College of Art',
                duration: '2023 - 2025',
                description: 'Designed immersive physical and digital exhibition spaces for degree shows. Led the spatial planning and visitor journey for over 500 exhibits.',
                category: 'work',
                sort_order: 10,
                published: true
            },
            {
                role: 'Lead Photographer',
                company: 'Royal College of Art',
                duration: '2023 - 2025',
                description: 'Documented high-end and creative venues including the British Film Institute, Ollama, London, Frameless, RCA Graduate shows, International Body of Art, and Flat Time House.',
                category: 'work',
                sort_order: 20,
                published: true
            },
            {
                role: 'Creative Producer, Director, and Editor',
                company: 'Multiple Brands & MNCs',
                duration: '2017 - 2021',
                description: 'Produced content for select clients including Hermosa Art Design Studio, Wieden+Kennedy, Budweiser, Jawa Motorcycles, Pursuit of Portraits (New York), Uniqlo, and Odisha Tourism.',
                category: 'work',
                sort_order: 30,
                published: true
            },
            {
                role: 'Founder and Creative Director',
                company: 'Visual Notes Creative Agency (India)',
                duration: '2014 - 2017',
                description: 'Led a creative agency focused on UX design, promotional content, photography, brand films, and logo design. Shutdown operations in 2017 upon relocating to Mumbai.',
                category: 'work',
                sort_order: 40,
                published: true
            },
            {
                role: 'MA Information Experience Design',
                company: 'Royal College of Art',
                duration: '2023 – 2025',
                description: 'Exploring the intersection of data, design, and narrative. Focused on creating immersive installations and experimental interfaces that challenge traditional modes of information consumption.',
                category: 'education',
                sort_order: 10,
                published: true
            },
            {
                role: 'Master of Design',
                company: 'National Institute of Design',
                duration: '2019 - 2021',
                description: 'Specialized in New Media Design. Developed a strong foundation in interaction design, creative coding, and user experience, culminating in projects that bridge physical and digital realms.',
                category: 'education',
                sort_order: 20,
                published: true
            },
            {
                role: 'Bachelor of Arts',
                company: 'University of Creative Arts',
                duration: '2015 - 2018',
                description: 'Major in Film Making. Gained comprehensive experience in visual storytelling, cinematography, and post-production, laying the groundwork for a multidisciplinary creative practice.',
                category: 'education',
                sort_order: 30,
                published: true
            },
            {
                role: 'Apple Scholarship',
                company: 'Royal College of Art',
                duration: '2022',
                description: 'Awarded a full scholarship covering the entire tuition fees of £20,000 for the MA program at the Royal College of Art.',
                category: 'award',
                sort_order: 10,
                published: true
            },
            {
                role: 'BSA Conference 2026',
                company: 'University of Manchester',
                duration: '2026',
                description: 'Selected to present two papers at the British Sociological Association conference.',
                category: 'conference',
                sort_order: 20,
                published: true
            },
            {
                role: 'Cambridge Data School',
                company: 'Cambridge University',
                duration: '2026',
                description: 'Participant in the Cambridge Data School program.',
                category: 'conference',
                sort_order: 30,
                published: true
            }
        ] as WorkExperience[];
    }

    const { data, error } = await supabase
        .from('work_experience')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching work experience:', error);
        return [];
    }

    return data as WorkExperience[];
}

// --- Services ---
export async function getServices(): Promise<ServiceItem[]> {
    if (!isSupabaseConfigured() || !supabase) {
        return [
            {
                category: 'offer',
                title: 'What I have to offer',
                content: 'Comprehensive creative services bridging design, technology, and storytelling.',
                items: [
                    "Commissioned visual storytelling for brands, editorials, and projects.",
                    "Visual narratives for publications and digital media.",
                    "Brand identity and campaign photography.",
                    "Intimate and honest captures of the human depth (Portrait).",
                    "Immersive physical and digital exhibition spaces.",
                    "UX Design and Prototyping for novel interactions."
                ],
                sort_order: 10,
                published: true
            },
            {
                category: 'skills',
                title: 'Creative & Research',
                items: [
                    "Photography (portrait, documentary, product, events)",
                    "Visual analysis",
                    "Image annotation & descriptive writing",
                    "Lighting",
                    "Video Editing",
                    "Metacognitive Communication",
                    "Teaching"
                ],
                sort_order: 20,
                published: true
            },
            {
                category: 'tools',
                title: 'Technical Toolkit',
                items: [
                    "Lightroom",
                    "Photoshop",
                    "Illustrator",
                    "Premiere Pro",
                    "DaVinci Resolve",
                    "DSLR & mirrorless systems",
                    "Colour grading",
                    "Retouching",
                    "HTML/CSS (working)",
                    "Generative AI workflows (Midjourney, Veo)"
                ],
                sort_order: 30,
                published: true
            }
        ] as ServiceItem[];
    }

    const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching services:', error);
        return [];
    }

    return data as ServiceItem[];
}
