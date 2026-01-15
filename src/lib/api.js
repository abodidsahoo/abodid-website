import { supabase } from './supabaseClient';
import { featuredPhotography as mockPhotography, recentPosts as mockPosts } from '../utils/mockData';

// --- Helper to check if Supabase is configured ---
const isSupabaseConfigured = () => {
    return import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
};

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
        image: p.image
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
        href: `/photography/${project.slug}`
    }));
}

export async function getAllPhotography() {
    if (!isSupabaseConfigured()) return mockPhotography;

    const { data, error } = await supabase
        .from('photography')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all photography:', error);
        return [];
    }

    return data.map(project => ({
        title: project.title,
        category: project.category,
        image: project.cover_image,
        tags: project.tags || [], // Legacy or unused if category is array
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
        .order('published_at', { ascending: false })
        .limit(3);

    if (error) return mockPosts;

    return data.map(post => ({
        title: post.title,
        date: new Date(post.published_at).toLocaleDateString(),
        tags: post.tags || [],
        category: post.category || [], // Add category support
        href: `/blog/${post.slug}`
    }));
}

export async function getAllPosts() {
    if (!isSupabaseConfigured()) return mockPosts;

    const { data, error } = await supabase
        .from('blog')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });

    if (error) return mockPosts;

    return data.map(post => ({
        title: post.title,
        date: new Date(post.published_at).toLocaleDateString(),
        tags: post.tags || [],
        category: post.category || [], // Add category support
        href: `/blog/${post.slug}`
    }));
}

export async function getPostBySlug(slug) {
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

// --- Films (Table: 'films') ---

export async function getFilms() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
        .from('films')
        .select('*')
        .eq('published', true)
        .order('year', { ascending: false });

    if (error) return [];

    return data.map(film => ({
        title: film.title,
        description: film.description,
        year: film.year,
        image: film.thumbnail_url,
        videoUrl: film.video_url,
        role: film.role,
        genre: film.genre
    }));
}
