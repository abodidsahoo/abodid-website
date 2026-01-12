import { supabase } from './supabaseClient';
import { featuredStories as mockStories, recentPosts as mockPosts } from '../utils/mockData';

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

    return data.map(p => ({
        title: p.title,
        desc: p.description,
        tags: p.tags || [],
        link: p.link || p.repo_link,
        slug: p.slug,
        href: `/research/${p.slug}`,
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

// --- Stories (Table: 'photography') --- 

export async function getFeaturedStories() {
    if (!isSupabaseConfigured()) return mockStories;

    const { data, error } = await supabase
        .from('photography')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Error fetching stories:', error);
        return mockStories;
    }

    return data.map(story => ({
        title: story.title,
        category: story.category,
        image: story.cover_image,
        href: `/photography/${story.slug}`
    }));
}

export async function getAllStories() {
    if (!isSupabaseConfigured()) return mockStories;

    const { data, error } = await supabase
        .from('photography')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all stories:', error);
        return [];
    }

    return data.map(story => ({
        title: story.title,
        category: story.category,
        image: story.cover_image,
        href: `/photography/${story.slug}`
    }));
}


export async function getStoryBySlug(slug) {
    if (!isSupabaseConfigured()) return null;

    // 1. Fetch Story Metadata
    const { data: story, error: storyError } = await supabase
        .from('photography')
        .select('*')
        .eq('slug', slug)
        .single();

    if (storyError || !story) return null;

    // 2. Fetch Story Photos (Table: 'photography_images' - formerly photos)
    // NOTE: Keeping 'photography' table for metadata. 
    // Assuming 'photos' table is where images live? 
    // Wait, previous code used 'photography' table for the story metadata.
    // And 'photos' table for the images linked by story_id.
    const { data: photos, error: photosError } = await supabase
        .from('photos') // Keep this as 'photos' unless user requested otherwise
        .select('url, caption')
        .eq('story_id', story.id)
        .order('sort_order', { ascending: true });

    return {
        ...story,
        images: photos ? photos.map(p => p.url) : []
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
        href: `/blog/${post.slug}`
    }));
}

export async function getPostBySlug(slug) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('journal')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error(`Error fetching journal post ${slug}:`, error);
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
        role: film.role
    }));
}
