import { supabase } from './supabaseClient';
import { featuredStories as mockStories, recentPosts as mockPosts } from '../utils/mockData';

// Helper to check if Supabase is configured
const isSupabaseConfigured = () => {
    return import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
};

// --- Stories ---

export async function getFeaturedStories() {
    if (!isSupabaseConfigured()) return mockStories;

    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Error fetching stories:', error);
        return mockStories;
    }

    // Map DB fields to UI fields if necessary
    return data.map(story => ({
        title: story.title,
        category: story.category,
        image: story.cover_image,
        href: `/portfolio/${story.slug}`
    }));
}

export async function getAllStories() {
    if (!isSupabaseConfigured()) return mockStories; // Return all mock stories helper if we had one

    const { data, error } = await supabase
        .from('stories')
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
        href: `/portfolio/${story.slug}`
    }));
}

export async function getStoryBySlug(slug) {
    if (!isSupabaseConfigured()) return null;

    // 1. Fetch Story Metadata
    const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('slug', slug)
        .single();

    if (storyError || !story) return null;

    // 2. Fetch Story Photos
    const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('url, caption')
        .eq('story_id', story.id)
        .order('sort_order', { ascending: true });

    return {
        ...story,
        images: photos ? photos.map(p => p.url) : []
    };
}

// --- Blog Posts ---

export async function getRecentPosts() {
    if (!isSupabaseConfigured()) return mockPosts;

    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(3);

    if (error) return mockPosts;

    return data.map(post => ({
        title: post.title,
        date: new Date(post.published_at).toLocaleDateString(),
        href: `/blog/${post.slug}` // Assumes blog uses slug routing
    }));
}

export async function getPostBySlug(slug) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error(`Error fetching post ${slug}:`, error);
        return null;
    }
    return data;
}

// --- Films ---

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
        videoUrl: film.video_url
    }));
}
